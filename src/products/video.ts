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
import { buildTextToVideo, parseCreate } from '../codecs/new-standard.js';
import type { TextToVideoParams } from '../codecs/params.js';
import type { Product, TaskHandle } from '../codecs/task.js';
import { DEFAULT_VIDEO_MODEL } from '../config/models.js';
import { resolveVideoCaps, type ValidationPolicy } from '../config/validators/helpers.js';
import { validateTextToVideo } from '../config/validators/video.js';
import type { HttpCore, KlingConfig, Logger } from '../http/core.js';
import { createHandle, resolveExternalId } from './tasks.js';

export interface VideoApiConfig {
  logger: Logger;
  unknownModels: NonNullable<KlingConfig['unknownModels']>;
  capabilityValidation: NonNullable<KlingConfig['capabilityValidation']>;
}

/** Keys that never belong in the handle's `request` record. */
const NON_RECORD_KEYS: ReadonlySet<string> = new Set(['signal']);

export class VideoApi {
  readonly #core: HttpCore;
  readonly #config: VideoApiConfig;

  constructor(core: HttpCore, config: VideoApiConfig) {
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

  /** `POST /text-to-video/<model>` (D6). Default model `kling-3.0-turbo` (§10.11). */
  async textToVideo(params: TextToVideoParams): Promise<TaskHandle> {
    const product: Product = 'text-to-video';
    const model = params.model ?? DEFAULT_VIDEO_MODEL;
    const policy = this.#policy();
    const caps = resolveVideoCaps(model, policy);
    validateTextToVideo({ ...params, model }, caps, policy);
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildTextToVideo(params, externalId);
    const res = await this.#core.request({
      method: 'POST',
      path: `/text-to-video/${encodeURIComponent(model)}`,
      body,
      kind: 'write',
      externalId,
      signal: params.signal,
    });
    const task = parseCreate(res.envelope, { product, warn: policy.warn });
    return createHandle(this.#core, this.#config.logger, product, task.id, recordOf({ ...params, model }), externalId);
  }
}

/**
 * The params as recorded on the handle (and later in the saver's sidecar, D4): `signal`
 * dropped, `undefined` dropped, `externalTaskId` dropped (the resolved value is on the
 * handle). Media fields are redacted by `redactMedia` in 2a₃ when the first media-bearing
 * product lands; t2v has none.
 */
export function recordOf(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (NON_RECORD_KEYS.has(k) || k === 'externalTaskId' || v === undefined) continue;
    out[k] = v;
  }
  return out;
}
