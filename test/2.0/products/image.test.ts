/** ImageApi end-to-end over a real HttpCore and a routed fake fetch (spec D7). Legacy standard: flat bodies, /v1 paths, 10 MB inline cap. */
import { describe, expect, it } from 'vitest';
import { HttpCore } from '../../../src/http/core.js';
import { KlingValidationError } from '../../../src/http/errors.js';
import { ImageApi } from '../../../src/products/image.js';
import { fixture } from '../codecs/fixtures.js';

interface Call { url: URL; method: string; body?: Record<string, unknown> }
function rig(config: Partial<ConstructorParameters<typeof ImageApi>[1]> = {}) {
  const calls: Call[] = [];
  const warnings: string[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(fixture('legacy/image-generation-create.json')), { status: 200 });
  }) as typeof fetch;
  const logger = { debug: () => undefined, info: () => undefined, warn: (m: string) => void warnings.push(m), error: () => undefined };
  const core = new HttpCore({ apiKey: 'k', fetch: fetchImpl, retry: { maxAttempts: 3 } }, { sleep: async () => undefined });
  return { image: new ImageApi(core, { logger, unknownModels: 'passthrough', capabilityValidation: 'error', ...config }), calls, warnings };
}
const IMG = 'https://cdn.example/ref.png';
const PNG_B64 = Buffer.alloc(2000, 3).toString('base64');

describe('image.generate', () => {
  it('POST /v1/images/generations with the flat body, default kling-v3, generated external_task_id; legacy handle', async () => {
    const { image, calls } = rig();
    const h = await image.generate({ prompt: 'a puppy', n: 2, aspectRatio: '1:1', resolution: '2k' });
    expect(calls[0].url.pathname).toBe('/v1/images/generations');
    expect(calls[0].body).toMatchObject({ model_name: 'kling-v3', prompt: 'a puppy', n: 2, aspect_ratio: '1:1', resolution: '2k' });
    expect(calls[0].body!.external_task_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(h).toMatchObject({ standard: 'legacy', product: 'image-generation', id: 'string' });
    expect(h.request).toEqual({ prompt: 'a puppy', n: 2, aspectRatio: '1:1', resolution: '2k', model: 'kling-v3' });
  });

  it('a Base64 reference image is sent in `image` and redacted on the handle; a bare path is refused; the legacy 10 MB cap applies', async () => {
    const { image, calls } = rig();
    const h = await image.generate({ model: 'kling-v2-1', prompt: 'p', image: `data:image/png;base64,${PNG_B64}`, imageReference: 'subject' });
    expect(calls[0].body!.image).toBe(PNG_B64);
    expect(h.request.image).toMatchObject({ kind: 'base64', bytes: 2000 });
    await expect(image.generate({ prompt: 'p', image: './ref.png' })).rejects.toThrow(/filesystem path is never read/);
    const big = Buffer.alloc(10_000_001, 1).toString('base64');
    await expect(image.generate({ prompt: 'p', image: big })).rejects.toThrow(/10 MB inline cap for the legacy standard/);
    expect(calls).toHaveLength(1);
  });

  it('validation before any request; warn mode sends with a log line', async () => {
    const strict = rig();
    await expect(strict.image.generate({ prompt: 'p', image: IMG, imageReference: 'face' })).rejects.toBeInstanceOf(KlingValidationError);
    expect(strict.calls).toHaveLength(0);
    const lenient = rig({ capabilityValidation: 'warn' });
    await lenient.image.generate({ prompt: 'p', image: IMG, imageReference: 'face' });
    expect(lenient.calls[0].body!.image_reference).toBe('face');
    expect(lenient.warnings[0]).toMatch(/^\[capability\] imageReference/);
  });
});

describe('image.omni / multiImageToImage / outpaint / subjectCompletion', () => {
  it('omni: default kling-v3-omni, image_list/element_list built, ids numeric when safe', async () => {
    const { image, calls } = rig();
    const h = await image.omni({ prompt: 'merge <<image_1>>', images: [IMG, `data:image/png;base64,${PNG_B64}`], elements: [{ elementId: '321922438904313' }], resultType: 'series', seriesAmount: 'auto', aspectRatio: 'auto' });
    expect(calls[0].url.pathname).toBe('/v1/images/omni-image');
    expect(calls[0].body).toMatchObject({ model_name: 'kling-v3-omni', image_list: [{ image: IMG }, { image: PNG_B64 }], element_list: [{ element_id: 321922438904313 }], result_type: 'series', series_amount: 'auto', aspect_ratio: 'auto' });
    expect(h.product).toBe('omni-image');
    expect((h.request.images as { kind: string }[]).map((r) => r.kind)).toEqual(['url', 'base64']);
  });

  it('multiImageToImage: model fixed to kling-v2-1, subject_image_list, scene/style optional', async () => {
    const { image, calls } = rig();
    const h = await image.multiImageToImage({ prompt: 'p', subjectImages: [IMG, IMG], sceneImage: IMG, n: 2, aspectRatio: '9:16' });
    expect(calls[0].url.pathname).toBe('/v1/images/multi-image2image');
    expect(calls[0].body).toMatchObject({ model_name: 'kling-v2-1', subject_image_list: [{ subject_image: IMG }, { subject_image: IMG }], scene_image: IMG, n: 2, aspect_ratio: '9:16' });
    expect(calls[0].body).not.toHaveProperty('style_image');
    expect(h.product).toBe('multi-image-to-image');
    expect(h.request.model).toBe('kling-v2-1');
  });

  it('outpaint: /v1/images/editing/expand with the four ratios', async () => {
    const { image, calls } = rig();
    const h = await image.outpaint({ image: IMG, up: 0.1, down: 0.1, left: 0.5, right: 0.5, n: 1 });
    expect(calls[0].url.pathname).toBe('/v1/images/editing/expand');
    expect(calls[0].body).toMatchObject({ image: IMG, up_expansion_ratio: 0.1, down_expansion_ratio: 0.1, left_expansion_ratio: 0.5, right_expansion_ratio: 0.5, n: 1 });
    expect(h.product).toBe('outpainting');
    await expect(image.outpaint({ image: IMG, up: 1, down: 1, left: 0.5, right: 0 })).rejects.toThrow(/at most 3×/);
  });

  it('subjectCompletion: /v1/general/ai-multi-shot with element_frontal_image', async () => {
    const { image, calls } = rig();
    const h = await image.subjectCompletion({ frontalImage: IMG, externalTaskId: 'e-sc' });
    expect(calls[0].url.pathname).toBe('/v1/general/ai-multi-shot');
    expect(calls[0].body).toEqual({ element_frontal_image: IMG, external_task_id: 'e-sc' });
    expect(h).toMatchObject({ product: 'subject-completion', externalId: 'e-sc' });
  });
});
