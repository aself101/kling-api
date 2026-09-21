/**
 * Capability registry grounding (spec D9, V3): every enum value in VIDEO_MODELS appears
 * verbatim in the docs/api page its row cites. Control: a value the docs do not carry
 * fails the same check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Product } from '../../../src/codecs/task.js';
import { DEFAULT_VIDEO_MODEL, VIDEO_MODELS, VIDEO_MODEL_SOURCES } from '../../../src/config/models.js';

const API = join(process.cwd(), 'docs', 'api');
const page = (name: string) => readFileSync(join(API, name), 'utf8');

/** The `duration` enum row of a vendor table, e.g. "| `settings.duration` | int | No | `5` | `3`, `4`, … |". */
function durationEnum(doc: string): number[] {
  const row = doc.split('\n').find((l) => /^\|\s*`(settings\.)?duration`/.test(l));
  if (!row) return [];
  return [...row.matchAll(/`(\d+)`/g)].map((m) => Number(m[1])).slice(1); // slice off the default column's value
}

describe('VIDEO_MODELS grounding (V3)', () => {
  const rows = Object.values(VIDEO_MODELS);

  it('has the six ids of spec §2.2 and the default is one of them', () => {
    expect(Object.keys(VIDEO_MODELS).sort()).toEqual(['kling-2.5-turbo', 'kling-2.6', 'kling-3.0', 'kling-3.0-omni', 'kling-3.0-turbo', 'kling-o1']);
    expect(VIDEO_MODELS[DEFAULT_VIDEO_MODEL].id).toBe('kling-3.0-turbo');
  });

  it.each(rows.map((r) => [r.id] as const))('%s: every product cites an existing page that names the model id', (id) => {
    const caps = VIDEO_MODELS[id];
    for (const product of caps.products) {
      const src = VIDEO_MODEL_SOURCES[id][product];
      expect(src, `${id}/${product} has no source page`).toBeDefined();
      expect(existsSync(join(API, src!)), src).toBe(true);
      expect(page(src!)).toContain(`/${id}`);
    }
  });

  it.each(rows.map((r) => [r.id] as const))('%s: resolutions, audio modes and durations appear in the cited page', (id) => {
    const caps = VIDEO_MODELS[id];
    for (const product of caps.products) {
      const doc = page(VIDEO_MODEL_SOURCES[id][product]!);
      for (const r of caps.resolutions[product] ?? []) expect(doc, `${id}/${product} resolution ${r}`).toContain(`\`${r}\``);
      for (const a of caps.audio[product] ?? []) expect(doc, `${id}/${product} audio ${a}`).toContain(`\`${a}\``);
      const durations = caps.durations[product];
      if (durations) {
        const documented = durationEnum(doc);
        expect(documented.length, `${id}/${product} has no duration enum row`).toBeGreaterThan(0);
        expect(durations).toEqual(documented);
      }
      if (caps.multiShotSetting && product !== 'motion-control') expect(doc).toContain('`settings.multi_shot`');
      if (!caps.audio[product] && product !== 'motion-control') expect(doc).not.toContain('`settings.audio`');
    }
  });

  it('control: a value the docs do not carry is caught by the same grep', () => {
    const doc = page(VIDEO_MODEL_SOURCES['kling-2.6']['text-to-video']!);
    expect(doc).not.toContain('`4k`');
    expect(durationEnum(doc)).not.toContain(3);
  });

  it('per-product shape: durations/audio/resolutions keys are subsets of products', () => {
    for (const caps of rows) {
      const products = new Set<Product>(caps.products);
      for (const key of [...Object.keys(caps.resolutions), ...Object.keys(caps.durations), ...Object.keys(caps.audio), ...Object.keys(caps.contentTypes)]) {
        expect(products.has(key as Product), `${caps.id}: ${key} is not one of its products`).toBe(true);
      }
    }
  });
});

// ── image registry (3a) ───────────────────────────────────────────────────────────────

import { DEFAULT_IMAGE_MODEL, DEFAULT_OMNI_IMAGE_MODEL, IMAGE_MODELS, IMAGE_MODEL_SOURCES, MULTI_IMAGE_MODEL } from '../../../src/config/models.js';

describe('IMAGE_MODELS grounding (V3)', () => {
  it('has the four ids of spec §6.2; defaults are rows', () => {
    expect(Object.keys(IMAGE_MODELS).sort()).toEqual(['kling-image-o1', 'kling-v2-1', 'kling-v3', 'kling-v3-omni']);
    expect(IMAGE_MODELS[DEFAULT_IMAGE_MODEL].id).toBe('kling-v3');
    expect(IMAGE_MODELS[DEFAULT_OMNI_IMAGE_MODEL].id).toBe('kling-v3-omni');
    expect(IMAGE_MODELS[MULTI_IMAGE_MODEL].products).toContain('multi-image-to-image');
  });

  it.each(Object.values(IMAGE_MODELS).map((r) => [r.id] as const))('%s: the cited page names the id in its model_name enum and carries every resolution / ratio value', (id) => {
    const caps = IMAGE_MODELS[id];
    const doc = page(IMAGE_MODEL_SOURCES[id]);
    expect(doc).toContain(`\`${id}\``);
    for (const product of caps.products) for (const r of caps.resolutions[product] ?? []) expect(doc, `${id} resolution ${r}`).toContain(`\`${r}\``);
    for (const a of caps.aspectRatios) expect(doc, `${id} ratio ${a}`).toContain(`\`${a}\``);
  });

  it('control: kling-v3 does not carry auto or 4k (its page has neither)', () => {
    const doc = page(IMAGE_MODEL_SOURCES['kling-v3']);
    expect(doc).not.toContain('`auto`');
    expect(doc).not.toContain('`4k`');
    expect(IMAGE_MODELS['kling-v3'].aspectRatios).not.toContain('auto');
  });
});
