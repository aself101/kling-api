/**
 * Save a task's outputs to disk (spec D14).
 *
 *   save(task, dir, { includeWatermark?, signal?, fetch?, timeoutMs?, force?, request? })
 *     → the paths written
 *
 * Refuses a task whose derived `outputsExpireAt` has passed (`KlingOutputsExpiredError`,
 * unless `force`) BEFORE any fetch — the vendor clears URLs after 30 days and a 404 from
 * the CDN is less useful than the reason. A `succeeded` task with no outputs is
 * `KlingNoOutputsError`. Files are `<task.id>-<index>.<ext>` with `ext` from the
 * response `Content-Type`, else the URL's extension, else `bin`; a sidecar
 * `<task.id>.json` records `{ product, standard, request, outputs, raw }` (only after every
 * download succeeded — a failed save throws `KlingSaveError { written }` instead). Per-download
 * deadline: 120 s for videos, 60 s for images/audio, or `timeoutMs`. `request` is
 * the handle's redacted record, so a 20 MB inline frame is a `{ kind, bytes, sha256 }`
 * triple here, not a second copy (run #3 architect F-5). Every download goes through
 * `fetchToBuffer` and its byte / redirect / per-hop SSRF guards. Import graph (§5):
 * `codecs/task`, `media/download`, `http/errors`, `utils/*`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { SaveOptions, Task, TaskOutput } from '../codecs/task.js';
import { KlingNoOutputsError, KlingOutputsExpiredError, KlingSaveError, KlingValidationError } from '../http/errors.js';
import { fetchToBuffer } from '../media/download.js';
import { MAX_VIDEO_SIZE, MEDIA_DOWNLOAD_TIMEOUT, VIDEO_DOWNLOAD_TIMEOUT } from '../utils/constants.js';


interface Download {
  url: string;
  label: string;
  /** Videos get the longer default deadline (120 s); images/audio 60 s. */
  video: boolean;
}

/**
 * The vendor's task id becomes a path component below, so it must be exactly one path
 * segment. The codecs only require a non-empty string, and a callback body parsed without
 * a secret is untrusted input — an id carrying a parent-directory segment would otherwise
 * escape `dir` (ship run #4, code-auditor). Every live id seen is a 15–18 digit number.
 */
const SAFE_ID = /^[A-Za-z0-9._-]{1,200}$/;

export async function save(task: Task, dir: string, options: SaveOptions = {}): Promise<string[]> {
  const now = options.now ?? Date.now;
  if (task.status !== 'succeeded') throw new KlingNoOutputsError(task);
  if (task.outputs.length === 0) throw new KlingNoOutputsError(task);
  if (!options.force && task.outputsExpireAt !== undefined && task.outputsExpireAt < now()) throw new KlingOutputsExpiredError(task);
  if (!SAFE_ID.test(task.id) || task.id === '.' || task.id === '..') {
    throw new KlingValidationError('task.id', `task id ${JSON.stringify(task.id)} is not a single safe path segment; refusing to use it as a file name`);
  }

  const downloads = task.outputs.flatMap((o) => downloadsFor(o, options.includeWatermark === true));
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const [index, d] of downloads.entries()) {
    let res;
    try {
      res = await fetchToBuffer(d.url, {
        maxBytes: options.maxBytes ?? MAX_VIDEO_SIZE,
        timeoutMs: options.timeoutMs ?? defaultDownloadTimeoutMs(d.video),
        signal: options.signal,
        fetch: options.fetch,
        lookup: options.lookup,
      });
    } catch (cause) {
      // The caller's own abort stays theirs; everything else reports what is already on disk.
      if (options.signal?.aborted && cause === options.signal.reason) throw cause;
      throw new KlingSaveError(task, written, d.url, cause);
    }
    const file = join(dir, `${task.id}-${index}${d.label}.${extensionFor(res.contentType, res.finalUrl)}`);
    writeFileSync(file, res.buffer);
    written.push(file);
  }
  const sidecar = join(dir, `${task.id}.json`);
  writeFileSync(
    sidecar,
    JSON.stringify({ product: task.product, standard: task.standard, request: options.request, outputs: task.outputs, files: written, raw: task.raw }, null, 2)
  );
  written.push(sidecar);
  return written;
}

/** Per-download deadline when `timeoutMs` is not given: 120 s for a video, 60 s for an image or audio file. */
export function defaultDownloadTimeoutMs(video: boolean): number {
  return video ? VIDEO_DOWNLOAD_TIMEOUT : MEDIA_DOWNLOAD_TIMEOUT;
}

/** The URLs one output contributes: the primary, plus the watermarked variant when asked. Element/voice outputs have no downloadable file. */
function downloadsFor(o: TaskOutput, includeWatermark: boolean): Download[] {
  const out: Download[] = [];
  switch (o.type) {
    case 'video':
    case 'image': {
      const video = o.type === 'video';
      out.push({ url: o.url, label: '', video });
      if (includeWatermark && o.watermarkUrl) out.push({ url: o.watermarkUrl, label: '-watermark', video });
      break;
    }
    case 'audio':
      if (o.mp3Url) out.push({ url: o.mp3Url, label: '', video: false });
      if (o.wavUrl) out.push({ url: o.wavUrl, label: '-wav', video: false });
      break;
    case 'voice':
      if (o.url) out.push({ url: o.url, label: '-preview', video: false });
      break;
    case 'element':
      break;
  }
  return out;
}

const CONTENT_TYPE_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
};

/** `Content-Type` → known extension; else the URL path's extension; else `bin`. */
export function extensionFor(contentType: string | undefined, url: string): string {
  const mime = contentType?.split(';')[0].trim().toLowerCase();
  if (mime && CONTENT_TYPE_EXT[mime]) return CONTENT_TYPE_EXT[mime];
  try {
    const ext = extname(new URL(url).pathname).replace('.', '').toLowerCase();
    if (/^[a-z0-9]{1,5}$/.test(ext)) return ext;
  } catch {
    // AUDIT-OK(no_empty_catch): not a URL — the `bin` fallback below is the documented answer.
  }
  return 'bin';
}
