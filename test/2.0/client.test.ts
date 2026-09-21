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

describe('public barrel (src/index.ts)', () => {
  it('exports the values spec §6.4 lists for this phase — and nothing JWT-shaped', () => {
    for (const name of [
      'KlingClient', 'HttpCore', 'KlingError', 'KlingAPIError', 'KlingNetworkError', 'KlingTimeoutError',
      'KlingResponseError', 'KlingCodecError', 'KlingValidationError', 'KlingTaskFailedError', 'KlingPollTimeoutError',
      'KlingNoOutputsError', 'KlingOutputsExpiredError', 'KlingBatchError', 'KlingDownloadError', 'KlingWebhookError',
      'ERROR_CODES_V2', 'BASE_URL', 'loadApiKey',
    ]) {
      expect(pkg, name).toHaveProperty(name);
    }
    expect(pkg).not.toHaveProperty('KlingAuth');
    expect(pkg).not.toHaveProperty('loadCredentials');
  });
});
