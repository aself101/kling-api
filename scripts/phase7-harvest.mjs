/**
 * Phase 7b — harvest in-flight tasks, and exercise the ship-run-#6 behaviour changes live.
 *
 * Costs nothing: it reads and downloads tasks that were already paid for. What it proves:
 *
 *  - **coalescing** (tracker de20644f): N concurrent `wait()`s must issue ceil(N/20) requests
 *    per tick, not N. Every outbound request is counted through an instrumented `fetch`.
 *  - **streamed save** (006bb99e): `save()` pulls a real CDN body to disk; peak RSS must not
 *    track the file size.
 *  - **outputsExpireAt** (84375490): the derived expiry is compared against the `Expires=` on
 *    the vendor's own signed URL — on a NEW-STANDARD VIDEO, which has never been compared
 *    (the one prior comparison was a legacy image).
 *  - whatever the codecs warn about, recorded (9a2d0364: does live data carry values the
 *    library refuses or does not model?).
 *
 * Usage: node scripts/phase7-harvest.mjs <id> [<id>...] [--save-dir dir]
 */
import { mkdirSync, statSync } from 'node:fs';
import { KlingClient } from '../dist/index.js';

const args = process.argv.slice(2);
const saveDirFlag = args.indexOf('--save-dir');
const SAVE_DIR = saveDirFlag === -1 ? null : args[saveDirFlag + 1];
const ids = args.filter((a) => /^\d{6,}$/.test(a));
if (ids.length === 0) {
  console.error('usage: node scripts/phase7-harvest.mjs <id> [<id>...] [--save-dir dir]');
  process.exit(2);
}

/** Every request the library makes, so the batching claim is counted rather than asserted. */
const requests = [];
const countingFetch = async (input, init) => {
  const url = new URL(String(input));
  const ids = url.searchParams.get('task_ids');
  requests.push({ at: Date.now(), path: url.pathname, idCount: ids ? ids.split(',').length : 0 });
  return globalThis.fetch(input, init);
};

const warnings = [];
const client = new KlingClient({
  apiKey: process.env.KLING_API_KEY,
  fetch: countingFetch,
  logger: {
    debug: () => {},
    info: () => {},
    warn: (m) => warnings.push(m),
    error: (m) => warnings.push(`ERROR ${m}`),
  },
});

console.log(`waiting on ${ids.length} task(s) concurrently — each is its own handle, as a caller would\n`);
const started = Date.now();
const settled = await Promise.allSettled(
  ids.map((id) => client.tasks.handle('text-to-video', id).wait({ intervalMs: 3000, deadlineMs: 900_000 }))
);
const elapsed = Date.now() - started;

const tasks = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
for (const [i, s] of settled.entries()) {
  console.log(
    s.status === 'fulfilled'
      ? `  ${ids[i]}  ${s.value.status}  outputs:${s.value.outputs.length}`
      : `  ${ids[i]}  REJECTED ${s.reason?.name}: ${String(s.reason?.message).slice(0, 90)}`
  );
}

// ── coalescing, counted ────────────────────────────────────────────────────────────────────
const polls = requests.filter((r) => r.path === '/v1/tasks' || r.path.endsWith('/tasks'));
const ticks = [];
for (const p of polls) {
  const tick = ticks.find((t) => Math.abs(t.at - p.at) < 1500);
  if (tick) {
    tick.requests++;
    tick.ids += p.idCount;
  } else ticks.push({ at: p.at, requests: 1, ids: p.idCount });
}
console.log(`\n── coalescing (de20644f) ──`);
console.log(`handles waited : ${ids.length}`);
console.log(`elapsed        : ${(elapsed / 1000).toFixed(1)} s`);
console.log(`GET /tasks     : ${polls.length} request(s) over ~${ticks.length} tick(s)`);
console.log(`ids per request: ${[...new Set(polls.map((p) => p.idCount))].sort((a, b) => a - b).join(', ')}`);
console.log(
  `unbatched would have been ~${ids.length * ticks.length} requests; actual ${polls.length}` +
    ` (${(((ids.length * ticks.length - polls.length) / Math.max(1, ids.length * ticks.length)) * 100).toFixed(0)}% fewer)`
);

// ── outputsExpireAt vs the vendor's own signed URL (84375490) ──────────────────────────────
console.log(`\n── outputsExpireAt vs the CDN's Expires= (84375490) ──`);
let compared = 0;
for (const t of tasks) {
  for (const o of t.outputs) {
    if (!o.url) continue;
    const u = new URL(o.url);
    // CloudFront/S3-style signed URLs put an absolute epoch-seconds expiry on the query string.
    const expiresParam = u.searchParams.get('Expires') ?? u.searchParams.get('x-oss-expires') ?? u.searchParams.get('X-Amz-Expires');
    if (!expiresParam) {
      console.log(`  ${t.id}: no Expires-style param on ${u.host}${u.pathname.slice(0, 40)} (params: ${[...u.searchParams.keys()].join(',') || 'none'})`);
      continue;
    }
    const vendorMs = Number(expiresParam) * 1000;
    const derived = t.outputsExpireAt;
    compared++;
    console.log(
      `  ${t.id}: vendor Expires=${expiresParam} → ${new Date(vendorMs).toISOString()}\n` +
        `             derived outputsExpireAt → ${derived ? new Date(derived).toISOString() : 'undefined'}\n` +
        `             delta ${derived ? `${((vendorMs - derived) / 3_600_000).toFixed(2)} h` : 'n/a'}`
    );
  }
}
if (compared === 0) console.log('  (no signed-URL expiry parameter found to compare against)');

// ── streamed save against the real CDN (006bb99e) ──────────────────────────────────────────
if (SAVE_DIR && tasks.length > 0) {
  const target = tasks.find((t) => t.outputs.some((o) => o.url));
  if (target) {
    mkdirSync(SAVE_DIR, { recursive: true });
    const rssBefore = process.memoryUsage().rss;
    const files = await client.save(target, SAVE_DIR);
    const rssAfter = process.memoryUsage().rss;
    const bytes = files.filter((f) => !f.endsWith('.json')).reduce((n, f) => n + statSync(f).size, 0);
    console.log(`\n── streamed save (006bb99e) ──`);
    console.log(`  files : ${files.length} (${(bytes / 1048576).toFixed(1)} MB on disk)`);
    console.log(`  rss   : ${(rssBefore / 1048576).toFixed(0)} → ${(rssAfter / 1048576).toFixed(0)} MB (+${((rssAfter - rssBefore) / 1048576).toFixed(0)} MB for a ${(bytes / 1048576).toFixed(1)} MB download)`);
    for (const f of files) console.log(`          ${f}`);
  }
}

console.log(`\n── codec warnings (9a2d0364: does live data carry unmodelled values?) ──`);
console.log(warnings.length === 0 ? '  none — every field the vendor returned is modelled' : warnings.map((w) => `  ${w}`).join('\n'));
