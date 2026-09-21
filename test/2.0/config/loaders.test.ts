import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MISSING_API_KEY_MESSAGE, loadApiKey } from '../../../src/config/loaders.js';

describe('loadApiKey', () => {
  const saved = process.env.KLING_API_KEY;
  beforeEach(() => {
    delete process.env.KLING_API_KEY;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.KLING_API_KEY;
    else process.env.KLING_API_KEY = saved;
  });

  it('prefers an explicit key over the environment', () => {
    process.env.KLING_API_KEY = 'env-key';
    expect(loadApiKey('arg-key')).toEqual({ apiKey: 'arg-key', source: 'explicit' });
  });

  it('falls back to KLING_API_KEY', () => {
    process.env.KLING_API_KEY = ' env-key ';
    expect(loadApiKey()).toEqual({ apiKey: 'env-key', source: 'env' });
  });

  it('treats empty and whitespace-only values as absent', () => {
    process.env.KLING_API_KEY = '   ';
    expect(loadApiKey('')).toBeUndefined();
  });

  it('reads ONLY the argument and the environment — no .env files', () => {
    // If a ./.env with KLING_API_KEY existed in cwd, a dotenv-based loader would find it.
    // The library must not; that lookup belongs to the CLI (spec D2).
    expect(loadApiKey()).toBeUndefined();
  });

  it('the missing-key message names both sources and the console URL, and no legacy env var as a fix', () => {
    expect(MISSING_API_KEY_MESSAGE).toContain('KLING_API_KEY');
    expect(MISSING_API_KEY_MESSAGE).toContain('{ apiKey }');
    expect(MISSING_API_KEY_MESSAGE).toContain('https://kling.ai/dev/api-key');
    expect(MISSING_API_KEY_MESSAGE).not.toMatch(/set KLING_ACCESS_KEY/);
  });
});
