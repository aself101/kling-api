/**
 * Phase 7a — read-after-write visibility (tracker 5dfca444 / eec95ba9).
 *
 * The claim under test, from the README's own Known limits: "~4 live tasks polled at 3 s showed
 * no lag". Everything in the unattended protocol rests on it — `wait()` treats a `200 data: []`
 * as terminal `KlingTaskNotFoundError`, and the recovery guidance tells a caller to read `null`
 * from `recover()` as inconclusive "in the first seconds" without saying how many.
 *
 * So: create a task, then read it back as fast as possible, on both read paths —
 *   - `GET /tasks?task_ids=`         (what `wait()` polls)
 *   - `GET /tasks?external_task_ids=` (what `recover()` uses after a lost create)
 * at t ≈ 0, 100 ms, 500 ms, 2 s, and record whether the vendor had it yet.
 *
 * Paced deliberately: the video pack is `Trial-Video-100Units-5Con-1Months` — the `5Con` is the
 * vendor's concurrency ceiling and what `1303 "parallel task over resource pack limit"` fires
 * on. This runs 3 at a time, well under it.
 *
 * Cost: kling-2.5-turbo, 5 s, 720p, silent = 0.3 units/s = 1.5 units per task.
 *
 * Usage: node scripts/phase7-read-after-write.mjs [count] [--out file.jsonl]
 */
import { appendFileSync } from 'node:fs';
import { KlingClient, KlingTaskNotFoundError, KlingAPIError } from '../dist/index.js';

const COUNT = Number(process.argv[2] ?? 2);
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const CONCURRENCY = 3;
const UNITS_PER_TASK = 1.5;
const LADDER_MS = [0, 100, 500, 2000];

if (!Number.isInteger(COUNT) || COUNT < 1 || COUNT > 40) {
  console.error('count must be an integer 1..40');
  process.exit(2);
}

const client = new KlingClient({
  apiKey: process.env.KLING_API_KEY,
  // One attempt: a retry would hide the very latency this measures.
  retry: { maxAttempts: 1 },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const rows = [];
const record = (row) => {
  rows.push(row);
  if (OUT) appendFileSync(OUT, `${JSON.stringify(row)}\n`);
};

/** Read one id back on a named path; returns visibility plus the round trip. */
async function probe(kind, fn, meta) {
  const started = Date.now();
  try {
    const task = await fn();
    const row = { ...meta, kind, visible: task !== null && task !== undefined, ms: Date.now() - started };
    record(row);
    return row;
  } catch (err) {
    const notFound = err instanceof KlingTaskNotFoundError;
    const row = {
      ...meta,
      kind,
      visible: false,
      notFound,
      ms: Date.now() - started,
      error: notFound ? 'KlingTaskNotFoundError' : `${err?.name}: ${String(err?.message).slice(0, 120)}`,
      ...(err instanceof KlingAPIError ? { code: err.code, httpStatus: err.httpStatus } : {}),
    };
    record(row);
    return row;
  }
}

async function one(n) {
  const externalTaskId = `p7a-${Date.now()}-${n}`;
  const createdAt = Date.now();
  const handle = await client.video.textToVideo({
    model: 'kling-2.5-turbo',
    prompt: 'a single grey pebble resting on flat wet sand, static camera',
    duration: 5,
    resolution: '720p',
    externalTaskId,
  });
  const createMs = Date.now() - createdAt;
  const meta = { task: n, id: handle.id, externalTaskId, createMs };
  console.log(`  #${n} created id=${handle.id} in ${createMs} ms`);

  const t0 = Date.now();
  for (const at of LADDER_MS) {
    await sleep(at - (Date.now() - t0));
    const since = Date.now() - t0;
    const byId = await probe('task_ids', () => client.tasks.getByProduct('text-to-video', handle.id), { ...meta, at, since });
    const byExt = await probe('external_task_ids', () => client.tasks.recover('text-to-video', externalTaskId), { ...meta, at, since });
    console.log(
      `     t+${String(at).padStart(4)}ms  task_ids:${byId.visible ? 'VISIBLE' : `MISSING(${byId.error ?? '[]'})`}` +
        `  external_task_ids:${byExt.visible ? 'VISIBLE' : 'MISSING(null)'}`
    );
  }
  return handle;
}

/**
 * Run with a hard concurrency ceiling — the pack allows 5 (`5Con` in its name), we use 3.
 *
 * The slot is held until the task reaches TERMINAL, not until the create returns. The vendor
 * counts tasks in flight, and a 5 s video renders for ~30-60 s after its create responds; a
 * limiter that frees the slot on the create had 5 tasks rendering within ten seconds and took
 * `1303 "parallel task over resource pack limit"` on 7 of 10 creates (measured, this session —
 * the refused creates cost nothing, but they are not data either).
 */
async function paced(count, limit, fn) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, count) }, async () => {
    for (;;) {
      const n = next++;
      if (n >= count) return;
      try {
        const handle = await fn(n);
        results.push(handle);
        // Hold the slot until the vendor stops counting this task as in-flight.
        await handle.wait({ intervalMs: 3000, deadlineMs: 600_000 }).catch((err) => {
          console.error(`  #${n} did not reach succeeded: ${err?.name}`);
        });
      } catch (err) {
        console.error(`  #${n} FAILED: ${err?.name}: ${err?.message}`);
        record({ task: n, kind: 'create', error: `${err?.name}: ${String(err?.message).slice(0, 160)}`, code: err?.code });
        if (err?.code === 1303) await sleep(15_000); // ceiling reached: let the queue drain
      }
      await sleep(400);
    }
  });
  await Promise.all(workers);
  return results;
}

/** `usage(startTime, endTime)` — a window is required; 30 days back covers the trial packs. */
const packs = () => client.account.usage(Date.now() - 30 * 86_400_000, Date.now());
const before = await packs();
const videoPack = before.find((p) => p.name.includes('Video'));
console.log(`video pack: ${videoPack.remainingQuantity} / ${videoPack.totalQuantity} units, concurrency ceiling ${/(\d+)Con/.exec(videoPack.name)?.[1] ?? '?'}`);
console.log(`creating ${COUNT} task(s) at ${UNITS_PER_TASK} units each ≈ ${(COUNT * UNITS_PER_TASK).toFixed(1)} units, ${CONCURRENCY} at a time\n`);

const handles = await paced(COUNT, CONCURRENCY, one);

const after = await packs();
const videoAfter = after.find((p) => p.name.includes('Video'));
const spent = videoPack.remainingQuantity - videoAfter.remainingQuantity;

const reads = rows.filter((r) => r.kind === 'task_ids' || r.kind === 'external_task_ids');
const misses = reads.filter((r) => !r.visible);
console.log(`\n── read-after-write summary ──`);
console.log(`tasks created : ${handles.length}`);
console.log(`reads issued  : ${reads.length} (${LADDER_MS.length} ladder steps × 2 paths × ${handles.length} tasks)`);
console.log(`misses        : ${misses.length}`);
for (const at of LADDER_MS) {
  for (const kind of ['task_ids', 'external_task_ids']) {
    const slice = reads.filter((r) => r.at === at && r.kind === kind);
    const miss = slice.filter((r) => !r.visible).length;
    const ms = slice.map((r) => r.ms).sort((a, b) => a - b);
    console.log(
      `  t+${String(at).padStart(4)}ms ${kind.padEnd(18)} visible ${slice.length - miss}/${slice.length}` +
        (ms.length ? `  rtt med ${ms[Math.floor(ms.length / 2)]} ms` : '')
    );
  }
}
console.log(`\nspent ${spent.toFixed(2)} video units (${videoAfter.remainingQuantity} remaining)`);
console.log(`ids: ${handles.map((h) => h.id).join(' ')}`);
console.log(`externalIds: ${handles.map((h) => h.externalId).join(' ')}`);
if (OUT) console.log(`rows → ${OUT}`);
