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
import { createHash } from 'node:crypto';
import { buildImageToVideo, buildTextToVideo, parseCreate, type NewStandardBody } from '../codecs/new-standard.js';
import type { ImageToVideoParams, MediaSource, TextToVideoParams } from '../codecs/params.js';
import type { Product, TaskHandle } from '../codecs/task.js';
import { DEFAULT_VIDEO_MODEL } from '../config/models.js';
import { resolveVideoCaps, type ValidationPolicy } from '../config/validators/helpers.js';
import { validateImageToVideo, validateTextToVideo } from '../config/validators/video.js';
import type { HttpCore, KlingConfig, Logger } from '../http/core.js';
import { MediaBudget, resolveMediaSource, type ResolvedMedia } from '../media/source.js';
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
    return this.#create(product, model, body, externalId, params.signal, recordOf({ ...params, model }), policy);
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
    const firstFrame = resolveMediaSource(params.firstFrame, { kind: 'image', standard: 'new', field: 'firstFrame', budget });
    const lastFrame = params.lastFrame === undefined ? undefined : resolveMediaSource(params.lastFrame, { kind: 'image', standard: 'new', field: 'lastFrame', budget });
    const externalId = resolveExternalId(params.externalTaskId);
    const body = buildImageToVideo(params, { firstFrame: asUrlField(firstFrame), lastFrame: lastFrame && asUrlField(lastFrame) }, externalId, policy.warn);
    const record = recordOf({ ...params, model, firstFrame: redactMedia(params.firstFrame, firstFrame), lastFrame: params.lastFrame === undefined ? undefined : redactMedia(params.lastFrame, lastFrame!) });
    return this.#create(product, model, body, externalId, params.signal, record, policy);
  }

  /** The write, shared by every new-standard create: deadline scaled to the body, parse, handle. */
  async #create(product: Product, model: string, body: NewStandardBody, externalId: string | undefined, signal: AbortSignal | undefined, record: Record<string, unknown>, policy: ValidationPolicy): Promise<TaskHandle> {
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

/**
 * A create's per-attempt deadline grows with the body (spec D11): a 20 MB Base64 frame
 * cannot be written in the 30 s a JSON-only create gets. `max(configured, 30 s + 4 s per MB)`
 * — 250 000 bytes per second of allowance.
 */
export function createTimeoutMs(configuredMs: number, bodyBytes: number): number {
  return Math.max(configuredMs, 30_000 + Math.round(bodyBytes / 250));
}

/** The vendor takes a URL or a Base64 string in the same `url` field ("URL or Base64"). */
function asUrlField(media: ResolvedMedia): string {
  return 'url' in media ? media.url : media.base64;
}

/**
 * What the handle's `request` (and the saver's sidecar, D4) records for a media input:
 * a URL is kept as-is — it is what the vendor was told and is not secret; inline data is
 * reduced to `{ kind, bytes, sha256 }` so a 20 MB frame does not become a 27 MB sidecar
 * (run #3 architect F-5).
 */
export function redactMedia(source: MediaSource, resolved: ResolvedMedia): Record<string, unknown> {
  if ('url' in resolved) return { kind: 'url', url: resolved.url };
  const bytes = Buffer.from(resolved.base64, 'base64');
  const origin = typeof source === 'string' ? 'base64' : source instanceof Uint8Array ? 'buffer' : 'path' in source ? 'path' : 'base64';
  return { kind: origin, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
}

/**
 * The params as recorded on the handle (and later in the saver's sidecar, D4): `signal`
 * dropped, `undefined` dropped, `externalTaskId` dropped (the resolved value is on the
 * handle). Callers pass media fields already through `redactMedia`.
 */
export function recordOf(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (NON_RECORD_KEYS.has(k) || k === 'externalTaskId' || v === undefined) continue;
    out[k] = v;
  }
  return out;
}
