/**
 * Kling 2.0 error family (spec D10).
 *
 * One base class, one class per failure kind, and — on every write error — a
 * `taskState` that says whether the vendor may already hold the task. That field, not
 * `isTransient()`, is what a consumer keys a re-submit decision on: `1303` and `5002`
 * are both "transient" in the vendor's vocabulary, but only one of them means the
 * request never reached the queue (run #3 A35 / F11).
 *
 * Imports: `codecs/task` (types) and `config/constants` (the vendor table). No HTTP.
 */

import type { Product, Standard, Task, TaskState } from '../codecs/task.js';
import {
  PERMANENT_429_CODES,
  TRANSIENT_ERROR_CODES,
  TRANSIENT_HTTP_STATUSES,
  WRITE_NOT_CREATED_CODES,
} from '../config/constants.js';

// ============================================================================
// Request descriptor
// ============================================================================

/** Reads are retried by the core; writes (creates, deletes) never are once a response arrived. */
export type RequestKind = 'read' | 'write';

export interface RequestDescriptor {
  kind: RequestKind;
  method: string;
  path: string;
  /** The `external_task_id` the write carried, if any — the recovery key (spec D10). */
  externalId?: string;
}

// ============================================================================
// Base
// ============================================================================

/**
 * The base of every error this library throws — `err instanceof KlingError` is the one check
 * that separates "the library or the vendor said no" from a bug in your own code.
 *
 * Carries `requestId` whenever a response was received, which is what the vendor asks for when
 * you report a problem. Subclasses add the fields that make an error actionable: `taskState`
 * (the re-submit decision), `code`/`httpStatus` (the vendor's own classification), `written`
 * (what already landed on disk). Everything thrown from a public method is one of these except
 * the caller's own abort reason, which is rethrown unwrapped by design.
 */
export class KlingError extends Error {
  /** The vendor's `request_id`, when a response was received. */
  requestId?: string;

  constructor(message: string, options?: { requestId?: string; cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    if (options?.requestId) this.requestId = options.requestId;
  }
}

// ============================================================================
// Vendor business error
// ============================================================================

export interface KlingAPIErrorInit {
  code: number;
  httpStatus: number;
  request: RequestDescriptor;
  requestId?: string;
  /** Parsed `Retry-After` in ms; see `KlingAPIError.retryAfterMs`. */
  retryAfterMs?: number;
}

/**
 * The vendor answered with `code !== 0`.
 *
 * - `isTransient()` — the vendor's "try again later" signal (1302/1303/5000–5002,
 *   HTTP 429/502/503/504). Diagnostic only.
 * - `isRetryable()` — `isTransient()` AND the request was a read AND the 429 is not a
 *   permanent one (`1102` pack exhausted, `1304` IP whitelist). ALWAYS `false` for a
 *   write: the core never re-sends a create that received a response, and this method
 *   must not suggest otherwise.
 * - `taskState` — see `TaskState`. Decision field for consumers.
 */
export class KlingAPIError extends KlingError {
  readonly code: number;
  readonly httpStatus: number;
  readonly request: RequestDescriptor;
  /** The create's `external_task_id` — the recovery key. Mirrors `request.externalId`, as on the other request-bearing errors (ship run #6). */
  readonly externalId?: string;
  /**
   * The vendor's `Retry-After` for this response in ms, when it sent one and it parsed
   * (delta-seconds or HTTP-date). The core waits this instead of its own backoff on a
   * retryable read; a consumer re-submitting a create should honour it too.
   */
  readonly retryAfterMs?: number;
  readonly taskState: TaskState;

  constructor(message: string, init: KlingAPIErrorInit) {
    super(message, { requestId: init.requestId });
    this.code = init.code;
    this.httpStatus = init.httpStatus;
    this.request = init.request;
    if (init.request.externalId) this.externalId = init.request.externalId;
    if (init.retryAfterMs !== undefined) this.retryAfterMs = init.retryAfterMs;
    this.taskState = deriveTaskStateFromResponse(init.request.kind, init.code, init.httpStatus);
  }

  isTransient(): boolean {
    return TRANSIENT_ERROR_CODES.has(this.code) || TRANSIENT_HTTP_STATUSES.has(this.httpStatus);
  }

  isRetryable(): boolean {
    if (this.request.kind !== 'read') return false;
    if (PERMANENT_429_CODES.has(this.code)) return false;
    return this.isTransient();
  }
}

// ============================================================================
// Transport-level failures
// ============================================================================

/**
 * `fetch` threw before a response arrived: DNS, connection refused, reset, TLS.
 * `taskState` is `'not-created'` only when the failure is provably pre-request
 * (`ENOTFOUND`, `ECONNREFUSED`); a reset after the request was written is `'may-exist'`.
 */
export class KlingNetworkError extends KlingError {
  readonly request: RequestDescriptor;
  readonly externalId?: string;
  readonly taskState: TaskState;

  constructor(message: string, request: RequestDescriptor, cause: unknown) {
    super(message, { cause });
    this.request = request;
    if (request.externalId) this.externalId = request.externalId;
    this.taskState = deriveTaskStateFromNetworkFailure(request.kind, cause);
  }
}

/**
 * Our per-attempt `AbortController` fired. The deadline covers connection, request-body
 * write, headers and response-body read, so a create that times out is ALWAYS
 * `'may-exist'` (spec D11).
 */
export class KlingTimeoutError extends KlingError {
  readonly request: RequestDescriptor;
  readonly deadlineMs: number;
  readonly attempt: number;
  readonly attempts: number;
  readonly externalId?: string;
  readonly taskState: TaskState;

  constructor(
    message: string,
    request: RequestDescriptor,
    timing: { deadlineMs: number; attempt: number; attempts: number }
  ) {
    super(message);
    this.request = request;
    this.deadlineMs = timing.deadlineMs;
    this.attempt = timing.attempt;
    this.attempts = timing.attempts;
    if (request.externalId) this.externalId = request.externalId;
    this.taskState = request.kind === 'write' ? 'may-exist' : 'n/a';
  }
}

/**
 * A response arrived but is not a vendor envelope: a CDN's HTML 429/502 page, an
 * unexpected 3xx (`redirect: 'manual'`, `location` carried), an empty body.
 * For a write this is `'may-exist'` — the request may have reached the vendor.
 */
export class KlingResponseError extends KlingError {
  readonly request: RequestDescriptor;
  readonly httpStatus: number;
  readonly bodySnippet: string;
  readonly location?: string;
  readonly externalId?: string;
  readonly taskState: TaskState;

  constructor(
    message: string,
    request: RequestDescriptor,
    init: { httpStatus: number; bodySnippet: string; location?: string; requestId?: string; cause?: unknown }
  ) {
    super(message, { requestId: init.requestId, cause: init.cause });
    this.request = request;
    this.httpStatus = init.httpStatus;
    this.bodySnippet = init.bodySnippet;
    if (init.location) this.location = init.location;
    if (request.externalId) this.externalId = request.externalId;
    this.taskState = request.kind === 'write' ? 'may-exist' : 'n/a';
  }
}

// ============================================================================
// Codec / validation
// ============================================================================

/** The envelope parsed as JSON with `code === 0` but is not the shape this codec expects. */
export class KlingCodecError extends KlingError {
  readonly standard: Standard;
  /** JSON path of the offending field, e.g. `data.status`. */
  readonly path: string;

  constructor(message: string, standard: Standard, path: string, options?: { cause?: unknown }) {
    super(message, options);
    this.standard = standard;
    this.path = path;
  }
}

/** A parameter failed a `[shape]` rule, or a `[capability]` rule under `capabilityValidation: 'error'` (spec D9). */
export class KlingValidationError extends KlingError {
  readonly field: string;

  constructor(field: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.field = field;
  }
}

// ============================================================================
// Task lifecycle
// ============================================================================

/** `wait()` saw `status === 'failed'`. `code` is the vendor's code when the envelope carried one, else `null`. */
export class KlingTaskFailedError extends KlingError {
  readonly task: Task;
  readonly code: number | null;

  constructor(task: Task, code: number | null = null) {
    super(task.message ? `Task ${task.id} failed: ${task.message}` : `Task ${task.id} failed`);
    this.task = task;
    this.code = code;
  }
}

/** `wait()` hit its deadline. `task` is the last state seen, or `null` if no poll completed. */
/**
 * `tasks.getByProduct` / `TaskHandle.get()` could not see the task. Not in the spec D10
 * family — added at 2a₁ because the unified `GET /tasks` answers `200 data: []` for an
 * unknown id, so a new-standard lookup has no vendor error to surface; the legacy path
 * reaches the same class when the vendor answers not-found (live: HTTP 400 / `1201`
 * "Task not found by id/external id", not the table's `1203`). `null` from `tasks.recover` is
 * the soft form of the same fact; `get()` is the hard one because a handle's caller asked
 * for exactly one task. Means "not visible to this account", not "never created".
 */
export class KlingTaskNotFoundError extends KlingError {
  readonly product: Product;
  readonly id: string;
  readonly byExternalId: boolean;

  constructor(product: Product, id: string, byExternalId = false, options?: { requestId?: string; cause?: unknown }) {
    super(`task ${byExternalId ? 'with external id ' : ''}${id} (${product}) is not visible to this account`, options);
    this.product = product;
    this.id = id;
    this.byExternalId = byExternalId;
  }
}

/**
 * `wait()`/`poll()` hit the caller's `deadlineMs`.
 *
 * **The deadline is yours, not the vendor's: the task is still running and still billed.** Do
 * not re-submit on this — read `task` for the last status seen, and `handle.get()` later, or
 * `tasks.recover()` by external id. Verified live: killing the client does not cancel the task.
 */
export class KlingPollTimeoutError extends KlingError {
  readonly task: Task | null;
  readonly elapsedMs: number;

  constructor(task: Task | null, elapsedMs: number) {
    super(
      task
        ? `Task ${task.id} still ${task.status} after ${elapsedMs} ms`
        : `Task did not report a status within ${elapsedMs} ms`
    );
    this.task = task;
    this.elapsedMs = elapsedMs;
  }
}

/** `save()` on a `succeeded` task with no outputs — terminal and empty. */
export class KlingNoOutputsError extends KlingError {
  readonly task: Task;

  constructor(task: Task) {
    super(`Task ${task.id} succeeded with no outputs`);
    this.task = task;
  }
}

/** `save()` past the derived `outputsExpireAt` (30 days after `updatedAt`) without `force`. */
export class KlingOutputsExpiredError extends KlingError {
  readonly task: Task;

  constructor(task: Task) {
    super(
      `Outputs of task ${task.id} expired at ${
        task.outputsExpireAt ? new Date(task.outputsExpireAt).toISOString() : 'unknown'
      } (the vendor clears URLs after 30 days); pass force: true to attempt anyway`
    );
    this.task = task;
  }
}

// ============================================================================
// Batch, download, webhook
// ============================================================================

/**
 * `tasks.get()` failed on a chunk after earlier chunks succeeded.
 * `missing` = attempted ids the vendor did not return; `unattempted` = ids in chunks
 * that were never sent (spec D5, run #3 A43).
 */
export class KlingBatchError extends KlingError {
  readonly tasks: Task[];
  readonly missing: string[];
  readonly unattempted: string[];

  constructor(
    message: string,
    partial: { tasks: Task[]; missing: string[]; unattempted: string[] },
    cause: unknown
  ) {
    super(message, { cause });
    this.tasks = partial.tasks;
    this.missing = partial.missing;
    this.unattempted = partial.unattempted;
  }
}

/** `'timeout'` = the per-hop deadline fired (ship run #4: it used to surface as `'http'`); `'invalid-redirect'` = a `Location` that does not parse. */
/**
 * `save()` failed after some outputs were already written. `written` lists the files on
 * disk so the caller can clean up or keep them; `cause` is the download error. No sidecar
 * is written on a failed save. (Ship run #4: the partial set used to be unreported —
 * the `KlingBatchError` precedent applied to downloads.)
 */
export class KlingSaveError extends KlingError {
  readonly task: Task;
  readonly written: string[];
  readonly failedUrl: string;
  /**
   * Set when the failed write's temp file (`<file>.<pid>.part`) could not be removed either —
   * the one case where a path on disk is named by neither `written` nor the target. Consumers
   * that clean up from `written` must also remove `leftover.path` (ship run #6, code-auditor).
   */
  readonly leftover?: { path: string; cause: unknown };

  constructor(
    task: Task,
    written: string[],
    failedUrl: string,
    cause: unknown,
    leftover?: { path: string; cause: unknown }
  ) {
    const why = cause instanceof Error ? cause.message : String(cause);
    const tail = leftover
      ? ` (temp file ${leftover.path} could not be removed: ${leftover.cause instanceof Error ? leftover.cause.message : String(leftover.cause)})`
      : '';
    super(`save failed on ${failedUrl} after ${written.length} file(s) were written: ${why}${tail}`, { cause });
    this.task = task;
    this.written = written;
    this.failedUrl = failedUrl;
    if (leftover) this.leftover = leftover;
  }
}

/**
 * `Retry-After` → ms, per RFC 9110: either delta-seconds or an HTTP-date. Returns undefined for
 * an absent, malformed, or already-past value — never a negative wait. The caller caps it.
 */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
  if (value === null || value === undefined) return undefined;
  const raw = value.trim();
  if (raw === '') return undefined;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, at - now);
}

export type DownloadFailureReason = 'too-large' | 'too-many-redirects' | 'blocked-host' | 'http' | 'timeout' | 'invalid-redirect';

/** A download (`save()`, URL media) was refused by the library's guards or by the remote host. */
export class KlingDownloadError extends KlingError {
  readonly url: string;
  readonly reason: DownloadFailureReason;
  readonly httpStatus?: number;

  constructor(
    message: string,
    init: { url: string; reason: DownloadFailureReason; httpStatus?: number; cause?: unknown }
  ) {
    super(message, { cause: init.cause });
    this.url = init.url;
    this.reason = init.reason;
    if (init.httpStatus !== undefined) this.httpStatus = init.httpStatus;
  }
}

export type WebhookFailureReason = 'missing-headers' | 'bad-signature' | 'stale-timestamp';

/** `parseCallback` with a secret: the signature check failed. The task is never returned on this path (spec D16). */
export class KlingWebhookError extends KlingError {
  readonly reason: WebhookFailureReason;

  constructor(reason: WebhookFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

// ============================================================================
// Classification helpers
// ============================================================================

/**
 * Task state implied by a vendor response to a request of `kind`.
 *
 * Writes: any 4xx business code (the vendor rejected before enqueueing) is
 * `'not-created'`; `5000`/`5002`, an HTTP 5xx, and anything unrecognised is
 * `'may-exist'`. Reads: `'n/a'`.
 */
export function deriveTaskStateFromResponse(
  kind: RequestKind,
  code: number,
  httpStatus: number
): TaskState {
  if (kind !== 'write') return 'n/a';
  if (WRITE_NOT_CREATED_CODES.has(code)) return 'not-created';
  if (httpStatus >= 400 && httpStatus < 500 && !TRANSIENT_ERROR_CODES.has(code)) return 'not-created';
  return 'may-exist';
}

/** libuv codes that prove the request never left this host. */
const PRE_REQUEST_FAILURE_CODES: ReadonlySet<string> = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN']);

/**
 * Task state implied by a `fetch` rejection. Node's `fetch` wraps the socket error as
 * `TypeError { cause: { code } }`; on a dual-stack hostname the cause can be an
 * `AggregateError` whose `errors[]` carry the codes (spec V14).
 */
export function deriveTaskStateFromNetworkFailure(kind: RequestKind, cause: unknown): TaskState {
  if (kind !== 'write') return 'n/a';
  const codes = collectErrorCodes(cause);
  if (codes.length > 0 && codes.every((c) => PRE_REQUEST_FAILURE_CODES.has(c))) return 'not-created';
  return 'may-exist';
}

/** Whether a network failure is one the core may retry for a write (pre-request only). */
export function isPreRequestNetworkFailure(cause: unknown): boolean {
  const codes = collectErrorCodes(cause);
  return codes.length > 0 && codes.every((c) => PRE_REQUEST_FAILURE_CODES.has(c));
}

function collectErrorCodes(err: unknown, depth = 0): string[] {
  if (depth > 4 || err === null || typeof err !== 'object') return [];
  const out: string[] = [];
  const e = err as { code?: unknown; cause?: unknown; errors?: unknown };
  if (typeof e.code === 'string') out.push(e.code);
  if (Array.isArray(e.errors)) for (const inner of e.errors) out.push(...collectErrorCodes(inner, depth + 1));
  if (e.cause !== undefined && e.cause !== err) out.push(...collectErrorCodes(e.cause, depth + 1));
  return out;
}
