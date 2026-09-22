/** Elements / voices / avatar / TTS product modules over a routed fake fetch (spec D8). */
import { describe, expect, it } from 'vitest';
import { HttpCore } from '../../../src/http/core.js';
import { KlingTaskFailedError } from '../../../src/http/errors.js';
import { AudioApi, AvatarApi, ElementsApi, VoicesApi } from '../../../src/products/resources.js';
import { fixture } from '../codecs/fixtures.js';

interface Call { url: URL; method: string; body?: Record<string, unknown> }
function rig(route: (c: Call) => unknown) {
  const calls: Call[] = [];
  const warnings: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = { url: new URL(String(input)), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    return new Response(JSON.stringify(route(call)), { status: 200 });
  }) as typeof fetch;
  const logger = { debug: () => undefined, info: () => undefined, warn: (m: string) => void warnings.push(m), error: () => undefined };
  const core = new HttpCore({ apiKey: 'k', fetch: fetchImpl, retry: { maxAttempts: 1 } });
  const config = { logger, unknownModels: 'passthrough' as const, capabilityValidation: 'error' as const };
  return { calls, warnings, elements: new ElementsApi(core, config), voices: new VoicesApi(core, config), avatar: new AvatarApi(core, config), audio: new AudioApi(core, config) };
}
const IMG = 'https://cdn.example/i.png';
const created = () => fixture('legacy/image-generation-create.json');
const deleted = () => ({ code: 0, message: 'SUCCEED', request_id: 'r', data: { task_id: 'del-1', task_status: 'succeed' } });

describe('elements', () => {
  it('create → POST /v1/general/advanced-custom-elements with the nested image list; handle product element', async () => {
    const { elements, calls } = rig(created);
    const h = await elements.create({ name: 'n', description: 'd', referenceType: 'image_refer', frontalImage: IMG, referImages: [IMG], tags: ['o_102'], externalTaskId: 'e-el' });
    expect(calls[0].url.pathname).toBe('/v1/general/advanced-custom-elements');
    expect(calls[0].body).toEqual({ element_name: 'n', element_description: 'd', reference_type: 'image_refer', element_image_list: { frontal_image: IMG, refer_images: [{ image_url: IMG }] }, tag_list: [{ tag_id: 'o_102' }], external_task_id: 'e-el' });
    expect(h).toMatchObject({ product: 'element', standard: 'legacy', externalId: 'e-el' });
    expect(h.request.frontalImage).toEqual({ kind: 'url', url: IMG });
  });

  it('video_refer: the video is URL-only; a Base64 string is refused', async () => {
    const { elements, calls } = rig(created);
    await expect(elements.create({ name: 'n', description: 'd', referenceType: 'video_refer', referVideos: ['AAAAIGZ0eXBpc29t'] })).rejects.toThrow(/no upload endpoint for video/);
    expect(calls).toHaveLength(0);
    await elements.create({ name: 'n', description: 'd', referenceType: 'video_refer', referVideos: [{ url: 'https://v/a.mp4' }] });
    expect(calls[0].body!.element_video_list).toEqual({ refer_videos: [{ video_url: 'https://v/a.mp4' }] });
  });

  it('get / list / presets route to the element paths and parse element outputs', async () => {
    const { elements, calls } = rig((c) => (c.url.pathname.endsWith('/t1') ? { ...(fixture('legacy/element-list.json') as { data: unknown[] }), data: (fixture('legacy/element-list.json') as { data: unknown[] }).data[0] } : fixture('legacy/element-list.json')));
    const one = await elements.get('t1');
    expect(calls[0].url.pathname).toBe('/v1/general/advanced-custom-elements/t1');
    expect(one.outputs[0]).toMatchObject({ type: 'element', id: '0', name: 'string' });
    await elements.list({ pageNum: 2, pageSize: 50 });
    expect(calls[1].url.pathname).toBe('/v1/general/advanced-custom-elements');
    expect(calls[1].url.searchParams.get('pageSize')).toBe('50');
    const presets = (await elements.presets()).tasks;
    expect(calls[2].url.pathname).toBe('/v1/general/advanced-presets-elements');
    expect(presets[0].product).toBe('element');
  });

  it('delete by ELEMENT id: kind video (default) and image paths; the documented { task_id, task_status } data AND the live bare code-0 envelope both succeed', async () => {
    const { elements, calls } = rig(deleted);
    const r = await elements.delete('321922438904313');
    expect(calls[0].url.pathname).toBe('/v1/general/delete-advanced-elements');
    expect(calls[0].body).toEqual({ element_id: '321922438904313' });
    expect(r).toMatchObject({ taskId: 'del-1', status: 'succeeded', requestId: 'r' });
    await elements.delete('321922438904313', { kind: 'image' });
    expect(calls[1].url.pathname).toBe('/v1/general/delete-elements');
    // The live shape: code 0, no data.
    const live = rig(() => ({ code: 0, message: 'SUCCEED', request_id: 'r-live' }));
    const bare = await live.elements.delete('321930081569316', { kind: 'image' });
    expect(bare).toEqual({ raw: { code: 0, message: 'SUCCEED', request_id: 'r-live' }, requestId: 'r-live' });
  });
});

describe('voices', () => {
  it('create / get / list (pageSize ≤ 1000) / presets / delete', async () => {
    const { voices, calls } = rig((c) => (c.url.pathname.endsWith('delete-voices') ? deleted() : c.method === 'POST' ? created() : fixture('legacy/voice-list.json')));
    const h = await voices.create({ name: 'Custom Voice', voiceUrl: 'https://cdn.example/out.mp3' });
    expect(calls[0].url.pathname).toBe('/v1/general/custom-voices');
    expect(calls[0].body).toMatchObject({ voice_name: 'Custom Voice', voice_url: 'https://cdn.example/out.mp3' });
    expect(h.product).toBe('voice');
    await voices.list({ pageSize: 1000 });
    expect(calls[1].url.searchParams.get('pageSize')).toBe('1000');
    await expect(voices.list({ pageSize: 1001 })).rejects.toThrow(/1–1000/);
    const presets = (await voices.presets()).tasks;
    expect(calls[2].url.pathname).toBe('/v1/general/presets-voices');
    expect(presets[0].outputs[0]).toMatchObject({ type: 'voice', ownedBy: 'kling' });
    const d = await voices.delete('930801338081615883');
    expect(calls[3].body).toEqual({ voice_id: '930801338081615883' });
    expect(d.status).toBe('succeeded');
  });
});

describe('avatar and tts', () => {
  it('avatar.create → /v1/videos/avatar/image2video; audioId or an audio soundFile (5 MB legacy cap via kind audio)', async () => {
    const { avatar, calls } = rig(created);
    const h = await avatar.create({ image: IMG, audioId: '930801290416885794', mode: 'std', externalTaskId: 'e-av' });
    expect(calls[0].url.pathname).toBe('/v1/videos/avatar/image2video');
    expect(calls[0].body).toEqual({ image: IMG, audio_id: '930801290416885794', mode: 'std', external_task_id: 'e-av' });
    expect(h.product).toBe('avatar');
    const wav = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(100)]);
    await avatar.create({ image: IMG, soundFile: wav });
    expect(calls[1].body!.sound_file).toBe(wav.toString('base64'));
    await expect(avatar.create({ image: IMG, soundFile: Buffer.from('not audio at all') })).rejects.toThrow(/not MP3, WAV, M4A or AAC/);
  });

  it('audio.tts is synchronous: returns the audio outputs from the create response; failed → KlingTaskFailedError', async () => {
    const ok = rig(() => fixture('legacy/tts-create.json'));
    const outputs = await ok.audio.tts({ text: 'hello', voiceId: 'oversea_male1', voiceLanguage: 'en', voiceSpeed: 1 });
    expect(ok.calls[0].url.pathname).toBe('/v1/audio/tts');
    expect(ok.calls[0].body).toEqual({ text: 'hello', voice_id: 'oversea_male1', voice_language: 'en', voice_speed: 1 });
    expect(outputs).toEqual([{ type: 'audio', id: 'string', mp3Url: 'string', mp3DurationSeconds: 5 }]);
    const failed = rig(() => ({ code: 0, message: 'SUCCEED', request_id: 'r', data: { task_id: 't', task_status: 'failed', task_status_msg: 'Voice id not found' } }));
    await expect(failed.audio.tts({ text: 'hello', voiceId: 'nope', voiceLanguage: 'en' })).rejects.toBeInstanceOf(KlingTaskFailedError);
  });
});
