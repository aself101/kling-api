/**
 * Task-read coalescing (ship run #6, de20644f). The property under test is the one the
 * anxiety read named: N in-flight handles must not be N requests per tick.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../src/codecs/task.js';
import { COALESCE_CHUNK, TaskReadCoalescer } from '../../../src/handlers/coalescer.js';

const task = (id: string, status: Task['status'] = 'processing'): Task => ({
  id,
  standard: 'new',
  status,
  outputs: [],
  raw: { id },
});

/** Records each wire call's id list; answers with a task per id unless told to omit or throw. */
function fetcher(options: { omit?: string[]; throwOn?: (ids: string[]) => unknown } = {}) {
  const calls: string[][] = [];
  const fn = async (ids: string[]): Promise<Task[]> => {
    calls.push(ids);
    const boom = options.throwOn?.(ids);
    if (boom) throw boom;
    return ids.filter((id) => !options.omit?.includes(id)).map((id) => task(id));
  };
  return { fn, calls };
}

describe('TaskReadCoalescer', () => {
  it('reads issued in one tick become ONE request — 12 handles, 1 wire call', async () => {
    const { fn, calls } = fetcher();
    const c = new TaskReadCoalescer(fn);
    const ids = Array.from({ length: 12 }, (_, i) => `t${i}`);
    const results = await Promise.all(ids.map((id) => c.read(id)));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(ids);
    expect(results.map((t) => t?.id)).toEqual(ids);
  });

  it('CONTROL — reads in separate ticks are separate requests (the batching is real, not an artefact of the rig)', async () => {
    const { fn, calls } = fetcher();
    const c = new TaskReadCoalescer(fn);
    await c.read('a');
    await c.read('b');
    expect(calls).toEqual([['a'], ['b']]);
  });

  it(`chunks at the vendor's cap of ${COALESCE_CHUNK}: 45 ids → 20/20/5`, async () => {
    const { fn, calls } = fetcher();
    const c = new TaskReadCoalescer(fn);
    const ids = Array.from({ length: 45 }, (_, i) => `t${i}`);
    const results = await Promise.all(ids.map((id) => c.read(id)));
    expect(calls.map((c) => c.length)).toEqual([20, 20, 5]);
    expect(results.every((t, i) => t?.id === ids[i])).toBe(true);
  });

  it('the same id asked for twice is one wire id, and both callers get the task', async () => {
    const { fn, calls } = fetcher();
    const c = new TaskReadCoalescer(fn);
    const [a, b] = await Promise.all([c.read('dup'), c.read('dup')]);
    expect(calls).toEqual([['dup']]);
    expect(a?.id).toBe('dup');
    expect(b?.id).toBe('dup');
  });

  it('an id the vendor does not return resolves undefined — absence is the only not-found signal', async () => {
    const { fn } = fetcher({ omit: ['gone'] });
    const c = new TaskReadCoalescer(fn);
    const [here, gone] = await Promise.all([c.read('here'), c.read('gone')]);
    expect(here?.id).toBe('here');
    expect(gone).toBeUndefined();
  });

  it('a failing chunk rejects ONLY its own waiters — the other chunk still resolves', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `t${i}`);
    const boom = new Error('chunk 1 exploded');
    const { fn, calls } = fetcher({ throwOn: (sent) => (sent.includes('t0') ? boom : undefined) });
    const c = new TaskReadCoalescer(fn);
    const settled = await Promise.allSettled(ids.map((id) => c.read(id)));
    expect(calls.map((c) => c.length)).toEqual([20, 5]);
    expect(settled.slice(0, 20).every((r) => r.status === 'rejected' && r.reason === boom)).toBe(true);
    expect(settled.slice(20).every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it("a caller's abort rejects THAT caller and drops them from the batch; everyone else is unaffected", async () => {
    const { fn, calls } = fetcher();
    const c = new TaskReadCoalescer(fn);
    const ac = new AbortController();
    const cancelled = c.read('mine', ac.signal);
    const other = c.read('theirs');
    ac.abort(new Error('caller cancelled'));
    await expect(cancelled).rejects.toThrow('caller cancelled');
    await expect(other).resolves.toMatchObject({ id: 'theirs' });
    expect(calls).toEqual([['theirs']]); // the aborted id never reached the wire
  });

  it('an already-aborted signal rejects without touching the batch', async () => {
    const { fn, calls } = fetcher();
    const c = new TaskReadCoalescer(fn);
    const ac = new AbortController();
    ac.abort('pre');
    await expect(c.read('x', ac.signal)).rejects.toBe('pre');
    expect(calls).toEqual([]);
  });

  it('aborting one of two waiters on the SAME id keeps the id on the wire for the other', async () => {
    const { fn, calls } = fetcher();
    const c = new TaskReadCoalescer(fn);
    const ac = new AbortController();
    const cancelled = c.read('shared', ac.signal);
    const kept = c.read('shared');
    ac.abort('bye');
    await expect(cancelled).rejects.toBe('bye');
    await expect(kept).resolves.toMatchObject({ id: 'shared' });
    expect(calls).toEqual([['shared']]);
  });

  it('a settled waiter leaves no abort listener on the caller signal', async () => {
    const { fn } = fetcher();
    const c = new TaskReadCoalescer(fn);
    const ac = new AbortController();
    const remove = vi.spyOn(ac.signal, 'removeEventListener');
    await c.read('x', ac.signal);
    expect(remove).toHaveBeenCalled();
  });

  it('a forced millisecond window batches across ticks (the timed mode still works)', async () => {
    vi.useFakeTimers();
    try {
      const { fn, calls } = fetcher();
      const c = new TaskReadCoalescer(fn, { windowMs: 20 });
      const a = c.read('a');
      await vi.advanceTimersByTimeAsync(5);
      const b = c.read('b');
      await vi.advanceTimersByTimeAsync(20);
      await Promise.all([a, b]);
      expect(calls).toEqual([['a', 'b']]);
    } finally {
      vi.useRealTimers();
    }
  });
});
