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
 * A non-2xx final response is `'http'` with the status. Each hop has its own deadline.
 * Import graph (§5): `http/errors`, `utils/security`, `config/constants`.
 */
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

export async function fetchToBuffer(url: string, options: FetchToBufferOptions): Promise<FetchedResource> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? MEDIA_DOWNLOAD_TIMEOUT;
  let current = url;

  for (let hop = 0; ; hop++) {
    if (options.signal?.aborted) throw options.signal.reason;
    await guard(current, options.lookup);
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException(`download hop timed out after ${timeoutMs} ms`, 'TimeoutError')), timeoutMs);
    try {
      let res: Response;
      try {
        res = await fetchImpl(current, { redirect: 'manual', signal: controller.signal });
      } catch (cause) {
        if (options.signal?.aborted) throw options.signal.reason;
        throw new KlingDownloadError(`download failed: ${describe(cause)}`, { url: current, reason: 'http', cause });
      }

      if (REDIRECT_STATUSES.has(res.status)) {
        const location = res.headers.get('location');
        await res.body?.cancel().catch(() => undefined);
        if (!location) throw new KlingDownloadError(`redirect (${res.status}) without a Location header`, { url: current, reason: 'http', httpStatus: res.status });
        if (hop + 1 > maxRedirects) throw new KlingDownloadError(`more than ${maxRedirects} redirects`, { url: current, reason: 'too-many-redirects', httpStatus: res.status });
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel().catch(() => undefined);
        throw new KlingDownloadError(`download failed with HTTP ${res.status}`, { url: current, reason: 'http', httpStatus: res.status });
      }

      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > options.maxBytes) {
        await res.body?.cancel().catch(() => undefined);
        throw new KlingDownloadError(`resource declares ${declared} bytes, over the ${options.maxBytes}-byte cap`, { url: current, reason: 'too-large', httpStatus: res.status });
      }
      const buffer = await readCapped(res, options.maxBytes, current, controller);
      return { buffer, contentType: res.headers.get('content-type') ?? undefined, finalUrl: current, hops: hop };
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
    if (err instanceof UnsafeUrlError) throw new KlingDownloadError(`refusing to fetch ${url}: ${err.message}`, { url, reason: 'blocked-host', cause: err });
    throw err;
  }
}

/** Stream the body, abort past `maxBytes`. Works for both a ReadableStream body and a body-less 200. */
async function readCapped(res: Response, maxBytes: number, url: string, controller: AbortController): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        controller.abort();
        throw new KlingDownloadError(`resource exceeds the ${maxBytes}-byte cap`, { url, reason: 'too-large' });
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof KlingDownloadError) throw err;
    throw new KlingDownloadError(`download interrupted: ${describe(err)}`, { url, reason: 'http', cause: err });
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

const describe = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e));
