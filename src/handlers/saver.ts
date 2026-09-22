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
 * `fetchToFile` (streamed) and its byte / redirect / per-hop SSRF guards. Import graph (§5):
 * `codecs/task`, `media/download`, `http/errors`, `utils/*`.
 */
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { SaveOptions, Task, TaskOutput } from '../codecs/task.js';
import {
  KlingNoOutputsError,
  KlingOutputsExpiredError,
  KlingSaveError,
  KlingValidationError,
} from '../http/errors.js';
import { fetchToFile } from '../media/download.js';
import {
  MAX_VIDEO_SIZE,
  MEDIA_DOWNLOAD_TIMEOUT,
  VIDEO_DOWNLOAD_TIMEOUT,
} from '../utils/constants.js';

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

/**
 * Download every output of a `succeeded` task into `dir` and write the `<id>.json` sidecar;
 * returns the paths written. Throws `KlingNoOutputsError`, `KlingOutputsExpiredError` (unless
 * `force`), `KlingValidationError('task.id')`, or `KlingSaveError { written }` when a download
 * fails part-way. `client.save()` is this with the client's fetch and timeout.
 */
/**
 * @param task A `succeeded` task; `task.id` must be a single path segment (it becomes the file name).
 * @param dir Target directory, created if absent.
 * @param options `force` to save past the derived expiry, `timeoutMs` to override the per-download
 *   deadline (120 s video / 60 s otherwise), `fetch` to supply the transport.
 * @returns Absolute paths written — every output plus the `<id>.json` sidecar.
 * @example
 * ```ts
 * try {
 *   const files = await save(task, 'output');
 * } catch (err) {
 *   if (err instanceof KlingSaveError) {
 *     await Promise.all(err.written.map((f) => rm(f)));       // what landed before the failure
 *     if (err.leftover) await rm(err.leftover.path);           // the temp file that could not be removed
 *   }
 * }
 * ```
 */
export async function save(task: Task, dir: string, options: SaveOptions = {}): Promise<string[]> {
  const now = options.now ?? Date.now;
  if (task.status !== 'succeeded') throw new KlingNoOutputsError(task);
  if (task.outputs.length === 0) throw new KlingNoOutputsError(task);
  if (!options.force && task.outputsExpireAt !== undefined && task.outputsExpireAt < now())
    throw new KlingOutputsExpiredError(task);
  if (!SAFE_ID.test(task.id) || task.id === '.' || task.id === '..') {
    throw new KlingValidationError(
      'task.id',
      `task id ${JSON.stringify(task.id)} is not a single safe path segment; refusing to use it as a file name`
    );
  }

  const downloads = task.outputs.flatMap((o) => downloadsFor(o, options.includeWatermark === true));
  const written: string[] = [];
  try {
    mkdirSync(dir, { recursive: true });
  } catch (cause) {
    throw new KlingSaveError(task, written, dir, cause);
  }
  for (const [index, d] of downloads.entries()) {
    // Stream straight to the temp name this output would be renamed from anyway, so the body
    // never sits in the heap (ship run #4 anxiety read: `maxBytes` was a 500 MiB-per-call heap
    // ceiling presented as a protective byte cap). The final name needs the response's
    // Content-Type, which is why the temp name is keyed on the index rather than the name.
    const tmp = join(dir, `${task.id}-${index}${d.label}.${process.pid}.part`);
    let res;
    try {
      res = await fetchToFile(d.url, tmp, {
        maxBytes: options.maxBytes ?? MAX_VIDEO_SIZE,
        timeoutMs: options.timeoutMs ?? defaultDownloadTimeoutMs(d.video),
        signal: options.signal,
        fetch: options.fetch,
        lookup: options.lookup,
      });
    } catch (cause) {
      // The caller's own abort stays theirs; everything else reports what is already on disk.
      // `fetchToFile` has already removed its partial file.
      if (options.signal?.aborted && cause === options.signal.reason) throw cause;
      throw new KlingSaveError(task, written, d.url, cause);
    }
    const file = join(
      dir,
      `${task.id}-${index}${d.label}.${extensionFor(res.contentType, res.finalUrl)}`
    );
    renameInto(file, tmp, task, written);
    written.push(file);
  }
  const sidecar = join(dir, `${task.id}.json`);
  writeTo(
    sidecar,
    JSON.stringify(
      {
        product: task.product,
        standard: task.standard,
        request: options.request,
        outputs: task.outputs,
        files: written,
        raw: task.raw,
      },
      null,
      2
    ),
    task,
    written
  );
  written.push(sidecar);
  return written;
}

/**
 * One failure signal for the whole save: an fs error (ENOSPC, EACCES) is a `KlingSaveError`
 * like a download error, and a half-written file is removed so `written` stays truthful.
 */
function renameInto(file: string, tmp: string, task: Task, written: string[]): void {
  try {
    renameSync(tmp, file);
  } catch (cause) {
    let leftover: { path: string; cause: unknown } | undefined;
    try {
      rmSync(tmp, { force: true });
    } catch (rmCause) {
      leftover = { path: tmp, cause: rmCause };
    }
    throw new KlingSaveError(task, written, file, cause, leftover);
  }
}

function writeTo(file: string, data: Buffer | string, task: Task, written: string[]): void {
  // Write to a sibling temp name and rename into place: a failure part-way leaves the temp
  // file to remove, never a truncated target — and never touches a PRE-EXISTING file at
  // `file` (a read-only prior output whose overwrite fails at open must survive; ship run #5,
  // anxiety-reader F3). rename() is atomic on the same filesystem.
  const tmp = `${file}.${process.pid}.part`;
  try {
    writeFileSync(tmp, data);
    renameSync(tmp, file);
  } catch (cause) {
    // The write error is the one to throw; a cleanup failure (EACCES on the directory, EBUSY
    // on Windows) rides along as `leftover` so the orphaned temp file is named somewhere.
    let leftover: { path: string; cause: unknown } | undefined;
    try {
      rmSync(tmp, { force: true });
    } catch (rmCause) {
      leftover = { path: tmp, cause: rmCause };
    }
    throw new KlingSaveError(task, written, file, cause, leftover);
  }
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
      if (includeWatermark && o.watermarkUrl)
        out.push({ url: o.watermarkUrl, label: '-watermark', video });
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
  const mime = contentType?.split(';')[0]?.trim().toLowerCase();
  const known = mime ? CONTENT_TYPE_EXT[mime] : undefined;
  if (known) return known;
  try {
    const ext = extname(new URL(url).pathname).replace('.', '').toLowerCase();
    if (/^[a-z0-9]{1,5}$/.test(ext)) return ext;
  } catch {
    // AUDIT-OK(no_empty_catch): not a URL — the `bin` fallback below is the documented answer.
  }
  return 'bin';
}
