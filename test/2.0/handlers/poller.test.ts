/** Library poller (spec D13; checklist 2a₁). Fake timers drive interval, deadline and abort. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../src/codecs/task.js';
import { MAX_TIMER_MS, poll, sleep } from '../../../src/handlers/poller.js';
import { KlingPollTimeoutError, KlingValidationError } from '../../../src/http/errors.js';

const task = (status: Task['status']): Task => ({ id: 't', standard: 'new', status, outputs: [], raw: {} });
const terminal = (t: Task) => t.status === 'succeeded' || t.status === 'failed';

/** Advance fake time by `ms` while letting microtasks between timers run. */
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('poll', () => {
  it('calls fn every intervalMs until `until` holds, then resolves with that value', async () => {
    const seq = [task('submitted'), task('processing'), task('succeeded')];
    const fn = vi.fn(async () => seq.shift()!);
    const p = poll(fn, { until: terminal, intervalMs: 1000 });
    await advance(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(999);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await advance(1000);
    expect(fn).toHaveBeenCalledTimes(3);
    await expect(p).resolves.toMatchObject({ status: 'succeeded' });
  });

  it('a function interval is re-read before each sleep', async () => {
    let interval = 5000;
    const seq = [task('processing'), task('processing'), task('succeeded')];
    const fn = vi.fn(async () => seq.shift()!);
    const p = poll(fn, { until: terminal, intervalMs: () => interval });
    await advance(0);
    interval = 100; // takes effect at the NEXT sleep; the current 5 s sleep runs out first
    await advance(4999);
    expect(fn).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await advance(100);
    expect(fn).toHaveBeenCalledTimes(3);
    await expect(p).resolves.toBeDefined();
  });

  it('deadline → KlingPollTimeoutError carrying the last value and elapsed ms; the sleep is clipped to the deadline', async () => {
    const fn = vi.fn(async () => task('processing'));
    const p = poll(fn, { until: terminal, intervalMs: 3000, deadlineMs: 4000 });
    const rejection = expect(p).rejects.toBeInstanceOf(KlingPollTimeoutError);
    await advance(4000);
    await rejection;
    // 0 s, 3 s, then a 1 s sleep clipped to the deadline (not a 3 s one) → exactly 2 calls, elapsed 4000.
    expect(fn).toHaveBeenCalledTimes(2);
    const err = await p.catch((e) => e as KlingPollTimeoutError);
    expect(err.elapsedMs).toBe(4000);
    expect(err.task).toMatchObject({ status: 'processing' });
  });

  it('abort → rejects with the caller’s own reason, unwrapped; fn is not called again', async () => {
    const ac = new AbortController();
    const fn = vi.fn(async () => task('processing'));
    const p = poll(fn, { until: terminal, intervalMs: 1000, signal: ac.signal });
    const reason = new DOMException('stop', 'AbortError');
    const rejection = expect(p).rejects.toBe(reason);
    await advance(0);
    ac.abort(reason);
    await rejection;
    await advance(5000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('an already-aborted signal rejects before the first call', async () => {
    const ac = new AbortController();
    ac.abort(new Error('pre'));
    const fn = vi.fn(async () => task('succeeded'));
    await expect(poll(fn, { until: terminal, signal: ac.signal })).rejects.toThrow('pre');
    expect(fn).not.toHaveBeenCalled();
  });

  it('an error from fn propagates as-is (the loop does not swallow it)', async () => {
    const boom = new Error('vendor 5000');
    await expect(poll(async () => { throw boom; }, { until: terminal })).rejects.toBe(boom);
  });
});

describe('sleep', () => {
  it('resolves after ms; abort rejects with the reason and clears the timer', async () => {
    const ok = sleep(500);
    await advance(500);
    await expect(ok).resolves.toBeUndefined();
    const ac = new AbortController();
    const p = sleep(10_000, ac.signal);
    ac.abort('why');
    await expect(p).rejects.toBe('why');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('poll — deadline boundary (ship run #4)', () => {
  it('when remaining hits exactly 0 at the pre-sleep check, no extra sleep is scheduled — the throw comes from that check', async () => {
    // deadline == interval: after the first poll, elapsed 0, remaining 3000 → sleep 3000 → post-sleep check trips.
    // With a 3000 deadline and an fn that itself takes 3000 ms (fake timers), the pre-sleep check sees remaining === 0.
    let calls = 0;
    const timersArmed = vi.spyOn(globalThis, 'setTimeout');
    const fn = vi.fn(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 3000)); // the poll itself consumes the whole deadline
      return task('processing');
    });
    const p = poll(fn, { until: terminal, intervalMs: 3000, deadlineMs: 3000 });
    let settled = false;
    p.catch(() => undefined).finally(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(3000);
    // The rejection must already be in flight from the pre-sleep check — under the `< 0` mutation it
    // would need another tick (sleep(0)) and this assertion fails cleanly instead of hanging.
    await Promise.resolve();
    expect(settled).toBe(true);
    await expect(p).rejects.toBeInstanceOf(KlingPollTimeoutError);
    expect(calls).toBe(1);
    // Exactly one timer: fn's own. Under the `remaining < 0` mutation the pre-sleep check
    // would pass at 0 and `sleep(0)` would arm a second timer before the post-sleep check threw.
    expect(timersArmed).toHaveBeenCalledTimes(1);
    timersArmed.mockRestore();
  });
});

describe('poll — ship run #6 option validation (code-auditor probe)', () => {
  const never = vi.fn(async () => task('processing'));

  it.each([NaN, 0, -1, Infinity])('intervalMs %s is KlingValidationError(intervalMs) before the first call', async (intervalMs) => {
    never.mockClear();
    const err = await poll(never, { until: terminal, intervalMs }).catch((e) => e as KlingValidationError);
    expect(err).toBeInstanceOf(KlingValidationError);
    expect(err.field).toBe('intervalMs');
    expect(never).not.toHaveBeenCalled();
  });

  it('a function interval that returns NaN is rejected at the first sleep, not slept for 1 ms', async () => {
    const seq = [task('processing'), task('processing')];
    const fn = vi.fn(async () => seq.shift() ?? task('processing'));
    const p = poll(fn, { until: terminal, intervalMs: () => NaN });
    const rejects = expect(p).rejects.toMatchObject({ field: 'intervalMs' });
    await advance(0);
    await rejects;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each([NaN, 0, -5, MAX_TIMER_MS + 1])('deadlineMs %s is KlingValidationError(deadlineMs)', async (deadlineMs) => {
    const err = await poll(never, { until: terminal, intervalMs: 1000, deadlineMs }).catch((e) => e as KlingValidationError);
    expect(err).toBeInstanceOf(KlingValidationError);
    expect(err.field).toBe('deadlineMs');
  });

  it('control: Infinity and MAX_TIMER_MS deadlines are accepted (the check can pass)', async () => {
    const seq = [task('processing'), task('succeeded')];
    const fn = vi.fn(async () => seq.shift() ?? task('succeeded'));
    const p = poll(fn, { until: terminal, intervalMs: 1000, deadlineMs: Infinity });
    await advance(1000);
    await expect(p).resolves.toMatchObject({ status: 'succeeded' });
    const seq2 = [task('succeeded')];
    await expect(poll(async () => seq2[0]!, { until: terminal, intervalMs: 1, deadlineMs: MAX_TIMER_MS })).resolves.toMatchObject({ status: 'succeeded' });
  });
});
