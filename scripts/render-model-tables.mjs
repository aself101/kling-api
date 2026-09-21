#!/usr/bin/env node
/**
 * Renders the README's model tables from the capability registry so the two cannot drift
 * (checklist 6c: "model tables generated from VIDEO_MODELS / IMAGE_MODELS").
 *
 *   npm run build && node scripts/render-model-tables.mjs            # print
 *   npm run build && node scripts/render-model-tables.mjs --write    # splice into README.md
 *
 * README.md carries `<!-- model-tables:start -->` / `<!-- model-tables:end -->`; a test
 * regenerates the block and fails when the README's copy differs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { IMAGE_MODELS, VIDEO_MODELS, DEFAULT_VIDEO_MODEL, DEFAULT_OMNI_VIDEO_MODEL, DEFAULT_MOTION_CONTROL_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_OMNI_IMAGE_MODEL, MULTI_IMAGE_MODEL } from '../dist/index.js';

const set = (xs) => (xs && xs.length ? xs.join(' \\| ') : '—');
const range = (xs) => {
  if (!xs || xs.length === 0) return '—';
  const s = [...xs].sort((a, b) => a - b);
  return s.every((v, i) => i === 0 || v === s[i - 1] + 1) && s.length > 2 ? `${s[0]}–${s[s.length - 1]} s` : `${s.join(', ')} s`;
};
const defaults = { 'kling-3.0-turbo': 't2v, i2v', 'kling-3.0-omni': 'omni', 'kling-3.0': 'motion-control', 'kling-v3': 'generate', 'kling-v3-omni': 'omni', 'kling-v2-1': 'multi (only model)' };
void [DEFAULT_VIDEO_MODEL, DEFAULT_OMNI_VIDEO_MODEL, DEFAULT_MOTION_CONTROL_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_OMNI_IMAGE_MODEL, MULTI_IMAGE_MODEL];

const lines = [];
lines.push('### Video models (new API standard, path-per-model)', '');
lines.push('| Model | Products | Resolution | Duration | Audio | `multi_shot` field | Prompt cap | Default for |', '|---|---|---|---|---|---|---|---|');
for (const m of Object.values(VIDEO_MODELS)) {
  const per = (table) => m.products.map((p) => `${p}: ${table(p)}`).join('<br>');
  lines.push(`| \`${m.id}\` | ${m.products.join(', ')} | ${per((p) => set(m.resolutions[p]))} | ${per((p) => range(m.durations[p]))} | ${per((p) => set(m.audio[p]))} | ${m.multiShotSetting ? 'yes' : 'no'} | ${m.maxPromptLength} | ${defaults[m.id] ?? '—'} |`);
}
lines.push('', '### Image models (legacy `/v1/` standard, `model_name`)', '');
lines.push('| Model | Products | Resolution | Aspect ratios | Feature reference (`imageReference` / `humanFidelity`) | Series | Default for |', '|---|---|---|---|---|---|---|');
for (const m of Object.values(IMAGE_MODELS)) {
  const res = m.products.map((p) => `${p}: ${set(m.resolutions[p])}`).filter((s) => !s.endsWith('—')).join('<br>') || '—';
  lines.push(`| \`${m.id}\` | ${m.products.join(', ')} | ${res} | ${set(m.aspectRatios)} | ${m.featureReference ? 'yes' : 'no'} | ${m.series ? 'yes' : 'no'} | ${defaults[m.id] ?? '—'} |`);
}
const block = lines.join('\n');

if (process.argv.includes('--write')) {
  const readme = readFileSync('README.md', 'utf8');
  const start = '<!-- model-tables:start -->';
  const end = '<!-- model-tables:end -->';
  const a = readme.indexOf(start);
  const b = readme.indexOf(end);
  if (a < 0 || b < 0) throw new Error('README.md lacks the model-tables markers');
  writeFileSync('README.md', `${readme.slice(0, a + start.length)}\n${block}\n${readme.slice(b)}`);
  console.log('README.md model tables updated');
} else {
  console.log(block);
}
