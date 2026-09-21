/**
 * t2v rules (spec D9; checklist 2a₂). Every test names its rule class. `[shape]` rules
 * throw under BOTH capabilityValidation modes; `[capability]` rules throw under 'error'
 * and warn under 'warn' (run #3 A42).
 */
import { describe, expect, it } from 'vitest';
import { VIDEO_MODELS } from '../../../../src/config/models.js';
import { resolveVideoCaps, type ValidationPolicy } from '../../../../src/config/validators/helpers.js';
import { validateTextToVideo } from '../../../../src/config/validators/video.js';
import { KlingValidationError } from '../../../../src/http/errors.js';

function policy(mode: ValidationPolicy['capabilityValidation'] = 'error', unknown: ValidationPolicy['unknownModels'] = 'passthrough') {
  const warnings: string[] = [];
  return { policy: { capabilityValidation: mode, unknownModels: unknown, warn: (m: string) => void warnings.push(m) } as ValidationPolicy, warnings };
}
const turbo = VIDEO_MODELS['kling-3.0-turbo'];
const v30 = VIDEO_MODELS['kling-3.0'];
const v26 = VIDEO_MODELS['kling-2.6'];

/** Run a rule under both modes and return what each did. */
function underBothModes(fn: (p: ValidationPolicy) => void) {
  const err = policy('error');
  const warn = policy('warn');
  let threwError: KlingValidationError | undefined;
  let threwWarn: KlingValidationError | undefined;
  try { fn(err.policy); } catch (e) { threwError = e as KlingValidationError; }
  try { fn(warn.policy); } catch (e) { threwWarn = e as KlingValidationError; }
  return { threwError, threwWarn, warnings: warn.warnings };
}

describe('validateTextToVideo — [shape] rules throw under both modes', () => {
  it('[shape] prompt required', () => {
    const r = underBothModes((p) => validateTextToVideo({ prompt: '  ' } as never, turbo, p));
    expect(r.threwError?.field).toBe('prompt');
    expect(r.threwWarn?.field).toBe('prompt');
  });

  it('[shape] prompt ≤ 3072 on 3.0-turbo / 3.0, ≤ 2500 on 2.6 / 2.5-turbo; unknown model held to 3072', () => {
    const p = policy().policy;
    expect(() => validateTextToVideo({ prompt: 'x'.repeat(3072) }, turbo, p)).not.toThrow();
    expect(() => validateTextToVideo({ prompt: 'x'.repeat(3073) }, turbo, p)).toThrow(/3072/);
    expect(() => validateTextToVideo({ prompt: 'x'.repeat(2500) }, v26, p)).not.toThrow();
    expect(() => validateTextToVideo({ prompt: 'x'.repeat(2501), model: 'kling-2.6' }, v26, p)).toThrow(/kling-2.6 allows at most 2500/);
    expect(() => validateTextToVideo({ prompt: 'x'.repeat(3072) }, undefined, p)).not.toThrow();
    expect(() => validateTextToVideo({ prompt: 'x'.repeat(3073) }, undefined, p)).toThrow(KlingValidationError);
  });

  it('[shape] duration integer; audio enum; multiShot boolean; callbackUrl http(s)', () => {
    const r1 = underBothModes((p) => validateTextToVideo({ prompt: 'p', duration: 5.5 }, turbo, p));
    expect(r1.threwError?.field).toBe('duration');
    expect(r1.threwWarn?.field).toBe('duration');
    expect(() => validateTextToVideo({ prompt: 'p', audio: 'loud' as never }, v30, policy().policy)).toThrow(/audio/);
    expect(() => validateTextToVideo({ prompt: 'p', multiShot: 'yes' as never }, v30, policy().policy)).toThrow(/multiShot/);
    expect(() => validateTextToVideo({ prompt: 'p', callbackUrl: 'ftp://x' }, v30, policy().policy)).toThrow(/callbackUrl/);
  });

  it('[shape] extraSettings / extraOptions may not carry a modeled key (run #3 A41); unknown keys pass', () => {
    const p = policy('warn').policy;
    expect(() => validateTextToVideo({ prompt: 'p', extraSettings: { resolution: '720p' } }, turbo, p)).toThrow(/extraSettings\.resolution/);
    expect(() => validateTextToVideo({ prompt: 'p', extraOptions: { external_task_id: 'x' } }, turbo, p)).toThrow(/extraOptions\.external_task_id/);
    expect(() => validateTextToVideo({ prompt: 'p', extraSettings: { shot_type: 'wide' }, extraOptions: { priority: 1 } }, turbo, p)).not.toThrow();
  });
});

describe('validateTextToVideo — [capability] rules: throw under error, warn-and-continue under warn', () => {
  it('[capability] model ∈ products (kling-3.0-omni has no t2v endpoint)', () => {
    const r = underBothModes((p) => validateTextToVideo({ prompt: 'p', model: 'kling-3.0-omni' }, VIDEO_MODELS['kling-3.0-omni'], p));
    expect(r.threwError?.field).toBe('model');
    expect(r.threwWarn).toBeUndefined();
    expect(r.warnings[0]).toMatch(/^\[capability\] model: kling-3.0-omni has no \/text-to-video endpoint/);
  });

  it('[capability] resolution ∈ model×product set (4k on 3.0, not on 3.0-turbo)', () => {
    const p = policy().policy;
    expect(() => validateTextToVideo({ prompt: 'p', resolution: '4k' }, v30, p)).not.toThrow();
    const r = underBothModes((pp) => validateTextToVideo({ prompt: 'p', model: 'kling-3.0-turbo', resolution: '4k' }, turbo, pp));
    expect(r.threwError?.message).toMatch(/720p \| 1080p, not 4k/);
    expect(r.threwWarn).toBeUndefined();
    expect(r.warnings).toHaveLength(1);
  });

  it('[capability] duration ∈ model set (3–15 on 3.0-era; 5|10 on 2.x)', () => {
    const p = policy().policy;
    expect(() => validateTextToVideo({ prompt: 'p', duration: 3 }, turbo, p)).not.toThrow();
    expect(() => validateTextToVideo({ prompt: 'p', duration: 16 }, turbo, p)).toThrow(/3–15 s, not 16/);
    expect(() => validateTextToVideo({ prompt: 'p', duration: 10 }, v26, p)).not.toThrow();
    expect(() => validateTextToVideo({ prompt: 'p', duration: 7 }, v26, p)).toThrow(/5 \| 10 s, not 7/);
  });

  it('[capability] aspectRatio ∈ 16:9 | 9:16 | 1:1', () => {
    expect(() => validateTextToVideo({ prompt: 'p', aspectRatio: '4:3' as never }, turbo, policy().policy)).toThrow(/aspectRatio/);
    expect(() => validateTextToVideo({ prompt: 'p', aspectRatio: '1:1' }, turbo, policy().policy)).not.toThrow();
  });

  it('[capability] audio only where the model has the field — the 3.0-turbo message names the inference and the knob', () => {
    const r = underBothModes((p) => validateTextToVideo({ prompt: 'p', model: 'kling-3.0-turbo', audio: 'off' }, turbo, p));
    expect(r.threwError?.field).toBe('audio');
    expect(r.threwError?.message).toBe("native audio is always on for kling-3.0-turbo (inferred from pricing; pass capabilityValidation: 'warn' to send anyway)");
    expect(r.threwWarn).toBeUndefined();
    expect(() => validateTextToVideo({ prompt: 'p', audio: 'native' }, v30, policy().policy)).not.toThrow();
    expect(() => validateTextToVideo({ prompt: 'p', audio: 'original' }, v30, policy().policy)).toThrow(/native \| off, not original/);
    expect(() => validateTextToVideo({ prompt: 'p', model: 'kling-2.5-turbo', audio: 'off' }, VIDEO_MODELS['kling-2.5-turbo'], policy().policy)).toThrow(/has no audio setting/);
  });

  it('[capability] kling-2.6 native audio ⇒ 1080p', () => {
    const p = policy().policy;
    expect(() => validateTextToVideo({ prompt: 'p', audio: 'native', resolution: '1080p' }, v26, p)).not.toThrow();
    expect(() => validateTextToVideo({ prompt: 'p', audio: 'native' }, v26, p)).not.toThrow(); // vendor default resolution is 720p — the vendor decides
    expect(() => validateTextToVideo({ prompt: 'p', audio: 'native', resolution: '720p' }, v26, p)).toThrow(/kling-2.6 with audio: native supports only 1080p/);
    expect(() => validateTextToVideo({ prompt: 'p', audio: 'off', resolution: '720p' }, v26, p)).not.toThrow();
  });

  it('[capability] multiShot only where settings.multi_shot exists; 3.0-turbo message points at the prompt syntax', () => {
    const p = policy().policy;
    expect(() => validateTextToVideo({ prompt: 'p', multiShot: false }, v30, p)).not.toThrow();
    expect(() => validateTextToVideo({ prompt: 'p', model: 'kling-3.0-turbo', multiShot: true }, turbo, p)).toThrow(/prompt syntax/);
    expect(() => validateTextToVideo({ prompt: 'p', multiShot: true }, v26, p)).toThrow(/no multi_shot setting/);
  });
});

describe('resolveVideoCaps (D9 unknown-model policy)', () => {
  it('known id → its row, no warning', () => {
    const { policy: p, warnings } = policy();
    expect(resolveVideoCaps('kling-2.6', p)).toBe(v26);
    expect(warnings).toEqual([]);
  });

  it("unknown id + passthrough → undefined with a warning naming the id and the knob; shape rules still apply", () => {
    const { policy: p, warnings } = policy();
    expect(resolveVideoCaps('kling-9.9', p)).toBeUndefined();
    expect(warnings[0]).toMatch(/"kling-9\.9" is not in this library's capability registry[^]*unknownModels: 'passthrough'/);
    expect(() => validateTextToVideo({ prompt: 'p', resolution: '8k' as never, duration: 99 }, undefined, p)).not.toThrow();
    expect(() => validateTextToVideo({ prompt: '' }, undefined, p)).toThrow(/prompt/);
  });

  it("unknown id + reject → KlingValidationError('model') listing the known ids", () => {
    const { policy: p } = policy('error', 'reject');
    expect(() => resolveVideoCaps('kling-9.9', p)).toThrow(KlingValidationError);
    expect(() => resolveVideoCaps('kling-9.9', p)).toThrow(/known: kling-3.0-turbo, kling-3.0/);
  });

  it('prototype keys are not models', () => {
    expect(resolveVideoCaps('toString', policy().policy)).toBeUndefined();
  });
});

// ── image-to-video rules (2a₃) ────────────────────────────────────────────────────────

import { validateImageToVideo } from '../../../../src/config/validators/video.js';

const FRAME = 'https://cdn.example/f.png';
const t25 = VIDEO_MODELS['kling-2.5-turbo'];

describe('validateImageToVideo — [shape] rules', () => {
  it('[shape] firstFrame required; lastFrame alone is rejected under both modes', () => {
    const r = underBothModes((p) => validateImageToVideo({ prompt: 'p', lastFrame: FRAME } as never, v30, p));
    expect(r.threwError?.field).toBe('firstFrame');
    expect(r.threwWarn?.field).toBe('firstFrame');
    expect(r.threwError?.message).toMatch(/last-frame-only generation is not supported/);
  });

  it('[shape] elements ≤ 3 and voices ≤ 2 (array bounds); required ids; unique content ids', () => {
    const p = policy('warn').policy;
    const four = Array.from({ length: 4 }, (_, i) => ({ elementId: `E${i}` }));
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, elements: four }, v30, p)).toThrow(/elements: at most 3/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, voices: [{ voiceId: 'a' }, { voiceId: 'b' }, { voiceId: 'c' }] }, v26, p)).toThrow(/voices: at most 2/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, elements: [{ elementId: '' }] }, v30, p)).toThrow(/elements\[0\]\.elementId/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, elements: [{ elementId: 'a', id: 'x' }, { elementId: 'b', id: 'x' }] }, v30, p)).toThrow(/must be unique/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, elements: [{ elementId: 'a', id: 'x' }, { elementId: 'b' }] }, v30, p)).not.toThrow();
  });

  it('[shape] aspectRatio has no i2v setting', () => {
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, aspectRatio: '16:9' } as never, v30, policy('warn').policy)).toThrow(/first frame sets it/);
  });
});

describe('validateImageToVideo — [capability] rules', () => {
  it('[capability] 3.0-turbo rejects lastFrame (first frame only); 3.0 accepts it', () => {
    const r = underBothModes((p) => validateImageToVideo({ prompt: 'p', model: 'kling-3.0-turbo', firstFrame: FRAME, lastFrame: FRAME }, turbo, p));
    expect(r.threwError?.field).toBe('lastFrame');
    expect(r.threwWarn).toBeUndefined();
    expect(r.warnings[0]).toMatch(/first frame only/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, lastFrame: FRAME, resolution: '720p' }, v30, policy().policy)).not.toThrow();
  });

  it('[capability] 2.6 / 2.5-turbo first + last ⇒ 1080p', () => {
    const p = policy().policy;
    for (const caps of [v26, t25]) {
      expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, lastFrame: FRAME, resolution: '1080p' }, caps, p)).not.toThrow();
      expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, lastFrame: FRAME, resolution: '720p', model: caps.id }, caps, p)).toThrow(/with first \+ last frame supports only 1080p/);
      expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, resolution: '720p' }, caps, p)).not.toThrow();
    }
  });

  it('[capability] elements 3.0 only', () => {
    const p = policy().policy;
    expect(() => validateImageToVideo({ prompt: '@Zhang', firstFrame: FRAME, elements: [{ elementId: 'e', id: 'Zhang' }] }, v30, p)).not.toThrow();
    expect(() => validateImageToVideo({ prompt: 'p', model: 'kling-3.0-turbo', firstFrame: FRAME, elements: [{ elementId: 'e' }] }, turbo, p)).toThrow(/does not take element contents \(kling-3.0 does\)/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, elements: [] }, turbo, p)).not.toThrow(); // empty array is a no-op
  });

  it("[capability] voices 2.6 only, and audio must not be 'off'", () => {
    const p = policy().policy;
    expect(() => validateImageToVideo({ prompt: '@1', firstFrame: FRAME, voices: [{ voiceId: 'v', id: '1' }], audio: 'native', resolution: '1080p' }, v26, p)).not.toThrow();
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, voices: [{ voiceId: 'v' }], audio: 'off' }, v26, p)).toThrow(/audio cannot be off/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, voices: [{ voiceId: 'v' }] }, v30, p)).toThrow(/does not take voice contents \(kling-2.6 does\)/);
  });

  it('[capability] resolution / duration / audio / multiShot per the i2v sets; unknown model → shape only', () => {
    const p = policy().policy;
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, resolution: '4k' }, v30, p)).not.toThrow();
    expect(() => validateImageToVideo({ prompt: 'p', model: 'kling-2.6', firstFrame: FRAME, resolution: '4k' }, v26, p)).toThrow(/image-to-video accepts resolution 720p \| 1080p, not 4k/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, duration: 7 }, v26, p)).toThrow(/5 \| 10 s, not 7/);
    expect(() => validateImageToVideo({ prompt: 'p', model: 'kling-3.0-turbo', firstFrame: FRAME, audio: 'off' }, turbo, p)).toThrow(/native audio is always on/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, multiShot: true }, v26, p)).toThrow(/no multi_shot setting/);
    expect(() => validateImageToVideo({ prompt: 'p', firstFrame: FRAME, resolution: '8k' as never, lastFrame: FRAME, elements: [{ elementId: 'e' }], voices: [{ voiceId: 'v' }] }, undefined, p)).not.toThrow();
  });
});
