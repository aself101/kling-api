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
import { KlingPollTimeoutError } from '../http/errors.js';
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

export async function poll<T extends Task>(fn: (signal?: AbortSignal) => Promise<T>, options: PollOptions<T>): Promise<T> {
  const { until, signal } = options;
  const deadlineMs = options.deadlineMs ?? DEFAULT_POLL_TIMEOUT;
  const configured = options.intervalMs;
  const interval: () => number = typeof configured === 'function' ? configured : () => configured ?? DEFAULT_POLL_INTERVAL;
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
    if (Date.now() - started >= deadlineMs) throw new KlingPollTimeoutError(last, Date.now() - started);
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
