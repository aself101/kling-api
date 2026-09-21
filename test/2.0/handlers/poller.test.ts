/** Library poller (spec D13; checklist 2a₁). Fake timers drive interval, deadline and abort. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../src/codecs/task.js';
import { poll, sleep } from '../../../src/handlers/poller.js';
import { KlingPollTimeoutError } from '../../../src/http/errors.js';

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
