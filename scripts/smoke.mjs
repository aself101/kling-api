#!/usr/bin/env node
// Live smoke (spec §8 V5). Read-only, spends nothing. Requires KLING_API_KEY and a built dist/.
// Exits 1 if any expected-success call fails OR if the garbage-key control succeeds — a check that
// cannot fail proves nothing (CLAUDE.md "verifying absence").
//
// Until 2a₁ the client has no product namespaces, so this reaches the transport as
// client['http'] — a documented escape into an @internal member, used only here.
import { KlingClient, KlingAPIError } from '../dist/index.js';

const key = process.env.KLING_API_KEY;
if (!key) { console.error('KLING_API_KEY not set (try: source ~/.zshrc)'); process.exit(2); }

const client = new KlingClient({ apiKey: key });
const http = client['http'];
const now = Date.now();
let failures = 0;

async function expectOk(label, req) {
  try {
    const res = await http.request(req);
    console.log(`ok   ${label} — HTTP ${res.status} code 0 (attempt ${res.attempt}) req=${res.requestId ?? '-'}`);
  } catch (err) {
    failures++;
    console.log(`FAIL ${label} — ${err.name}: ${err.message}${err.code !== undefined ? ` (code ${err.code}, taskState ${err.taskState})` : ''}`);
  }
}

await expectOk('GET /tasks?task_ids=0 (new standard)', { method: 'GET', path: '/tasks', query: { task_ids: '0' }, kind: 'read' });
await expectOk('POST /tasks {limit:1} (new standard, cursor query — a read)', { method: 'POST', path: '/tasks', body: { limit: 1 }, kind: 'read' });
await expectOk('GET /account/costs (account)', { method: 'GET', path: '/account/costs', query: { start_time: now - 3_600_000, end_time: now }, kind: 'read' });
await expectOk('GET /v1/general/presets-voices (legacy)', { method: 'GET', path: '/v1/general/presets-voices', kind: 'read' });

// Control: a garbage key must be rejected with 401. Records which business code the vendor uses (spec §11 Q9).
try {
  const bad = new KlingClient({ apiKey: 'garbage-not-a-key' });
  await bad['http'].request({ method: 'GET', path: '/tasks', query: { task_ids: '0' }, kind: 'read' });
  failures++;
  console.log('FAIL control — a garbage key was accepted; the smoke cannot be trusted');
} catch (err) {
  if (err instanceof KlingAPIError && err.httpStatus === 401) {
    console.log(`ok   control — garbage key rejected: HTTP 401 code ${err.code} "${err.message}" (Q9: garbage key → ${err.code})`);
  } else {
    failures++;
    console.log(`FAIL control — expected KlingAPIError 401, got ${err.name}: ${err.message}`);
  }
}

console.log(failures ? `\n${failures} failure(s)` : '\nall smoke checks passed');
process.exit(failures ? 1 : 0);
