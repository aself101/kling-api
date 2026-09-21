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
