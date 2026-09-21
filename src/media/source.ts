/**
 * Media input resolution (spec D12). URL / Base64 (2a₃) and `{ path }` / `Buffer` /
 * `Uint8Array` (2c: read, extension, magic bytes, dimensions, then Base64).
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
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { INLINE_MEDIA_CAP_BYTES, INLINE_MEDIA_AGGREGATE_CAP_BYTES, MIN_IMAGE_DIMENSION_PX, MAX_IMAGE_ASPECT, SUPPORTED_AUDIO_EXTENSIONS, SUPPORTED_IMAGE_EXTENSIONS } from '../config/constants.js';
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
    return inlineBytes(Buffer.from(src.buffer, src.byteOffset, src.byteLength), kind, undefined, standard, options);
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
    if ('path' in src) {
      shapeExtension(src.path, kind, field);
      let bytes: Buffer;
      try {
        bytes = readFileSync(src.path);
      } catch (cause) {
        throw new KlingValidationError(field, `${field}: cannot read ${src.path} (${cause instanceof Error ? cause.message : String(cause)})`, { cause });
      }
      return inlineBytes(bytes, kind, src.path, standard, options);
    }
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

/**
 * Bytes from a file or a Buffer: cap by size FIRST (cheap, and the message the caller
 * most needs), then the vendor's content rules — magic bytes and, for images, ≥ 300 px
 * per side and an aspect ratio within 1:2.5 – 2.5:1 (every video/image page states
 * these). Base64 is produced only after the checks pass.
 */
function inlineBytes(bytes: Buffer, kind: MediaKind, path: string | undefined, standard: Standard, options: ResolveOptions): ResolvedMedia {
  const { field } = options;
  const cap = INLINE_MEDIA_CAP_BYTES[standard];
  if (bytes.byteLength > cap) {
    throw new KlingValidationError(field, `${field} is ${formatMB(bytes.byteLength)}, over the ${formatMB(cap)} inline cap for the ${standard} standard — host the file and pass a URL`);
  }
  if (kind === 'image') {
    const info = sniffImage(bytes);
    if (!info) throw new KlingValidationError(field, `${field}${path ? ` (${path})` : ''} is not a PNG or JPEG (magic bytes) — the vendor accepts .jpg, .jpeg, .png`);
    if (info.width !== undefined && info.height !== undefined) {
      if (info.width < MIN_IMAGE_DIMENSION_PX || info.height < MIN_IMAGE_DIMENSION_PX) {
        throw new KlingValidationError(field, `${field} is ${info.width}×${info.height} px; the vendor requires at least ${MIN_IMAGE_DIMENSION_PX} px on each side`);
      }
      const ratio = info.width / info.height;
      if (ratio > MAX_IMAGE_ASPECT || ratio < 1 / MAX_IMAGE_ASPECT) {
        throw new KlingValidationError(field, `${field} aspect ratio ${ratio.toFixed(2)} is outside the vendor's 1:${MAX_IMAGE_ASPECT} – ${MAX_IMAGE_ASPECT}:1 range`);
      }
    }
  } else if (kind === 'audio') {
    if (!sniffAudio(bytes)) throw new KlingValidationError(field, `${field}${path ? ` (${path})` : ''} is not MP3, WAV, M4A or AAC (magic bytes)`);
  }
  const base64 = bytes.toString('base64');
  options.budget?.charge(base64.length, field);
  return { base64 };
}

function shapeExtension(path: string, kind: MediaKind, field: string): void {
  const ext = extname(path).toLowerCase().replace('.', '');
  const allowed = kind === 'image' ? SUPPORTED_IMAGE_EXTENSIONS : SUPPORTED_AUDIO_EXTENSIONS;
  if (!allowed.includes(ext)) throw new KlingValidationError(field, `${field}: unsupported ${kind} extension ".${ext}" — the vendor accepts ${allowed.map((e) => `.${e}`).join(', ')}`);
}

export interface ImageInfo {
  format: 'png' | 'jpeg';
  width?: number;
  height?: number;
}

/** PNG (IHDR) and JPEG (first SOFn marker) headers; dimensions undefined when a JPEG has no SOF before the scan. */
export function sniffImage(b: Buffer): ImageInfo | undefined {
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { format: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return { format: 'jpeg' };
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2;
        continue;
      }
      const len = b.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { format: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      if (marker === 0xda) break; // start of scan without SOF — malformed; give up on dimensions
      i += 2 + len;
    }
    return { format: 'jpeg' };
  }
  return undefined;
}

/** MP3 (ID3 tag or MPEG sync), WAV (RIFF/WAVE), M4A (ftyp box), AAC (ADTS sync). */
export function sniffAudio(b: Buffer): boolean {
  if (b.length < 12) return false;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true; // ID3
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true; // MPEG audio sync (MP3 frame or ADTS AAC)
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE') return true;
  if (b.toString('latin1', 4, 8) === 'ftyp') return true; // MP4 container (m4a)
  return false;
}
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
