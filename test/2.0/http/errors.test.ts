import { describe, expect, it } from 'vitest';
import type { Task } from '../../../src/codecs/task.js';
import {
  KlingAPIError,
  KlingBatchError,
  KlingCodecError,
  KlingDownloadError,
  KlingError,
  KlingNetworkError,
  KlingOutputsExpiredError,
  KlingResponseError,
  KlingTaskFailedError,
  KlingTimeoutError,
  KlingValidationError,
  KlingWebhookError,
  deriveTaskStateFromResponse,
  isPreRequestNetworkFailure,
} from '../../../src/http/errors.js';

const read = { kind: 'read', method: 'GET', path: '/tasks' } as const;
const write = { kind: 'write', method: 'POST', path: '/text-to-video/kling-3.0-turbo', externalId: 'ext-1' } as const;

const api = (code: number, httpStatus: number, request: typeof read | typeof write) =>
  new KlingAPIError('vendor said no', { code, httpStatus, request, requestId: 'req-1' });

describe('KlingAPIError — taskState (the consumer decision field)', () => {
  it.each([
    [1303, 429, 'not-created'], // concurrency refusal: the vendor answered BEFORE enqueueing
    [1302, 429, 'not-created'],
    [1201, 400, 'not-created'],
    [1102, 429, 'not-created'],
    [1103, 403, 'not-created'],
    [5000, 500, 'may-exist'],
    [5001, 503, 'may-exist'],
    [5002, 504, 'may-exist'], // "internal timeout, usually due to a backlog" — the task may already exist
    [4242, 502, 'may-exist'], // unknown code on a 5xx
    [4242, 404, 'not-created'], // unknown code on a 4xx
  ] as const)('write code %i / HTTP %i → %s', (code, status, expected) => {
    expect(api(code, status, write).taskState).toBe(expected);
  });

  it('reads are always n/a', () => {
    expect(api(1303, 429, read).taskState).toBe('n/a');
    expect(api(5002, 504, read).taskState).toBe('n/a');
  });

  it('deriveTaskStateFromResponse is the same classifier the class uses', () => {
    expect(deriveTaskStateFromResponse('write', 1303, 429)).toBe('not-created');
    expect(deriveTaskStateFromResponse('write', 5002, 504)).toBe('may-exist');
    expect(deriveTaskStateFromResponse('read', 5002, 504)).toBe('n/a');
  });
});

describe('KlingAPIError — externalId (ship run #6: the README recovery key must exist on the error a 5002 produces)', () => {
  it('mirrors request.externalId on a write; absent on a read (no key on the descriptor)', () => {
    const mayExist = api(5002, 500, write);
    expect(mayExist.taskState).toBe('may-exist');
    expect(mayExist.externalId).toBe('ext-1');
    expect(api(1201, 400, read).externalId).toBeUndefined();
  });
});

describe('KlingAPIError — isTransient vs isRetryable', () => {
  it('1303 on a read: transient and retryable', () => {
    const e = api(1303, 429, read);
    expect(e.isTransient()).toBe(true);
    expect(e.isRetryable()).toBe(true);
  });

  it('1303 on a write: transient but NEVER retryable (the core does not re-send writes)', () => {
    const e = api(1303, 429, write);
    expect(e.isTransient()).toBe(true);
    expect(e.isRetryable()).toBe(false);
    expect(e.taskState).toBe('not-created');
  });

  it('5002 on a write: transient, not retryable, may-exist — the double-bill case', () => {
    const e = api(5002, 504, write);
    expect(e.isTransient()).toBe(true);
    expect(e.isRetryable()).toBe(false);
    expect(e.taskState).toBe('may-exist');
  });

  it('1002 (bad key): neither', () => {
    const e = api(1002, 401, read);
    expect(e.isTransient()).toBe(false);
    expect(e.isRetryable()).toBe(false);
  });

  it('permanent 429s (1102 pack exhausted, 1304 IP whitelist) are transient by status but NOT retryable', () => {
    for (const code of [1102, 1304]) {
      const e = api(code, 429, read);
      expect(e.isTransient()).toBe(true);
      expect(e.isRetryable()).toBe(false);
    }
  });

  it('HTTP 502 with no business code is transient on a read', () => {
    expect(api(0, 502, read).isTransient()).toBe(true);
  });

  it('carries request descriptor, requestId, name, and is a KlingError', () => {
    const e = api(1303, 429, write);
    expect(e.request.externalId).toBe('ext-1');
    expect(e.requestId).toBe('req-1');
    expect(e.name).toBe('KlingAPIError');
    expect(e).toBeInstanceOf(KlingError);
    expect(e).toBeInstanceOf(Error);
  });

  it('constructs from a 1303 body that has no `data` (the vendor omits it)', () => {
    const body = { code: 1303, message: 'parallel task over resource pack limit', request_id: 'r' };
    expect(() => new KlingAPIError(body.message, { code: body.code, httpStatus: 429, request: write, requestId: body.request_id })).not.toThrow();
  });
});

describe('KlingNetworkError — taskState from the socket error', () => {
  const refused = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('connect'), { code: 'ECONNREFUSED' }) });
  const reset = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) });
  const dualStack = Object.assign(new TypeError('fetch failed'), {
    cause: new AggregateError(
      [Object.assign(new Error('v6'), { code: 'ECONNREFUSED' }), Object.assign(new Error('v4'), { code: 'ECONNREFUSED' })],
      'connect failed'
    ),
  });

  it('ECONNREFUSED on a write → not-created (the request never left)', () => {
    expect(new KlingNetworkError('x', write, refused).taskState).toBe('not-created');
    expect(isPreRequestNetworkFailure(refused)).toBe(true);
  });

  it('ECONNRESET on a write → may-exist (the request may have been written)', () => {
    expect(new KlingNetworkError('x', write, reset).taskState).toBe('may-exist');
    expect(isPreRequestNetworkFailure(reset)).toBe(false);
  });

  it('dual-stack AggregateError of refusals → not-created (Node 20 hostname path, spec V14)', () => {
    expect(new KlingNetworkError('x', write, dualStack).taskState).toBe('not-created');
  });

  it('a cause with no code at all → may-exist (fail towards recovery, not re-submit)', () => {
    expect(new KlingNetworkError('x', write, new TypeError('fetch failed')).taskState).toBe('may-exist');
  });

  it('reads → n/a; externalId and cause are carried', () => {
    const e = new KlingNetworkError('x', write, reset);
    expect(e.externalId).toBe('ext-1');
    expect(e.cause).toBe(reset);
    expect(new KlingNetworkError('x', read, reset).taskState).toBe('n/a');
  });
});

describe('KlingTimeoutError / KlingResponseError', () => {
  it('a timed-out write is ALWAYS may-exist and carries attempt/attempts', () => {
    const e = new KlingTimeoutError('deadline', write, { deadlineMs: 30_000, attempt: 3, attempts: 3 });
    expect(e.taskState).toBe('may-exist');
    expect(e.attempt).toBe(3);
    expect(e.attempts).toBe(3);
    expect(e.externalId).toBe('ext-1');
    expect(new KlingTimeoutError('d', read, { deadlineMs: 1, attempt: 1, attempts: 3 }).taskState).toBe('n/a');
  });

  it('a non-envelope response on a write is may-exist; a 3xx carries its Location', () => {
    const e = new KlingResponseError('redirect', write, { httpStatus: 302, bodySnippet: '', location: 'https://elsewhere/' });
    expect(e.taskState).toBe('may-exist');
    expect(e.location).toBe('https://elsewhere/');
    expect(new KlingResponseError('html', read, { httpStatus: 502, bodySnippet: '<html>' }).taskState).toBe('n/a');
  });
});

describe('lifecycle, batch, download, webhook errors', () => {
  const task: Task = {
    id: 't1', standard: 'new', status: 'failed', message: 'content risk control', outputs: [], raw: {},
    updatedAt: Date.UTC(2026, 0, 1), outputsExpireAt: Date.UTC(2026, 0, 31),
  };

  it('KlingTaskFailedError uses the vendor message and defaults code to null', () => {
    const e = new KlingTaskFailedError(task);
    expect(e.message).toContain('content risk control');
    expect(e.code).toBeNull();
    expect(new KlingTaskFailedError(task, 1301).code).toBe(1301);
  });

  it('KlingOutputsExpiredError names the expiry and the force escape', () => {
    const e = new KlingOutputsExpiredError(task);
    expect(e.message).toContain('2026-01-31');
    expect(e.message).toContain('force: true');
  });

  it('a CYCLIC cause chain terminates and still classifies (isPreRequestNetworkFailure)', () => {
    // Termination here is carried by the `depth > 4` cap, NOT by the `e.cause !== err` guard:
    // deleting that guard leaves this test green (mutation-verified, ship run #6). So this
    // asserts the property that matters to a caller — a self-referencing or mutual cause
    // chain does not hang and still yields a verdict — and claims nothing about which line
    // achieves it. The guard remains as the cheaper of the two stops.
    const self = Object.assign(new Error('boom'), { code: 'ENOTFOUND' }) as Error & { cause?: unknown };
    self.cause = self;
    expect(isPreRequestNetworkFailure(self)).toBe(true);

    const a = Object.assign(new Error('a'), { code: 'ECONNREFUSED' }) as Error & { cause?: unknown };
    const b = Object.assign(new Error('b'), { code: 'ECONNREFUSED' }) as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    expect(isPreRequestNetworkFailure(a)).toBe(true);

    // control: the same walk still reaches a nested code and still says false for a non-pre-request one.
    const wrapped = new Error('outer', { cause: Object.assign(new Error('inner'), { code: 'ECONNRESET' }) });
    expect(isPreRequestNetworkFailure(wrapped)).toBe(false);
  });

  it('KlingOutputsExpiredError reads without an outputsExpireAt (the undefined branch of its message)', () => {
    const noExpiry: Task = { ...task, outputsExpireAt: undefined };
    const e = new KlingOutputsExpiredError(noExpiry);
    expect(e.message).toBeTruthy();
    expect(e.message).not.toMatch(/undefined|NaN|Invalid Date/);
    expect(e.task).toBe(noExpiry);
  });

  it('KlingBatchError separates missing (attempted) from unattempted', () => {
    const e = new KlingBatchError('chunk 2 failed', { tasks: [task], missing: ['a'], unattempted: ['b', 'c'] }, new Error('boom'));
    expect(e.tasks).toHaveLength(1);
    expect(e.missing).toEqual(['a']);
    expect(e.unattempted).toEqual(['b', 'c']);
    expect((e.cause as Error).message).toBe('boom');
  });

  it('KlingDownloadError / KlingWebhookError / KlingCodecError / KlingValidationError carry their discriminators', () => {
    expect(new KlingDownloadError('too big', { url: 'https://x/', reason: 'too-large' }).reason).toBe('too-large');
    expect(new KlingWebhookError('bad-signature', 'nope').reason).toBe('bad-signature');
    const c = new KlingCodecError('unknown status', 'legacy', 'data.task_status');
    expect(c.standard).toBe('legacy');
    expect(c.path).toBe('data.task_status');
    expect(new KlingValidationError('duration', 'must be an integer').field).toBe('duration');
  });
});
