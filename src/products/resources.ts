/**
 * Resources on the legacy standard (spec D8; App. C §7): elements, voices, avatar, TTS.
 * Every create here was probed live with the API Key in Phase 0 (checklist A5) — that is
 * the gate these modules ship under.
 */
import {
  buildAvatarCreate,
  buildElementCreate,
  buildTts,
  buildVoiceCreate,
  parseCreate,
  parseList,
  parseTask,
  type LegacyBody,
} from '../codecs/legacy.js';
import type {
  AvatarCreateParams,
  ElementCreateParams,
  ElementDeleteOptions,
  MediaSource,
  TtsParams,
  VoiceCreateParams,
} from '../codecs/params.js';
import type {
  PageOptions,
  Product,
  RequestOptions,
  Task,
  TaskHandle,
  TaskOutput,
} from '../codecs/task.js';
import {
  validateAvatarCreate,
  validateElementCreate,
  validatePage,
  validateTts,
  validateVoiceCreate,
} from '../config/validators/resources.js';
import type { HttpCore } from '../http/core.js';
import { KlingTaskFailedError } from '../http/errors.js';
import { MediaBudget, resolveMediaSource, type ResolvedMedia } from '../media/source.js';
import { createTimeoutMs, recordOf, redactList, redactMedia, type ProductApiConfig } from './shared.js';
import { LEGACY_PRODUCT_PATHS, TasksApi, createHandle, resolveExternalId } from './tasks.js';

/** Paths the routing table does not carry: presets and deletes are not task products. */
export const RESOURCE_PATHS = {
  elementPresets: '/v1/general/advanced-presets-elements',
  elementDeleteVideo: '/v1/general/delete-advanced-elements',
  elementDeleteImage: '/v1/general/delete-elements',
  voicePresets: '/v1/general/presets-voices',
  voiceDelete: '/v1/general/delete-voices',
  tts: '/v1/audio/tts',
} as const;

const asField = (m: ResolvedMedia) => ('url' in m ? m.url : m.base64);

/**
 * What a delete answers. The docs promise `data { task_id, task_status }`; the live API
 * answers `code 0` with NO `data` at all [LIVE 2026-09-20, both element delete paths], so
 * `taskId` / `status` are optional and `code 0` alone is success. A second delete of the
 * same id is `400 / 1201 "Element already be deleted for id: …"` — a `KlingAPIError`.
 */
export interface DeleteResult {
  taskId?: string;
  status?: Task['status'];
  requestId?: string;
  /** The vendor envelope, untouched. */
  raw: unknown;
}

abstract class LegacyResourceApi {
  protected readonly core: HttpCore;
  protected readonly config: ProductApiConfig;
  protected readonly tasks: TasksApi;

  constructor(core: HttpCore, config: ProductApiConfig) {
    this.core = core;
    this.config = config;
    this.tasks = new TasksApi(core, config.logger);
  }

  protected warn = (m: string): void => this.config.logger.warn(m);

  protected async submit(
    product: Product,
    body: LegacyBody,
    externalId: string | undefined,
    signal: AbortSignal | undefined,
    record: Record<string, unknown>
  ): Promise<TaskHandle> {
    const res = await this.core.request({
      method: 'POST',
      path: LEGACY_PRODUCT_PATHS[product as keyof typeof LEGACY_PRODUCT_PATHS],
      body,
      kind: 'write',
      externalId,
      signal,
      timeoutMs: createTimeoutMs(this.core.timeout, Buffer.byteLength(JSON.stringify(body))),
    });
    const task = parseCreate(res.envelope, { product, warn: this.warn });
    return createHandle(this.core, this.config.logger, product, task.id, record, externalId);
  }

  protected async listAt(
    path: string,
    product: Product,
    options: PageOptions,
    maxPageSize: number
  ): Promise<Task[]> {
    validatePage(options.pageNum, options.pageSize, maxPageSize);
    const res = await this.core.request({
      method: 'GET',
      path,
      query: { pageNum: options.pageNum, pageSize: options.pageSize },
      kind: 'read',
      signal: options.signal,
    });
    return parseList(res.envelope, { product, warn: this.warn });
  }

  /** A delete is a WRITE (mutates). `code 0` is success whether or not `data` is present. */
  protected async remove(
    path: string,
    body: LegacyBody,
    product: Product,
    signal: AbortSignal | undefined
  ): Promise<DeleteResult> {
    const res = await this.core.request({ method: 'POST', path, body, kind: 'write', signal });
    const out: DeleteResult = { raw: res.envelope };
    if (res.requestId !== undefined) out.requestId = res.requestId;
    const data = res.envelope.data;
    if (
      typeof data === 'object' &&
      data !== null &&
      typeof (data as { task_id?: unknown }).task_id === 'string'
    ) {
      const task = parseCreate(res.envelope, { product, warn: this.warn });
      out.taskId = task.id;
      out.status = task.status;
    }
    return out;
  }
}

/** `client.elements` — the element library: `create` (image_refer / video_refer), `get`, `list`, `presets`, `delete(id, { kind })`. */
export class ElementsApi extends LegacyResourceApi {
  /** `POST /v1/general/advanced-custom-elements` → handle (product `element`); `wait()` yields one `element` output. */
  async create(params: ElementCreateParams): Promise<TaskHandle> {
    validateElementCreate(params);
    const budget = new MediaBudget();
    const image = (src: MediaSource, field: string) =>
      resolveMediaSource(src, { kind: 'image', standard: 'legacy', field, budget });
    const frontal =
      params.frontalImage === undefined ? undefined : image(params.frontalImage, 'frontalImage');
    const refers = params.referImages?.map((src, i) => image(src, `referImages[${i}]`));
    const videos = params.referVideos?.map((v, i) =>
      resolveMediaSource(v, { kind: 'video', standard: 'legacy', field: `referVideos[${i}]` })
    );
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildElementCreate(
      params,
      {
        frontalImage: frontal && asField(frontal),
        referImages: refers?.map(asField),
        referVideos: videos?.map(asField),
      },
      externalId
    );
    const record = recordOf({
      ...params,
      frontalImage: frontal && params.frontalImage && redactMedia(params.frontalImage, frontal),
      referImages: redactList(params.referImages, refers, redactMedia),
      referVideos: redactList(params.referVideos, videos, redactMedia),
    });
    return this.submit('element', body, externalId, params.signal, record);
  }

  /** `GET /v1/general/advanced-custom-elements/{id}` — the creation TASK id (the element id is inside `outputs[0]`). */
  get(taskId: string, options?: RequestOptions): Promise<Task> {
    return this.tasks.getByProduct('element', taskId, options);
  }

  list(options: PageOptions = {}): Promise<Task[]> {
    return this.tasks.listByProduct('element', options);
  }

  /** `GET /v1/general/advanced-presets-elements` — the official library. */
  presets(options: PageOptions = {}): Promise<Task[]> {
    return this.listAt(RESOURCE_PATHS.elementPresets, 'element', options, 500);
  }

  /**
   * Delete a custom element by ELEMENT id (not task id). Two vendor paths exist for one
   * surface (App. C §7.9): `kind: 'video'` (default) → `/v1/general/delete-advanced-elements`,
   * `kind: 'image'` → `/v1/general/delete-elements`. Whether they share a library is §11 Q7.
   */
  delete(elementId: string, options: ElementDeleteOptions = {}): Promise<DeleteResult> {
    const path =
      options.kind === 'image'
        ? RESOURCE_PATHS.elementDeleteImage
        : RESOURCE_PATHS.elementDeleteVideo;
    return this.remove(path, { element_id: elementId }, 'element', options.signal);
  }
}

/** `client.voices` — the voice library: `create` (voiceUrl XOR videoId), `get`, `list`, `presets`, `delete`. Not the TTS voice catalogue. */
export class VoicesApi extends LegacyResourceApi {
  /** `POST /v1/general/custom-voices` → handle (product `voice`); `wait()` yields one `voice` output. */
  async create(params: VoiceCreateParams): Promise<TaskHandle> {
    validateVoiceCreate(params);
    const externalId = resolveExternalId(params.externalTaskId);
    return this.submit(
      'voice',
      buildVoiceCreate(params, externalId),
      externalId,
      params.signal,
      recordOf({ ...params })
    );
  }

  get(taskId: string, options?: RequestOptions): Promise<Task> {
    return this.tasks.getByProduct('voice', taskId, options);
  }

  /** `pageSize` 1–1000 on the voice endpoints (App. C §7.10) — enforced in `tasks.listByProduct`. */
  list(options: PageOptions = {}): Promise<Task[]> {
    return this.tasks.listByProduct('voice', options);
  }

  presets(options: PageOptions = {}): Promise<Task[]> {
    return this.listAt(RESOURCE_PATHS.voicePresets, 'voice', options, 1000);
  }

  /** Delete a custom voice by VOICE id. */
  delete(voiceId: string, options: RequestOptions = {}): Promise<DeleteResult> {
    return this.remove(RESOURCE_PATHS.voiceDelete, { voice_id: voiceId }, 'voice', options.signal);
  }
}

/** `client.avatar` — a talking-head video from a portrait and a sound (`audioId` XOR `soundFile`). */
export class AvatarApi extends LegacyResourceApi {
  /** `POST /v1/videos/avatar/image2video` → handle (product `avatar`). */
  async create(params: AvatarCreateParams): Promise<TaskHandle> {
    validateAvatarCreate(params);
    const budget = new MediaBudget();
    const image = resolveMediaSource(params.image, {
      kind: 'image',
      standard: 'legacy',
      field: 'image',
      budget,
    });
    const sound =
      params.soundFile === undefined
        ? undefined
        : resolveMediaSource(params.soundFile, {
            kind: 'audio',
            standard: 'legacy',
            field: 'soundFile',
            budget,
          });
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildAvatarCreate(
      params,
      { image: asField(image), soundFile: sound && asField(sound) },
      externalId
    );
    const record = recordOf({
      ...params,
      image: redactMedia(params.image, image),
      soundFile: sound && redactMedia(params.soundFile!, sound),
    });
    return this.submit('avatar', body, externalId, params.signal, record);
  }
}

/** `client.audio` — text-to-speech; synchronous, returns `audio` outputs directly (no task, no external id). */
export class AudioApi extends LegacyResourceApi {
  /**
   * `POST /v1/audio/tts` — SYNCHRONOUS: the response already carries `task_result.audios`
   * (D8). Returns the `audio` outputs directly; there is no task to poll and no external
   * id to recover by, so a lost response is a lost 0.05 units. A `failed` record throws
   * `KlingTaskFailedError`.
   */
  async tts(params: TtsParams): Promise<TaskOutput[]> {
    validateTts(params);
    const res = await this.core.request({
      method: 'POST',
      path: RESOURCE_PATHS.tts,
      body: buildTts(params),
      kind: 'write',
      signal: params.signal,
    });
    const task = parseTask(res.envelope, { warn: this.warn });
    if (task.status === 'failed') throw new KlingTaskFailedError(task, null);
    return task.outputs;
  }
}
