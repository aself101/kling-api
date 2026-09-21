/**
 * Media input resolution (spec D12). 2a₃ ships the URL / Base64 half; 2c adds `{ path }`,
 * `Buffer` and `Uint8Array` (read, extension, magic bytes, dimensions) and the download
 * side. Until then those inputs throw a `KlingValidationError` that says so.
 *
 * The one rule that is fully in force from day one: **a bare string is never a
 * filesystem path.** 1.x read any string that `existsSync` matched, so a server passing
 * user input to `imageToVideo` would read from its own disk (run #1 A8). Here a string is
 * an https URL or Base64, and anything else is rejected without touching the filesystem.
 *
 * Caps are per standard and DECIMAL megabytes (10 000 000 / 20 000 000 bytes) so a file
 * that passes is under the vendor's limit whichever unit the vendor means; the aggregate
 * cap (40 MB of encoded payload per request) guards the unpublished edge body limit
 * (run #3 A45). Import graph (§5): `http/errors`, `utils/security`, `config/constants`,
 * `codecs/params` (the MediaSource type).
 */
import type { MediaSource } from '../codecs/params.js';
import type { Standard } from '../codecs/task.js';
import { INLINE_MEDIA_CAP_BYTES, INLINE_MEDIA_AGGREGATE_CAP_BYTES } from '../config/constants.js';
import { KlingValidationError } from '../http/errors.js';

export type MediaKind = 'image' | 'video' | 'audio';

export type ResolvedMedia = { url: string } | { base64: string };

/** Per-request accumulator for the aggregate inline cap. One per create call. */
export class MediaBudget {
  #used = 0;
  readonly limit: number;

  constructor(limit = INLINE_MEDIA_AGGREGATE_CAP_BYTES) {
    this.limit = limit;
  }

  get used(): number {
    return this.#used;
  }

  /** Charge `encodedBytes` against the budget; throws when the request would exceed it. */
  charge(encodedBytes: number, field: string): void {
    if (this.#used + encodedBytes > this.limit) {
      throw new KlingValidationError(
        field,
        `inline media for this request would total ${formatMB(this.#used + encodedBytes)} encoded, over the ${formatMB(this.limit)} aggregate cap — host the files and pass URLs instead`
      );
    }
    this.#used += encodedBytes;
  }
}

export interface ResolveOptions {
  kind: MediaKind;
  standard: Standard;
  /** Parameter name, for error messages. */
  field: string;
  /** Shared across every media input of one request (aggregate cap). */
  budget?: MediaBudget;
}

/**
 * Turn a `MediaSource` into what the vendor accepts: a URL, or a Base64 string.
 * Video inputs accept only a URL — the Kling API has no upload endpoint.
 */
export function resolveMediaSource(src: MediaSource, options: ResolveOptions): ResolvedMedia {
  const { kind, standard, field } = options;

  if (typeof src === 'string') {
    if (isHttpsUrl(src)) return { url: src };
    if (kind === 'video') throw videoMustBeUrl(field);
    const base64 = stripDataPrefix(src);
    if (isBase64(base64)) return inline(base64, standard, options);
    throw new KlingValidationError(
      field,
      `${field} must be an https URL or a Base64 string; a filesystem path is never read from a bare string — pass { path: '…' } to read a local file`
    );
  }

  if (src instanceof Uint8Array) {
    if (kind === 'video') throw videoMustBeUrl(field);
    throw notYet(field, 'Buffer / Uint8Array');
  }

  if (typeof src === 'object' && src !== null) {
    if ('url' in src) {
      if (!isHttpsUrl(src.url)) throw new KlingValidationError(field, `${field}.url must be an https URL`);
      return { url: src.url };
    }
    if (kind === 'video') throw videoMustBeUrl(field);
    if ('base64' in src) {
      const base64 = stripDataPrefix(src.base64);
      if (!isBase64(base64)) throw new KlingValidationError(field, `${field}.base64 is not valid Base64`);
      return inline(base64, standard, options);
    }
    if ('path' in src) throw notYet(field, '{ path }');
  }

  throw new KlingValidationError(field, `${field} is not a MediaSource (https URL, Base64 string, { url }, { base64 }, { path }, Buffer or Uint8Array)`);
}

function inline(base64: string, standard: Standard, options: ResolveOptions): ResolvedMedia {
  const decodedBytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  const cap = INLINE_MEDIA_CAP_BYTES[standard];
  if (decodedBytes > cap) {
    const why =
      standard === 'legacy'
        ? 'the vendor documents a 10 MB limit on /v1/ image endpoints'
        : 'a larger Base64 payload inflates the JSON body past what an unpublished edge limit is known to accept';
    throw new KlingValidationError(options.field, `${options.field} decodes to ${formatMB(decodedBytes)}, over the ${formatMB(cap)} inline cap for the ${standard} standard — ${why}; host the file and pass a URL`);
  }
  options.budget?.charge(base64.length, options.field);
  return { base64 };
}

const notYet = (field: string, what: string) =>
  new KlingValidationError(field, `${field}: ${what} inputs are not supported on this build yet (Phase 2c) — pass an https URL or a Base64 string`);
const videoMustBeUrl = (field: string) => new KlingValidationError(field, `${field} must be a URL; the Kling API has no upload endpoint for video`);

export function isHttpsUrl(s: string): boolean {
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Optional `data:<mime>;base64,` prefix removed. */
export function stripDataPrefix(s: string): string {
  const m = /^data:[^;,]+;base64,/.exec(s);
  return m ? s.slice(m[0].length) : s;
}

/** Standard alphabet, length ≡ 0 mod 4, padding only at the end. Long enough not to be a path by accident. */
export function isBase64(s: string): boolean {
  return s.length >= 8 && s.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

const formatMB = (bytes: number) => `${(bytes / 1_000_000).toFixed(bytes % 1_000_000 === 0 ? 0 : 1)} MB`;
