/**
 * Legacy codec, parse half (spec §8 V1 parse, V2; D4 "legacy deductions mapped when present").
 * Fixtures are the vendor Response Examples (`test/2.0/fixtures/INDEX.md`).
 */
import { describe, expect, it } from 'vitest';
import { SERIES_GROUP_ID, parseCreate, parseList, parseTask, parseTaskRecord } from '../../../src/codecs/legacy.js';
import { KlingCodecError } from '../../../src/http/errors.js';
import { OUTPUT_RETENTION_MS } from '../../../src/config/constants.js';
import { fixture } from './fixtures.js';

const T = 1722769557708;
const LEGACY_BILLING = [
  { chargeType: 'unit', amount: 'string' },
  { chargeType: 'cash', amount: 'string', listPrice: 'string' },
];

describe('legacy parseCreate — image generation create', () => {
  it('normalises task_id/task_status/task_info.external_task_id/created_at/updated_at', () => {
    const json = fixture('legacy/image-generation-create.json');
    const t = parseCreate(json, { product: 'image-generation' });
    expect(t).toEqual({
      id: 'string',
      standard: 'legacy',
      product: 'image-generation',
      status: 'submitted',
      externalId: 'string',
      createdAt: T,
      updatedAt: T,
      outputs: [],
      raw: (json as { data: unknown }).data,
    });
  });
});

describe('legacy parseTask — image generation query', () => {
  const t = parseTask(fixture('legacy/image-generation-query.json'), { product: 'image-generation' });

  it('succeed → succeeded, task_status_msg → message, expiry derived, images[] → image outputs with index', () => {
    expect(t.status).toBe('succeeded');
    expect(t.message).toBe('string');
    expect(t.outputsExpireAt).toBe(T + OUTPUT_RETENTION_MS);
    expect(t.outputs).toEqual([{ type: 'image', url: 'string', watermarkUrl: 'string', index: 0 }]);
  });

  it('final_unit_deduction + final_balance_deduction → unit and cash entries', () => {
    expect(t.billing).toEqual(LEGACY_BILLING);
  });
});

describe('legacy parseList — image generation list', () => {
  it('one Task per data[] entry', () => {
    const tasks = parseList(fixture('legacy/image-generation-list.json'), { product: 'image-generation' }).tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: 'string', standard: 'legacy', product: 'image-generation', status: 'succeeded' });
    expect(tasks[0].outputs).toHaveLength(1);
  });
});

describe('legacy task_result shapes', () => {
  it('omni-image: images[] plain, series_images[] tagged with the series groupId', () => {
    const t = parseTask(fixture('legacy/omni-image-query.json'), { product: 'omni-image' });
    expect(t.outputs).toEqual([
      { type: 'image', url: 'string', watermarkUrl: 'string', index: 0 },
      { type: 'image', url: 'string', watermarkUrl: 'string', index: 0, groupId: SERIES_GROUP_ID },
    ]);
  });

  it('subject completion: images[]{index,url_1,url_2,url_3} → three image outputs sharing groupId = String(index)', () => {
    const t = parseTask(fixture('legacy/subject-completion-query.json'), { product: 'subject-completion' });
    expect(t.outputs).toEqual([
      { type: 'image', url: 'string', index: 0, groupId: '0' },
      { type: 'image', url: 'string', index: 0, groupId: '0' },
      { type: 'image', url: 'string', index: 0, groupId: '0' },
    ]);
  });

  it('avatar: videos[] → video output with duration parsed', () => {
    const t = parseTask(fixture('legacy/avatar-query.json'), { product: 'avatar' });
    expect(t.outputs).toEqual([{ type: 'video', id: 'string', url: 'string', watermarkUrl: 'string', durationSeconds: 5 }]);
    expect(t.billing).toEqual(LEGACY_BILLING);
  });

  it('TTS: audios[]{id,url,duration} → mp3Url / mp3DurationSeconds', () => {
    const t = parseTask(fixture('legacy/tts-create.json'));
    expect(t.outputs).toEqual([{ type: 'audio', id: 'string', mp3Url: 'string', mp3DurationSeconds: 5 }]);
    // TTS has no task_info → no externalId (the vendor documents none for TTS).
    expect(t).not.toHaveProperty('externalId');
  });

  it('text-to-audio: audios[]{url_mp3,url_wav,duration_mp3,duration_wav} → all four camelCase fields', () => {
    const t = parseTask(fixture('legacy/text-to-audio-query.json'));
    expect(t.outputs).toEqual([{ type: 'audio', id: 'string', mp3Url: 'string', wavUrl: 'string', mp3DurationSeconds: 5, wavDurationSeconds: 5 }]);
  });

  it('elements: element_id (number) → id string, element_name → name, succeed → succeeded, elementType unset, record in raw', () => {
    const [t] = parseList(fixture('legacy/element-list.json'), { product: 'element' }).tasks;
    expect(t.outputs).toHaveLength(1);
    const el = t.outputs[0];
    expect(el).toMatchObject({ type: 'element', id: '0', name: 'string', description: 'string', status: 'succeeded' });
    expect(el).not.toHaveProperty('elementType');
    expect((el as { raw: { reference_type: string } }).raw.reference_type).toBe('video_refer');
  });

  it('voices: voice_id/voice_name/trial_url/owned_by → id/name/url/ownedBy; status succeeded (no vendor field)', () => {
    const [t] = parseList(fixture('legacy/voice-list.json'), { product: 'voice' }).tasks;
    expect(t.outputs).toEqual([{ type: 'voice', id: 'string', name: 'string', url: 'string', ownedBy: 'kling', status: 'succeeded' }]);
  });

  it('callback body (no envelope) parses through parseTaskRecord', () => {
    const body = fixture('legacy/callback.json') as Record<string, unknown>;
    const t = parseTaskRecord(body, undefined, '$');
    expect(t).toMatchObject({ id: 'string', standard: 'legacy', status: 'succeeded', externalId: 'string' });
    // Fixed emission order (videos, images, series, audios, elements, voices), not the vendor's key order.
    expect(t.outputs.map((o) => o.type)).toEqual(['video', 'image']);
    expect(t.raw).toBe(body);
  });
});

describe('legacy guards (V2) and lenient paths', () => {
  const base = { task_id: 't1', task_status: 'succeed', created_at: T, updated_at: T };

  it('unknown task_status → KlingCodecError at data.task_status', () => {
    let err: unknown;
    try {
      parseTaskRecord({ ...base, task_status: 'string' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(KlingCodecError);
    expect((err as KlingCodecError).standard).toBe('legacy');
    expect((err as KlingCodecError).path).toBe('data.task_status');
  });

  it("new spelling 'succeeded' is accepted", () => {
    expect(parseTaskRecord({ ...base, task_status: 'succeeded' }).status).toBe('succeeded');
  });

  it('missing task_id → KlingCodecError at data.task_id', () => {
    expect(() => parseTaskRecord({ task_status: 'submitted' })).toThrow(/data\.task_id/);
  });

  it('timestamps: absent stays absent; seconds are scaled with a warning (Q12 — image products)', () => {
    const none = parseTaskRecord({ task_id: 't', task_status: 'succeed' });
    expect(none).not.toHaveProperty('createdAt');
    expect(none).not.toHaveProperty('outputsExpireAt');
    const warnings: string[] = [];
    const s = parseTaskRecord({ task_id: 't', task_status: 'succeed', created_at: 1722769557, updated_at: 1722769557 }, { warn: (m) => warnings.push(m) });
    expect(s.createdAt).toBe(1722769557000);
    expect(s.outputsExpireAt).toBe(1722769557000 + OUTPUT_RETENTION_MS);
    expect(warnings).toHaveLength(2);
  });

  it('no deductions → no billing key; units alone → one unit entry', () => {
    expect(parseTaskRecord(base)).not.toHaveProperty('billing');
    expect(parseTaskRecord({ ...base, final_unit_deduction: '0.8' }).billing).toEqual([{ chargeType: 'unit', amount: '0.8' }]);
  });

  it('a malformed task_result entry is dropped with a warning, never a throw', () => {
    const warnings: string[] = [];
    const t = parseTaskRecord({ ...base, task_result: { videos: [{ id: 'v' }], images: [{ index: 1 }], audios: 'nope' } }, { warn: (m) => warnings.push(m) });
    expect(t.outputs).toEqual([]);
    expect(warnings).toHaveLength(3);
  });
});
