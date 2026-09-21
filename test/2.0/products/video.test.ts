/** VideoApi.textToVideo end-to-end over a real HttpCore and a routed fake fetch (spec D6, D10). */
import { describe, expect, it } from 'vitest';
import { HttpCore } from '../../../src/http/core.js';
import { KlingAPIError, KlingValidationError } from '../../../src/http/errors.js';
import { VideoApi, recordOf } from '../../../src/products/video.js';
import { fixture } from '../codecs/fixtures.js';

interface Call { url: URL; method: string; body?: unknown }
function rig(route: (call: Call) => { status?: number; json: unknown }, config: Partial<ConstructorParameters<typeof VideoApi>[1]> = {}) {
  const calls: Call[] = [];
  const warnings: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = { url: new URL(String(input)), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const r = route(call);
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as typeof fetch;
  const logger = { debug: () => undefined, info: () => undefined, warn: (m: string) => void warnings.push(m), error: () => undefined };
  const core = new HttpCore({ apiKey: 'k', fetch: fetchImpl, retry: { maxAttempts: 3 } }, { sleep: async () => undefined });
  const video = new VideoApi(core, { logger, unknownModels: 'passthrough', capabilityValidation: 'error', ...config });
  return { video, calls, warnings };
}
const created = () => ({ json: fixture('new/t2v-create.json') });

describe('video.textToVideo', () => {
  it('POSTs /text-to-video/<default model> with the built body and a generated external_task_id; returns a TaskHandle', async () => {
    const { video, calls } = rig(created);
    const h = await video.textToVideo({ prompt: 'A girl on a train', duration: 3, resolution: '720p' });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url.pathname).toBe('/text-to-video/kling-3.0-turbo');
    const body = calls[0].body as { prompt: string; settings: unknown; options: { external_task_id: string } };
    expect(body.prompt).toBe('A girl on a train');
    expect(body.settings).toEqual({ resolution: '720p', duration: 3 });
    expect(body.options.external_task_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(h).toMatchObject({ id: '893605946402811985', standard: 'new', product: 'text-to-video', externalId: body.options.external_task_id });
    expect(h.request).toEqual({ prompt: 'A girl on a train', duration: 3, resolution: '720p', model: 'kling-3.0-turbo' });
  });

  it('explicit model goes in the path (URL-encoded); externalTaskId: false → no external_task_id anywhere', async () => {
    const { video, calls } = rig(created);
    const h = await video.textToVideo({ model: 'kling-2.6', prompt: 'p', externalTaskId: false, duration: 5 });
    expect(calls[0].url.pathname).toBe('/text-to-video/kling-2.6');
    expect((calls[0].body as { options?: unknown }).options).toBeUndefined();
    expect(h).not.toHaveProperty('externalId');
  });

  it('the create is a WRITE: a 5002 is thrown immediately with taskState may-exist and the externalId — fetch called once', async () => {
    const { video, calls } = rig(() => ({ status: 500, json: { code: 5002, message: 'internal timeout', request_id: 'r' } }));
    const err = await video.textToVideo({ prompt: 'p', externalTaskId: 'e-1' }).catch((e) => e as KlingAPIError);
    expect(err).toBeInstanceOf(KlingAPIError);
    expect(err.taskState).toBe('may-exist');
    expect(err.request.externalId).toBe('e-1');
    expect(err.isRetryable()).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('validation runs before any request: a capability failure under error sends nothing', async () => {
    const { video, calls } = rig(created);
    await expect(video.textToVideo({ prompt: 'p', audio: 'off' })).rejects.toBeInstanceOf(KlingValidationError);
    expect(calls).toHaveLength(0);
  });

  it("capabilityValidation: 'warn' sends the request and logs the rule", async () => {
    const { video, calls, warnings } = rig(created, { capabilityValidation: 'warn' });
    await video.textToVideo({ prompt: 'p', audio: 'off' });
    expect(calls).toHaveLength(1);
    expect((calls[0].body as { settings: { audio: string } }).settings.audio).toBe('off');
    expect(warnings[0]).toMatch(/^\[capability\] audio: native audio is always on for kling-3.0-turbo/);
  });

  it('unknown model: passthrough warns and sends to /text-to-video/<id>; reject throws before sending', async () => {
    const pass = rig(created);
    await pass.video.textToVideo({ model: 'kling-9.9', prompt: 'p', resolution: '8k' as never });
    expect(pass.calls[0].url.pathname).toBe('/text-to-video/kling-9.9');
    expect(pass.warnings[0]).toMatch(/not in this library's capability registry/);
    const rej = rig(created, { unknownModels: 'reject' });
    await expect(rej.video.textToVideo({ model: 'kling-9.9', prompt: 'p' })).rejects.toThrow(/unknownModels: 'reject'/);
    expect(rej.calls).toHaveLength(0);
  });

  it('recordOf drops signal, externalTaskId and undefined values', () => {
    expect(recordOf({ prompt: 'p', signal: new AbortController().signal, externalTaskId: 'e', duration: undefined, model: 'm' })).toEqual({ prompt: 'p', model: 'm' });
  });
});
