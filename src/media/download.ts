/**
 * Fetch a vendor output (or any https resource) into memory with the three guards 1.x
 * got from axios and 2.0 must provide itself (spec D12; run #1 A3):
 *
 *  1. **byte cap** — the body is streamed and aborted the moment it passes `maxBytes`
 *     (`KlingDownloadError('too-large')`), so a hostile or mislabelled resource cannot
 *     fill memory;
 *  2. **redirect cap** — `redirect: 'manual'`, at most `maxRedirects` hops
 *     (`'too-many-redirects'`);
 *  3. **per-hop SSRF check** — `assertSafeUrl` on the initial URL AND on every
 *     `Location` (`'blocked-host'`). 1.x checked only the first URL, so a public host
 *     could redirect the client into 127.0.0.1 or the metadata endpoint.
 *
 * A non-2xx final response is `'http'` with the status; the per-hop deadline is `'timeout'`;
 * a missing or unparseable `Location` is `'invalid-redirect'`. The caller's own abort is
 * rethrown unwrapped wherever it lands (DNS lookup, fetch, body read).
 * Import graph (§5): `http/errors`, `utils/security`, `config/constants`.
 */
import { open, rm } from 'node:fs/promises';
import { MAX_REDIRECTS, MEDIA_DOWNLOAD_TIMEOUT } from '../utils/constants.js';
import { KlingDownloadError } from '../http/errors.js';
import { UnsafeUrlError, assertSafeUrl, type LookupFn } from '../utils/security.js';

export interface FetchToBufferOptions {
  /** Hard cap on the decoded body. Required — there is no safe default for "how big may a video be". */
  maxBytes: number;
  /** Default `MAX_REDIRECTS` (5). */
  maxRedirects?: number;
  /** Per-hop deadline covering headers AND body. Default `MEDIA_DOWNLOAD_TIMEOUT` (60 s). */
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Injection seam (proxies, tests). Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** DNS seam for `assertSafeUrl`. */
  lookup?: LookupFn;
}

export interface FetchedResource {
  buffer: Buffer;
  /** The `Content-Type` header of the final hop, if any. */
  contentType?: string;
  /** Where the bytes actually came from after redirects. */
  finalUrl: string;
  hops: number;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Fetch an https resource into memory under the three guards (byte cap, redirect cap,
 * per-hop URL safety) with a per-hop deadline. Throws `KlingDownloadError { url, reason }`;
 * the caller's own abort is rethrown unwrapped.
 */
export async function fetchToBuffer(
  url: string,
  options: FetchToBufferOptions
): Promise<FetchedResource> {
  const chunks: Uint8Array[] = [];
  const res = await fetchStreamed(url, options, (c) => {
    chunks.push(c);
  });
  return { buffer: Buffer.concat(chunks, res.bytes), contentType: res.contentType, finalUrl: res.finalUrl, hops: res.hops };
}

/**
 * Stream an https resource straight to `destPath` under the same three guards and per-hop
 * deadline as `fetchToBuffer`, without ever holding the whole body in memory.
 *
 * `fetchToBuffer` buffers up to `maxBytes` (500 MiB for video in `save()`) before a single
 * write — a per-call heap ceiling the README presented as a protective byte cap, and the reason
 * a server saving several videos at once could OOM (ship run #4 anxiety read, 006bb99e). The
 * cap still applies here; it just no longer has to fit in memory.
 *
 * On ANY failure the partial file is removed and the error propagates, so a caller never sees a
 * truncated file at `destPath`. A write error (ENOSPC, EACCES) propagates as-is for the caller
 * to classify — `save()` turns it into `KlingSaveError` like any other fs failure.
 */
export async function fetchToFile(
  url: string,
  destPath: string,
  options: FetchToBufferOptions
): Promise<StreamedResource> {
  const handle = await open(destPath, 'w');
  try {
    const res = await fetchStreamed(url, options, async (chunk) => {
      await handle.write(chunk);
    });
    await handle.close();
    return res;
  } catch (err) {
    // close before unlink: an open descriptor on Windows refuses the unlink.
    // AUDIT-OK(no_empty_catch): the download error below is the one to report; a close that
    // fails on an already-failed handle adds nothing.
    await handle.close().catch(() => undefined);
    // AUDIT-OK(no_empty_catch): best-effort removal of the partial file; same reason.
    await rm(destPath, { force: true }).catch(() => undefined);
    throw err;
  }
}

/** What `fetchToFile` returns — the same provenance as `FetchedResource`, minus the bytes. */
export interface StreamedResource {
  /** Bytes written. */
  bytes: number;
  contentType?: string;
  finalUrl: string;
  hops: number;
}

async function fetchStreamed(
  url: string,
  options: FetchToBufferOptions,
  onChunk: (chunk: Uint8Array) => void | Promise<void>
): Promise<StreamedResource> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? MEDIA_DOWNLOAD_TIMEOUT;
  let current = url;

  for (let hop = 0; ; hop++) {
    if (options.signal?.aborted) throw options.signal.reason;
    // The hop deadline and the caller's abort are armed BEFORE the DNS lookup inside the
    // URL guard, so a hung resolver cannot hold the download open past `timeoutMs` and a
    // caller cancel is honoured during the lookup too (ship run #4).
    const controller = new AbortController();
    const timedOut = new DOMException(
      `download hop timed out after ${timeoutMs} ms`,
      'TimeoutError'
    );
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(timedOut), timeoutMs);
    /** Rethrow the caller's own abort unwrapped, or classify the hop timeout; anything else is the caller's to wrap. */
    const classify = (cause: unknown): never => {
      if (options.signal?.aborted) throw options.signal.reason;
      if (controller.signal.aborted && controller.signal.reason === timedOut) {
        throw new KlingDownloadError(timedOut.message, { url: current, reason: 'timeout', cause });
      }
      throw new KlingDownloadError(`download failed: ${describe(cause)}`, {
        url: current,
        reason: 'http',
        cause,
      });
    };
    try {
      await Promise.race([guard(current, options.lookup), abortPromise(controller.signal)]).catch(
        (cause: unknown) => {
          if (cause instanceof KlingDownloadError) throw cause;
          return classify(cause);
        }
      );
      let res: Response;
      try {
        res = await fetchImpl(current, { redirect: 'manual', signal: controller.signal });
      } catch (cause) {
        classify(cause);
        throw cause; // unreachable — classify always throws; keeps TS's control flow honest
      }

      if (REDIRECT_STATUSES.has(res.status)) {
        const location = res.headers.get('location');
        // AUDIT-OK(no_empty_catch): the body of a redirect is discarded; a cancel failure is not the error the caller needs.
        await res.body?.cancel().catch(() => undefined);
        if (!location)
          throw new KlingDownloadError(`redirect (${res.status}) without a Location header`, {
            url: current,
            reason: 'invalid-redirect',
            httpStatus: res.status,
          });
        if (hop + 1 > maxRedirects)
          throw new KlingDownloadError(`more than ${maxRedirects} redirects`, {
            url: current,
            reason: 'too-many-redirects',
            httpStatus: res.status,
          });
        try {
          current = new URL(location, current).toString();
        } catch (cause) {
          throw new KlingDownloadError(
            `redirect Location ${JSON.stringify(location)} is not a valid URL`,
            { url: current, reason: 'invalid-redirect', httpStatus: res.status, cause }
          );
        }
        continue;
      }
      if (!res.ok) {
        // AUDIT-OK(no_empty_catch): discarding an error body; the status is the error.
        await res.body?.cancel().catch(() => undefined);
        throw new KlingDownloadError(`download failed with HTTP ${res.status}`, {
          url: current,
          reason: 'http',
          httpStatus: res.status,
        });
      }

      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > options.maxBytes) {
        // AUDIT-OK(no_empty_catch): refusing before the read; the cap is the error.
        await res.body?.cancel().catch(() => undefined);
        throw new KlingDownloadError(
          `resource declares ${declared} bytes, over the ${options.maxBytes}-byte cap`,
          { url: current, reason: 'too-large', httpStatus: res.status }
        );
      }
      const bytes = await consumeCapped(res, options.maxBytes, current, controller, classify, onChunk);
      return {
        bytes,
        contentType: res.headers.get('content-type') ?? undefined,
        finalUrl: current,
        hops: hop,
      };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
}

async function guard(url: string, lookup: LookupFn | undefined): Promise<void> {
  try {
    await assertSafeUrl(url, { lookup });
  } catch (err) {
    if (err instanceof UnsafeUrlError)
      throw new KlingDownloadError(`refusing to fetch ${url}: ${err.message}`, {
        url,
        reason: 'blocked-host',
        cause: err,
      });
    throw err;
  }
}

/** Resolves never; rejects with the signal's reason on abort — races the guard's DNS lookup against the hop deadline. */
function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

/**
 * Stream the body past `onChunk`, abort past `maxBytes`. Works for a ReadableStream body and a
 * body-less 200 alike. The sink decides where the bytes go — memory for `fetchToBuffer`, a file
 * for `fetchToFile` — so the three guards and the abort classification are written once.
 */
async function consumeCapped(
  res: Response,
  maxBytes: number,
  url: string,
  controller: AbortController,
  classify: (cause: unknown) => never,
  onChunk: (chunk: Uint8Array) => void | Promise<void>
): Promise<number> {
  if (!res.body) return 0;
  let total = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        controller.abort();
        throw new KlingDownloadError(`resource exceeds the ${maxBytes}-byte cap`, {
          url,
          reason: 'too-large',
        });
      }
      await onChunk(value);
    }
  } catch (err) {
    if (err instanceof KlingDownloadError) throw err;
    // A caller abort or the hop deadline mid-body is classified like one mid-fetch (ship run #4:
    // it used to surface as reason 'http', indistinguishable from a network failure).
    classify(err);
    throw err; // unreachable
  } finally {
    reader.releaseLock();
  }
  return total;
}

const describe = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));
