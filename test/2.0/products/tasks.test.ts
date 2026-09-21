/**
 * TasksApi + TaskHandle (spec D5, D10; checklist 2a₁). A real HttpCore over a routed
 * fake fetch — the seam is the URL and body the core actually sends, so these tests also
 * pin the query-string and body contracts (`task_ids`, `external_task_ids`, `POST /tasks`
 * `filters[]`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpCore } from '../../../src/http/core.js';
import {
  KlingAPIError,
  KlingBatchError,
  KlingPollTimeoutError,
  KlingTaskFailedError,
  KlingTaskNotFoundError,
  KlingValidationError,
} from '../../../src/http/errors.js';
import { LEGACY_PRODUCT_PATHS, TASKS_CHUNK_SIZE, TasksApi, createHandle, resolveExternalId, standardOf } from '../../../src/products/tasks.js';
import { fixture } from '../codecs/fixtures.js';

interface Call {
  url: URL;
  method: string;
  body?: unknown;
}
type Route = (call: Call) => { status?: number; json: unknown } | { throw: unknown };

function rig(route: Route) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = { url: new URL(String(input)), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const r = route(call);
    if ('throw' in r) throw r.throw;
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const warnings: string[] = [];
  const logger = { debug: () => undefined, info: () => undefined, warn: (m: string) => void warnings.push(m), error: () => undefined };
  const core = new HttpCore({ apiKey: 'k-test', fetch: fetchImpl, retry: { maxAttempts: 1 } }, { sleep: async () => undefined });
  return { core, logger, calls, warnings, tasks: new TasksApi(core, logger) };
}

const ok = (data: unknown) => ({ json: { code: 0, message: 'SUCCEED', request_id: 'r', data } });
const newRec = (id: string, status = 'succeeded', extra: Record<string, unknown> = {}) => ({ id, status, create_time: 1781080778802, update_time: 1781080794151, ...extra });
const legacyRec = (id: string, status = 'succeed') => ({ task_id: id, task_status: status, created_at: 1722769557708, updated_at: 1722769557708 });
const apiError = (code: number, status: number) => ({ status, json: { code, message: `vendor ${code}`, request_id: 'r-err' } });

describe('routing table', () => {
  it('every Product resolves to a standard; legacy paths match spec D5', () => {
    expect(standardOf('text-to-video')).toBe('new');
    expect(standardOf('motion-control')).toBe('new');
    expect(standardOf('image-generation')).toBe('legacy');
    expect(standardOf('voice')).toBe('legacy');
    expect(LEGACY_PRODUCT_PATHS).toEqual({
      'image-generation': '/v1/images/generations',
      'omni-image': '/v1/images/omni-image',
      'multi-image-to-image': '/v1/images/multi-image2image',
      outpainting: '/v1/images/editing/expand',
      'subject-completion': '/v1/general/ai-multi-shot',
      avatar: '/v1/videos/avatar/image2video',
      element: '/v1/general/advanced-custom-elements',
      voice: '/v1/general/custom-voices',
    });
    expect(() => standardOf('tts' as never)).toThrow(KlingValidationError);
  });

  it('resolveExternalId: caller value wins, false opts out, otherwise a UUID', () => {
    expect(resolveExternalId('mine')).toBe('mine');
    expect(resolveExternalId(false)).toBeUndefined();
    const a = resolveExternalId(undefined);
    const b = resolveExternalId(undefined);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a).not.toBe(b);
  });
});

describe('tasks.get (GET /tasks)', () => {
  it('sends task_ids comma-joined, parses data[], reports unknown ids as missing', async () => {
    const { tasks, calls } = rig(() => ok([newRec('a'), newRec('c')]));
    const res = await tasks.get(['a', 'b', 'c']);
    expect(calls[0].url.pathname).toBe('/tasks');
    expect(calls[0].url.searchParams.get('task_ids')).toBe('a,b,c');
    expect(res.tasks.map((t) => t.id)).toEqual(['a', 'c']);
    expect(res.missing).toEqual(['b']);
    expect(res.tasks[0]).not.toHaveProperty('product');
  });

  it('byExternalId uses external_task_ids and matches on externalId', async () => {
    const { tasks, calls } = rig(() => ok([newRec('a', 'succeeded', { external_id: 'x1' })]));
    const res = await tasks.get('x1', { byExternalId: true });
    expect(calls[0].url.searchParams.get('external_task_ids')).toBe('x1');
    expect(calls[0].url.searchParams.has('task_ids')).toBe(false);
    expect(res.missing).toEqual([]);
  });

  it('45 ids → 3 sequential chunks of 20/20/5 (the live cap is 20 — §11 Q13)', async () => {
    const ids = Array.from({ length: 45 }, (_, i) => `t${i}`);
    const { tasks, calls } = rig((c) => ok(c.url.searchParams.get('task_ids')!.split(',').map((id) => newRec(id))));
    const res = await tasks.get(ids);
    expect(calls).toHaveLength(3);
    expect(calls.map((c) => c.url.searchParams.get('task_ids')!.split(',').length)).toEqual([20, 20, 5]);
    expect(res.tasks).toHaveLength(45);
    expect(res.missing).toEqual([]);
    expect(TASKS_CHUNK_SIZE).toBe(20);
  });

  it('chunk 2 fails → KlingBatchError with chunk-1 tasks, chunk-1 missing, and the 5 never-sent ids as unattempted', async () => {
    const ids = Array.from({ length: 45 }, (_, i) => `t${i}`);
    let n = 0;
    const { tasks } = rig((c) => {
      n++;
      if (n === 2) return apiError(5000, 500);
      // chunk 1 returns all but t7
      return ok(c.url.searchParams.get('task_ids')!.split(',').filter((id) => id !== 't7').map((id) => newRec(id)));
    });
    const err = await tasks.get(ids).catch((e) => e as KlingBatchError);
    expect(err).toBeInstanceOf(KlingBatchError);
    expect(err.tasks).toHaveLength(19);
    expect(err.missing).toEqual(['t7']);
    expect(err.unattempted).toEqual(ids.slice(40));
    expect(err.cause).toBeInstanceOf(KlingAPIError);
  });

  it('empty input → no request', async () => {
    const { tasks, calls } = rig(() => ok([]));
    expect(await tasks.get([])).toEqual({ tasks: [], missing: [] });
    expect(calls).toHaveLength(0);
  });
});

describe('tasks.list (POST /tasks)', () => {
  it('builds the vendor body: numeric ms times, cursor, limit, filters[] from status/productType', async () => {
    const { tasks, calls } = rig(() => ({ json: fixture('new/tasks-cursor.json') }));
    const page = await tasks.list({ startTime: 1, endTime: 2, cursor: 'c', limit: 500, status: ['succeeded', 'failed'], productType: 'video' });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({
      start_time: 1,
      end_time: 2,
      cursor: 'c',
      limit: 500,
      filters: [
        { key: 'status', values: ['succeeded', 'failed'] },
        { key: 'product_type', values: ['video'] },
      ],
    });
    expect(page.hasMore).toBe(true);
    expect(page.tasks[0]).not.toHaveProperty('product'); // never back-filled
  });

  it('omits unset fields; limit outside 1–500 or non-integer → KlingValidationError before any request', async () => {
    const { tasks, calls } = rig(() => ok({ result: [], count: 0, has_more: false }));
    await tasks.list();
    expect(calls[0].body).toEqual({});
    await expect(tasks.list({ limit: 501 })).rejects.toBeInstanceOf(KlingValidationError);
    await expect(tasks.list({ limit: 0 })).rejects.toThrow(/limit/);
    await expect(tasks.list({ limit: 2.5 })).rejects.toThrow(/limit/);
    expect(calls).toHaveLength(1);
  });
});

describe('tasks.getByProduct / listByProduct / recover', () => {
  it('new-standard product → GET /tasks?task_ids=, product back-filled from the argument', async () => {
    const { tasks, calls } = rig(() => ok([newRec('v1')]));
    const t = await tasks.getByProduct('text-to-video', 'v1');
    expect(calls[0].url.pathname).toBe('/tasks');
    expect(t.product).toBe('text-to-video');
  });

  it('new-standard product, vendor answers [] → KlingTaskNotFoundError (the only signal there is)', async () => {
    const { tasks } = rig(() => ok([]));
    const err = await tasks.getByProduct('text-to-video', 'ghost').catch((e) => e as KlingTaskNotFoundError);
    expect(err).toBeInstanceOf(KlingTaskNotFoundError);
    expect(err).toMatchObject({ product: 'text-to-video', id: 'ghost', byExternalId: false });
    expect(err.message).toMatch(/not visible to this account/);
  });

  it('legacy product → GET /v1/<path>/{id}, id URL-encoded, parsed by the legacy codec with product set', async () => {
    const { tasks, calls } = rig(() => ok(legacyRec('i 1')));
    const t = await tasks.getByProduct('image-generation', 'i 1');
    expect(calls[0].url.pathname).toBe('/v1/images/generations/i%201');
    expect(t).toMatchObject({ id: 'i 1', standard: 'legacy', product: 'image-generation', status: 'succeeded' });
  });

  it('legacy not-found: the LIVE shape (400 / 1201 "Task not found by id/external id") and the table\'s 1203 both → KlingTaskNotFoundError; a plain 1201 does not', async () => {
    const live = rig(() => ({ status: 400, json: { code: 1201, message: 'Task not found by id/external id: x', request_id: 'r-err' } }));
    const err = await live.tasks.getByProduct('avatar', 'x').catch((e) => e as KlingTaskNotFoundError);
    expect(err).toBeInstanceOf(KlingTaskNotFoundError);
    expect(err.cause).toBeInstanceOf(KlingAPIError);
    expect(err.requestId).toBe('r-err');
    const table = rig(() => apiError(1203, 404));
    await expect(table.tasks.getByProduct('avatar', 'x')).rejects.toBeInstanceOf(KlingTaskNotFoundError);
    // Control: 1201 with a different message is a real parameter error and must surface as such.
    const param = rig(() => ({ status: 400, json: { code: 1201, message: 'pageSize out of range', request_id: 'r' } }));
    await expect(param.tasks.getByProduct('avatar', 'x')).rejects.toBeInstanceOf(KlingAPIError);
    const other = rig(() => apiError(1000, 401));
    await expect(other.tasks.getByProduct('avatar', 'x')).rejects.toBeInstanceOf(KlingAPIError);
  });

  it('listByProduct → GET /v1/<path>?pageNum&pageSize; bounds enforced before the request', async () => {
    const { tasks, calls } = rig(() => ({ json: fixture('legacy/voice-list.json') }));
    const list = await tasks.listByProduct('voice', { pageNum: 2, pageSize: 10 });
    expect(calls[0].url.pathname).toBe('/v1/general/custom-voices');
    expect(calls[0].url.searchParams.get('pageNum')).toBe('2');
    expect(calls[0].url.searchParams.get('pageSize')).toBe('10');
    expect(list[0]).toMatchObject({ product: 'voice', standard: 'legacy' });
    await expect(tasks.listByProduct('voice', { pageNum: 0 })).rejects.toThrow(/pageNum/);
    await expect(tasks.listByProduct('voice', { pageSize: 1001 })).rejects.toThrow(/pageSize must be an integer in 1–1000/);
    await expect(tasks.listByProduct('element', { pageSize: 501 })).rejects.toThrow(/pageSize must be an integer in 1–500/);
    await expect(tasks.listByProduct('text-to-video' as never)).rejects.toThrow(/new-standard/);
    expect(calls).toHaveLength(1);
  });

  it('recover: new-standard → external_task_ids, null when absent; legacy → /{externalId}, null on 1203', async () => {
    const found = rig(() => ok([newRec('v9', 'processing', { external_id: 'e-9' })]));
    const t = await found.tasks.recover('image-to-video', 'e-9');
    expect(found.calls[0].url.searchParams.get('external_task_ids')).toBe('e-9');
    expect(t).toMatchObject({ id: 'v9', externalId: 'e-9', product: 'image-to-video' });

    const absent = rig(() => ok([]));
    expect(await absent.tasks.recover('image-to-video', 'e-0')).toBeNull();

    const leg = rig(() => ok(legacyRec('i2')));
    const lt = await leg.tasks.recover('omni-image', 'e-2');
    expect(leg.calls[0].url.pathname).toBe('/v1/images/omni-image/e-2');
    expect(lt).toMatchObject({ id: 'i2', product: 'omni-image' });

    const gone = rig(() => ({ status: 400, json: { code: 1201, message: 'Task not found by id/external id: e-3', request_id: 'r' } }));
    expect(await gone.tasks.recover('omni-image', 'e-3')).toBeNull();

    const broken = rig(() => apiError(5000, 500));
    await expect(broken.tasks.recover('omni-image', 'e-4')).rejects.toBeInstanceOf(KlingAPIError);
  });

  it('codec warnings reach the logger passed to TasksApi', async () => {
    const { tasks, warnings } = rig(() => ok([newRec('w', 'succeeded', { outputs: [{ type: 'hologram' }] })]));
    await tasks.get('w');
    expect(warnings).toEqual([expect.stringMatching(/unknown output type "hologram"/)]);
  });
});

describe('TaskHandle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const statuses = (...s: string[]) => {
    const q = [...s];
    return () => q.length > 1 ? q.shift()! : q[0];
  };

  it('shape: id, standard, product, request, externalId (absent when opted out); get() routes by product', async () => {
    const { core, logger, calls } = rig(() => ok(legacyRec('i1')));
    const h = createHandle(core, logger, 'image-generation', 'i1', { model: 'kling-v3' }, 'ext');
    expect(h).toMatchObject({ id: 'i1', standard: 'legacy', product: 'image-generation', request: { model: 'kling-v3' }, externalId: 'ext' });
    const t = await h.get();
    expect(calls[0].url.pathname).toBe('/v1/images/generations/i1');
    expect(t.product).toBe('image-generation');
    expect(createHandle(core, logger, 'text-to-video', 'v', {})).not.toHaveProperty('externalId');
  });

  it('wait(): polls until succeeded; a failed task rejects with KlingTaskFailedError(task, null)', async () => {
    const next = statuses('submitted', 'processing', 'succeeded');
    const { core, logger, calls } = rig(() => ok([newRec('v1', next())]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const p = h.wait({ intervalMs: 1000 });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toMatchObject({ status: 'succeeded' });
    expect(calls).toHaveLength(3);

    const failing = rig(() => ok([newRec('v2', 'failed', { message: 'risk control' })]));
    const err = await createHandle(failing.core, failing.logger, 'text-to-video', 'v2', {}).wait().catch((e) => e as KlingTaskFailedError);
    expect(err).toBeInstanceOf(KlingTaskFailedError);
    expect(err.code).toBeNull();
    expect(err.task.message).toBe('risk control');
  });

  it('two concurrent wait()s share ONE poll loop at the shortest interval and both resolve', async () => {
    const next = statuses('processing', 'processing', 'processing', 'succeeded');
    const { core, logger, calls } = rig(() => ok([newRec('v1', next())]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const a = h.wait({ intervalMs: 1000 });
    const b = h.wait({ intervalMs: 5000 });
    await vi.advanceTimersByTimeAsync(3000);
    // One request per tick at the 1 s interval — not two loops, not the 5 s interval.
    expect(calls).toHaveLength(4);
    await expect(a).resolves.toMatchObject({ status: 'succeeded' });
    await expect(b).resolves.toMatchObject({ status: 'succeeded' });
  });

  it('per-caller abort: only the aborting caller rejects (with ITS reason); the other keeps polling and resolves', async () => {
    const next = statuses('processing', 'processing', 'succeeded');
    const { core, logger, calls } = rig(() => ok([newRec('v1', next())]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const ac = new AbortController();
    const reason = new DOMException('caller B gave up', 'AbortError');
    const a = h.wait({ intervalMs: 1000 });
    const b = h.wait({ intervalMs: 1000, signal: ac.signal });
    const bRejects = expect(b).rejects.toBe(reason);
    await vi.advanceTimersByTimeAsync(500);
    ac.abort(reason);
    await bRejects;
    await vi.advanceTimersByTimeAsync(2000);
    await expect(a).resolves.toMatchObject({ status: 'succeeded' });
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('per-caller deadline: the 5 s caller times out alone with KlingPollTimeoutError; the 60 s caller resolves', async () => {
    const next = statuses('processing', 'processing', 'processing', 'processing', 'processing', 'processing', 'processing', 'succeeded');
    const { core, logger } = rig(() => ok([newRec('v1', next())]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const short = h.wait({ intervalMs: 1000, deadlineMs: 5000 });
    const long = h.wait({ intervalMs: 1000, deadlineMs: 60_000 });
    const shortRejects = expect(short).rejects.toBeInstanceOf(KlingPollTimeoutError);
    await vi.advanceTimersByTimeAsync(5000);
    await shortRejects;
    await vi.advanceTimersByTimeAsync(3000);
    await expect(long).resolves.toMatchObject({ status: 'succeeded' });
  });

  it('the loop stops when the last subscriber settles — no further requests after everyone left', async () => {
    const { core, logger, calls } = rig(() => ok([newRec('v1', 'processing')]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const ac = new AbortController();
    const p = h.wait({ intervalMs: 1000, signal: ac.signal });
    await vi.advanceTimersByTimeAsync(1500);
    const before = calls.length;
    const rej = expect(p).rejects.toBeDefined();
    ac.abort(new Error('done'));
    await rej;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls.length).toBe(before);
    // A new wait() after the loop ended starts a fresh loop.
    const again = h.wait({ intervalMs: 1000, deadlineMs: 1500 });
    const againRej = expect(again).rejects.toBeInstanceOf(KlingPollTimeoutError);
    await vi.advanceTimersByTimeAsync(1500);
    await againRej;
    expect(calls.length).toBeGreaterThan(before);
  });

  it('a poll get() that fails (read retries exhausted) surfaces its KlingAPIError to every subscriber', async () => {
    let n = 0;
    const { core, logger } = rig(() => (++n < 2 ? ok([newRec('v1', 'processing')]) : apiError(5000, 500)));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const a = h.wait({ intervalMs: 1000 });
    const b = h.wait({ intervalMs: 1000 });
    const ra = expect(a).rejects.toBeInstanceOf(KlingAPIError);
    const rb = expect(b).rejects.toBeInstanceOf(KlingAPIError);
    await vi.advanceTimersByTimeAsync(1000);
    await ra;
    await rb;
  });

  it('an already-aborted signal rejects immediately and never starts a loop', async () => {
    const { core, logger, calls } = rig(() => ok([newRec('v1', 'processing')]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const ac = new AbortController();
    ac.abort('pre');
    await expect(h.wait({ signal: ac.signal })).rejects.toBe('pre');
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(0);
  });
});

// ── ship run #4 fixes ─────────────────────────────────────────────────────────────────

describe('TaskHandle — ship run #4 regressions', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('abort-then-retry on one handle: the second wait() polls and resolves instead of inheriting the dying loop\'s AbortError', async () => {
    const statuses = ['processing', 'processing', 'succeeded'];
    const { core, logger, calls } = rig(() => ok([newRec('v1', statuses.length > 1 ? statuses.shift()! : statuses[0])]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const ac = new AbortController();
    const first = h.wait({ intervalMs: 1000, signal: ac.signal });
    const firstRejects = expect(first).rejects.toThrow('gave up');
    await vi.advanceTimersByTimeAsync(500);
    ac.abort(new Error('gave up'));
    await firstRejects;
    // The idiomatic retry, in the same microtask window the dying loop's catch runs in.
    const second = h.wait({ intervalMs: 1000, deadlineMs: 10_000 });
    await vi.advanceTimersByTimeAsync(3000);
    await expect(second).resolves.toMatchObject({ status: 'succeeded' });
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('wait().catch(() => wait()) — the chained form — also polls again', async () => {
    const statuses = ['processing', 'succeeded'];
    const { core, logger, calls } = rig(() => ok([newRec('v1', statuses.length > 1 ? statuses.shift()! : statuses[0])]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const ac = new AbortController();
    const p = h.wait({ intervalMs: 1000, signal: ac.signal }).catch(() => h.wait({ intervalMs: 1000, deadlineMs: 10_000 }));
    await vi.advanceTimersByTimeAsync(100);
    ac.abort('stop');
    await vi.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toMatchObject({ status: 'succeeded' });
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('a per-caller timeout carries the last task the loop saw (not null once a poll has completed)', async () => {
    const { core, logger } = rig(() => ok([newRec('v1', 'processing', { message: 'still rendering' })]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const p = h.wait({ intervalMs: 1000, deadlineMs: 2500 });
    const rej = expect(p).rejects.toBeInstanceOf(KlingPollTimeoutError);
    await vi.advanceTimersByTimeAsync(2500);
    await rej;
    const err = await p.catch((e) => e as KlingPollTimeoutError);
    expect(err.task).toMatchObject({ id: 'v1', status: 'processing', message: 'still rendering' });
    expect(err.elapsedMs).toBeGreaterThanOrEqual(2500);
  });
});

describe('TaskHandle — ship run #6 wait() option validation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('wait({ intervalMs: NaN }) rejects with KlingValidationError and never polls (no 1 ms storm)', async () => {
    const { core, logger, calls } = rig(() => ok([newRec('v1', 'processing')]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const err = await h.wait({ intervalMs: Number('') }).catch((e) => e as KlingValidationError);
    expect(err).toBeInstanceOf(KlingValidationError);
    expect(err.field).toBe('intervalMs');
    await vi.advanceTimersByTimeAsync(200);
    expect(calls).toHaveLength(0);
  });

  it('wait({ deadlineMs: 30 days }) rejects with KlingValidationError instead of timing out in 1 ms', async () => {
    const { core, logger } = rig(() => ok([newRec('v1', 'processing')]));
    const h = createHandle(core, logger, 'text-to-video', 'v1', {});
    const err = await h.wait({ intervalMs: 1000, deadlineMs: 30 * 86_400_000 }).catch((e) => e as KlingValidationError);
    expect(err).toBeInstanceOf(KlingValidationError);
    expect(err.field).toBe('deadlineMs');
    // control: Infinity disables the deadline and the handle still resolves.
    const statuses = ['processing', 'succeeded'];
    const r2 = rig(() => ok([newRec('v2', statuses.length > 1 ? statuses.shift()! : statuses[0])]));
    const h2 = createHandle(r2.core, r2.logger, 'text-to-video', 'v2', {});
    const p = h2.wait({ intervalMs: 1000, deadlineMs: Infinity });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toMatchObject({ status: 'succeeded' });
  });
});
