/** Image rules (spec D7, D9; checklist 3a/3b). [shape] throws under both modes; [capability] warns under 'warn'. */
import { describe, expect, it } from 'vitest';
import { IMAGE_MODELS } from '../../../../src/config/models.js';
import type { ValidationPolicy } from '../../../../src/config/validators/helpers.js';
import {
  MAX_TOTAL_EXPANSION,
  resolveImageCaps,
  validateImageGenerate,
  validateMultiImageToImage,
  validateOmniImage,
  validateOutpaint,
  validateSubjectCompletion,
} from '../../../../src/config/validators/image.js';
import { KlingValidationError } from '../../../../src/http/errors.js';

function policy(mode: ValidationPolicy['capabilityValidation'] = 'error', unknown: ValidationPolicy['unknownModels'] = 'passthrough') {
  const warnings: string[] = [];
  return { policy: { capabilityValidation: mode, unknownModels: unknown, warn: (m: string) => void warnings.push(m) } as ValidationPolicy, warnings };
}
const v3 = IMAGE_MODELS['kling-v3'];
const v21 = IMAGE_MODELS['kling-v2-1'];
const omni = IMAGE_MODELS['kling-v3-omni'];
const o1 = IMAGE_MODELS['kling-image-o1'];
const IMG = 'https://cdn.example/i.png';

describe('validateImageGenerate', () => {
  it('[shape] prompt required ≤ 2500; n 1–9; fidelities in [0,1]; imageReference needs image', () => {
    const p = policy('warn').policy;
    expect(() => validateImageGenerate({ prompt: '' }, v3, p)).toThrow(/prompt is required/);
    expect(() => validateImageGenerate({ prompt: 'x'.repeat(2501) }, v3, p)).toThrow(/at most 2500/);
    expect(() => validateImageGenerate({ prompt: 'p', n: 10 }, v3, p)).toThrow(/n must be an integer in 1–9/);
    expect(() => validateImageGenerate({ prompt: 'p', n: 0 }, v3, p)).toThrow(/n must be/);
    expect(() => validateImageGenerate({ prompt: 'p', imageFidelity: 1.5 }, v21, p)).toThrow(/imageFidelity must be a number in \[0, 1\]/);
    expect(() => validateImageGenerate({ prompt: 'p', imageReference: 'face' }, v21, p)).toThrow(/imageReference requires image/);
    expect(() => validateImageGenerate({ prompt: 'p', aspectRatio: 'auto' as never }, v3, p)).toThrow(/no auto on \/v1\/images\/generations/);
    expect(() => validateImageGenerate({ prompt: 'p', extraSettings: { resolution: '2k' } }, v3, p)).toThrow(/extraSettings\.resolution/);
    expect(() => validateImageGenerate({ prompt: 'p', image: IMG, imageReference: 'subject', imageFidelity: 0.5, humanFidelity: 0.45, n: 9, aspectRatio: '21:9', resolution: '2k' }, v21, p)).not.toThrow();
  });

  it("[capability] imageReference / humanFidelity are kling-v2-1 only → ERROR on kling-v3 (warn under 'warn')", () => {
    const strict = policy();
    expect(() => validateImageGenerate({ prompt: 'p', model: 'kling-v3', image: IMG, imageReference: 'subject' }, v3, strict.policy)).toThrow(/imageReference is supported by kling-v2-1 only, not kling-v3/);
    expect(() => validateImageGenerate({ prompt: 'p', model: 'kling-v3', image: IMG, imageReference: 'subject', humanFidelity: 0.3 }, v3, strict.policy)).toThrow(KlingValidationError);
    const lenient = policy('warn');
    expect(() => validateImageGenerate({ prompt: 'p', model: 'kling-v3', image: IMG, imageReference: 'subject' }, v3, lenient.policy)).not.toThrow();
    expect(lenient.warnings[0]).toMatch(/^\[capability\] imageReference/);
  });

  it("humanFidelity without imageReference: 'subject' → a WARNING (vendor: only takes effect when subject), not an error", () => {
    const { policy: p, warnings } = policy();
    expect(() => validateImageGenerate({ prompt: 'p', image: IMG, humanFidelity: 0.5 }, v21, p)).not.toThrow();
    expect(warnings).toEqual([expect.stringMatching(/humanFidelity is set but imageReference is unset/)]);
    const quiet = policy();
    validateImageGenerate({ prompt: 'p', image: IMG, imageReference: 'subject', humanFidelity: 0.5 }, v21, quiet.policy);
    expect(quiet.warnings).toEqual([]);
  });

  it('[capability] resolution per model; model must have the endpoint', () => {
    expect(() => validateImageGenerate({ prompt: 'p', resolution: '4k' as never }, v3, policy().policy)).toThrow(/accepts resolution 1k \| 2k, not 4k/);
    expect(() => validateImageGenerate({ prompt: 'p', model: 'kling-v3-omni' }, omni, policy().policy)).toThrow(/has no \/v1\/images\/generations endpoint/);
  });
});

describe('validateOmniImage', () => {
  it('[shape] images + elements ≤ 10; seriesAmount 2–9|auto and only with series; resultType enum', () => {
    const p = policy('warn').policy;
    expect(() => validateOmniImage({ prompt: 'p', images: Array(6).fill(IMG), elements: Array(5).fill({ elementId: 'e' }) }, omni, p)).toThrow(/at most 10 \(got 11\)/);
    expect(() => validateOmniImage({ prompt: 'p', resultType: 'series', seriesAmount: 1 }, omni, p)).toThrow(/seriesAmount must be an integer in 2–9 or 'auto'/);
    expect(() => validateOmniImage({ prompt: 'p', seriesAmount: 3 }, omni, p)).toThrow(/only meaningful with resultType: 'series'/);
    expect(() => validateOmniImage({ prompt: 'p', resultType: 'pair' as never }, omni, p)).toThrow(/resultType/);
    expect(() => validateOmniImage({ prompt: 'p', resultType: 'series', seriesAmount: 'auto', aspectRatio: 'auto', resolution: '4k' }, omni, p)).not.toThrow();
  });

  it('[capability] O1: no 4k, no series; 3.0 Omni: both', () => {
    const p = policy().policy;
    expect(() => validateOmniImage({ prompt: 'p', model: 'kling-image-o1', resolution: '4k' }, o1, p)).toThrow(/accepts resolution 1k \| 2k, not 4k \(capability map/);
    expect(() => validateOmniImage({ prompt: 'p', model: 'kling-image-o1', resultType: 'series' }, o1, p)).toThrow(/does not support series generation/);
    expect(() => validateOmniImage({ prompt: 'p', resolution: '4k', resultType: 'series' }, omni, p)).not.toThrow();
  });
});

describe('validateMultiImageToImage / validateOutpaint / validateSubjectCompletion', () => {
  it('[shape] subjectImages 1–4', () => {
    const p = policy().policy;
    expect(() => validateMultiImageToImage({ subjectImages: [] }, p)).toThrow(/1–4 images/);
    expect(() => validateMultiImageToImage({ subjectImages: Array(5).fill(IMG) }, p)).toThrow(/1–4 images/);
    expect(() => validateMultiImageToImage({ subjectImages: [IMG], aspectRatio: '9:16', n: 2 }, p)).not.toThrow();
  });

  it('[shape] outpaint ratios in [0, 2] and total area ≤ 3× (MAX_TOTAL_EXPANSION retained from 1.x)', () => {
    expect(MAX_TOTAL_EXPANSION).toBe(3);
    const base = { image: IMG, up: 0, down: 0, left: 0, right: 0 };
    expect(() => validateOutpaint({ ...base, up: 2.1 })).toThrow(/up must be a number in \[0, 2\]/);
    expect(() => validateOutpaint({ ...base, up: 1, down: 1, left: 0.5 })).toThrow(/4.50× the source area; the vendor allows at most 3×/);
    expect(() => validateOutpaint({ ...base, up: 1, down: 1 })).not.toThrow(); // exactly 3×
    expect(() => validateOutpaint({ ...base, left: 0.6547, right: 0.6547, up: 0.1495, down: 0.1495 })).not.toThrow(); // the vendor example
  });

  it('[shape] subjectCompletion frontalImage required', () => {
    expect(() => validateSubjectCompletion({ frontalImage: undefined as never })).toThrow(/frontalImage is required/);
    expect(() => validateSubjectCompletion({ frontalImage: IMG })).not.toThrow();
  });
});

describe('resolveImageCaps', () => {
  it('known / unknown-passthrough / unknown-reject', () => {
    const { policy: p, warnings } = policy();
    expect(resolveImageCaps('kling-v3', p)).toBe(v3);
    expect(resolveImageCaps('kling-v9', p)).toBeUndefined();
    expect(warnings[0]).toMatch(/not in this library's capability registry/);
    expect(() => resolveImageCaps('kling-v9', policy('error', 'reject').policy)).toThrow(/known: kling-v3, kling-v2-1, kling-v3-omni, kling-image-o1/);
  });
});
