/**
 * Image surface — legacy standard, API Key (spec D7, D9, D10, D12).
 *
 * Same pipeline as `products/video.ts` — resolve model → caps → validate → external id →
 * build → WRITE → parse → handle — against `/v1/images/*` and `/v1/general/ai-multi-shot`,
 * with the legacy codec and the 10 MB legacy inline cap. Query goes through the handle
 * to `GET /v1/<product>/{id}` (routing table in `products/tasks.ts`).
 */
import {
  buildImageGeneration,
  buildMultiImageToImage,
  buildOmniImage,
  buildOutpaint,
  buildSubjectCompletion,
  parseCreate,
  type LegacyBody,
} from '../codecs/legacy.js';
import type {
  ImageGenerateParams,
  MediaSource,
  MultiImageToImageParams,
  OmniImageParams,
  OutpaintParams,
  SubjectCompletionParams,
} from '../codecs/params.js';
import type { Product, TaskHandle } from '../codecs/task.js';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_OMNI_IMAGE_MODEL,
  MULTI_IMAGE_MODEL,
} from '../config/models.js';
import type { ValidationPolicy } from '../config/validators/helpers.js';
import {
  resolveImageCaps,
  validateImageGenerate,
  validateMultiImageToImage,
  validateOmniImage,
  validateOutpaint,
  validateSubjectCompletion,
} from '../config/validators/image.js';
import type { HttpCore } from '../http/core.js';
import { MediaBudget, resolveMediaSource, type ResolvedMedia } from '../media/source.js';
import { LEGACY_PRODUCT_PATHS, createHandle, resolveExternalId } from './tasks.js';
import { createTimeoutMs, recordOf, redactMedia, type ProductApiConfig } from './shared.js';

/** `client.image` — generation, omni image, multi-image, outpainting and subject completion on the legacy `/v1/` standard (spec D7). */
export class ImageApi {
  readonly #core: HttpCore;
  readonly #config: ProductApiConfig;

  constructor(core: HttpCore, config: ProductApiConfig) {
    this.#core = core;
    this.#config = config;
  }

  #policy(): ValidationPolicy {
    return {
      unknownModels: this.#config.unknownModels,
      capabilityValidation: this.#config.capabilityValidation,
      warn: (m) => this.#config.logger.warn(m),
    };
  }

  /** `POST /v1/images/generations` (D7). Default `kling-v3`. */
  async generate(params: ImageGenerateParams): Promise<TaskHandle> {
    const model = params.model ?? DEFAULT_IMAGE_MODEL;
    const policy = this.#policy();
    validateImageGenerate({ ...params, model }, resolveImageCaps(model, policy), policy);
    const budget = new MediaBudget();
    const image =
      params.image === undefined ? undefined : this.#image(params.image, 'image', budget);
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildImageGeneration(params, model, image && field(image), externalId);
    return this.#create(
      'image-generation',
      body,
      externalId,
      params.signal,
      recordOf({ ...params, model, image: image && redactMedia(params.image!, image) }),
      policy
    );
  }

  /** `POST /v1/images/omni-image` (D7). Default `kling-v3-omni` (§10.2). */
  async omni(params: OmniImageParams): Promise<TaskHandle> {
    const model = params.model ?? DEFAULT_OMNI_IMAGE_MODEL;
    const policy = this.#policy();
    validateOmniImage({ ...params, model }, resolveImageCaps(model, policy), policy);
    const budget = new MediaBudget();
    const images = params.images?.map((src, i) => this.#image(src, `images[${i}]`, budget));
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildOmniImage(params, model, images?.map(field), externalId);
    return this.#create(
      'omni-image',
      body,
      externalId,
      params.signal,
      recordOf({
        ...params,
        model,
        images: images?.map((r, i) => redactMedia(params.images![i], r)),
      }),
      policy
    );
  }

  /** `POST /v1/images/multi-image2image` (D7). The endpoint documents one model, `kling-v2-1`; there is no model parameter. */
  async multiImageToImage(params: MultiImageToImageParams): Promise<TaskHandle> {
    const policy = this.#policy();
    validateMultiImageToImage(params, policy);
    const budget = new MediaBudget();
    const subjectImages = params.subjectImages.map((src, i) =>
      this.#image(src, `subjectImages[${i}]`, budget)
    );
    const sceneImage =
      params.sceneImage === undefined
        ? undefined
        : this.#image(params.sceneImage, 'sceneImage', budget);
    const styleImage =
      params.styleImage === undefined
        ? undefined
        : this.#image(params.styleImage, 'styleImage', budget);
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildMultiImageToImage(
      params,
      MULTI_IMAGE_MODEL,
      {
        subjectImages: subjectImages.map(field),
        sceneImage: sceneImage && field(sceneImage),
        styleImage: styleImage && field(styleImage),
      },
      externalId
    );
    const record = recordOf({
      ...params,
      model: MULTI_IMAGE_MODEL,
      subjectImages: subjectImages.map((r, i) => redactMedia(params.subjectImages[i], r)),
      sceneImage: sceneImage && redactMedia(params.sceneImage!, sceneImage),
      styleImage: styleImage && redactMedia(params.styleImage!, styleImage),
    });
    return this.#create('multi-image-to-image', body, externalId, params.signal, record, policy);
  }

  /** `POST /v1/images/editing/expand` (D7; renamed from 1.x `expandImage` — D3). */
  async outpaint(params: OutpaintParams): Promise<TaskHandle> {
    const policy = this.#policy();
    validateOutpaint(params);
    const image = this.#image(params.image, 'image', new MediaBudget());
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildOutpaint(params, field(image), externalId);
    return this.#create(
      'outpainting',
      body,
      externalId,
      params.signal,
      recordOf({ ...params, image: redactMedia(params.image, image) }),
      policy
    );
  }

  /** `POST /v1/general/ai-multi-shot` (D7) — three views of a subject from one frontal image; feeds element creation. */
  async subjectCompletion(params: SubjectCompletionParams): Promise<TaskHandle> {
    const policy = this.#policy();
    validateSubjectCompletion(params);
    const frontal = this.#image(params.frontalImage, 'frontalImage', new MediaBudget());
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildSubjectCompletion(params, field(frontal), externalId);
    return this.#create(
      'subject-completion',
      body,
      externalId,
      params.signal,
      recordOf({ ...params, frontalImage: redactMedia(params.frontalImage, frontal) }),
      policy
    );
  }

  #image(src: MediaSource, fieldName: string, budget: MediaBudget): ResolvedMedia {
    return resolveMediaSource(src, { kind: 'image', standard: 'legacy', field: fieldName, budget });
  }

  async #create(
    product: Product,
    body: LegacyBody,
    externalId: string | undefined,
    signal: AbortSignal | undefined,
    record: Record<string, unknown>,
    policy: ValidationPolicy
  ): Promise<TaskHandle> {
    const path = LEGACY_PRODUCT_PATHS[product as keyof typeof LEGACY_PRODUCT_PATHS];
    const res = await this.#core.request({
      method: 'POST',
      path,
      body,
      kind: 'write',
      externalId,
      signal,
      timeoutMs: createTimeoutMs(this.#core.timeout, Buffer.byteLength(JSON.stringify(body))),
    });
    const task = parseCreate(res.envelope, { product, warn: policy.warn });
    return createHandle(this.#core, this.#config.logger, product, task.id, record, externalId);
  }
}

/** The vendor takes a URL or a Base64 string in the same field. */
function field(media: ResolvedMedia): string {
  return 'url' in media ? media.url : media.base64;
}
