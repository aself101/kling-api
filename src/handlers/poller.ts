/**
 * Library poller (spec D13). No spinner, no TTY — `pollWithSpinner` lives in `src/cli/`.
 *
 * `poll` calls `fn` until `until(value)` is true, sleeping `intervalMs` between calls.
 * Three ways out that are not success:
 *  - the caller's `signal` aborts → rejects with `signal.reason` (their `AbortError`,
 *    never wrapped — D10);
 *  - `deadlineMs` elapses → `KlingPollTimeoutError(last, elapsed)` where `last` is the most
 *    recent value seen (or `null` before the first response);
 *  - `fn` throws → the error propagates as-is (a `get()` that has exhausted its read
 *    retries surfaces its `KlingAPIError`; the loop does not swallow it).
 *
 * `intervalMs` may be a function so a shared loop can re-read the shortest interval its
 * subscribers currently want (`TaskHandle.wait`, D5). The deadline is checked before each
 * sleep AND bounds the sleep itself, so a 15-minute deadline with a 3-second interval
 * fires at 15:00, not at the next tick after it.
 */
import { DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT } from '../config/constants.js';
import { KlingPollTimeoutError, KlingValidationError } from '../http/errors.js';
import type { Task } from '../codecs/task.js';

export interface PollOptions<T> {
  /** Completion predicate on the latest value. */
  until: (value: T) => boolean;
  /** Milliseconds between calls, or a function re-evaluated before each sleep. Default 3 000. */
  intervalMs?: number | (() => number);
  /** Overall deadline. Default 900 000 (15 min). `Infinity` disables it. */
  deadlineMs?: number;
  signal?: AbortSignal;
}

/** Largest delay `setTimeout` honours; above it Node warns and fires after 1 ms. */
export const MAX_TIMER_MS = 2_147_483_647;

/**
 * A poll interval must be a finite number of milliseconds above zero. `NaN` (an unset
 * `Number(process.env.X)`) and `0` both reach `setTimeout` as a 1 ms timer and poll the vendor
 * at ~800 req/s until its 429 backoff bites (ship run #6, code-auditor probe).
 */
export function assertIntervalMs(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    throw new KlingValidationError('intervalMs', `intervalMs must be a finite number > 0, got ${String(value)}`);
  return value;
}

/**
 * A poll deadline must be above zero and either `Infinity` or within `setTimeout`'s range —
 * `wait()` arms one raw timer for it, and a value past 2^31-1 ms (~24.8 days) fires at once.
 */
export function assertDeadlineMs(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0 || (value !== Infinity && value > MAX_TIMER_MS))
    throw new KlingValidationError(
      'deadlineMs',
      `deadlineMs must be > 0 and either Infinity or <= ${MAX_TIMER_MS} ms, got ${String(value)}`
    );
  return value;
}

/**
 * Call `fn` every `intervalMs` until `until(value)` holds; the library's poller behind
 * `TaskHandle.wait()`. Rejects with the caller's abort reason, `KlingPollTimeoutError(last,
 * elapsed)` at the deadline, or whatever `fn` threw.
 */
export async function poll<T extends Task>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: PollOptions<T>
): Promise<T> {
  const { until, signal } = options;
  const deadlineMs = assertDeadlineMs(options.deadlineMs ?? DEFAULT_POLL_TIMEOUT);
  const configured = options.intervalMs;
  // A constant interval is checked before the first call; a function's return, before each sleep.
  const interval: () => number =
    typeof configured === 'function'
      ? () => assertIntervalMs(configured())
      : ((fixed) => () => fixed)(assertIntervalMs(configured ?? DEFAULT_POLL_INTERVAL));
  const started = Date.now();
  let last: T | null = null;

  for (;;) {
    if (signal?.aborted) throw signal.reason;
    last = await fn(signal);
    if (until(last)) return last;

    const elapsed = Date.now() - started;
    const remaining = deadlineMs - elapsed;
    if (remaining <= 0) throw new KlingPollTimeoutError(last, elapsed);
    await sleep(Math.min(Math.max(1, interval()), remaining), signal);
    if (Date.now() - started >= deadlineMs)
      throw new KlingPollTimeoutError(last, Date.now() - started);
  }
}

/** Abortable sleep. Rejects with `signal.reason` on abort; clears its timer either way. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
