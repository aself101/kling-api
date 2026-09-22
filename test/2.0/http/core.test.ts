/**
 * HttpCore through the fake-fetch seam (spec D20). These tests prove the core against a
 * MODEL of fetch; the three undici-specific behaviours (manual redirect Location, cause.code,
 * abort mid-body) get real-undici integration tests in 1c (spec V14).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpCore, type HttpRequest } from '../../../src/http/core.js';
import {
  KlingAPIError,
  KlingNetworkError,
  KlingResponseError,
  KlingTimeoutError,
  KlingValidationError,
} from '../../../src/http/errors.js';

type Step =
  | { json: unknown; status?: number; headers?: Record<string, string> }
  | { text: string; status?: number; headers?: Record<string, string> }
  | { throw: unknown }
  | { stall: true } // never resolves the body → deadline must fire
  | { hang: true }; // never resolves fetch itself

interface Recorded {
  url: string;
  init: RequestInit;
}

/** A scripted fetch: consumes one Step per call, records every call. */
function fakeFetch(steps: Step[]) {
  const calls: Recorded[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    const step = steps.shift();
    if (!step) throw new Error('fakeFetch: no scripted step left');
    if ('throw' in step) throw step.throw;
    if ('hang' in step) {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new DOMException('aborted', 'AbortError')));
      });
    }
    if ('stall' in step) {
      // Headers arrive; the body never does. `text()` must reject on abort.
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason ?? new DOMException('aborted', 'AbortError')));
        },
      });
      return new Response(body, { status: 200 });
    }
    const status = step.status ?? 200;
    const headers = new Headers(step.headers);
    const text = 'json' in step ? JSON.stringify(step.json) : step.text;
    return new Response(status === 204 ? null : text, { status, headers });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const sleeps: number[] = [];
const sleep = async (ms: number) => {
  sleeps.push(ms);
};

function core(steps: Step[], overrides: Partial<ConstructorParameters<typeof HttpCore>[0]> = {}) {
  const { fetchImpl, calls } = fakeFetch(steps);
  // jitter: 'none' by default in this rig — these tests assert the EXPONENTIAL schedule, which
  // is still a contract. The jitter that now sits on top of it has its own tests below, with an
  // injected `random` (ship run #6).
  const c = new HttpCore(
    { apiKey: 'k-1234', fetch: fetchImpl, timeout: 50, ...overrides, retry: { jitter: 'none', ...overrides.retry } },
    { sleep }
  );
  return { core: c, calls };
}

const READ: HttpRequest = { method: 'GET', path: '/tasks', query: { task_ids: '0' }, kind: 'read' };
const WRITE: HttpRequest = {
  method: 'POST',
  path: '/text-to-video/kling-3.0-turbo',
  body: { prompt: 'x' },
  kind: 'write',
  externalId: 'ext-1',
};
const OK = { json: { code: 0, message: 'SUCCEED', request_id: 'r-ok', data: { id: '1' } } };

beforeEach(() => {
  sleeps.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('construction', () => {
  it('rejects a non-https baseUrl and an empty key', () => {
    const { fetchImpl } = fakeFetch([]);
    expect(() => new HttpCore({ apiKey: 'k', baseUrl: 'http://api.example', fetch: fetchImpl })).toThrow(KlingValidationError);
    expect(() => new HttpCore({ apiKey: '', fetch: fetchImpl })).toThrow(KlingValidationError);
  });

  it('never exposes the key: describeCredential is redacted', () => {
    const { core: c } = core([]);
    expect(c.describeCredential()).toBe('***1234');
    expect(JSON.stringify(c)).not.toContain('k-1234');
  });
});

describe('request shape', () => {
  it('sends the bearer header, JSON body, manual redirect, and omits undefined query params', async () => {
    const { core: c, calls } = core([OK]);
    await c.request({ ...READ, query: { task_ids: '0', external_task_ids: undefined } });
    expect(calls[0].url).toBe('https://api-singapore.klingai.com/tasks?task_ids=0');
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.Authorization).toBe('Bearer k-1234');
    expect(h['Content-Type']).toBe('application/json');
    expect(calls[0].init.redirect).toBe('manual');
    expect(calls[0].init.body).toBeUndefined();
  });

  it('POST serialises the body once and returns the envelope with request_id and attempt', async () => {
    const { core: c, calls } = core([OK]);
    const res = await c.request(WRITE);
    expect(calls[0].init.body).toBe('{"prompt":"x"}');
    expect(res.envelope.data).toEqual({ id: '1' });
    expect(res.requestId).toBe('r-ok');
    expect(res.attempt).toBe(1);
  });
});

describe('response classification', () => {
  it('code !== 0 → KlingAPIError with httpStatus, request descriptor, requestId', async () => {
    const { core: c } = core([{ status: 429, json: { code: 1303, message: 'parallel task over resource pack limit', request_id: 'r1' } }]);
    const err = await c.request(WRITE).catch((e) => e);
    expect(err).toBeInstanceOf(KlingAPIError);
    expect(err.code).toBe(1303);
    expect(err.httpStatus).toBe(429);
    expect(err.requestId).toBe('r1');
    expect(err.request.externalId).toBe('ext-1');
    expect(err.taskState).toBe('not-created');
  });

  it('a 3xx is surfaced with its Location and never followed or retried', async () => {
    const { core: c, calls } = core([{ status: 302, text: '', headers: { location: 'https://api-elsewhere.klingai.com/tasks' } }]);
    const err = await c.request(READ).catch((e) => e);
    expect(err).toBeInstanceOf(KlingResponseError);
    expect(err.httpStatus).toBe(302);
    expect(err.location).toBe('https://api-elsewhere.klingai.com/tasks');
    expect(calls).toHaveLength(1);
  });

  it('a non-JSON body (CDN HTML) → KlingResponseError with a 200-byte snippet', async () => {
    const html = '<html>' + 'x'.repeat(500);
    const { core: c } = core([{ status: 502, text: html }, { status: 502, text: html }, { status: 502, text: html }]);
    const err = await c.request(READ).catch((e) => e);
    expect(err).toBeInstanceOf(KlingResponseError);
    expect(err.httpStatus).toBe(502);
    expect(err.bodySnippet.length).toBe(200);
  });

  it('JSON that is not an envelope (no numeric code) → KlingResponseError, not a crash', async () => {
    const { core: c } = core([{ status: 200, json: { hello: 'world' } }]);
    await expect(c.request(WRITE)).rejects.toBeInstanceOf(KlingResponseError);
  });
});

describe('deadline and abort', () => {
  it('a stalled BODY (headers arrived) trips the deadline → KlingTimeoutError with attempt/attempts; a timed-out write is may-exist', async () => {
    const { core: c } = core([{ stall: true }], { timeout: 20 });
    const err = await c.request(WRITE).catch((e) => e);
    expect(err).toBeInstanceOf(KlingTimeoutError);
    expect(err.deadlineMs).toBe(20);
    expect(err.attempt).toBe(1);
    expect(err.attempts).toBe(3);
    expect(err.taskState).toBe('may-exist');
    expect(err.externalId).toBe('ext-1');
  });

  it('a hung connection trips the deadline too', async () => {
    const { core: c } = core([{ hang: true }, { hang: true }, { hang: true }], { timeout: 10 });
    await expect(c.request(READ)).rejects.toBeInstanceOf(KlingTimeoutError);
  });

  it('per-request timeoutMs overrides the configured deadline', async () => {
    const { core: c } = core([{ stall: true }], { timeout: 5_000 });
    const err = await c.request({ ...WRITE, timeoutMs: 15 }).catch((e) => e);
    expect(err).toBeInstanceOf(KlingTimeoutError);
    expect(err.deadlineMs).toBe(15);
  });

  it("a caller abort surfaces the caller's reason, unwrapped, and is not retried", async () => {
    const { core: c, calls } = core([{ hang: true }], { timeout: 5_000 });
    const ac = new AbortController();
    const reason = new Error('caller cancelled');
    const p = c.request({ ...READ, signal: ac.signal });
    ac.abort(reason);
    await expect(p).rejects.toBe(reason);
    expect(calls).toHaveLength(1);
  });

  it('an already-aborted signal short-circuits before any fetch', async () => {
    const { core: c, calls } = core([OK]);
    const ac = new AbortController();
    ac.abort(new Error('pre-aborted'));
    await expect(c.request({ ...READ, signal: ac.signal })).rejects.toThrow('pre-aborted');
    expect(calls).toHaveLength(0);
  });
});

describe('retry policy (V11)', () => {
  const refused = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });
  const reset = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) });

  it('read: 1303 then 200 → 2 fetch calls, one backoff of 2 s (base × 2^1)', async () => {
    const { core: c, calls } = core([{ status: 429, json: { code: 1303, message: 'busy' } }, OK]);
    const res = await c.request(READ);
    expect(calls).toHaveLength(2);
    expect(res.attempt).toBe(2);
    expect(sleeps).toEqual([2_000]);
  });

  it('read: three transient failures → gives up after maxAttempts with backoffs 2 s, 4 s', async () => {
    const busy = { status: 429, json: { code: 1303, message: 'busy' } };
    const { core: c, calls } = core([busy, busy, busy]);
    await expect(c.request(READ)).rejects.toBeInstanceOf(KlingAPIError);
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([2_000, 4_000]);
  });

  it('read: backoff is capped at maxDelayMs', async () => {
    const busy = { status: 503, json: { code: 5001, message: 'maint' } };
    const { core: c } = core([busy, busy, busy], { retry: { baseDelayMs: 10_000, maxDelayMs: 15_000 } });
    await c.request(READ).catch(() => undefined);
    expect(sleeps).toEqual([15_000, 15_000]);
  });

  // --- ship run #6: jitter and Retry-After -----------------------------------------------

  it("equal jitter keeps half the delay and randomises the rest — [d/2, d) per attempt, never 0", async () => {
    const busy = { status: 429, json: { code: 1303, message: 'busy' } };
    for (const [r, expected] of [[0, [1000, 2000]], [0.5, [1500, 3000]], [0.999, [2000, 4000]]] as const) {
      sleeps.length = 0;
      const { fetchImpl } = fakeFetch([busy, busy, busy]);
      const c = new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, timeout: 50 }, { sleep, random: () => r });
      await c.request(READ).catch(() => undefined);
      expect(sleeps.map((n) => Math.round(n / 10) * 10), `random=${r}`).toEqual(expected.map((n) => Math.round(n / 10) * 10));
    }
  });

  it('the default is jittered: two clients failing on the same burst do not sleep in lockstep', async () => {
    const busy = { status: 429, json: { code: 1303, message: 'busy' } };
    const runs: number[] = [];
    for (let i = 0; i < 12; i++) {
      sleeps.length = 0;
      const { fetchImpl } = fakeFetch([busy, OK]);
      await new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, timeout: 50 }, { sleep }).request(READ);
      runs.push(sleeps[0] ?? -1);
    }
    expect(new Set(runs).size).toBeGreaterThan(1);       // not a constant
    for (const d of runs) expect(d).toBeGreaterThanOrEqual(1000); // the floor still rises with the attempt
    for (const d of runs) expect(d).toBeLessThanOrEqual(2000);
  });

  it("the vendor's Retry-After wins over our backoff, in seconds and as an HTTP-date, capped by maxDelayMs", async () => {
    const at = new Date(Date.now() + 7_000).toUTCString();
    for (const [header, expected] of [['5', 5_000], [at, 7_000], ['9999', 30_000], ['garbage', 2_000]] as const) {
      sleeps.length = 0;
      const { fetchImpl } = fakeFetch([
        { status: 429, json: { code: 1303, message: 'busy' }, headers: { 'retry-after': header } },
        OK,
      ]);
      const c = new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, timeout: 50, retry: { jitter: 'none' } }, { sleep });
      await c.request(READ);
      // the HTTP-date case is computed against a moving now(), so allow a second of slack
      expect(Math.abs((sleeps[0] ?? 0) - expected), `retry-after: ${header}`).toBeLessThanOrEqual(1_000);
    }
  });

  it('KlingAPIError carries the parsed retryAfterMs so a consumer re-submitting a create can honour it', async () => {
    const { fetchImpl } = fakeFetch([{ status: 429, json: { code: 1302, message: 'rate' }, headers: { 'retry-after': '12' } }]);
    const c = new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, timeout: 50, retry: { maxAttempts: 1 } }, { sleep });
    const err = await c.request(WRITE).catch((e) => e as KlingAPIError);
    expect(err.retryAfterMs).toBe(12_000);
  });

  it("retry.jitter rejects anything but 'equal' or 'none'", () => {
    const { fetchImpl } = fakeFetch([OK]);
    expect(() => new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, retry: { jitter: 'full' as never } })).toThrow(/retry\.jitter/);
  });

  it('write: 1303 → thrown immediately, ONE fetch call, taskState not-created, isRetryable false', async () => {
    const { core: c, calls } = core([{ status: 429, json: { code: 1303, message: 'busy' } }, OK]);
    const err = await c.request(WRITE).catch((e) => e);
    expect(err).toBeInstanceOf(KlingAPIError);
    expect(calls).toHaveLength(1);
    expect(err.taskState).toBe('not-created');
    expect(err.isTransient()).toBe(true);
    expect(err.isRetryable()).toBe(false);
    expect(sleeps).toEqual([]);
  });

  it('write: 5002 → thrown immediately, ONE call, taskState may-exist (the double-bill case)', async () => {
    const { core: c, calls } = core([{ status: 504, json: { code: 5002, message: 'backlog' } }, OK]);
    const err = await c.request(WRITE).catch((e) => e);
    expect(calls).toHaveLength(1);
    expect(err.taskState).toBe('may-exist');
  });

  it('write: ECONNRESET mid-request → ONE call, KlingNetworkError may-exist with externalId', async () => {
    const { core: c, calls } = core([{ throw: reset() }, OK]);
    const err = await c.request(WRITE).catch((e) => e);
    expect(err).toBeInstanceOf(KlingNetworkError);
    expect(calls).toHaveLength(1);
    expect(err.taskState).toBe('may-exist');
    expect(err.externalId).toBe('ext-1');
  });

  it('write: ECONNREFUSED (provably pre-request) → retried, then succeeds', async () => {
    const { core: c, calls } = core([{ throw: refused() }, OK]);
    const res = await c.request(WRITE);
    expect(calls).toHaveLength(2);
    expect(res.attempt).toBe(2);
  });

  it('write: a timeout is never retried', async () => {
    const { core: c, calls } = core([{ stall: true }, OK], { timeout: 10 });
    await expect(c.request(WRITE)).rejects.toBeInstanceOf(KlingTimeoutError);
    expect(calls).toHaveLength(1);
  });

  it('read: HTTP 429 carrying permanent code 1102 → ONE call (pack exhausted is not transient)', async () => {
    const { core: c, calls } = core([{ status: 429, json: { code: 1102, message: 'Account balance not enough' } }, OK]);
    await expect(c.request(READ)).rejects.toBeInstanceOf(KlingAPIError);
    expect(calls).toHaveLength(1);
  });

  it('read: non-JSON 502 is retried; non-JSON 200 is not', async () => {
    const a = core([{ status: 502, text: '<html>' }, OK]);
    await a.core.request(READ);
    expect(a.calls).toHaveLength(2);
    const b = core([{ status: 200, text: 'not json' }, OK]);
    await expect(b.core.request(READ)).rejects.toBeInstanceOf(KlingResponseError);
    expect(b.calls).toHaveLength(1);
  });

  it('read: a timeout on the last attempt reports attempt 3 of 3', async () => {
    const { core: c } = core([{ stall: true }, { stall: true }, { stall: true }], { timeout: 10 });
    const err = await c.request(READ).catch((e) => e);
    expect(err).toBeInstanceOf(KlingTimeoutError);
    expect(err.attempt).toBe(3);
    expect(err.attempts).toBe(3);
    expect(err.taskState).toBe('n/a');
  });
});

describe('ship run #4 regressions', () => {
  it('a caller abort during the retry backoff rejects immediately with the caller\'s reason (not after maxDelayMs)', async () => {
    const ac = new AbortController();
    let resolveSleep: (() => void) | undefined;
    const blockingSleep = () => new Promise<void>((r) => { resolveSleep = r; });
    const { fetchImpl } = fakeFetch([{ json: { code: 5000, message: 'internal', request_id: 'r' }, status: 500 }, OK]);
    const c = new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, timeout: 50 }, { sleep: blockingSleep });
    const p = c.request({ ...READ, signal: ac.signal });
    await new Promise((r) => setTimeout(r, 5));
    ac.abort('bail');
    await expect(p).rejects.toBe('bail');
    resolveSleep?.();
  });

  it('a non-envelope body keeps the JSON.parse error as cause', async () => {
    const { core: c } = core([{ text: '<html>cdn</html>', status: 502 }], { retry: { maxAttempts: 1 } });
    const err = await c.request(READ).catch((e) => e as KlingResponseError);
    expect(err).toBeInstanceOf(KlingResponseError);
    expect(err.cause).toBeInstanceOf(SyntaxError);
  });
});

describe('ship run #5 regressions', () => {
  it('retry: { maxAttempts: undefined } keeps the default (3) instead of retrying forever; invalid values are refused', async () => {
    const { fetchImpl, calls } = fakeFetch(Array.from({ length: 10 }, () => ({ json: { code: 5000, message: 'internal', request_id: 'r' }, status: 500 })));
    const c = new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, timeout: 50, retry: { maxAttempts: undefined, baseDelayMs: undefined } }, { sleep });
    await expect(c.request(READ)).rejects.toBeInstanceOf(KlingAPIError);
    expect(calls).toHaveLength(3); // the default, not ∞
    expect(c.retry).toEqual({ maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30_000, jitter: 'equal' });
    expect(() => new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, retry: { maxAttempts: 0 } })).toThrow(/retry\.maxAttempts must be an integer ≥ 1/);
    expect(() => new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, retry: { baseDelayMs: Number.NaN } })).toThrow(/retry\.baseDelayMs/);
  });

  it('an abort during the default backoff clears its timer and removes its listener; a completed backoff leaves no listener behind', async () => {
    vi.useFakeTimers();
    try {
      const ac = new AbortController();
      const { fetchImpl } = fakeFetch([{ json: { code: 5000, message: 'x', request_id: 'r' }, status: 500 }, OK]);
      const c = new HttpCore({ apiKey: 'k-1234', fetch: fetchImpl, timeout: 50 }); // default sleep → real (fake) timers
      const p = c.request({ ...READ, signal: ac.signal });
      await vi.advanceTimersByTimeAsync(10); // into the 2 s backoff
      expect(vi.getTimerCount()).toBe(1);
      ac.abort('bail');
      await expect(p).rejects.toBe('bail');
      expect(vi.getTimerCount()).toBe(0); // timer cleared, nothing holds the loop
      // Completed backoff: no listener accumulates on a long-lived signal.
      const long = new AbortController();
      const { fetchImpl: f2 } = fakeFetch([{ json: { code: 5000, message: 'x', request_id: 'r' }, status: 500 }, OK]);
      const c2 = new HttpCore({ apiKey: 'k-1234', fetch: f2, timeout: 50 });
      const p2 = c2.request({ ...READ, signal: long.signal });
      await vi.advanceTimersByTimeAsync(2100);
      await expect(p2).resolves.toBeDefined();
      const { getEventListeners } = await import('node:events');
      expect(getEventListeners(long.signal, 'abort')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
