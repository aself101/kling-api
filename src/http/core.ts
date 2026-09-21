/**
 * Kling 2.0 HTTP core (spec D10, D11).
 *
 * One transport for both vendor API standards: base URL, `Authorization: Bearer <apiKey>`,
 * a per-attempt deadline that covers the request-body write and the response-body read,
 * `redirect: 'manual'`, JSON envelope handling, and the retry policy that never
 * re-sends a write once any response arrived.
 *
 * The codec, not this module, owns vendor field names: `request()` returns the parsed
 * envelope and throws the error family; it never looks inside `data`.
 *
 * Imports: `http/errors`, `config/constants`, `utils/security` (redaction), `node:*`.
 */

import { BASE_URL, DEFAULT_TIMEOUT } from '../config/constants.js';
import { redactKey } from '../utils/security.js';
import {
  KlingAPIError,
  KlingNetworkError,
  KlingResponseError,
  KlingTimeoutError,
  KlingValidationError,
  isPreRequestNetworkFailure,
  type RequestDescriptor,
  type RequestKind,
} from './errors.js';

// ============================================================================
// Configuration
// ============================================================================

export interface RetryOptions {
  /** Attempts per read, including the first. Default 3. Writes never retry after a response. */
  maxAttempts?: number;
  /** Backoff base. Delay after failed attempt n is `baseDelayMs * 2^n`: 2 s, 4 s at the default. Default 1 000. */
  baseDelayMs?: number;
  /** Backoff cap. Default 30 000. */
  maxDelayMs?: number;
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Client configuration (spec §6.4).
 *
 * The library reads `apiKey` and `process.env.KLING_API_KEY` only; the `.env` chain is
 * the CLI's (spec D2). `fetch` is the single injection seam for proxies and tests
 * (spec D11, D20) — Node's `fetch` ignores `HTTP(S)_PROXY`, so a proxied consumer passes
 * an undici `fetch` bound to a `ProxyAgent` here.
 */
export interface KlingConfig {
  apiKey?: string;
  /** Must be `https://`. Default `https://api-singapore.klingai.com`. */
  baseUrl?: string;
  /** Per-attempt deadline in ms, covering body write and body read. Default 30 000. */
  timeout?: number;
  retry?: RetryOptions;
  fetch?: typeof fetch;
  /** Unknown model ids: pass through with a warning (default) or reject (spec D9). */
  unknownModels?: 'passthrough' | 'reject';
  /** Known-model capability rules: throw (default) or warn and send. Shape rules always throw (spec D9). */
  capabilityValidation?: 'error' | 'warn';
  logger?: Logger;
}

export interface ResolvedRetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: ResolvedRetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
};

/** A `Logger` that says nothing — the library's default. The CLI installs its own. */
const noop = (): void => undefined;
export const silentLogger: Logger = { debug: noop, info: noop, warn: noop, error: noop };

// ============================================================================
// Requests and envelopes
// ============================================================================

export interface HttpRequest {
  method: 'GET' | 'POST';
  /** Absolute path on the vendor host, e.g. `/tasks` or `/v1/images/generations`. */
  path: string;
  /** Query string; `undefined` values are omitted. */
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON body for POST. */
  body?: unknown;
  signal?: AbortSignal;
  /** Reads are retried; writes are not once a response arrived (spec D10). `POST /tasks` is a read. */
  kind: RequestKind;
  /** The `external_task_id` a write carries — attached to any error so the consumer can recover. */
  externalId?: string;
  /** Per-attempt override of the configured deadline (products scale it with body size, spec D11). */
  timeoutMs?: number;
}

/** The vendor envelope common to both standards. `data` is opaque here; the codecs read it. */
export interface VendorEnvelope<T = unknown> {
  code: number;
  message?: string;
  request_id?: string;
  data?: T;
}

export interface HttpResult<T = unknown> {
  status: number;
  envelope: VendorEnvelope<T>;
  requestId?: string;
  /** 1-based attempt that produced this result. */
  attempt: number;
}

/** Internal knobs the tests use; not part of `KlingConfig`. */
export interface HttpCoreInternals {
  sleep?: (ms: number) => Promise<void>;
}

const REQUEST_ID_HEADER = 'x-request-id';
const BODY_SNIPPET_BYTES = 200;

// ============================================================================
// Core
// ============================================================================

/** Never resolves; rejects with the signal's reason when it aborts (or immediately if it already has). Without a signal, never settles. */
function abortRejection(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_, reject) => {
    if (!signal) return;
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

/** The transport behind every namespace: `request({ method, path, body, kind })` with the per-attempt deadline, the read-only retry policy and vendor-envelope error mapping (spec D10, D11). */
export class HttpCore {
  readonly baseUrl: string;
  readonly timeout: number;
  readonly retry: ResolvedRetryOptions;
  readonly logger: Logger;
  // ECMAScript private fields, not TS `private`: `JSON.stringify(core)` and `console.log(core)`
  // must never surface the key. (A test asserts this.)
  readonly #apiKey: string;
  readonly #fetchImpl: typeof fetch;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(
    config: Pick<KlingConfig, 'baseUrl' | 'timeout' | 'retry' | 'fetch' | 'logger'> & {
      apiKey: string;
    },
    internals: HttpCoreInternals = {}
  ) {
    const baseUrl = (config.baseUrl ?? BASE_URL).replace(/\/+$/, '');
    if (!/^https:\/\//i.test(baseUrl)) {
      throw new KlingValidationError(
        'baseUrl',
        `baseUrl must use https:// (got ${JSON.stringify(baseUrl)})`
      );
    }
    if (!config.apiKey) {
      throw new KlingValidationError('apiKey', 'apiKey is required');
    }
    this.baseUrl = baseUrl;
    this.#apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.retry = { ...DEFAULT_RETRY, ...config.retry };
    this.#fetchImpl = config.fetch ?? globalThis.fetch;
    this.logger = config.logger ?? silentLogger;
    this.#sleep = internals.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    if (typeof this.#fetchImpl !== 'function') {
      throw new KlingValidationError(
        'fetch',
        'No fetch implementation: pass config.fetch on runtimes without a global fetch'
      );
    }
  }

  /** The redacted key, for `--debug` output. Never the key itself. */
  /** The fetch this core sends through — so downloads (`client.save`) can share a proxy or a test seam. */
  get fetchImpl(): typeof fetch {
    return this.#fetchImpl;
  }

  describeCredential(): string {
    return redactKey(this.#apiKey);
  }

  /**
   * Perform a request, applying the retry policy (spec D10):
   * - reads retry on network errors, timeouts, transient HTTP statuses, transient business codes;
   * - writes retry only on a provably pre-request network failure (DNS, refused) — never
   *   after any response, however transient it looks, because the task may already exist.
   *
   * Resolves with the envelope when `code === 0`; throws `KlingAPIError` otherwise.
   */
  async request<T = unknown>(req: HttpRequest): Promise<HttpResult<T>> {
    const descriptor: RequestDescriptor = {
      kind: req.kind,
      method: req.method,
      path: req.path,
      ...(req.externalId ? { externalId: req.externalId } : {}),
    };
    const attempts =
      req.kind === 'read' ? this.retry.maxAttempts : Math.max(1, this.retry.maxAttempts);

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.attempt<T>(req, descriptor, attempt, attempts);
      } catch (err) {
        if (attempt >= attempts || !this.shouldRetry(req.kind, err)) throw err;
        const delay = Math.min(this.retry.baseDelayMs * 2 ** attempt, this.retry.maxDelayMs); // attempt 1 → 2 s, attempt 2 → 4 s (spec D11: 96 s worst case at defaults)
        this.logger.debug(
          `kling: ${req.method} ${req.path} attempt ${attempt}/${attempts} failed (${(err as Error).name}); retrying in ${delay} ms`
        );
        // The backoff is abortable: a caller cancel during the sleep rejects now, not at the
        // next attempt's pre-check up to maxDelayMs later (ship run #4).
        await Promise.race([this.#sleep(delay), abortRejection(req.signal)]);
      }
    }
  }

  // --------------------------------------------------------------------------

  private shouldRetry(kind: RequestKind, err: unknown): boolean {
    if (kind === 'write') {
      // The only write retry: the request provably never left this host.
      return err instanceof KlingNetworkError && isPreRequestNetworkFailure(err.cause);
    }
    if (err instanceof KlingNetworkError || err instanceof KlingTimeoutError) return true;
    if (err instanceof KlingAPIError) return err.isRetryable();
    if (err instanceof KlingResponseError) return [429, 502, 503, 504].includes(err.httpStatus);
    return false;
  }

  private async attempt<T>(
    req: HttpRequest,
    descriptor: RequestDescriptor,
    attempt: number,
    attempts: number
  ): Promise<HttpResult<T>> {
    const deadlineMs = req.timeoutMs ?? this.timeout;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, deadlineMs);
    const onCallerAbort = () => controller.abort(req.signal?.reason);
    if (req.signal) {
      if (req.signal.aborted) {
        clearTimeout(timer);
        throw req.signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
      }
      req.signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    const url = this.buildUrl(req.path, req.query);
    this.logger.debug(
      `kling: ${req.method} ${req.path} attempt ${attempt}/${attempts} (key ${this.describeCredential()})`
    );

    let response: Response;
    let text: string;
    try {
      response = await this.#fetchImpl(url, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body:
          req.method === 'POST' && req.body !== undefined ? JSON.stringify(req.body) : undefined,
        redirect: 'manual',
        signal: controller.signal,
      });
      // The deadline covers the body read too: a stalled body cannot hang past `timeout`.
      text = await response.text();
    } catch (err) {
      clearTimeout(timer);
      req.signal?.removeEventListener('abort', onCallerAbort);
      if (req.signal?.aborted && !timedOut) {
        // The caller aborted: surface THEIR reason, never wrapped.
        throw req.signal.reason ?? err;
      }
      if (timedOut) {
        throw new KlingTimeoutError(
          `${req.method} ${req.path} exceeded the ${deadlineMs} ms deadline (attempt ${attempt}/${attempts})`,
          descriptor,
          { deadlineMs, attempt, attempts }
        );
      }
      throw new KlingNetworkError(
        `${req.method} ${req.path}: ${(err as Error).message}`,
        descriptor,
        err
      );
    }
    clearTimeout(timer);
    req.signal?.removeEventListener('abort', onCallerAbort);

    const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined;

    // An unexpected redirect from the API host: surface the Location, do not follow, do not retry.
    if (response.status >= 300 && response.status < 400) {
      throw new KlingResponseError(
        `${req.method} ${req.path} was redirected (${response.status}) — the API host moved?`,
        descriptor,
        {
          httpStatus: response.status,
          bodySnippet: text.slice(0, BODY_SNIPPET_BYTES),
          location: response.headers.get('location') ?? undefined,
          requestId,
        }
      );
    }

    let envelope: VendorEnvelope<T>;
    try {
      // SAFETY: the cast is validated on the next line (object with a numeric `code`); `T`
      // is the codecs' concern — every caller passes the envelope to a parser that checks it.
      envelope = JSON.parse(text) as VendorEnvelope<T>;
      if (typeof envelope !== 'object' || envelope === null || typeof envelope.code !== 'number') {
        throw new Error('not a vendor envelope');
      }
    } catch (cause) {
      // HTML from a CDN, an empty body, a proxy page: no business code to reason from.
      throw new KlingResponseError(
        `${req.method} ${req.path} returned HTTP ${response.status} with a non-envelope body`,
        descriptor,
        {
          httpStatus: response.status,
          bodySnippet: text.slice(0, BODY_SNIPPET_BYTES),
          requestId,
          cause,
        }
      );
    }

    if (envelope.code !== 0) {
      throw new KlingAPIError(envelope.message ?? `Kling error ${envelope.code}`, {
        code: envelope.code,
        httpStatus: response.status,
        request: descriptor,
        requestId: envelope.request_id ?? requestId,
      });
    }

    return {
      status: response.status,
      envelope,
      requestId: envelope.request_id ?? requestId,
      attempt,
    };
  }

  private buildUrl(path: string, query?: HttpRequest['query']): string {
    const url = new URL(path.startsWith('/') ? path : `/${path}`, `${this.baseUrl}/`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
}
