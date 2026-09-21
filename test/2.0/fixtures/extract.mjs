#!/usr/bin/env node
/**
 * Regenerates the codec fixtures from the vendor docs snapshot (spec V1, D17, D20).
 *
 *   node test/2.0/fixtures/extract.mjs
 *
 * Each fixture is the first ```json block after the `### Response Example` sub-heading of a
 * named section in a `docs/api/*.md` page (the callback page has no such sub-heading; its
 * two fixtures anchor on the `###` section itself), with three mechanical edits and nothing else:
 *
 *   1. `//` comments stripped (string-aware — URLs inside strings survive);
 *   2. the vendor's non-JSON type placeholders repaired: bare `boolean` → `true`,
 *      bare `int` → `0`, a missing comma or a trailing comma (both occur in the
 *      voice-management list example);
 *   3. enum placeholders replaced by ONE legal value each, listed per fixture in
 *      `subs` below — the vendor writes `"status": "string"` where a real response
 *      carries `succeeded`, and a fixture whose status is literally "string" can only
 *      exercise the codec's rejection path.
 *
 * Everything else — field names, nesting, the `1722769557708` timestamps, the
 * `"string"` URLs — is the vendor's. `INDEX.md` records, per fixture, the source page,
 * section, fence line and every substitution, so a reviewer can diff a fixture against
 * the page it came from. `test/2.0/codecs/fixtures.test.ts` asserts every fixture on
 * disk has an INDEX row and re-derives from this script without drift.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const api = join(root, 'docs', 'api');

/**
 * Request-body fixtures (spec V1, build half): the `--data '…'` body of the first ```bash
 * block after the section's "### Request Example". The same comment/placeholder repairs
 * apply. The vendor writes `"external_task_id": ""` in every example; the build tests
 * substitute the id they pass in, so the auto-UUID cannot perturb the comparison.
 *
 * @type {Array<{out: string, doc: string, section: string, request: true, subs?: Record<string, unknown>}>}
 */
const REQUEST_FIXTURES = [
  { out: 'requests/t2v-kling-3.0-turbo.json', doc: 'kling-3.0-turbo-t2v.md', section: '## Create Task', request: true },
  { out: 'requests/t2v-kling-3.0.json', doc: 'kling-omni-3.0-t2v.md', section: '## Create Task', request: true },
  { out: 'requests/t2v-kling-2.6.json', doc: 'kling-2.6-t2v.md', section: '## Create Task', request: true },
  { out: 'requests/t2v-kling-2.5-turbo.json', doc: 'kling-2.5-turbo-t2v.md', section: '## Create Task', request: true },
];

/** @type {Array<{out: string, doc: string, section: string, subs?: Record<string, unknown>}>} */
const FIXTURES = [
  // ── new standard (video; `kling-3.0-turbo-t2v.md` is the page the default model documents) ──
  { out: 'new/t2v-create.json', doc: 'kling-3.0-turbo-t2v.md', section: '## Create Task',
    subs: { 'data.status': 'submitted' } },
  { out: 'new/tasks-get.json', doc: 'kling-3.0-turbo-t2v.md', section: '## Query Task (By task ID)',
    subs: { 'data[0].status': 'succeeded', 'data[0].outputs[0].duration': '5', 'data[0].outputs[2].mp3_duration': '5', 'data[0].outputs[2].wav_duration': '5',
            'data[0].outputs[4].element_type': 'video_character_elements', 'data[0].outputs[4].status': 'succeeded',
            'data[0].billing[0].charge_type': 'unit', 'data[0].billing[0].package_type': 'video' } },
  { out: 'new/tasks-cursor.json', doc: 'kling-3.0-turbo-t2v.md', section: '## Query Task (By Cursor)',
    subs: { 'data.result[0].status': 'succeeded', 'data.result[0].outputs[0].duration': '5', 'data.result[0].outputs[2].mp3_duration': '5', 'data.result[0].outputs[2].wav_duration': '5',
            'data.result[0].outputs[4].element_type': 'multi_image_elements', 'data.result[0].outputs[4].status': 'deleted',
            'data.result[0].billing[0].charge_type': 'cash', 'data.result[0].billing[0].cash_type': 'balance' } },
  { out: 'new/callback.json', doc: 'kling-get-started-callbacks.md', section: '### New Callback Function',
    subs: { status: 'succeeded', 'outputs[0].duration': '5', 'outputs[2].mp3_duration': '5', 'outputs[2].wav_duration': '5',
            'outputs[4].element_type': 'video_character_elements', 'outputs[4].status': 'succeeded', 'billing[0].charge_type': 'unit', 'billing[0].package_type': 'video' } },

  // ── legacy standard (image, resources, audio) ──
  { out: 'legacy/image-generation-create.json', doc: 'kling-image-2.1-generation.md', section: '## Create Task',
    subs: { 'data.task_status': 'submitted' } },
  { out: 'legacy/image-generation-query.json', doc: 'kling-image-2.1-generation.md', section: '## Query Task (Single)',
    subs: { 'data.task_status': 'succeed' } },
  { out: 'legacy/image-generation-list.json', doc: 'kling-image-2.1-generation.md', section: '## Query Task (List)',
    subs: { 'data[0].task_status': 'succeed' } },
  { out: 'legacy/omni-image-query.json', doc: 'kling-image-omni-3.0-image-omni.md', section: '## Query Task (Single)',
    subs: { 'data.task_status': 'succeed' } },
  { out: 'legacy/subject-completion-query.json', doc: 'kling-image-common-subject-completion.md', section: '## Query Task (Single)',
    subs: { 'data.task_status': 'succeed' } },
  { out: 'legacy/avatar-query.json', doc: 'kling-avatar.md', section: '## Query Task (Single)',
    subs: { 'data.task_status': 'succeed', 'data.task_result.videos[0].duration': '5' } },
  { out: 'legacy/tts-create.json', doc: 'kling-text-to-speech.md', section: '## Create Task',
    subs: { 'data.task_status': 'succeed', 'data.task_result.audios[0].duration': '5' } },
  { out: 'legacy/text-to-audio-query.json', doc: 'kling-text-to-audio.md', section: '## Query Task (Single)',
    subs: { 'data.task_status': 'succeed', 'data.task_result.audios[0].duration_mp3': '5', 'data.task_result.audios[0].duration_wav': '5' } },
  { out: 'legacy/element-list.json', doc: 'kling-omni-3.0-element-mgt.md', section: '## Query Custom Element (List)',
    subs: { 'data[0].task_status': 'succeed' } },
  { out: 'legacy/voice-list.json', doc: 'kling-omni-3.0-voice-mgt.md', section: '## Query Custom Voice (List)',
    subs: { 'data[0].task_status': 'succeed' } },
  { out: 'legacy/callback.json', doc: 'kling-get-started-callbacks.md', section: '### Legacy Callback Function',
    subs: { task_status: 'succeed', 'task_result.videos[0].duration': '5', 'task_info.parent_video.duration': '5' } },
];

/** The `--data '…'` body of the first ```bash block after the section's "### Request Example". */
function extractRequestBody(doc, section) {
  const lines = readFileSync(join(api, doc), 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trim() === section);
  if (start < 0) throw new Error(`${doc}: section not found: ${section}`);
  const anchor = lines.findIndex((l, i) => i > start && l.trim() === '### Request Example');
  if (anchor < 0) throw new Error(`${doc}: no Request Example after ${section}`);
  const open = lines.findIndex((l, i) => i > anchor && /^```bash$/i.test(l.trim()));
  const close = lines.findIndex((l, i) => i > open && l.trim() === '```');
  const block = lines.slice(open + 1, close).join('\n');
  const m = /--data\s+'([\s\S]*?)'\s*$/.exec(block);
  if (!m) throw new Error(`${doc}: no --data body in the Request Example after ${section}`);
  return { text: m[1], line: open + 1 };
}

/** First fenced ```json / ```JSON block after `section`; returns { text, line } (1-based fence line). */
function extractBlock(doc, section) {
  const lines = readFileSync(join(api, doc), 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trim() === section);
  if (start < 0) throw new Error(`${doc}: section not found: ${section}`);
  // The callback page has no "Response Example" sub-heading — its fences follow the section
  // heading directly. Everywhere else, anchor on the sub-heading so the inline snippets in a
  // section's field notes (e.g. the `watermark_info` example on the t2v page) are skipped.
  const anchor = section.startsWith('### ') ? start : lines.findIndex((l, i) => i > start && l.trim() === '### Response Example');
  if (anchor < 0) throw new Error(`${doc}: no Response Example after ${section}`);
  const open = lines.findIndex((l, i) => i > anchor && /^```json$/i.test(l.trim()));
  if (open < 0) throw new Error(`${doc}: no json fence after ${section}`);
  const close = lines.findIndex((l, i) => i > open && l.trim() === '```');
  return { text: lines.slice(open + 1, close).join('\n'), line: open + 1 };
}

/** Strip `//` comments outside strings. */
function stripComments(src) {
  let out = '';
  let inStr = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === '\\') out += src[++i];
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
    } else out += c;
  }
  return out;
}

/** The vendor's non-JSON placeholders and the two syntax slips in the voice-list example. */
function repair(src) {
  return src
    .replace(/:\s*boolean\b/g, ': true')
    .replace(/:\s*int\b/g, ': 0')
    .replace(/\}\s*\n(\s*)"final_unit_deduction"/g, '},\n$1"final_unit_deduction"') // missing comma
    .replace(/,(\s*[}\]])/g, '$1'); // trailing commas
}

function setPath(obj, path, value) {
  const parts = path.split(/\.|\[|\]\.?/).filter(Boolean);
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    if (cur[key] === undefined) throw new Error(`${path}: missing segment ${parts[i]}`);
    cur = cur[key];
  }
  const last = parts[parts.length - 1];
  const key = /^\d+$/.test(last) ? Number(last) : last;
  if (!(key in cur)) throw new Error(`${path}: field absent in vendor example`);
  const before = cur[key];
  cur[key] = value;
  return before;
}

const index = ['# Codec fixtures — provenance', '',
  'Generated by `node test/2.0/fixtures/extract.mjs` from `docs/api/` (vendor snapshot, spec D17). Do not hand-edit the JSON; edit the `subs` table in the script and regenerate. Columns: fence line is the 1-based line of the ```json (or, for request bodies, ```bash) fence in the source page; each substitution is `path: vendor placeholder → fixture value`.', '',
  '| Fixture | Source page | Section | Fence line | Substitutions |', '|---|---|---|---:|---|'];
const written = new Set();
for (const f of [...FIXTURES, ...REQUEST_FIXTURES]) {
  const { text, line } = f.request ? extractRequestBody(f.doc, f.section) : extractBlock(f.doc, f.section);
  let json;
  try { json = JSON.parse(repair(stripComments(text))); } catch (e) { throw new Error(`${f.out} (${f.doc} @${line}): ${e.message}`); }
  const subs = [];
  for (const [path, value] of Object.entries(f.subs ?? {})) {
    const before = setPath(json, path, value);
    subs.push(`\`${path}\`: \`${JSON.stringify(before)}\` → \`${JSON.stringify(value)}\``);
  }
  writeFileSync(join(here, f.out), JSON.stringify(json, null, 2) + '\n');
  written.add(f.out);
  index.push(`| \`${f.out}\` | \`docs/api/${f.doc}\` | ${f.section.replace(/^#+\s*/, '')}${f.request ? ' (Request Example)' : ''} | ${line} | ${subs.join('<br>') || '—'} |`);
}
writeFileSync(join(here, 'INDEX.md'), index.join('\n') + '\n');

// Report strays: a fixture on disk that this script did not write has no provenance.
for (const dir of ['new', 'legacy', 'requests']) {
  for (const name of readdirSync(join(here, dir))) {
    const rel = `${dir}/${name}`;
    if (!written.has(rel)) console.error(`STRAY fixture without provenance: ${relative(root, join(here, rel))}`);
  }
}
console.log(`${written.size} fixtures written; INDEX.md updated`);
