/**
 * Video surface — new standard only (spec D6, D9, D10, D12).
 *
 * Each method: resolve the model → look up its capability row (or warn/throw for an
 * unknown id, D9) → validate → resolve the external id → build the body through the
 * codec → `POST /<product>/<model>` as a WRITE (never re-sent after a response, D10) →
 * parse the create → hand back a `TaskHandle`. The `request` recorded on the handle is
 * the normalized params with media fields redacted to `{ kind, bytes, sha256 }` HERE,
 * before `createHandle` — `products/tasks.ts` never sees media (run #3 architect F-5).
 * Import graph (§5): `http/*`, `codecs/*`, `config/*`, `media/*`, `products/tasks`.
 */
import {
  buildImageToVideo,
  buildMotionControl,
  buildOmniVideo,
  buildTextToVideo,
  parseCreate,
  type NewStandardBody,
} from '../codecs/new-standard.js';
import type {
  ImageToVideoParams,
  MediaSource,
  MotionControlParams,
  OmniVideoParams,
  TextToVideoParams,
} from '../codecs/params.js';
import type { Product, TaskHandle } from '../codecs/task.js';
import {
  DEFAULT_MOTION_CONTROL_MODEL,
  DEFAULT_OMNI_VIDEO_MODEL,
  DEFAULT_VIDEO_MODEL,
} from '../config/models.js';
import { resolveVideoCaps, type ValidationPolicy } from '../config/validators/helpers.js';
import {
  validateImageToVideo,
  validateMotionControl,
  validateOmniVideo,
  validateTextToVideo,
} from '../config/validators/video.js';
import type { HttpCore } from '../http/core.js';
import { MediaBudget, resolveMediaSource, type ResolvedMedia } from '../media/source.js';
import { createTimeoutMs, recordOf, redactMedia, type ProductApiConfig } from './shared.js';
import { createHandle, resolveExternalId } from './tasks.js';

/** `client.video` — text-to-video, image-to-video, omni video and motion control on the new API standard (spec D6). */
export class VideoApi {
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

  /**
   * @example
   * ```ts
   * const handle = await client.video.textToVideo({ prompt: 'a paper boat on a canal', duration: 5 });
   * const task = await handle.wait();          // KlingPollTimeoutError leaves it running and billed
   * const files = await client.save(task, 'output');
   * ```
   */
  /** `POST /text-to-video/<model>` (D6). Default model `kling-3.0-turbo` (§10.11). */
  async textToVideo(params: TextToVideoParams): Promise<TaskHandle> {
    const product: Product = 'text-to-video';
    const model = params.model ?? DEFAULT_VIDEO_MODEL;
    const policy = this.#policy();
    const caps = resolveVideoCaps(model, policy);
    validateTextToVideo({ ...params, model }, caps, policy);
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildTextToVideo(params, externalId);
    return this.#create(
      product,
      model,
      body,
      externalId,
      params.signal,
      recordOf({ ...params, model }),
      policy
    );
  }

  /**
   * `POST /image-to-video/<model>` (D6). `firstFrame` / `lastFrame` are `MediaSource`s
   * (D12) resolved here — URL or Base64 — under the new-standard cap and the per-request
   * aggregate budget; the handle's `request` carries them redacted (`redactMedia`).
   */
  async imageToVideo(params: ImageToVideoParams): Promise<TaskHandle> {
    const product: Product = 'image-to-video';
    const model = params.model ?? DEFAULT_VIDEO_MODEL;
    const policy = this.#policy();
    const caps = resolveVideoCaps(model, policy);
    validateImageToVideo({ ...params, model }, caps, policy);
    const budget = new MediaBudget();
    const firstFrame = resolveMediaSource(params.firstFrame, {
      kind: 'image',
      standard: 'new',
      field: 'firstFrame',
      budget,
    });
    const lastFrame =
      params.lastFrame === undefined
        ? undefined
        : resolveMediaSource(params.lastFrame, {
            kind: 'image',
            standard: 'new',
            field: 'lastFrame',
            budget,
          });
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildImageToVideo(
      params,
      { firstFrame: asUrlField(firstFrame), lastFrame: lastFrame && asUrlField(lastFrame) },
      externalId,
      policy.warn
    );
    const record = recordOf({
      ...params,
      model,
      firstFrame: redactMedia(params.firstFrame, firstFrame),
      lastFrame:
        params.lastFrame === undefined ? undefined : redactMedia(params.lastFrame, lastFrame!),
    });
    return this.#create(product, model, body, externalId, params.signal, record, policy);
  }

  /**
   * `POST /omni-video/<model>` (D6). Default `kling-3.0-omni`. Frames and reference
   * images are `MediaSource`s (URL or Base64, shared budget); reference videos are URLs.
   */
  async omni(params: OmniVideoParams): Promise<TaskHandle> {
    const product: Product = 'omni-video';
    const model = params.model ?? DEFAULT_OMNI_VIDEO_MODEL;
    const policy = this.#policy();
    const caps = resolveVideoCaps(model, policy);
    validateOmniVideo({ ...params, model }, caps, policy);
    const budget = new MediaBudget();
    const image = (src: MediaSource, field: string) =>
      resolveMediaSource(src, { kind: 'image', standard: 'new', field, budget });
    const firstFrame =
      params.firstFrame === undefined ? undefined : image(params.firstFrame, 'firstFrame');
    const lastFrame =
      params.lastFrame === undefined ? undefined : image(params.lastFrame, 'lastFrame');
    const referImages = params.referImages?.map((r, i) => image(r.source, `referImages[${i}]`));
    for (const [field, v] of [
      ['featureVideo', params.featureVideo],
      ['baseVideo', params.baseVideo],
    ] as const) {
      if (v) resolveMediaSource(v.url, { kind: 'video', standard: 'new', field });
    }
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildOmniVideo(
      params,
      {
        firstFrame: firstFrame && asUrlField(firstFrame),
        lastFrame: lastFrame && asUrlField(lastFrame),
        referImages: referImages?.map(asUrlField),
      },
      externalId,
      policy.warn
    );
    const record = recordOf({
      ...params,
      model,
      // Each redaction reads the SAME array the resolved list was derived from, once — a
      // second `params.x![i]` lookup would re-assert an invariant the compiler cannot see
      // and would silently break if the derivation ever filtered (ship run #5, type-safety).
      firstFrame: firstFrame && params.firstFrame && redactMedia(params.firstFrame, firstFrame),
      lastFrame: lastFrame && params.lastFrame && redactMedia(params.lastFrame, lastFrame),
      referImages: referImages?.map((r, i) => {
        const ref = params.referImages?.[i];
        return {
          ...(ref?.id ? { id: ref.id } : {}),
          ...(ref ? { source: redactMedia(ref.source, r) } : {}),
        };
      }),
    });
    return this.#create(product, model, body, externalId, params.signal, record, policy);
  }

  /** `POST /motion-control/<model>` (D6). Default `kling-3.0`. `image` is a `MediaSource`; `video` is a URL. */
  async motionControl(params: MotionControlParams): Promise<TaskHandle> {
    const product: Product = 'motion-control';
    const model = params.model ?? DEFAULT_MOTION_CONTROL_MODEL;
    const policy = this.#policy();
    const caps = resolveVideoCaps(model, policy);
    validateMotionControl({ ...params, model }, caps, policy);
    const budget = new MediaBudget();
    const image = resolveMediaSource(params.image, {
      kind: 'image',
      standard: 'new',
      field: 'image',
      budget,
    });
    const video = resolveMediaSource(params.video, {
      kind: 'video',
      standard: 'new',
      field: 'video',
    });
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildMotionControl(
      params,
      { image: asUrlField(image), video: asUrlField(video) },
      externalId,
      policy.warn
    );
    const record = recordOf({
      ...params,
      model,
      image: redactMedia(params.image, image),
      video: redactMedia(params.video, video),
    });
    return this.#create(product, model, body, externalId, params.signal, record, policy);
  }

  /** The write, shared by every new-standard create: deadline scaled to the body, parse, handle. */
  async #create(
    product: Product,
    model: string,
    body: NewStandardBody,
    externalId: string | undefined,
    signal: AbortSignal | undefined,
    record: Record<string, unknown>,
    policy: ValidationPolicy
  ): Promise<TaskHandle> {
    const res = await this.#core.request({
      method: 'POST',
      path: `/${product}/${encodeURIComponent(model)}`,
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

/** The vendor takes a URL or a Base64 string in the same `url` field ("URL or Base64"). */
function asUrlField(media: ResolvedMedia): string {
  return 'url' in media ? media.url : media.base64;
}
