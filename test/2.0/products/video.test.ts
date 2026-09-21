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

// ── imageToVideo (2a₃) ────────────────────────────────────────────────────────────────

import { createTimeoutMs, redactMedia } from '../../../src/products/video.js';
import { createHash } from 'node:crypto';

const FRAME_URL = 'https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/image_25.png';
const PNG_B64 = Buffer.alloc(3000, 7).toString('base64');

describe('video.imageToVideo', () => {
  it('POSTs /image-to-video/<model> with contents[] and settings without aspect_ratio; handle records the URL frame as-is', async () => {
    const { video, calls } = rig(created);
    const h = await video.imageToVideo({ prompt: 'p', firstFrame: FRAME_URL, resolution: '1080p', duration: 10, externalTaskId: 'e-i2v' });
    expect(calls[0].url.pathname).toBe('/image-to-video/kling-3.0-turbo');
    expect(calls[0].body).toEqual({
      contents: [{ type: 'prompt', text: 'p' }, { type: 'first_frame', url: FRAME_URL }],
      settings: { resolution: '1080p', duration: 10 },
      options: { external_task_id: 'e-i2v' },
    });
    expect(h.product).toBe('image-to-video');
    expect(h.request).toEqual({ prompt: 'p', model: 'kling-3.0-turbo', resolution: '1080p', duration: 10, firstFrame: { kind: 'url', url: FRAME_URL } });
  });

  it('a Base64 frame is sent inline in url and redacted on the handle to { kind, bytes, sha256 }', async () => {
    const { video, calls } = rig(created);
    const h = await video.imageToVideo({ prompt: 'p', firstFrame: `data:image/png;base64,${PNG_B64}` });
    const contents = (calls[0].body as { contents: { type: string; url?: string }[] }).contents;
    expect(contents[1]).toEqual({ type: 'first_frame', url: PNG_B64 });
    expect(h.request.firstFrame).toEqual({ kind: 'base64', bytes: 3000, sha256: createHash('sha256').update(Buffer.alloc(3000, 7)).digest('hex') });
    expect(JSON.stringify(h.request).length).toBeLessThan(400);
  });

  it('media validation: a bare path string is rejected before any request; a { path } that is missing or wrongly typed too', async () => {
    const { video, calls } = rig(created);
    await expect(video.imageToVideo({ prompt: 'p', firstFrame: './frame.png' })).rejects.toThrow(/filesystem path is never read/);
    await expect(video.imageToVideo({ prompt: 'p', firstFrame: { path: './missing-frame.png' } })).rejects.toThrow(/cannot read/);
    await expect(video.imageToVideo({ prompt: 'p', firstFrame: { path: './frame.gif' } })).rejects.toThrow(/unsupported image extension/);
    expect(calls).toHaveLength(0);
  });

  it('lastFrame on kling-3.0 → last_frame content; @name warnings reach the logger', async () => {
    const { video, calls, warnings } = rig(created);
    await video.imageToVideo({ model: 'kling-3.0', prompt: '@Zhang waves at @Li', firstFrame: FRAME_URL, lastFrame: FRAME_URL, elements: [{ elementId: 'E', id: 'Zhang' }] });
    const types = (calls[0].body as { contents: { type: string }[] }).contents.map((c) => c.type);
    expect(types).toEqual(['prompt', 'first_frame', 'last_frame', 'element']);
    expect(warnings).toEqual([expect.stringMatching(/@Li but no contents\[\] entry has id "Li"/)]);
  });

  it('the per-attempt deadline scales with the body: 20 MB → ≥ 110 s; a small body keeps the configured timeout', () => {
    expect(createTimeoutMs(30_000, 20_000_000)).toBeGreaterThanOrEqual(110_000);
    expect(createTimeoutMs(30_000, 500)).toBe(30_002);
    expect(createTimeoutMs(30_000, 0)).toBe(30_000);
    expect(createTimeoutMs(200_000, 20_000_000)).toBe(200_000);
  });

  it('redactMedia: url kept; base64/buffer/path origins named', () => {
    expect(redactMedia('https://x/y', { url: 'https://x/y' })).toEqual({ kind: 'url', url: 'https://x/y' });
    expect(redactMedia({ path: '/a.png' }, { base64: 'AAAA' })).toMatchObject({ kind: 'path', bytes: 3 });
    expect(redactMedia(Buffer.alloc(1), { base64: 'AAAA' })).toMatchObject({ kind: 'buffer' });
  });
});

// ── omni / motionControl (2b) ─────────────────────────────────────────────────────────

describe('video.omni and video.motionControl', () => {
  it('omni: POST /omni-video/kling-3.0-omni; frames/refs resolved and redacted; videos pass by URL', async () => {
    const { video, calls, warnings } = rig(created);
    const h = await video.omni({ prompt: '@image_1 in the style of @image_2, then @video_1', firstFrame: FRAME_URL, referImages: [{ source: `data:image/png;base64,${PNG_B64}` }], featureVideo: { url: 'https://cdn.example/v.mp4' }, resolution: '1080p', externalTaskId: 'e-omni' });
    expect(calls[0].url.pathname).toBe('/omni-video/kling-3.0-omni');
    const body = calls[0].body as { contents: { type: string; url?: string; id?: string }[]; settings: unknown };
    expect(body.contents.map((c) => [c.type, c.id])).toEqual([['prompt', undefined], ['first_frame', 'image_1'], ['refer_image', 'image_2'], ['feature_video', 'video_1']]);
    expect(body.contents[2].url).toBe(PNG_B64);
    expect(body.settings).toEqual({ resolution: '1080p' });
    expect(h.product).toBe('omni-video');
    expect(h.request.firstFrame).toEqual({ kind: 'url', url: FRAME_URL });
    expect((h.request.referImages as { source: { kind: string; bytes: number } }[])[0].source).toMatchObject({ kind: 'base64', bytes: 3000 });
    expect(h.request.featureVideo).toEqual({ url: 'https://cdn.example/v.mp4' });
    expect(warnings).toEqual([]);
  });

  it('omni: a Base64 reference video is refused before any request ("no upload endpoint")', async () => {
    const { video, calls } = rig(created);
    await expect(video.omni({ prompt: 'p', aspectRatio: '16:9', baseVideo: { url: PNG_B64 }, audio: 'off' })).rejects.toThrow(/no upload endpoint for video/);
    expect(calls).toHaveLength(0);
  });

  it('motionControl: POST /motion-control/kling-3.0; settings carries character_orientation; both media redacted', async () => {
    const { video, calls } = rig(created);
    const h = await video.motionControl({ image: FRAME_URL, video: 'https://cdn.example/dance.mp4', characterOrientation: 'video', audio: 'original', externalTaskId: 'e-mc' });
    expect(calls[0].url.pathname).toBe('/motion-control/kling-3.0');
    expect(calls[0].body).toEqual({
      contents: [{ type: 'image', url: FRAME_URL }, { type: 'video', url: 'https://cdn.example/dance.mp4' }],
      settings: { character_orientation: 'video', audio: 'original' },
      options: { external_task_id: 'e-mc' },
    });
    expect(h.product).toBe('motion-control');
    expect(h.request).toEqual({ model: 'kling-3.0', characterOrientation: 'video', audio: 'original', image: { kind: 'url', url: FRAME_URL }, video: { kind: 'url', url: 'https://cdn.example/dance.mp4' } });
  });

  it('motionControl on kling-2.6 with an element is a capability failure; under warn it is sent', async () => {
    const strict = rig(created);
    await expect(strict.video.motionControl({ model: 'kling-2.6', image: FRAME_URL, video: 'https://v/d.mp4', characterOrientation: 'image', element: { elementId: 'E' } })).rejects.toThrow(/does not take an element/);
    const lenient = rig(created, { capabilityValidation: 'warn' });
    await lenient.video.motionControl({ model: 'kling-2.6', image: FRAME_URL, video: 'https://v/d.mp4', characterOrientation: 'image', element: { elementId: 'E' } });
    expect(lenient.calls[0].url.pathname).toBe('/motion-control/kling-2.6');
    expect(lenient.warnings[0]).toMatch(/^\[capability\] element:/);
  });
});
