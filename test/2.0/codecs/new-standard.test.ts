/**
 * New-standard codec, parse half (spec §8 V1 parse, V2; run #3 architect timestamp edge case).
 * Fixtures are the vendor Response Examples (`test/2.0/fixtures/INDEX.md`).
 */
import { describe, expect, it } from 'vitest';
import { parseCreate, parseCursor, parseTaskRecord, parseTasks } from '../../../src/codecs/new-standard.js';
import { KlingCodecError } from '../../../src/http/errors.js';
import { OUTPUT_RETENTION_MS } from '../../../src/config/constants.js';
import { fixture } from './fixtures.js';

const T_CREATE = 1781080778802;
const T_UPDATE = 1781080794151;

describe('new-standard parseCreate — 3.0-turbo t2v create', () => {
  const json = fixture('new/t2v-create.json');

  it('normalises the create envelope; product comes from the caller', () => {
    const task = parseCreate(json, { product: 'text-to-video' });
    expect(task).toEqual({
      id: '893605946402811985',
      standard: 'new',
      product: 'text-to-video',
      status: 'submitted',
      externalId: 'string',
      createdAt: T_CREATE,
      updatedAt: T_UPDATE,
      outputs: [],
      raw: (json as { data: unknown }).data,
    });
    // Not succeeded → no expiry; no billing on a create.
    expect(task).not.toHaveProperty('outputsExpireAt');
    expect(task).not.toHaveProperty('billing');
  });

  it('omits product when the caller has none (unified /tasks results)', () => {
    expect(parseCreate(json)).not.toHaveProperty('product');
  });
});

describe('new-standard parseTasks — GET /tasks', () => {
  const tasks = parseTasks(fixture('new/tasks-get.json'));

  it('returns one Task per data[] entry with every output type mapped', () => {
    expect(tasks).toHaveLength(1);
    const [t] = tasks;
    expect(t.id).toBe('893605946402811985');
    expect(t.status).toBe('succeeded');
    expect(t.message).toBe('string');
    expect(t.outputsExpireAt).toBe(T_UPDATE + OUTPUT_RETENTION_MS);
    expect(t.outputs.map((o) => o.type)).toEqual(['video', 'image', 'audio', 'voice', 'element']);
  });

  it('video: duration string → durationSeconds number', () => {
    expect(tasks[0].outputs[0]).toEqual({ type: 'video', id: 'string', url: 'string', watermarkUrl: 'string', durationSeconds: 5 });
  });

  it('image: group_id → groupId', () => {
    expect(tasks[0].outputs[1]).toEqual({ type: 'image', url: 'string', watermarkUrl: 'string', groupId: 'string' });
  });

  it('audio: mp3_url/wav_url/*_duration → camelCase, seconds as numbers', () => {
    expect(tasks[0].outputs[2]).toEqual({ type: 'audio', id: 'string', mp3Url: 'string', wavUrl: 'string', mp3DurationSeconds: 5, wavDurationSeconds: 5 });
  });

  it('voice: owned_by → ownedBy, status carried', () => {
    expect(tasks[0].outputs[3]).toEqual({ type: 'voice', id: 'string', name: 'string', url: 'string', ownedBy: 'string', status: 'succeeded' });
  });

  it('element: element_type → elementType, references[] preserved in raw', () => {
    const el = tasks[0].outputs[4];
    expect(el).toMatchObject({ type: 'element', id: 'string', name: 'string', description: 'string', elementType: 'video_character_elements', status: 'succeeded' });
    expect((el as { raw: { references: unknown[] } }).raw.references).toHaveLength(3);
  });

  it('billing: a unit entry keeps package_type and drops the cash-only fields', () => {
    expect(tasks[0].billing).toEqual([{ chargeType: 'unit', amount: 'string', packageType: 'video' }]);
  });

  it('an empty data[] (unknown ids — the vendor answers 200 []) → []', () => {
    expect(parseTasks({ code: 0, message: 'SUCCEED', request_id: 'r', data: [] })).toEqual([]);
  });
});

describe('new-standard parseCursor — POST /tasks', () => {
  const page = parseCursor(fixture('new/tasks-cursor.json'));

  it('maps result[] + cursor fields', () => {
    expect(page.tasks).toHaveLength(1);
    expect(page.count).toBe(1);
    expect(page.nextCursor).toBe('string');
    expect(page.hasMore).toBe(true);
    expect(page.tasks[0].id).toBe('string');
  });

  it('billing: a cash entry keeps cash_type/currency/list_price and drops package_type', () => {
    expect(page.tasks[0].billing).toEqual([{ chargeType: 'cash', amount: 'string', cashType: 'balance', currency: 'string', listPrice: 'string' }]);
  });

  it('element: multi_image_elements / deleted round-trip', () => {
    expect(page.tasks[0].outputs[4]).toMatchObject({ type: 'element', elementType: 'multi_image_elements', status: 'deleted' });
  });

  it('a page without cursor fields → count from length, hasMore false, no nextCursor', () => {
    const p = parseCursor({ code: 0, data: { result: [] } });
    expect(p).toEqual({ tasks: [], count: 0, hasMore: false });
  });
});

describe('new-standard parseTaskRecord — callback body (no envelope)', () => {
  it('parses the New Callback Function body into the same Task shape', () => {
    const body = fixture('new/callback.json') as Record<string, unknown>;
    const t = parseTaskRecord(body, undefined, '$');
    expect(t.standard).toBe('new');
    expect(t.status).toBe('succeeded');
    expect(t.outputs).toHaveLength(5);
    expect(t.raw).toBe(body);
  });
});

describe('new-standard guards (V2) and lenient paths', () => {
  const base = { id: 't1', status: 'succeeded', create_time: T_CREATE, update_time: T_UPDATE };

  it('unknown status → KlingCodecError naming the path, never processing', () => {
    const err = (() => {
      try {
        parseTaskRecord({ ...base, status: 'string' });
      } catch (e) {
        return e;
      }
    })();
    expect(err).toBeInstanceOf(KlingCodecError);
    expect((err as KlingCodecError).standard).toBe('new');
    expect((err as KlingCodecError).path).toBe('data.status');
  });

  it("legacy spelling 'succeed' is accepted (the id field discriminates standards, not this word)", () => {
    expect(parseTaskRecord({ ...base, status: 'succeed' }).status).toBe('succeeded');
  });

  it('missing id → KlingCodecError at data.id', () => {
    expect(() => parseTaskRecord({ status: 'submitted' })).toThrow(KlingCodecError);
    expect(() => parseTaskRecord({ status: 'submitted' })).toThrow(/data\.id/);
  });

  it('non-envelope input → KlingCodecError at data', () => {
    expect(() => parseTasks(null)).toThrow(KlingCodecError);
    expect(() => parseTasks({ id: 'x' })).toThrow(/no `data`/);
    expect(() => parseTasks('not json')).toThrow(KlingCodecError);
  });

  it('timestamps: absent / 0 / negative stay absent — no 0×1000, no outputsExpireAt from the epoch', () => {
    const t = parseTaskRecord({ id: 't1', status: 'succeeded' });
    expect(t).not.toHaveProperty('createdAt');
    expect(t).not.toHaveProperty('updatedAt');
    expect(t).not.toHaveProperty('outputsExpireAt');
    const z = parseTaskRecord({ id: 't1', status: 'succeeded', create_time: 0, update_time: -5 });
    expect(z).not.toHaveProperty('createdAt');
    expect(z).not.toHaveProperty('updatedAt');
    expect(z).not.toHaveProperty('outputsExpireAt');
  });

  it('timestamps below 1e11 are read as seconds, scaled, and warned (Q12) — a ms value is not', () => {
    const warnings: string[] = [];
    const t = parseTaskRecord({ id: 't1', status: 'succeeded', create_time: 1722769557, update_time: T_UPDATE }, { warn: (m) => warnings.push(m) });
    expect(t.createdAt).toBe(1722769557000);
    expect(t.updatedAt).toBe(T_UPDATE);
    expect(warnings).toEqual([expect.stringMatching(/create_time: 1722769557 .* seconds/)]);
  });

  it('outputsExpireAt only on succeeded', () => {
    expect(parseTaskRecord({ ...base, status: 'processing' })).not.toHaveProperty('outputsExpireAt');
    expect(parseTaskRecord({ ...base, status: 'failed' })).not.toHaveProperty('outputsExpireAt');
  });

  it('a malformed or unknown output is dropped with a warning, never a throw', () => {
    const warnings: string[] = [];
    const t = parseTaskRecord(
      { ...base, outputs: [{ type: 'video', id: 'v1' }, { type: 'hologram', id: 'h' }, 'junk', { type: 'image', url: 'u' }] },
      { warn: (m) => warnings.push(m) }
    );
    expect(t.outputs).toEqual([{ type: 'image', url: 'u' }]);
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toMatch(/outputs\[0\]: video without id\/url/);
    expect(warnings[1]).toMatch(/unknown output type "hologram"/);
  });

  it("the docs' literal \"string\" duration placeholder → durationSeconds absent, not NaN", () => {
    const t = parseTaskRecord({ ...base, outputs: [{ type: 'video', id: 'v', url: 'u', duration: 'string' }] });
    expect(t.outputs[0]).toEqual({ type: 'video', id: 'v', url: 'u' });
  });

  it('a billing entry with an unknown charge_type is dropped with a warning', () => {
    const warnings: string[] = [];
    const t = parseTaskRecord({ ...base, billing: [{ charge_type: 'string', amount: '1' }, { charge_type: 'unit', amount: '2.4', package_type: 'video' }] }, { warn: (m) => warnings.push(m) });
    expect(t.billing).toEqual([{ chargeType: 'unit', amount: '2.4', packageType: 'video' }]);
    expect(warnings).toHaveLength(1);
  });

  it('an unknown element/voice status defaults to succeeded with a warning (outputs never throw)', () => {
    const warnings: string[] = [];
    const t = parseTaskRecord({ ...base, outputs: [{ type: 'voice', id: 'v', name: 'n', status: 'string' }] }, { warn: (m) => warnings.push(m) });
    expect(t.outputs[0]).toMatchObject({ status: 'succeeded' });
    expect(warnings[0]).toMatch(/unknown resource status "string"/);
  });
});
