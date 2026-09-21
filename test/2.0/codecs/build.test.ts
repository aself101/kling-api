/**
 * New-standard build half — V1 contract fixtures: given the vendor Request Example's
 * inputs, the built body deep-equals the example. The vendor writes
 * `"external_task_id": ""`; the test passes a fixed id and substitutes it into the
 * fixture so the auto-UUID cannot perturb the comparison (`test/2.0/fixtures/INDEX.md`).
 */
import { describe, expect, it } from 'vitest';
import { buildOptions, buildTextToVideo } from '../../../src/codecs/new-standard.js';
import type { TextToVideoParams } from '../../../src/codecs/params.js';
import { REQUEST_FIXTURES, fixture } from './fixtures.js';

interface VendorBody {
  prompt: string;
  settings?: { resolution?: string; aspect_ratio?: string; duration?: number; audio?: string; multi_shot?: boolean };
  options?: { callback_url?: string; external_task_id?: string; watermark_info?: { enabled: boolean } };
}

/** Read the example's inputs back into params — the inverse mapping the builder must undo exactly. */
function paramsFrom(body: VendorBody): TextToVideoParams {
  const p: TextToVideoParams = { prompt: body.prompt };
  if (body.settings?.resolution) p.resolution = body.settings.resolution as TextToVideoParams['resolution'];
  if (body.settings?.aspect_ratio) p.aspectRatio = body.settings.aspect_ratio as TextToVideoParams['aspectRatio'];
  if (body.settings?.duration !== undefined) p.duration = body.settings.duration;
  if (body.settings?.audio) p.audio = body.settings.audio as TextToVideoParams['audio'];
  if (body.settings?.multi_shot !== undefined) p.multiShot = body.settings.multi_shot;
  if (body.options?.callback_url) p.callbackUrl = body.options.callback_url;
  if (body.options?.watermark_info) p.watermark = body.options.watermark_info.enabled;
  return p;
}

describe('buildTextToVideo — vendor Request Examples (V1 build half)', () => {
  it.each(REQUEST_FIXTURES.filter((f) => f.startsWith('requests/t2v-')))('%s round-trips', (f) => {
    const vendor = fixture(f) as VendorBody;
    const expected = structuredClone(vendor);
    expected.options!.external_task_id = 'fixed-external-id';
    expect(buildTextToVideo(paramsFrom(vendor), 'fixed-external-id')).toEqual(expected);
  });

  it('control: a perturbed fixture does not match (so the equality above can fail)', () => {
    const vendor = fixture('requests/t2v-kling-2.6.json') as VendorBody;
    const built = buildTextToVideo(paramsFrom(vendor), 'x');
    expect(built).not.toEqual({ ...vendor, options: { ...vendor.options, external_task_id: 'y' } });
  });

  it('unset optionals are omitted, never null; no settings/options blocks when empty', () => {
    expect(buildTextToVideo({ prompt: 'p' }, undefined)).toEqual({ prompt: 'p' });
    const body = buildTextToVideo({ prompt: 'p', duration: 5 }, 'e');
    expect(body).toEqual({ prompt: 'p', settings: { duration: 5 }, options: { external_task_id: 'e' } });
    expect(JSON.stringify(body)).not.toContain('null');
  });

  it('extraSettings / extraOptions reach the body untouched, merged after the modeled fields', () => {
    const body = buildTextToVideo({ prompt: 'p', resolution: '720p', extraSettings: { shot_type: 'wide' }, extraOptions: { priority: 'low' } }, 'e');
    expect(body.settings).toEqual({ resolution: '720p', shot_type: 'wide' });
    expect(body.options).toEqual({ external_task_id: 'e', priority: 'low' });
  });

  it('buildOptions: externalId undefined (opted out) → no external_task_id; watermark false is still sent', () => {
    expect(buildOptions({ watermark: false }, undefined)).toEqual({ watermark_info: { enabled: false } });
    expect(buildOptions({}, undefined)).toBeUndefined();
  });
});

// ── image-to-video (2a₃) ─────────────────────────────────────────────────────────────

import { buildImageToVideo, warnUnresolvedReferences } from '../../../src/codecs/new-standard.js';
import type { ImageToVideoParams } from '../../../src/codecs/params.js';

interface VendorI2VBody {
  contents: { type: string; text?: string; url?: string; element_id?: string; voice_id?: string; id?: string }[];
  settings?: { resolution?: string; duration?: number; audio?: string; multi_shot?: boolean };
  options?: { callback_url?: string; external_task_id?: string; watermark_info?: { enabled: boolean } };
}

function i2vParamsFrom(body: VendorI2VBody): { params: ImageToVideoParams; media: { firstFrame: string; lastFrame?: string } } {
  const prompt = body.contents.find((c) => c.type === 'prompt')!.text!;
  const first = body.contents.find((c) => c.type === 'first_frame')!.url!;
  const last = body.contents.find((c) => c.type === 'last_frame')?.url;
  const p: ImageToVideoParams = { prompt, firstFrame: first };
  if (last) p.lastFrame = last;
  const elements = body.contents.filter((c) => c.type === 'element').map((c) => ({ elementId: c.element_id!, id: c.id }));
  const voices = body.contents.filter((c) => c.type === 'voice').map((c) => ({ voiceId: c.voice_id!, id: c.id }));
  if (elements.length) p.elements = elements;
  if (voices.length) p.voices = voices;
  if (body.settings?.resolution) p.resolution = body.settings.resolution as ImageToVideoParams['resolution'];
  if (body.settings?.duration !== undefined) p.duration = body.settings.duration;
  if (body.settings?.audio) p.audio = body.settings.audio as ImageToVideoParams['audio'];
  if (body.settings?.multi_shot !== undefined) p.multiShot = body.settings.multi_shot;
  if (body.options?.callback_url) p.callbackUrl = body.options.callback_url;
  if (body.options?.watermark_info) p.watermark = body.options.watermark_info.enabled;
  return { params: p, media: { firstFrame: first, lastFrame: last } };
}

describe('buildImageToVideo — vendor Request Examples (V1 build half)', () => {
  it.each(REQUEST_FIXTURES.filter((f) => f.startsWith('requests/i2v-')))('%s round-trips', (f) => {
    const vendor = fixture(f) as VendorI2VBody;
    const expected = structuredClone(vendor);
    expected.options!.external_task_id = 'fixed-external-id';
    const { params, media } = i2vParamsFrom(vendor);
    const warnings: string[] = [];
    expect(buildImageToVideo(params, media, 'fixed-external-id', (m) => warnings.push(m))).toEqual(expected);
    expect(warnings, 'every @name in the vendor example resolves').toEqual([]);
  });

  it('contents order: prompt, first_frame, last_frame, element*, voice*, extraContents; ids auto-assigned', () => {
    const body = buildImageToVideo(
      { prompt: 'p', firstFrame: 'x', lastFrame: 'y', elements: [{ elementId: 'E1' }, { elementId: 'E2', id: 'Zhang' }], voices: [{ voiceId: 'V1' }], extraContents: [{ type: 'hologram', url: 'h' }] },
      { firstFrame: 'https://a/f.png', lastFrame: 'https://a/l.png' },
      undefined
    );
    expect(body.contents).toEqual([
      { type: 'prompt', text: 'p' },
      { type: 'first_frame', url: 'https://a/f.png' },
      { type: 'last_frame', url: 'https://a/l.png' },
      { type: 'element', element_id: 'E1', id: 'element_1' },
      { type: 'element', element_id: 'E2', id: 'Zhang' },
      { type: 'voice', voice_id: 'V1', id: 'voice_1' },
      { type: 'hologram', url: 'h' },
    ]);
    expect(body).not.toHaveProperty('settings');
    expect(body).not.toHaveProperty('options');
  });

  it('a Base64 frame goes in the same url field ("URL or Base64")', () => {
    const body = buildImageToVideo({ prompt: 'p', firstFrame: 'ignored' }, { firstFrame: 'iVBORw0KGgo=' }, 'e');
    expect(body.contents[1]).toEqual({ type: 'first_frame', url: 'iVBORw0KGgo=' });
  });

  it('@name with no matching content id → one warning per name, never a throw; known and repeated names are silent', () => {
    const warnings: string[] = [];
    warnUnresolvedReferences('@Zhang walks; @Zhang waves; @1 speaks; email @gmail', ['Zhang'], (m) => warnings.push(m));
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/@1 but no contents\[\] entry has id "1" \(ids: Zhang\)/);
    expect(warnings[1]).toMatch(/@gmail/);
    expect(() => warnUnresolvedReferences('@x', [], undefined)).not.toThrow();
  });
});

// ── omni-video and motion-control (2b) ───────────────────────────────────────────────

import { buildMotionControl, buildOmniVideo } from '../../../src/codecs/new-standard.js';
import type { MotionControlParams, OmniVideoParams } from '../../../src/codecs/params.js';

interface VendorContent { type: string; text?: string; url?: string; element_id?: string; id?: string }
interface VendorOmniBody {
  contents: VendorContent[];
  settings?: Record<string, unknown>;
  options?: { callback_url?: string; external_task_id?: string; watermark_info?: { enabled: boolean } };
}

const byTypeAndId = (a: VendorContent, b: VendorContent) => `${a.type}:${a.id ?? ''}`.localeCompare(`${b.type}:${b.id ?? ''}`);

function omniParamsFrom(body: VendorOmniBody) {
  const c = body.contents;
  const p: OmniVideoParams = { prompt: c.find((x) => x.type === 'prompt')!.text! };
  const media: { firstFrame?: string; lastFrame?: string; referImages?: string[] } = {};
  const first = c.find((x) => x.type === 'first_frame');
  const last = c.find((x) => x.type === 'last_frame');
  if (first) { p.firstFrame = first.url!; media.firstFrame = first.url!; }
  if (last) { p.lastFrame = last.url!; media.lastFrame = last.url!; }
  const refs = c.filter((x) => x.type === 'refer_image');
  if (refs.length) { p.referImages = refs.map((r) => ({ source: r.url!, id: r.id })); media.referImages = refs.map((r) => r.url!); }
  const fv = c.find((x) => x.type === 'feature_video');
  const bv = c.find((x) => x.type === 'base_video');
  if (fv) p.featureVideo = { url: fv.url!, id: fv.id };
  if (bv) p.baseVideo = { url: bv.url!, id: bv.id };
  const els = c.filter((x) => x.type === 'element');
  if (els.length) p.elements = els.map((e) => ({ elementId: e.element_id!, id: e.id }));
  const s = body.settings ?? {};
  if (s.resolution) p.resolution = s.resolution as OmniVideoParams['resolution'];
  if (s.aspect_ratio) p.aspectRatio = s.aspect_ratio as OmniVideoParams['aspectRatio'];
  if (s.duration !== undefined) p.duration = s.duration as number;
  if (s.audio) p.audio = s.audio as OmniVideoParams['audio'];
  if (s.multi_shot !== undefined) p.multiShot = s.multi_shot as boolean;
  if (body.options?.callback_url) p.callbackUrl = body.options.callback_url;
  if (body.options?.watermark_info) p.watermark = body.options.watermark_info.enabled;
  return { params: p, media };
}

describe('buildOmniVideo — vendor Request Examples (V1 build half)', () => {
  it.each(REQUEST_FIXTURES.filter((f) => f.startsWith('requests/omni-kling-')))('%s round-trips (contents compared as a set — the vendor examples hold no fixed order)', (f) => {
    const vendor = fixture(f) as VendorOmniBody;
    const expected = structuredClone(vendor);
    expected.options!.external_task_id = 'fixed-external-id';
    const { params, media } = omniParamsFrom(vendor);
    const warnings: string[] = [];
    const built = buildOmniVideo(params, media, 'fixed-external-id', (m) => warnings.push(m));
    expect([...built.contents!].sort(byTypeAndId as never)).toEqual([...expected.contents].sort(byTypeAndId));
    expect(built.settings).toEqual(expected.settings);
    expect(built.options).toEqual(expected.options);
    expect(warnings).toEqual([]);
  });

  it('auto ids: image_n across first, last, refer images in order; video_1; element_n — explicit ids win', () => {
    const body = buildOmniVideo(
      { prompt: 'p', firstFrame: 'f', lastFrame: 'l', referImages: [{ source: 'r1' }, { source: 'r2', id: 'hat' }], featureVideo: { url: 'https://v/x.mp4' }, elements: [{ elementId: 'E' }] },
      { firstFrame: 'https://a/f.png', lastFrame: 'https://a/l.png', referImages: ['https://a/r1.png', 'https://a/r2.png'] },
      undefined
    );
    expect(body.contents!.map((c) => [c.type, c.id])).toEqual([
      ['prompt', undefined],
      ['first_frame', 'image_1'],
      ['last_frame', 'image_2'],
      ['refer_image', 'image_3'],
      ['refer_image', 'hat'],
      ['feature_video', 'video_1'],
      ['element', 'element_1'],
    ]);
  });
});

describe('buildMotionControl — vendor Request Examples (V1 build half)', () => {
  it.each(REQUEST_FIXTURES.filter((f) => f.startsWith('requests/motion-')))('%s round-trips', (f) => {
    const vendor = fixture(f) as VendorOmniBody;
    const expected = structuredClone(vendor);
    expected.options!.external_task_id = 'fixed-external-id';
    const c = vendor.contents;
    const s = vendor.settings!;
    const params: MotionControlParams = {
      prompt: c.find((x) => x.type === 'prompt')?.text,
      image: c.find((x) => x.type === 'image')!.url!,
      video: c.find((x) => x.type === 'video')!.url!,
      characterOrientation: s.character_orientation as 'image' | 'video',
      audio: s.audio as 'original' | 'off' | undefined,
      resolution: s.resolution as '720p' | '1080p' | undefined,
      callbackUrl: vendor.options?.callback_url,
      watermark: vendor.options?.watermark_info?.enabled,
    };
    expect(buildMotionControl(params, { image: params.image as string, video: params.video as string }, 'fixed-external-id')).toEqual(expected);
  });

  it('element and prompt are optional; settings always carries character_orientation; no duration/aspect_ratio', () => {
    const body = buildMotionControl({ image: 'i', video: 'v', characterOrientation: 'image', element: { elementId: 'E' } }, { image: 'https://a/i.png', video: 'https://a/v.mp4' }, 'e');
    expect(body).toEqual({
      contents: [{ type: 'image', url: 'https://a/i.png' }, { type: 'video', url: 'https://a/v.mp4' }, { type: 'element', element_id: 'E', id: 'element_1' }],
      settings: { character_orientation: 'image' },
      options: { external_task_id: 'e' },
    });
  });
});

// ── legacy image builders (3a/3b) ─────────────────────────────────────────────────────

import {
  buildImageGeneration,
  buildMultiImageToImage,
  buildOmniImage,
  buildOutpaint,
  buildSubjectCompletion,
  legacyElementId,
  type LegacyBody,
} from '../../../src/codecs/legacy.js';

const withId = (body: LegacyBody) => ({ ...body, external_task_id: 'fixed-external-id' });
const asStr = (v: unknown) => (v === undefined ? undefined : String(v));

describe('legacy builders — vendor Request Examples (V1 build half)', () => {
  it('image-generation (kling-image-2.1-generation.md) round-trips; empty-string fields are the caller\'s values and are sent', () => {
    const v = fixture('requests/image-generation.json') as LegacyBody;
    const built = buildImageGeneration(
      { model: v.model_name as string, prompt: v.prompt as string, negativePrompt: v.negative_prompt as string, n: v.n as number, callbackUrl: v.callback_url as string },
      v.model_name as string,
      v.image as string,
      'fixed-external-id'
    );
    expect(built).toEqual(withId(v));
  });

  it('omni-image O1 (kling-image-o1-generation.md) round-trips — except the element id, which the example writes as an 18-digit number', () => {
    // 829836802793406551 is above 2^53: JSON.parse has already turned it into 829836802793406600
    // in the fixture, which is exactly why the library takes element ids as STRINGS and sends an
    // unsafe one as a string [VERIFY live, Phase 7]. The rest of the body is compared exactly.
    const v = fixture('requests/omni-image-o1.json') as LegacyBody & { element_list: { element_id: number }[]; image_list: { image: string }[] };
    const built = buildOmniImage(
      { model: v.model_name as string, prompt: v.prompt as string, elements: [{ elementId: '829836802793406551' }], images: v.image_list.map((i) => i.image), resolution: v.resolution as '2k', n: v.n as number, aspectRatio: v.aspect_ratio as '3:2' },
      v.model_name as string,
      v.image_list.map((i) => i.image),
      undefined
    );
    const { element_list: builtElements, ...builtRest } = built;
    const { element_list: vendorElements, ...vendorRest } = v;
    expect(builtRest).toEqual(vendorRest);
    expect(builtElements).toEqual([{ element_id: '829836802793406551' }]);
    expect(vendorElements).toEqual([{ element_id: 829836802793406600 }]); // the mangling, pinned
  });

  it('omni-image 3.0 Omni series example (kling-image-omni-3.0-image-omni.md) round-trips', () => {
    const v = fixture('requests/omni-image-v3-omni.json') as LegacyBody & { element_list: { element_id: number }[]; image_list: { image: string }[] };
    const built = buildOmniImage(
      { model: v.model_name as string, prompt: v.prompt as string, elements: v.element_list.map((e) => ({ elementId: String(e.element_id) })), images: v.image_list.map((i) => i.image), resolution: '2k', resultType: 'series', seriesAmount: v.series_amount as number, aspectRatio: 'auto', callbackUrl: v.callback_url as string },
      v.model_name as string,
      v.image_list.map((i) => i.image),
      'fixed-external-id'
    );
    expect(built).toEqual(withId(v));
  });

  it('multi-image-to-image (kling-image-2.1-multi-image-to-image.md) round-trips, negative_prompt included', () => {
    const v = fixture('requests/multi-image-to-image.json') as LegacyBody & { subject_image_list: { subject_image: string }[] };
    const built = buildMultiImageToImage(
      { prompt: v.prompt as string, negativePrompt: v.negative_prompt as string, subjectImages: v.subject_image_list.map((s) => s.subject_image), sceneImage: asStr(v.scene_image), styleImage: asStr(v.style_image), n: v.n as number, aspectRatio: v.aspect_ratio as '9:16' },
      'kling-v2-1',
      { subjectImages: v.subject_image_list.map((s) => s.subject_image), sceneImage: asStr(v.scene_image), styleImage: asStr(v.style_image) },
      undefined
    );
    expect(built).toEqual(v);
  });

  it('outpaint (kling-image-common-outpainting.md) round-trips', () => {
    const v = fixture('requests/outpaint.json') as LegacyBody;
    const built = buildOutpaint(
      { image: v.image as string, up: v.up_expansion_ratio as number, down: v.down_expansion_ratio as number, left: v.left_expansion_ratio as number, right: v.right_expansion_ratio as number, prompt: v.prompt as string, n: v.n as number },
      v.image as string,
      'fixed-external-id'
    );
    expect(built).toEqual(withId(v));
  });

  it('subject-completion (kling-image-common-subject-completion.md) round-trips', () => {
    const v = fixture('requests/subject-completion.json') as LegacyBody;
    expect(buildSubjectCompletion({ frontalImage: v.element_frontal_image as string, callbackUrl: v.callback_url as string }, v.element_frontal_image as string, 'fixed-external-id')).toEqual(withId(v));
  });

  it('legacyElementId: safe integers become numbers (the vendor types element_id long); unsafe or non-numeric stay strings', () => {
    expect(legacyElementId('321922438904313')).toBe(321922438904313);
    expect(legacyElementId('829836802793406551')).toBe('829836802793406551'); // 18 digits — not exactly representable
    expect(legacyElementId('abc')).toBe('abc');
  });

  it('extraSettings merge at the top level of a legacy body', () => {
    expect(buildImageGeneration({ prompt: 'p', extraSettings: { style_preset: 'anime' } }, 'kling-v3', undefined, undefined)).toEqual({ model_name: 'kling-v3', prompt: 'p', style_preset: 'anime' });
  });
});
