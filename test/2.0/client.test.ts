import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KlingClient } from '../../src/client.js';
import { HttpCore } from '../../src/http/core.js';
import { KlingValidationError } from '../../src/http/errors.js';
import * as pkg from '../../src/index.js';

const fetchStub = (async () => new Response('{"code":0}')) as unknown as typeof fetch;

describe('KlingClient skeleton (1a₂)', () => {
  const saved = process.env.KLING_API_KEY;
  beforeEach(() => {
    delete process.env.KLING_API_KEY;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.KLING_API_KEY;
    else process.env.KLING_API_KEY = saved;
  });

  it('throws KlingValidationError naming apiKey when no key is available', () => {
    expect(() => new KlingClient({ fetch: fetchStub })).toThrow(KlingValidationError);
    try {
      new KlingClient({ fetch: fetchStub });
    } catch (e) {
      expect((e as KlingValidationError).field).toBe('apiKey');
      expect((e as Error).message).toContain('https://kling.ai/dev/api-key');
    }
  });

  it('resolves defaults and records the key source, never the key', () => {
    process.env.KLING_API_KEY = 'env-key-9999';
    const c = new KlingClient({ fetch: fetchStub });
    expect(c.config).toMatchObject({
      baseUrl: 'https://api-singapore.klingai.com',
      timeout: 30_000,
      unknownModels: 'passthrough',
      capabilityValidation: 'error',
      apiKeySource: 'env',
    });
    expect(c.http).toBeInstanceOf(HttpCore);
    expect(JSON.stringify(c.config)).not.toContain('env-key-9999');
    expect(c.http.describeCredential()).toBe('***9999');
  });

  it('explicit options win: apiKey source explicit, custom timeout/baseUrl', () => {
    process.env.KLING_API_KEY = 'env-key';
    const c = new KlingClient({ apiKey: 'arg-key', timeout: 5_000, baseUrl: 'https://example.test/', fetch: fetchStub });
    expect(c.config.apiKeySource).toBe('explicit');
    expect(c.config.timeout).toBe(5_000);
    expect(c.http.baseUrl).toBe('https://example.test');
  });
});

describe('KlingClient.tasks and healthCheck (2a₁)', () => {
  const okFetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    return new Response(JSON.stringify({ code: 0, message: 'SUCCEED', request_id: 'r', data: url.searchParams.get('task_ids') === '0' ? [] : [{ id: 'x', status: 'succeeded' }] }), { status: 200 });
  }) as typeof fetch;

  it('exposes a TasksApi bound to the client transport', async () => {
    const c = new KlingClient({ apiKey: 'k', fetch: okFetch });
    expect(c.tasks).toBeInstanceOf(pkg.TasksApi);
    const res = await c.tasks.get('x');
    expect(res.tasks[0]?.id).toBe('x');
  });

  it('healthCheck → true on an authenticated 200 (GET /tasks?task_ids=0 answers [] and that is fine)', async () => {
    const c = new KlingClient({ apiKey: 'k', fetch: okFetch, retry: { maxAttempts: 1 } });
    expect(await c.healthCheck()).toBe(true);
  });

  it("healthCheck rethrows the CALLER's own abort instead of reporting false (ship run #6)", async () => {
    // A readiness probe sharing a shutdown signal must not read as "API down".
    const ac = new AbortController();
    const hangs = (async (_u: unknown, init?: RequestInit) => {
      ac.abort(new Error('shutting down'));
      await new Promise((r) => setTimeout(r, 5));
      throw init?.signal?.reason ?? new Error('unreachable');
    }) as typeof fetch;
    const c = new KlingClient({ apiKey: 'k', fetch: hangs, retry: { maxAttempts: 1 } });
    await expect(c.healthCheck({ signal: ac.signal })).rejects.toThrow('shutting down');
    // control: the same failure without a caller abort is still a plain false.
    const offline = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
    expect(await new KlingClient({ apiKey: 'k', fetch: offline, retry: { maxAttempts: 1 } }).healthCheck()).toBe(false);
  });

  it('healthCheck → false on a 401 and on a network failure (any throw)', async () => {
    const unauthorized = (async () => new Response(JSON.stringify({ code: 1002, message: 'Authentication error' }), { status: 401 })) as typeof fetch;
    expect(await new KlingClient({ apiKey: 'k', fetch: unauthorized, retry: { maxAttempts: 1 } }).healthCheck()).toBe(false);
    const offline = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
    expect(await new KlingClient({ apiKey: 'k', fetch: offline, retry: { maxAttempts: 1 } }, { sleep: async () => undefined }).healthCheck()).toBe(false);
  });
});

describe('public barrel (src/index.ts)', () => {
  it('exports the values spec §6.4 lists for this phase — and nothing JWT-shaped', () => {
    for (const name of [
      'KlingClient', 'HttpCore', 'KlingError', 'KlingAPIError', 'KlingNetworkError', 'KlingTimeoutError',
      'KlingResponseError', 'KlingCodecError', 'KlingValidationError', 'KlingTaskFailedError', 'KlingPollTimeoutError',
      'KlingNoOutputsError', 'KlingOutputsExpiredError', 'KlingBatchError', 'KlingDownloadError', 'KlingWebhookError',
      'ERROR_CODES', 'BASE_URL', 'loadApiKey',
      'KlingTaskNotFoundError', 'TasksApi', 'LEGACY_PRODUCT_PATHS', 'standardOf', 'VIDEO_MODELS', 'IMAGE_MODELS', 'poll',
    ]) {
      expect(pkg, name).toHaveProperty(name);
    }
    expect(pkg).not.toHaveProperty('KlingAuth');
    expect(pkg).not.toHaveProperty('loadCredentials');
  });
});
