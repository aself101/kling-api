/**
 * Helpers shared by the product modules (`products/video.ts`, `products/image.ts`).
 * Import graph (§5): `codecs/*`, `media/*`, `http/*`, `node:*`.
 */
import { createHash } from 'node:crypto';
import type { MediaSource } from '../codecs/params.js';
import type { KlingConfig, Logger } from '../http/core.js';
import type { ResolvedMedia } from '../media/source.js';

export interface ProductApiConfig {
  logger: Logger;
  unknownModels: NonNullable<KlingConfig['unknownModels']>;
  capabilityValidation: NonNullable<KlingConfig['capabilityValidation']>;
}

/** Keys that never belong in the handle's `request` record. */
const NON_RECORD_KEYS: ReadonlySet<string> = new Set(['signal']);

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

/**
 * A create's per-attempt deadline grows with the body (spec D11): a 20 MB Base64 frame
 * cannot be written in the 30 s a JSON-only create gets. `max(configured, 30 s + 4 s per MB)`
 * — 250 000 bytes per second of allowance.
 */
export function createTimeoutMs(configuredMs: number, bodyBytes: number): number {
  return Math.max(configuredMs, 30_000 + Math.round(bodyBytes / 250));
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

