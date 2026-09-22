/**
 * Phase 7c — the scope of the vendor's duplicate `external_task_id` rejection
 * (tracker 82d3f0d4 / ee0667d6; README "Errors, retries and recovery").
 *
 * This is the load-bearing claim under the whole double-bill corridor: after a `may-exist`
 * failure the README now tells a caller to re-submit with the SAME external id, because the
 * vendor's duplicate check is what makes that safe. The evidence for that check was ONE
 * observation — a `text-to-video` create re-submitted immediately after a successful one.
 *
 * Unobserved, and probed here:
 *   A. after time has passed  (re-submit an id created minutes ago)
 *   B. on a LEGACY create     (image; the one observation was new-standard)
 *   C. across products        (a video's id re-submitted as an image) — if this is ACCEPTED,
 *      the dedupe is per-product and a cross-product retry would double-bill.
 *
 * Not probed: after a FAILED original. Forcing a failure means either tripping content
 * moderation deliberately or paying for a task designed to break; neither is worth it here, so
 * that scope stays open and is reported as such rather than quietly folded in.
 *
 * Cost: a REFUSED duplicate is free (1201 / not-created — verified this session: 7 refused
 * creates moved the balance by 0.00). Only the fresh originals cost: one image at 8 units.
 * Probe C costs a further 8 image units ONLY if the vendor accepts it, which is the finding.
 *
 * Usage: node scripts/phase7-dedupe.mjs <existing-video-external-id>
 */
import { KlingClient, KlingAPIError } from '../dist/index.js';

const PRIOR_VIDEO_EXTERNAL_ID = process.argv[2];
if (!PRIOR_VIDEO_EXTERNAL_ID) {
  console.error('usage: node scripts/phase7-dedupe.mjs <existing-video-external-id>');
  process.exit(2);
}

const client = new KlingClient({ apiKey: process.env.KLING_API_KEY, retry: { maxAttempts: 1 } });
const packs = () => client.account.usage(Date.now() - 30 * 86_400_000, Date.now());
const unitsOf = (ps, kind) => ps.find((p) => p.name.includes(kind))?.remainingQuantity;

/** Run a create that is EXPECTED to be refused; report what actually happened. */
async function attempt(label, fn) {
  try {
    const handle = await fn();
    console.log(`  ${label}\n     ACCEPTED → id ${handle.id} (a NEW task — this one was paid for)`);
    return { label, accepted: true, id: handle.id };
  } catch (err) {
    const api = err instanceof KlingAPIError;
    console.log(
      `  ${label}\n     REFUSED → ${api ? `code ${err.code} / HTTP ${err.httpStatus}` : err?.name} ` +
        `taskState=${api ? err.taskState : '?'}\n     "${String(err?.message).slice(0, 110)}"`
    );
    return { label, accepted: false, code: api ? err.code : undefined, taskState: api ? err.taskState : undefined };
  }
}

const before = await packs();
console.log(`before: video ${unitsOf(before, 'Video')}, image ${unitsOf(before, 'Image')}\n`);

const results = [];

// ── A. the same new-standard id, minutes later ────────────────────────────────────────────
console.log('A. same external id, same product, AFTER TIME HAS PASSED');
results.push(
  await attempt(`re-submit text-to-video with externalTaskId "${PRIOR_VIDEO_EXTERNAL_ID}"`, () =>
    client.video.textToVideo({
      model: 'kling-2.5-turbo',
      prompt: 'a single grey pebble resting on flat wet sand, static camera',
      duration: 5,
      resolution: '720p',
      externalTaskId: PRIOR_VIDEO_EXTERNAL_ID,
    })
  )
);

// ── B. a LEGACY create, duplicated immediately ────────────────────────────────────────────
console.log('\nB. LEGACY product (image): a fresh id, then the same id again');
const imageExternalId = `p7c-img-${Date.now()}`;
const first = await attempt(`image.generate with a FRESH externalTaskId "${imageExternalId}" (expected: accepted, 8 units)`, () =>
  client.image.generate({
    prompt: 'a single grey pebble on flat wet sand, overhead, natural light',
    externalTaskId: imageExternalId,
  })
);
results.push(first);
results.push(
  await attempt(`image.generate again with the SAME id "${imageExternalId}"`, () =>
    client.image.generate({
      prompt: 'a single grey pebble on flat wet sand, overhead, natural light',
      externalTaskId: imageExternalId,
    })
  )
);

// ── C. across products ────────────────────────────────────────────────────────────────────
console.log("\nC. ACROSS PRODUCTS: the video's external id, re-used on an image create");
console.log('   (if this is ACCEPTED the dedupe is per-product — a cross-product retry can double-bill)');
results.push(
  await attempt(`image.generate with the VIDEO's externalTaskId "${PRIOR_VIDEO_EXTERNAL_ID}"`, () =>
    client.image.generate({
      prompt: 'a single grey pebble on flat wet sand, overhead, natural light',
      externalTaskId: PRIOR_VIDEO_EXTERNAL_ID,
    })
  )
);

await new Promise((r) => setTimeout(r, 2000));
const after = await packs();
console.log(`\nafter: video ${unitsOf(after, 'Video')}, image ${unitsOf(after, 'Image')}`);
console.log(
  `spent: video ${(unitsOf(before, 'Video') - unitsOf(after, 'Video')).toFixed(2)}, ` +
    `image ${(unitsOf(before, 'Image') - unitsOf(after, 'Image')).toFixed(2)} ` +
    `(deduction lands at COMPLETION, so a just-created task may not show yet)`
);

console.log('\n── verdicts ──');
for (const r of results) console.log(`  ${r.accepted ? 'ACCEPTED' : `REFUSED(${r.code ?? '?'})`}  ${r.label.slice(0, 92)}`);
