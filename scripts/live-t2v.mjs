#!/usr/bin/env node
/**
 * V6 live acceptance (spec §8 V6, release-blocking; checklist 2a₂). SPENDS UNITS.
 *
 *   KLING_API_KEY=… node scripts/live-t2v.mjs [--dup]
 *
 * Creates the cheapest t2v on the default model (kling-3.0-turbo, 3 s, 720p ≈ 2.4 units),
 * waits, downloads the mp4 to the scratch dir, checks for an audio track (`ffprobe`, or the
 * MP4 `hdlr` boxes when ffprobe is absent — closes §11 Q3's inference), and prints task id + billing for the checklist blanks.
 * `--dup` re-submits with the SAME external_task_id afterwards and prints the vendor's
 * answer (§11 Q11 — costs another ≈2.4 units if the vendor accepts it).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KlingClient } from '../dist/index.js';

const client = new KlingClient();
const externalTaskId = `v6-${Date.now()}`;
const params = { prompt: 'A lighthouse at dusk, waves breaking gently, a gull calling.', duration: 3, resolution: '720p', externalTaskId };

console.log('create →', JSON.stringify({ model: 'kling-3.0-turbo', ...params }));
const handle = await client.video.textToVideo(params);
console.log('handle  ', JSON.stringify({ id: handle.id, externalId: handle.externalId, product: handle.product }));
const t0 = Date.now();
const task = await handle.wait({ intervalMs: 5000, deadlineMs: 10 * 60_000 });
console.log(`done in ${Math.round((Date.now() - t0) / 1000)} s — status ${task.status}, outputs ${task.outputs.map((o) => o.type).join(',')}, billing ${JSON.stringify(task.billing)}`);
const video = task.outputs.find((o) => o.type === 'video');
console.log('video   ', JSON.stringify({ id: video?.id, durationSeconds: video?.durationSeconds, url: video?.url?.slice(0, 80) + '…' }));

if (video?.url) {
  const dir = mkdtempSync(join(process.env.SCRATCH ?? tmpdir(), 'kling-v6-'));
  const file = join(dir, 'v6.mp4');
  const res = await fetch(video.url);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('saved   ', file);
  try {
    const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name', '-of', 'json', file], { encoding: 'utf8' });
    const streams = JSON.parse(probe).streams.map((s) => `${s.codec_type}:${s.codec_name}`);
    console.log('ffprobe ', streams.join(' '), streams.some((s) => s.startsWith('audio:')) ? '→ HAS AUDIO TRACK' : '→ NO AUDIO TRACK');
  } catch {
    // No ffprobe: read the MP4 track handlers directly. Each `hdlr` box carries its
    // handler_type 8 bytes in — `vide` for video, `soun` for audio.
    const bytes = readFileSync(file);
    const handlers = [];
    for (let i = bytes.indexOf('hdlr'); i !== -1; i = bytes.indexOf('hdlr', i + 4)) handlers.push(bytes.subarray(i + 12, i + 16).toString('latin1'));
    const codecs = ['mp4a', 'avc1', 'hvc1', 'hev1', 'av01'].filter((c) => bytes.includes(c));
    console.log('mp4 boxes', `handlers ${handlers.join(',')} codecs ${codecs.join(',')}`, handlers.includes('soun') ? '→ HAS AUDIO TRACK' : '→ NO AUDIO TRACK');
  }
}

if (process.argv.includes('--dup')) {
  console.log('\nQ11: re-submitting with the same external_task_id', externalTaskId);
  try {
    const dup = await client.video.textToVideo(params);
    console.log('vendor ACCEPTED the duplicate → new task', dup.id, '(same external id; a second charge follows)');
  } catch (e) {
    console.log(`vendor REJECTED the duplicate → ${e.name} code ${e.code} http ${e.httpStatus} taskState ${e.taskState}: ${e.message}`);
  }
}
