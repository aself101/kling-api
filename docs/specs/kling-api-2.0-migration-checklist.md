# kling-api 2.0 — Implementation Checklist

Companion to [`kling-api-2.0-migration-spec-v0_4_3.md`](kling-api-2.0-migration-spec-v0_4_3.md). The spec holds the *why*; this file holds the *what*, in commit order, with the check that closes each item. Decision references (`D3`, `§8.4`) point into the spec; `V<n>` are the spec's §8 verification items. Tick a box only when its check has been run and observed to pass — and, where a control is listed, observed to fail on the control.

Conventions: `[ ]` open · `[x]` done · `[-]` deliberately skipped (write why inline). Each sub-phase is one commit with a ≤ 500 LOC budget (source + tests, fixture JSON excluded but listed); **an overrun of more than 20 % splits the sub-phase before it merges into `release/2.0`** (D20). Commit messages are suggested, not mandated. **Branch:** Phase 0 and 6c on `main`; 1a–6b on `release/2.0` (D19); sub-phase work happens on `feat/<id>` branches PR'd into `release/2.0` so CI runs before merge. **Nothing 1.x is deleted before 2a₀** (spec §3.1).

---

## Phase 0 — Gate (`main`) — budget ~60 LOC

`docs(kling-api): pricing snapshot, release automation removal, 2.0 gate probes`

### Snapshot and docs
- [x] `docs/api/` contains 50 vendor pages + `README.md` (`ls docs/api | wc -l` → 51); the six body-identical multi-mount pairs are kept (D17); no ` copy` suffix; the four hand-copied `kling-auth.md` / `kling-callback-protocol.md` / `kling-concurrency.md` / `kling-error-codes.md` are gone
- [x] `docs/KLING_API_REFERENCE.md` deleted
- [x] Fetch `pricing/base/video.md` and `pricing/base/image.md` into `docs/api/kling-pricing-{video,image}.md`; update `docs/api/README.md` coverage table (Docs row = 8; Pricing row = 2; total 50)
- [x] `docs/api/README.md` Docs row corrected `11 → 8`
- [x] Appendix C line 9: add "*(these four files were removed before commit — see checklist Phase 0)*"
- [x] README: move the "1.x is broken" notice to directly under the H1 (above badges and Quick Start); fix `[LICENSE](../LICENSE)` → `[LICENSE](LICENSE)`
- [x] `CHANGELOG.md`: add `## [Unreleased]` at the top with the 2.0 breaking-change skeleton (Added / Changed / Removed)
- [x] `CHANGELOG.md`: collapse to a single `# Changelog` H1; fold the semantic-release `# 1.0.0` block under `## [1.0.0] - 2025-12-27` (run #3 docs-validator)

### Release automation removal (D19)
- [x] Delete `.github/workflows/release.yml` and `.releaserc.json`
- [x] Remove `semantic-release`, `@semantic-release/{changelog,commit-analyzer,git,github,npm,release-notes-generator}` from `devDependencies`; remove the `semantic-release` script; `npm install` regenerated the lockfile (jq scan: 0 `localhost:4873`; 0 `semantic-release`)
- [x] `ci.yml`: `on.push.branches: [main, 'release/**']` **and** `on.pull_request.branches: [main, 'release/**']` (run #2 A31); Node 20 + 22 matrix (V14 needs it later); steps lint → build → test → `tsc --noEmit`; **no** `dist/api.js` assertion; the `dist/index.js` + `dist/cli/index.js` assertions are added in 2a₀ when the layout switches
- [x] `npm run lint && npm run build && npm test && npx tsc --noEmit` green on `main` after removal — 534/534 tests; lint needed two unused imports removed from `test/integration/polling.test.ts` (pre-existing, would have failed the new push trigger)

### Live gate probes (`KLING_API_KEY` in env) — one per legacy write family 2.0 ships, because code `1103` is per-resource (run #2 A18, run #3 A40/F10). On `1103`, check `account.usage()` packages first: it is also the entitlement code.
- [ ] **A5 write probe, image:** `POST /v1/images/generations` with the API Key (`kling-v3`, `n=1`, 1k, portrait prompt — the output is reused by the element and avatar probes) → `code: 0`, `data.task_id`; poll to `succeed`. **2026-09-20 result: HTTP 429 `code 1102 Account balance not enough`** (`req b63503f4`) — the account holds only a *Video* trial pack (`Trial-Video-100Units-5Con-1Months`) and packages are per product type (App. C §3). **Not an auth failure**: needs an image pack or cash balance. **After Alex bought `Trial-Image-1000Units-9Con-1Months` (expires 2026-10-21): `code: 0`, task `930810057590833241` → `succeed` in 24 s, `final_unit_deduction` = 8 image-units** (`req 29690122`, 2026-09-20). Portrait reused below.
- [x] **A5 write probe, audio (TTS):** `POST /v1/audio/tts` with the API Key → `code: 0`, `audio_id 930801290416885794`, 11.3 s, **0.05 units** (`req b71fa328`, 2026-09-20). **Finding:** TTS `voice_id` is its own catalogue (`oversea_male1`, from the external Voice Guide the docs link) — a `/v1/general/presets-voices` id returns `1201 Voice id not found`. Spec D8/§6.3 must say so.
- [x] **A5 write probe, voice:** `POST /v1/general/custom-voices` with the TTS clip as `voice_url` → `code: 0`, task `930801301486305328` → `succeed` in 9 s, `voice_id 930801338081615883`, **0.05 units**; `POST /v1/general/delete-voices` → `code: 0` (2026-09-20)
- [x] **A5 write probe, element:** `POST /v1/general/advanced-custom-elements` (`image_refer`, frontal + refer = the generated portrait) → `code: 0`, task `930810160078651476` → `succeed` in 5 s, `element_id 321922438904313`, **0 units**; `POST /v1/general/delete-advanced-elements` → `code: 0` (`req 90f732c5`, 2026-09-20). Q7 (is the library shared with the image delete path?) still open — this probe used the video path only.
- [x] **A5 write probe, avatar:** `POST /v1/videos/avatar/image2video` (generated portrait + TTS `audio_id 930801290416885794`, `std`) → `code: 0`, task `930810294971662349` → `succeed`, 12.27 s video, **4.4 video-units** (≈ 0.36/s at std; 2026-09-21T00:36Z)
- [x] Total Phase 0 spend: video pack **4.5** units (TTS 0.05 + voice 0.05 + avatar 4.4); image pack **8** units (image generate; element was free). Billing is per pack: TTS/voices/avatar draw on the *video* pack (budget §10.17: 4.5 of ~20 video units used)
- [x] No probe returned `1002` or `1103`. **The API Key authenticates every legacy write family 2.0 ships (image, TTS, voice, element, avatar) — A5 closed; `auth.ts` may be deleted at 2a₀.** The one refusal seen was `1102` on image before the image pack existed — a balance code, per product type.
- [x] Spec + checklist at v0.4.0 committed; pre-implementation pipeline run #3 → **PROCEED** (architect 86, docs 93, anxiety 86, synthesis 84, excavator 79); findings folded into v0.4.1 (spec §13.3); §10 decisions closed in v0.4.2; Phase 0 live findings in v0.4.3
- [x] **Phase 0 complete 2026-09-21.** `release/2.0` branched from `main` at the commit recording this.
- [x] Before 1a₁: `npx madge --circular --extensions ts src` on the **1.x** tree: **1 cycle — `config/constants.ts > types.ts`** (constants imports types; types re-exports `ERROR_CODES`). It is the exact import 1a₁'s `constants.ts` rewrite removes; `check:cycles` is scoped to the 2.0 directories until then

---

## Phase 1a₁ — Errors, constants, credentials (additive) — budget ~250 src + ~120 test — **actual 786 src + 309 test, landed as two commits (`a14f839` config, `841f69e` types + errors)**

> **Budget note (2026-09-21).** The estimate was low by ~3× on src. Two causes, both deliberate: (1) `codecs/task.ts` (234 lines) moved here from 1b because the error family references `Task`; (2) the error family and task types carry the decision record in JSDoc — roughly 40 % of their lines are comments explaining *why* (`taskState` semantics, the double-bill case, dual-stack unwrapping). Per D20 the sub-phase was split rather than the comments trimmed. Re-estimate for the rest of §9: multiply the src numbers by ~1.5 where a module carries decision-heavy documentation.

`feat(http): error family, vendor error table, API-key loader (beside the 1.x core)`

**Nothing is deleted in 1a₁/1a₂/1c.** 1.x keeps building and its tests keep running; new tests live under `test/2.0/`. Deletion is the single 2a₀ commit (spec §3.1).

### `config/constants.ts` rewrite (~60 net)
- [x] Replace the six `import type … from '../types.js'` (lines 7-14) with local type aliases so the file survives `types.ts`'s deletion in 2a₀ (run #3 architect F-1) — `madge --circular` on the full 1.x+2.0 tree: **none** (the Phase 0 cycle is gone)
- [x] Add the **22-row** vendor error table as `ERROR_CODES_V2` (renamed to `ERROR_CODES` in 2a₀); names from the *Explanation* column; `1003`/`1004` present and commented "unreachable without AK/SK"; no `1104` — plus `VENDOR_HTTP_STATUS`, `TRANSIENT_ERROR_CODES`, `PERMANENT_429_CODES`, `WRITE_NOT_CREATED_CODES`; test checks every row against the snapshot with a control
- [-] Remove the `VALID_*` arrays 2.0 does not use — **deferred to 2a₀**: 1.x validators import them and 1a is additive (1.x must keep building). Spec §3.1 row for `constants.ts` amended accordingly.

### Credentials (D2) (~20)
- [ ] `KlingConfig` per spec §6.4: `apiKey?, baseUrl?, timeout?, retry?, fetch?, unknownModels?, capabilityValidation?, logger?` — **moved to 1a₂** (it belongs with `HttpCore`/`KlingClient`, which do not exist yet)
- [x] `loadApiKey(explicit?)` in `config/loaders.ts` reads `explicit ?? process.env.KLING_API_KEY` **only** (beside the 1.x `loadCredentials`, removed in 2a₀); the `./.env` / `~/.kling/.env` chain is implemented in `src/cli/index.ts` in 6a₁; returns `{ apiKey, source }`
- [x] Missing-key error names the constructor option, `KLING_API_KEY`, and `https://kling.ai/dev/api-key` (`MISSING_API_KEY_MESSAGE`)
- [x] `.env.example` → `KLING_API_KEY=` (1.x AK/SK lines kept, marked legacy, until 2a₀)

### `http/errors.ts` (D10) (~170)
- [x] `codecs/task.ts` types (moved forward from 1b — the error family references `Task`): `TaskStatus`, `Standard`, `Product`, `NewStandardProduct`, `LegacyProduct`, `Task`, `TaskOutput` union, `BillingEntry`, `RequestOptions`, `WaitOptions`, `PageOptions`, `SaveOptions`, `TaskHandle`, `TaskState`; imports nothing from `src/`
- [x] Error family exactly as D10: `KlingError`, `KlingAPIError{code,httpStatus,request{kind,method,path,externalId?},taskState,isTransient(),isRetryable()}`, `KlingNetworkError{cause,externalId?,taskState}`, `KlingTimeoutError{deadlineMs,attempt,attempts,externalId?,taskState}`, `KlingResponseError{httpStatus,bodySnippet,location?}`, `KlingCodecError{standard,path}`, `KlingValidationError{field}`, `KlingTaskFailedError{task,code}`, `KlingPollTimeoutError{task,elapsedMs}`, `KlingNoOutputsError{task}`, `KlingOutputsExpiredError{task}`, `KlingBatchError{tasks,missing,unattempted,cause}`, `KlingDownloadError{url,reason,httpStatus?}`, `KlingWebhookError{reason}`
- [x] `taskState` derivation for writes: `'not-created'` for business codes `1000`–`1304` (incl. `1303`) and HTTP 4xx; `'may-exist'` for `5000`/`5002`, HTTP 502/503/504, unparseable responses, post-request network errors, timeouts; `'n/a'` for reads. Tests: `1303` write → `'not-created'`; `5002` write → `'may-exist'`; `1303` read → `'n/a'`; `ECONNREFUSED` → `'not-created'`, `ECONNRESET` → `'may-exist'`, dual-stack `AggregateError` of refusals → `'not-created'`, code-less cause → `'may-exist'` (run #3 A35/F11)
- [x] `isTransient()`: `1302`, `1303`, `5000`, `5001`, `5002` or `httpStatus ∈ {429,502,503,504}` → true. `isRetryable()`: `isTransient() && request.kind === 'read'` **and the business code is not a permanent 429** (`1102`, `1304` → false — run #3 anxiety F7). Tests: `1303` read → both true; `1303` write → transient true, retryable false; `1002` → both false; `1102`/`1304` read → false
- [x] Constructing `KlingAPIError` from `{"code":1303,"message":"…","request_id":"…"}` (no `data`) does not throw

---

## Phase 1a₂ — Transport core + client skeleton (additive) — budget ~265 src + ~260 test — **actual 447 src + 357 test, two commits (`845f38c` core, `114a2bb` client + barrel)**

`feat(http): fetch transport with deadline, retry policy, redirect handling; KlingClient skeleton`

### `http/core.ts` (D10, D11) (~220)
- [x] `HttpCore.request({ method, path, query?, body?, signal?, kind: 'read' | 'write', externalId?, timeoutMs? })`
- [x] `fetch` = `config.fetch ?? globalThis.fetch`; `Authorization: Bearer <apiKey>` and `Content-Type: application/json` on every request; base URL must start with `https://` (else `KlingValidationError`)
- [x] `redirect: 'manual'`; a 3xx → `KlingResponseError { location }`, never retried (test with a fake 302)
- [x] Deadline: one `AbortController` per attempt covering body write, headers and body read; default `timeout` 30 000 ms; **`timeoutMs` override per request** so products can scale it with body size (D11; the scaling itself is in 2a₃) — tested with a fake fetch whose body stream stalls → `KlingTimeoutError { attempt, attempts, taskState: 'may-exist' }`
- [x] Caller `signal` is chained; caller abort surfaces as the caller's `AbortError`, not wrapped
- [x] Non-JSON body → `KlingResponseError` with first 200 bytes; JSON with `code !== 0` → `KlingAPIError`; fetch `TypeError` → `KlingNetworkError` with `taskState` from `cause.code`
- [x] **Retry (V11):** `kind: 'read'` retries on `KlingNetworkError`, `KlingTimeoutError`, HTTP 429/502/503/504 (except permanent `1102`/`1304`), transient business codes; backoff `baseDelayMs * 2^attempt` with `attempt` starting at 1 (default 1 000 ms → 2 s, 4 s; cap `maxDelayMs` 30 000; `maxAttempts` 3; worst case 96 s). `kind: 'write'` retries **only** on `KlingNetworkError` whose `cause.code ∈ {ENOTFOUND, ECONNREFUSED, EAI_AGAIN}`; never after any response; never on `ECONNRESET`/timeout — and the thrown error carries `externalId` and `taskState: 'may-exist'`
- [x] Tests: read `1303`→`200` = 2 calls, sleep 2 000 ms (injected sleep records the schedule); three transient → 2 000, 4 000; cap honoured; write `1303` = 1 call, `taskState 'not-created'`, `isRetryable() === false`; write `5002` = 1 call, `'may-exist'`; write `ECONNRESET` mid-body = 1 call, `KlingNetworkError` with `externalId`, `'may-exist'`; write `ECONNREFUSED` = retried; write timeout never retried; read `1102` under HTTP 429 = 1 call; non-JSON 502 retried, non-JSON 200 not; read timeout on attempt 3 → `KlingTimeoutError { attempt: 3, attempts: 3, taskState: 'n/a' }`
- [x] **Key never serialisable:** `#apiKey`/`#fetchImpl`/`#sleep` are ECMAScript private fields; test asserts `JSON.stringify(core)` does not contain the key (it did, with TS `private` — caught by the test)

### `client.ts` + `index.ts` (skeleton) (~45)
- [x] `KlingConfig` per spec §6.4 (`apiKey?, baseUrl?, timeout?, retry?, fetch?, unknownModels?, capabilityValidation?, logger?`) + `RetryOptions`, `Logger` — defined in `http/core.ts`, re-exported from `index.ts`
- [x] `KlingClient` with config resolution and a `/** @internal */ http: HttpCore` member; no product namespaces yet
- [x] `src/index.ts` exports `KlingClient` and the error family; **not yet wired to `package.json#main`** (2a₀ does that)

---

## Phase 1c — Tooling, real-undici integration, smoke — budget ~140 config + ~190 test — **actual: eslint.config.js +110, ci.yml +3, package.json script; tests 249 (lint-control 84, undici 130, smoke.mjs 35). Within budget. Commit `eb05948`.**

`chore(ci): import-graph lint with control, cycle check, real-undici integration matrix, live smoke`

### Tooling
- [x] devDependencies: `madge`, **`eslint-plugin-import-x`** (the maintained, flat-config-native fork — `eslint-plugin-import` + the TS resolver hit an `@typescript-eslint/utils ≥8.56` peer conflict), `eslint-import-resolver-typescript`, `undici` (for the V14 Agent); `typescript-eslint` bumped `^8.20 → ^8.70` inside its caret to satisfy the resolver's peer; lockfile: 0 `localhost:4873`
- [x] `eslint.config.js`: `import-x/no-restricted-paths` zones transcribed from spec §5, **scoped by directory to `src/codecs`, `src/http`, `src/products`, `src/media`, `src/handlers`, `src/webhooks.ts`, `src/client.ts`** so 1.x files in the additive window are not linted against 2.0 rules (run #3 A44); the three 1.x `handlers/*` files that share a zone directory are excluded by name until 2a₀; `node:*` unrestricted; **plus `import-x/no-unresolved`** — the zones rule cannot judge an import the resolver cannot resolve, so an unresolvable path (typo, not-yet-existing module) must be an error in its own right or it bypasses the graph (found while writing the control); `npm run check:cycles` = `madge --circular --extensions ts src` on the full tree (the 1.x cycle was removed by 1a₁)
- [x] **Control (V12):** `test/2.0/lint-control.test.ts` lints source text at a **virtual path inside a zone** (`src/codecs/illegal.ts` importing `../http/core.js`) with the production config via `ESLint.lintText` → exactly one `import-x/no-restricted-paths` message; the same import at `src/products/x.ts` → none; carve-outs (`http/errors`, `handlers/poller`), `node:*`, out-of-zone 1.x paths, and the unresolved-import case each asserted. Only the two type-aware style rules are switched off for the virtual file (not in the tsconfig program)
- [x] `ci.yml` runs `check:cycles` and lint

### Real-undici integration tests (V14) — `test/2.0/integration/undici.test.ts`, **through `HttpCore`**
- [x] Local **`https.createServer`** with a self-signed cert minted by `openssl` at test start (suite skips if `openssl` is absent); `HttpCore` constructed with `baseUrl: 'https://localhost:<port>'` and `fetch` = undici's bound to an `Agent({ connect: { rejectUnauthorized: false } })`; nothing in production relaxed (run #3 A36/F3)
- [x] 302 with `Location` → `KlingResponseError { httpStatus: 302, location }` through the core
- [x] Connection refused to **`https://localhost:<closed port>`** (a hostname) → `KlingNetworkError` with `ECONNREFUSED` in the cause chain, `taskState 'not-created'`, `externalId` carried; the test accepts the code directly or via `AggregateError.errors[]` (Q14 — passing on Node 24 locally; CI covers 20/22)
- [x] Server writes half a JSON body and stalls → `KlingTimeoutError { deadlineMs: 300 }`, `taskState 'may-exist'` on a write — the deadline covers the body read under real undici
- [x] CI matrix: Node 20 and 22 (set in Phase 0)

### Smoke (`scripts/smoke.mjs`) **(V5)** — raw core calls (no namespaces exist yet)
- [x] `scripts/smoke.mjs` via `client['http'].request(...)` on the built `dist/`: `GET /tasks?task_ids=0`, `POST /tasks {limit:1}`, `GET /account/costs`, `GET /v1/general/presets-voices` → all HTTP 200 `code 0` (2026-09-21, attempt 1 each)
- [x] Control: `apiKey: 'garbage-not-a-key'` → `KlingAPIError` HTTP 401 **code `1002`**, message *"Authentication error. The current API does not support AK/SK; please go to the console … to create API key."* — the same code and the same (misleading) text as the JWT rejection. **§11 Q9 closed for garbage keys:** `1002` = "authorization invalid" generally; the README must say the vendor message is not diagnostic (a revoked key is untested — needs Alex to rotate one)
- [x] Exit 1 on any expected-success failure or on the control succeeding

---

## Phase 1b — Task model + codec parsers — budget ~360 src + ~200 test (split legacy parsers into 1b₂ if fixtures exceed 14 files)

`feat(codecs)!: normalized Task and parsers for both vendor standards`

### `codecs/task.ts` (types only — D4, D5)
- [ ] `TaskStatus`, `Standard`, `Product`, `LegacyProduct`, `Task` (with `standard`, `product?`, `outputsExpireAt?`, `raw`), `TaskOutput` union, `BillingEntry`, `TaskHandle` interface (with `request` and non-optional `externalId`), `RequestOptions{signal?}`, `WaitOptions{intervalMs?, deadlineMs?, signal?}`, `SaveOptions`, `PageOptions` — exactly §6/D4/D5
- [ ] File imports nothing from `src/` (import-graph rule §5)

### `codecs/new-standard.ts` parsers
- [ ] `parseCreate(json) → Task` from `data.{id,status,create_time,update_time,external_id}`; `standard: 'new'`; `product` from the caller
- [ ] `parseTasks(json) → Task[]` from `GET /tasks` `data[]` incl. `outputs[]` (video `duration` string → `durationSeconds` number; image `group_id`; audio `mp3_url`…; element `references[]`; voice) and `billing[]` → `BillingEntry[]`
- [ ] `parseCursor(json) → { tasks, count, nextCursor, hasMore }` from `data.result[]`
- [ ] `outputsExpireAt = updatedAt + 30 * 86_400_000` when `status === 'succeeded'`
- [ ] Unknown `status` string → `KlingCodecError` **(V2)**; `create_time` / `update_time` `< 1e11` → treated as seconds, ×1000, logger warning (§11 Q12) — never a throw on units; **absent/`0` timestamps stay absent** (no `0 × 1000`, no `outputsExpireAt` from epoch — run #3 architect edge case)

### `codecs/legacy.ts` parsers
- [ ] `parseCreate(json)` from `data.{task_id,task_status,task_info.external_task_id,created_at,updated_at}`; `standard: 'legacy'`
- [ ] `parseTask(json)` adds `task_status_msg → message`, `task_result.{videos,images,audios,elements,voices}[] → outputs[]`, `final_unit_deduction`/`final_balance_deduction → billing?`
- [ ] `parseList(json) → Task[]` from `data[]`
- [ ] `succeed → succeeded`; `url_mp3/url_wav/duration_mp3/duration_wav` → camelCase; omni-image `series_images[]` → `image` outputs with `groupId`; ai-multi-shot `images[]{index,url_1,url_2,url_3}` → three `image` outputs with `groupId = String(index)`
- [ ] Same status guard and timestamp normalisation as new-standard

### Fixtures and tests **(V1 parse half)**
- [ ] `test/2.0/fixtures/<doc-file>/<section>.json` (outside the LOC budget; list the files in the commit message) copied verbatim from every *Response Example* the parsers consume (header comment: source path + line); 3.0-turbo t2v create, `GET /tasks`, `POST /tasks`; legacy image generate create/query/list; avatar query; element/voice list; callback bodies (both shapes)
- [ ] Table test: each fixture → expected `Task` (snapshot the normalized object)
- [ ] **Control:** every legacy fixture into `newStandard.parseTask*` → `KlingCodecError`; every new fixture into `legacy.parse*` → `KlingCodecError`

---

## Phase 2a₀ — Remove the 1.x surface — deletion + ~30 lines of barrel/config edits

`chore!: remove the 1.x surface; switch package entry points to 2.0`

Gate: **both Phase 0 write probes ticked.** This is the commit where the JWT path disappears.

- [ ] Delete `src/auth.ts`, `src/client/`, `src/api.ts`, `src/operations/`, `src/types.ts`, `src/errors.ts`, `src/handlers/result-poller.ts`, `src/handlers/file-saver.ts`, `src/handlers/index.ts`, `src/utils/polling.ts`, `src/utils/downloads.ts`, `src/cli.ts`, and the 16 files under `test/` (keep `test/2.0/`). **`src/utils/media.ts` is NOT deleted here** — it stays as the port reference until 2c (spec §3.1)
- [ ] Trim the barrels so `tsc` passes: `src/utils/index.ts` — remove the `./downloads.js` and `./polling.js` re-exports (keep `./media.js` until 2c); `src/config/index.ts` — remove the `loadCredentials`, model-table and validator re-exports (run #3 architect F-1 / anxiety F1)
- [ ] `vitest.config.ts` coverage `include` → `['src/**/*.ts']` (today it names `src/api.ts`, `src/auth.ts` and two nonexistent files)
- [ ] Remove the 1.x `loadCredentials`, 1.x `ERROR_CODES`, model tables and validators from `src/config/` (the 2.0 replacements land in 2a₂/3a); rename `ERROR_CODES_V2` → `ERROR_CODES`
- [ ] `src/cli/index.ts` stub: prints "kling 2.0 CLI is under construction on this branch" and exits 1
- [ ] `package.json`: `main`/`types` → `dist/index.*`; `bin.kling` → `dist/cli/index.js`; `exports` = `"."`, `"./package.json"`; remove `./api`, `./auth`, `./utils`, `./config`, `./types`; `scripts.kling*` → `dist/cli/index.js`; remove `axios`, `jsonwebtoken`, `@types/jsonwebtoken`, `nock`; `files` = `dist`, `README.md`, `CHANGELOG.md`, `LICENSE`
- [ ] `grep -rn "eyJ\|jsonwebtoken\|HS256\|accessKey\|secretKey\|KLING_ACCESS_KEY\|KLING_SECRET_KEY\|axios" src test` → 0 **(V4)**
- [ ] `npx tsc --noEmit && npm run build && npm test && npm run lint && npm run check:cycles` green with only `test/2.0/`
- [ ] `npm pack --dry-run` shows `dist/index.js`, `dist/cli/index.js`, no `dist/api.js`, no `dist/auth.*`

---

## Phase 2a₁ — Task handles, queries, poller — budget ~240 src + ~240 test

`feat(tasks): TaskHandle, unified and per-product task queries, poller`

### `products/tasks.ts` (D5)
- [ ] Product → path table: new-standard products → `/tasks`; legacy → `/v1/images/generations`, `/v1/images/omni-image`, `/v1/images/multi-image2image`, `/v1/images/editing/expand`, `/v1/general/ai-multi-shot`, `/v1/videos/avatar/image2video`, `/v1/general/advanced-custom-elements`, `/v1/general/custom-voices`
- [ ] `createHandle(core, product, id, request, externalId) → TaskHandle` — `request` arrives **already redacted** by the product module (2a₂); `products/tasks.ts` never imports `media/*`; `get()` routes by product
- [ ] `wait()` shares one in-flight poll loop across concurrent callers; **per-caller semantics** (spec D5): loop interval = shortest requested; each caller's `deadlineMs`/`signal` enforced on that caller's promise only; loop stops when the last subscriber settles. Tests: two callers, one aborts → only that one rejects with its `AbortError`, the other resolves; two callers with 5 s and 60 s deadlines → the 5 s one times out alone
- [ ] `wait()` → `KlingTaskFailedError` on `failed` (with `task`, `code` = vendor code or `null`); `KlingPollTimeoutError` on deadline; caller abort → `AbortError`; a poll `get()` that exhausts read retries surfaces its `KlingAPIError` (the loop does not swallow it)
- [ ] UUID `external_task_id` generated for every create when the caller supplies none (`crypto.randomUUID()`); `externalTaskId: false` opts out (then `TaskHandle.externalId` is `undefined` and the README says recovery is impossible); TTS never has one
- [ ] `tasks.get(ids, { byExternalId?, signal? })` → `{ tasks, missing }`; chunks of 50 run sequentially; `missing` = attempted − returned; a failing chunk throws `KlingBatchError { tasks (so far), missing (attempted only), unattempted (never sent), cause }` (tests: 120 ids → 3 calls; chunk 2 fails → error carries 50 tasks, 50 missing-or-returned from chunk 1–2 accounting, 20 `unattempted`; unknown id → in `missing`)
- [ ] `tasks.recover(product, externalId) → Task | null` — new-standard products → `GET /tasks?external_task_ids=`; legacy products → `GET /v1/<product>/{externalId}`; `null` = not visible (README wording); TTS → `KlingValidationError('TTS tasks carry no external id and cannot be recovered')`. Tests per standard with fixtures; **live** per legacy product recorded in the V10 blanks (§11 Q15)
- [ ] `tasks.list({...})` → `POST /tasks`; `limit ≤ 500`; `filters[]` from `status`/`productType`; `product` **not** back-filled; **live:** numeric `start_time` → if 400, switch to strings; pin in a contract test; record §11 Q2: `________`
- [ ] `tasks.getByProduct(product, id)`, `tasks.listByProduct(product, {pageNum, pageSize})` (pageNum 1–1000, pageSize 1–500), `tasks.handle(product, id, request?)`
- [ ] `config/models.ts` skeleton: exports empty `VIDEO_MODELS`/`IMAGE_MODELS` tables and their types, so 2a₂ and 3a each append their own table without touching shared lines (run #3 F-11/A48)
- [ ] `client.http` marked `/** @internal */`; the smoke script reaches it via `client['http']` with a comment saying so (run #3 F-8)
- [ ] **Live:** `tasks.get` with 100 ids → record whether 200 or 4xx (§11 Q13): `________`
- [ ] `healthCheck()` = `tasks.get(['0'])` resolves → `true`; any throw → `false`

### `handlers/poller.ts` (D13)
- [ ] `poll(fn, { intervalMs = 3000, deadlineMs = 900_000, signal })` — no TTY output; tests with fake timers for interval, deadline, abort

---

## Phase 2a₂ — Video text-to-video — budget ~170 src + ~130 test (i2v is 2a₃)

`feat(video)!: text-to-video and image-to-video on the new standard`

### `products/video.ts` + `codecs/new-standard.ts` builders
- [ ] `buildTextToVideo(params)` → `{ prompt, settings{resolution,aspect_ratio,duration,audio?,multi_shot?, ...extraSettings}, options{callback_url?,external_task_id,watermark_info?{enabled}, ...extraOptions} }`; unset optionals **omitted** (never `null`); `external_task_id` present unless opted out
- [ ] `products/video.ts` redacts media fields of `request` to `{ kind, bytes, sha256 }` **before** `createHandle` (t2v has none; the helper lands here for 2a₃)
- [ ] `video.textToVideo` → `POST /text-to-video/<model>` with `kind: 'write'`, `externalId` on the request → `TaskHandle`
- [ ] Default model `DEFAULT_VIDEO_MODEL = 'kling-3.0-turbo'` (§10.11 settled; one constant regardless)
- [ ] **(V1 build half)** built body deep-equals the vendor *Request Example* for 3.0-turbo, 3.0, 2.6, 2.5-turbo t2v (4 fixtures) given the example's inputs, with the example's `external_task_id` supplied so the auto-UUID does not perturb the comparison

### `config/models.ts` + validators (D9) **(V3)**
- [ ] `VIDEO_MODELS` for the six ids per spec §2.2, each row commented with its `docs/api/` source
- [ ] Test: every enum value in the table appears verbatim in the cited doc file (grep-based)
- [ ] `model` typing `KnownVideoModel | (string & {})`; unknown id + `unknownModels: 'passthrough'` (default) → logger warning, shape-only validation, request built; `'reject'` → `KlingValidationError`
- [ ] `capabilityValidation: 'warn'` turns every capability-rule failure below into a warning and still sends; shape rules (required fields, types) throw regardless (test both modes on one rule)
- [ ] `extraSettings`/`extraOptions` merged after validation (test: an unknown key reaches the body untouched); **a key the library models (e.g. `resolution`) in `extra*` → `KlingValidationError`** (test) (run #3 A41)
- [ ] Every rule below carries a `[shape]` or `[capability]` label in the test name; `[shape]` rules throw under both `capabilityValidation` modes (run #3 A42)
- [ ] t2v rules, each with pass + fail test, fail message naming the field: `[shape]` `prompt` required, ≤ 3072 (3.0, 3.0-turbo) / 2500 (else); `[shape]` `duration` integer; `[capability]` model ∈ products; `[capability]` `resolution` ∈ model×product set; `[capability]` `duration` ∈ model set; `[capability]` `audio` only where the model has the field (3.0-turbo message: "native audio is always on for kling-3.0-turbo (inferred from pricing; pass capabilityValidation: 'warn' to send anyway)"); `[capability]` 2.6 `native` ⇒ `1080p`
- [ ] `@name` in prompt with no matching content `id` → logger **warning**, not error

### Live (opt-in, spends units)
- [ ] **V6 (release-blocking):** `video.textToVideo({ model:'kling-3.0-turbo', prompt, duration:3, resolution:'720p' })` via a temporary script → `succeeded`, one `video` output; **inspect the mp4 for an audio track** (`ffprobe`) and record — this closes §11 Q3's inference: `________`. Record `task.id` `________`, billing `________`
- [ ] **§11 Q11:** submit the same `externalTaskId` twice (cheapest t2v) → record second response: `________`

---

## Phase 2a₃ — Video image-to-video — budget ~170 src + ~130 test

`feat(video): image-to-video on the new standard`

- [ ] `buildImageToVideo(params)` → `contents[]` = `[{type:'prompt',text}, {type:'first_frame',url}, {type:'last_frame',url}?, {type:'element',element_id,id}*, {type:'voice',voice_id,id}*, ...extraContents]`; `settings` without `aspect_ratio`
- [ ] `video.imageToVideo` → `POST /image-to-video/<model>` `kind: 'write'` → `TaskHandle`; `firstFrame`/`lastFrame` via `resolveMediaSource(kind:'image', standard:'new')` (stub until 2c: URL and Base64 strings only); `request` redacted before `createHandle`
- [ ] **(V1)** 4 i2v fixtures (3.0-turbo, 3.0, 2.6, 2.5-turbo) deep-equal
- [ ] i2v rules with labels and pass/fail tests: `[shape]` `firstFrame` required; `[shape]` `lastFrame` without `firstFrame` rejected; `[shape]` `voices` ≤ 2 and `elements` ≤ 3 (array bounds); `[capability]` 2.6/2.5-turbo `lastFrame` ⇒ `1080p`; `[capability]` 3.0-turbo rejects `lastFrame`; `[capability]` `voices` 2.6 only and `audio !== 'off'`; `[capability]` `elements` 3.0 only
- [ ] Create `timeout` scales with body size: `max(config.timeout, 30_000 + bodyBytes / 250_000)` (spec D11; test with a 20 MB fake body → ≥ 110 s)

---

## Phase 2b — Video omni + motion-control — budget ~200 src (builders ~90, validators ~110) + ~220 test (4 fixtures, count matrices)

`feat(video): omni-video and motion-control`

- [ ] `buildOmni(params)` → seven content types + `extraContents`; auto `id`s (`image_1`, `video_1`, element name) when omitted; `settings.aspect_ratio` only when set
- [ ] `buildMotionControl(params)` → `contents[]` prompt?, `{type:'image',url}`, `{type:'video',url}`, element?; `settings{character_orientation,audio,resolution}`; no `duration`
- [ ] `video.omni` (default `kling-3.0-omni`), `video.motionControl` (default `kling-3.0`)
- [ ] **(V1)** body deep-equals vendor examples: `/omni-video/kling-3.0-omni` (t2v, first-frame, feature_video, base_video examples), `/omni-video/kling-o1`, `/motion-control/kling-3.0`, `/motion-control/kling-2.6`
- [ ] **(V3)** rules with labels and pass/fail tests: `[shape]` omni `aspectRatio` required when no `firstFrame` and no reference video; `[shape]` 3.0-omni `baseVideo` ⇒ no frames, `multiShot` not `true`, `audio !== 'native'` (paid-request-shaping — never warned past); `featureVideo` ⇒ `audio === 'off'`, `multiShot !== false`; ≤1 reference video; refer-image + element count matrices (App. B §2.5, each cell a test); O1: multi-image elements only, `firstFrame` with no other refs ⇒ `duration ∈ {5,10}`, ref video 3–10 s (message: uncheckable client-side); motion: `characterOrientation` required, `element` 3.0 only ≤1, `video` must be `{url}`/https string, ref-video duration bound stated in the message as uncheckable; 3.0 motion excludes `4k`
- [ ] **V10 opt-in (not release-blocking):** `video.omni` first-frame-only with a hosted image → `succeeded`. Record: `________`

---

## Phase 2c — Media sources + download + save — budget ~230 src (source ~90, download ~80, saver ~60) + ~220 test

`feat(media)!: explicit MediaSource, fetch-based downloads with byte/redirect/SSRF guards`

### `media/source.ts` (D12)
- [ ] `resolveMediaSource(src: MediaSource, { kind: 'image' | 'video' | 'audio', standard: Standard }) → { url } | { base64 }`
- [ ] Bare string: `https://…` → `{url}`; Base64 (charset check, optional `data:` prefix stripped) → `{base64}`; **anything else → `KlingValidationError`** — never `existsSync`. Test: a string that is a real path on disk → throws
- [ ] `{ path }` / `Buffer` / `Uint8Array`: read, check extension (`jpg/jpeg/png` for images), magic bytes, ≥300 px, ratio 1:2.5–2.5:1 → `{base64}`; cap **10 000 000 bytes when `standard === 'legacy'`** (vendor "10MB", `kling-image-2.1-generation.md:77`; decimal so we are under either reading) and **20 000 000 when `'new'`** (library limit; JSON inflation) — over the cap → `KlingValidationError` naming the cap and the reason; tests for both standards at cap±1 byte
- [ ] **Aggregate cap:** total encoded inline payload per request ≤ 40 MB → else `KlingValidationError('host the files and pass URLs')` (test: 5 × 9 MB legacy inputs → throws) (run #3 A45)
- [ ] `kind: 'video'` accepts only `https` string or `{url}`; else `KlingValidationError('… must be a URL; the Kling API has no upload endpoint')`
- [ ] Delete `src/utils/media.ts` (`imageToBase64`, `audioToBase64`, `processMediaSource`) after porting the checks — **this is where it goes** (kept through 2a₀ as the reference); remove the `./media.js` re-export from `src/utils/index.ts` now

### `media/download.ts` (D12)
- [ ] `fetchToBuffer(url, { maxBytes, maxRedirects = MAX_REDIRECTS, timeoutMs, signal, fetch })`
- [ ] `redirect: 'manual'` loop; **`validateUrl` on the initial URL and on every `Location`** (test: first hop public, second hop **`https://127.0.0.1/`** → `KlingDownloadError('blocked-host')` before the second fetch — https so the protocol check passes and the *host* check is what fires; **control:** second hop `http://127.0.0.1/` is also blocked, but that one proves only the protocol rule — run #3 anxiety F3)
- [ ] `validateUrl` hardened (D12): `dns.lookup({all:true})` and reject if any address is private/loopback/link-local/metadata; IPv4 alternate encodings (`0x7f000001`, `2130706433`, `0177.0.0.1`) normalised via `new URL()` + `net.isIP`; IPv6 `::1`, `fc00::/7`, `fe80::/10`, `::ffff:` mapped v4 — each with a failing control; DNS lookup is injectable for tests; **lookup failure (`ENOTFOUND`, timeout) → `KlingDownloadError('blocked-host', cause)`** — fail closed (test); the time-of-check limitation is a README note, not a test
- [ ] Stream the body; abort and throw `KlingDownloadError('too-large')` once `maxBytes` is exceeded (test: fake stream of `maxBytes + 1`)
- [ ] `> maxRedirects` → `KlingDownloadError('too-many-redirects')` (test); non-2xx final → `KlingDownloadError('http', httpStatus)`
- [ ] Delete `src/utils/downloads.ts`

### `handlers/saver.ts` (D14)
- [ ] `save(task, dir, { includeWatermark?, signal?, fetch?, timeoutMs?, force? }) → string[]`; `client.save(task, dir, opts)` forwards the client's `fetch`/`timeout`/logger (test: injected fetch is the one called)
- [ ] `KlingOutputsExpiredError` when `outputsExpireAt < Date.now()` — thrown before any fetch (test with a synthetic task); `force: true` bypasses it (test)
- [ ] `KlingNoOutputsError` when `status === 'succeeded'` and `outputs.length === 0`
- [ ] Filename `<task.id>-<index>.<ext>`; `ext` from `Content-Type` → URL extension → `bin` (tests for each branch)
- [ ] Sidecar `<task.id>.json`: `{ product, standard, request, outputs, raw }` — `request` media fields already redacted to `{ kind, bytes, sha256 }` by the handle (test: a 5 MB Buffer input yields a sidecar under 10 KB)
- [ ] Watermarked variants only with `includeWatermark`
- [ ] Live (opt-in): `save()` on the V6 task writes a playable mp4

---

## Phase 3a — Image generate + omni — budget ~200 src (IMAGE_MODELS ~40, builders ~70, products ~40, validators ~50) + ~220 test

`feat(image)!: image generation and omni-image on the legacy standard`

- [ ] `IMAGE_MODELS`: `kling-v3` (generations; `1k|2k`; 8 ratios), `kling-v2-1` (generations + multi-image2image; `imageReference`-capable), `kling-v3-omni` (omni-image; `1k|2k|4k`; `auto`; series), `kling-image-o1` (omni-image; `1k|2k` per capability map — `4k` rejected with the doc cited); each row commented with source
- [ ] `legacy.buildGenerate(params)` → flat body `{ model_name, prompt, negative_prompt?, image?, image_reference?, image_fidelity?, human_fidelity?, element_list[]{element_id}, resolution, n, aspect_ratio, watermark_info?, callback_url?, external_task_id? }`
- [ ] `legacy.buildOmniImage(params)` → `{ model_name, prompt, image_list[]{image}, element_list[]{element_id}, resolution, result_type, series_amount, n, aspect_ratio, … }`
- [ ] `image.generate` (default `kling-v3`), `image.omni` (default `kling-v3-omni`) → `POST /v1/images/…` `kind: 'write'` → `TaskHandle` (`standard: 'legacy'`)
- [ ] **(V1)** bodies deep-equal the vendor *Request Example*s in `kling-image-2.1-generation.md` and `kling-image-o1-generation.md`
- [ ] **(V3)** rules with `[shape]`/`[capability]` labels: `[capability]` `imageReference`/`humanFidelity` with model ≠ `kling-v2-1` → **error**; `humanFidelity` with `imageReference !== 'subject'` → **warning** (vendor: "only takes effect when … subject"); `imageFidelity`/`humanFidelity` ∈ [0,1]; `n` 1–9; `resolution` per model; `aspectRatio` `auto` only on omni; `seriesAmount` 2–9|`auto`, only with `resultType: 'series'`; `images.length + elements.length ≤ 10` on omni
- [ ] Unknown `model_name` passthrough/reject per `unknownModels`; `capabilityValidation: 'warn'` and `extraSettings` (merged top-level for legacy) behave as in 2a₂
- [ ] **V10 (release-blocking):** `image.generate({ prompt, n: 1 })` → `succeeded`, one `image` output (the Phase 0 probe task may be reused as first evidence via `tasks.getByProduct('image-generation', id)`). Record: `________`

---

## Phase 3b — Image multi / outpaint / subject-completion — budget ~140 src + ~160 test

`feat(image): multi-image-to-image, outpainting, subject completion`

- [ ] `legacy.buildMultiImageToImage` → `{ model_name: 'kling-v2-1', prompt?, subject_image_list[]{subject_image}, scene_image?, style_image?, n, aspect_ratio, … }`; `subjectImages` 1–4
- [ ] `legacy.buildOutpaint` → `{ image, up_expansion_ratio, down_…, left_…, right_…, prompt?, n, … }`; each ratio ∈ [0,2]; `(1+up+down)*(1+left+right) ≤ 3` (retain `MAX_TOTAL_EXPANSION`)
- [ ] `legacy.buildSubjectCompletion` → `{ element_frontal_image, callback_url?, external_task_id? }`
- [ ] `image.multiImageToImage`, `image.outpaint`, `image.subjectCompletion` → `TaskHandle`
- [ ] **(V1)** bodies deep-equal vendor examples (`kling-image-2.1-multi-image-to-image.md`, `kling-image-common-outpainting.md`, `kling-image-common-subject-completion.md`)
- [ ] `tasks.listByProduct` for all five image products parses via `legacy.parseList` (fixture per product where the doc has a list example)

---

## Phase 4a — Elements + voices — budget ~230 src (types ~60, elements ~90, voices ~80) + ~220 test

`feat(resources): element and voice management`

- [ ] Transcribe spec §6.3 `ElementCreateParams`, `VoiceCreateParams`, `PageOptions`, `ElementDeleteOptions` into `products/elements.ts` / `products/voices.ts`; one test per required field asserting the snake_case key in the body
- [ ] `elements.create({ name, description, referenceType, frontalImage?, referImages?, referVideos?, voiceId?, tags?, … })` → `POST /v1/general/advanced-custom-elements` → `TaskHandle` (product `element`); image inputs via `resolveMediaSource`, videos URL-only
- [ ] `elements.get(id)`, `elements.list({pageNum,pageSize})`, `elements.presets()` → `Task`/`Task[]` with `element` outputs
- [ ] `elements.delete(id, { kind = 'video' })` → `/v1/general/delete-advanced-elements` | `/v1/general/delete-elements`; `kind: 'write'`
- [ ] `voices.create({ name, voiceUrl? | videoId?, … })` (exactly one of the two) → `POST /v1/general/custom-voices` → `TaskHandle`; `voices.get/list/presets/delete` (list `pageSize ≤ 1000`)
- [ ] **(V1)** contract tests for all create/delete bodies
- [ ] **Live, read-only:** `voices.presets()` and `elements.presets()` each return ≥1 output
- [ ] **§11 Q7 probe (spends an element create):** create one element via the video path; delete it via `kind: 'image'`; record whether delete returns `code: 0`: `________`

---

## Phase 4b — Avatar + TTS — budget ~120 src + ~130 test

`feat(resources): avatar and text-to-speech`

- [ ] `avatar.create(AvatarCreateParams)` (spec §6.3) — logic ported from the deleted `src/operations/avatar.ts` + `validators/avatar.ts` (retrieve from git history at `4f23c27`); `soundFile` via `resolveMediaSource(kind:'audio', standard:'legacy')` (≤ 5 MB, `mp3/wav/m4a/aac`); `image` cap 10 MB → `TaskHandle` (product `avatar`)
- [ ] `audio.tts(TtsParams)` → `POST /v1/audio/tts` synchronous (`kind: 'write'`) → `TaskOutput[]` (type `audio`); `text ≤ 1000`; `voiceSpeed ∈ [0.8, 2.0]`; `voiceLanguage` required
- [ ] **(V1)** contract tests

---

## Phase 5 — Platform — budget ~170 src (account ~70, webhooks ~100) + ~180 test

`feat(platform): account ledgers, webhook signature verification, callback parsing`

- [ ] `account.usage(startTime, endTime, resourcePackName?)` → `GET /account/costs` (`kind: 'read'`); parse the double envelope (`data.code`, `data.msg`, `data.resource_pack_subscribe_infos[]`)
- [ ] `account.balanceLedger({ startTime?, endTime?, cursor?, limit?, apiKeyName? })` → `POST /account/billing/balance` (`kind: 'read'`)
- [ ] `account.packageLedger({ …, productType?, packageName? | packageId? })` → `POST /account/billing/package`; `packageName`/`packageId` mutually exclusive (test)
- [ ] `verifyWebhookSignature({ id, timestamp, signature, rawBody, secret, toleranceSeconds = 300, now = () => Date.now() })` — HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`, key = base64-decode(secret without `whsec_`), constant-time compare, accepts multiple space-separated `v1,` signatures; `now` injectable (run #3 anxiety F2)
- [ ] **(V13)** vendor vector passes: secret `whsec_dGVzdHNlY3JldHRlc3RzZWNyZXR0ZXN0c2VjcmV0MTI=`, id `9876543210`, ts `1781080794`, body `{"id":"1234567890","status":"succeeded","message":"","create_time":1781080778802,"update_time":1781080794151}` → `v1,UsKlJP00XoQyOn410NM9xv34sP+Gl0jnOO9Lcpr7NJ4=` **with `now` pinned to `1781080794 × 1000`**; **controls:** one body byte flipped → `KlingWebhookError('bad-signature')`; `now` moved +301 s → `'stale-timestamp'`; `now` moved +299 s → passes
- [ ] `src/webhooks.ts`: `parseCallback(rawBody: string | Uint8Array, { headers?, secret? }) → { task, verified: true | null }` — `id` present → new codec, `task_id` present → legacy codec, **both present → `KlingCodecError`**; with `secret`: missing headers → `KlingWebhookError('missing-headers')`, bad signature → `'bad-signature'`, skew > tolerance → `'stale-timestamp'` — the task is never returned on a failed check; without `secret` → `verified: null`
- [ ] README section (written in 6c, drafted here as a docstring): raw-body precondition with an `express.raw({ type: 'application/json' })` example; bold warning that `verified: null` bodies are unauthenticated
- [ ] Fixtures: both callback body shapes from `kling-get-started-callbacks.md`
- [ ] **§11 Q1 (if a receiver is available; not release-blocking):** trigger one 3.0-omni task with `callbackUrl`; record body shape and whether signature headers arrived: `________`

---

## Phase 6a₁ — CLI core + video — budget ~360 src + ~120 test

`feat(cli)!: 2.0 command tree — program, credentials, video`

- [ ] `src/cli/index.ts` (replaces the 2a₀ stub): commander program; global `--api-key`, `--output-dir`, `--json`, `--debug`, `-q`; credential chain `--api-key` → `KLING_API_KEY` → `./.env` → `~/.kling/.env` (dotenv lives **here** only); `pollWithSpinner` (`ora`) wrapping `handle.wait()` unless `--json`/`-q`
- [ ] `cli/video.ts`: `t2v | i2v | omni | motion-control`; flags mirror §6.1 in kebab-case (`--first-frame`, `--last-frame`, `--refer-image` (repeatable), `--feature-video`, `--base-video`, `--element id:alias` (repeatable), `--voice`, `--character-orientation`, `--audio`, `--multi-shot/--no-multi-shot`, `-r/--resolution`, `-a/--aspect-ratio`, `-d/--duration`, `-m/--model`); file arguments are wrapped as `{ path }` by the CLI; `--wait`, `--no-download`, `--with-watermark`, `--callback-url`, `--external-task-id`
- [ ] Defaults printed in `--help`: `kling-3.0-turbo` (t2v, i2v — §10.11), `kling-3.0-omni` (omni), `kling-3.0` (motion)
- [ ] Removed flags absent from help: `--access-key`, `--secret-key`, `--mode`, `--cfg-scale`, `--negative-prompt` (video), `--camera-*`, `--image-tail`
- [ ] Video subcommand tests against built `dist/cli/index.js`: help contents, defaults, required-option errors, no dead flags

---

## Phase 6a₂ — CLI image + test suite — budget ~200 src + ~160 test

`feat(cli): image commands; CLI test suite`

- [ ] `cli/image.ts`: `generate | omni | multi | outpaint | subject-completion`; defaults `kling-v3` (generate), `kling-v3-omni` (omni)
- [ ] `test/2.0/cli.test.ts`: all video + image subcommands — help, defaults, required options, dead-flag absence, `--json` output shape

---

## Phase 6b — CLI resources / tasks / account — budget ~240 src + ~160 test

`feat(cli): elements, voices, avatar, audio, tasks, account`

- [ ] `cli/resources.ts`: `elements create|get|list|presets|delete [--kind]`, `voices …`, `avatar create`, `audio tts`
- [ ] `cli/tasks.ts`: `tasks get <ids…> [--by-external-id]`, `tasks list [--cursor] [--status] [--product-type] [--limit]`, `tasks get-by-product <product> <id>`
- [ ] `cli/account.ts`: `account usage [--days 30]`, `account balance`, `account packages`
- [ ] CLI tests extended

---

## Phase 6c — Docs, package, merge, publish (`main`) — no LOC budget (docs)

`docs(kling-api)!: 2.0 README and CHANGELOG` · `chore(release): 2.0.0` (manual)

### Docs
- [ ] `README.md` rewritten: install; `KLING_API_KEY`; one example per namespace; `TaskHandle`/`Task` usage; `MediaSource` rules (string is URL/Base64, `{ path }` for files); model tables generated from `VIDEO_MODELS`/`IMAGE_MODELS`; **default-model policy stated** (video: cheapest current-gen *with native audio*; image: newest — D6) with the dated price table; retry semantics (**`taskState`** drives re-submit decisions; `isTransient` is diagnostic; creates never auto-retried; `tasks.recover(product, externalId)` with `null` = not visible; TTS unrecoverable; body-size-scaled create timeout); worst-case read time arithmetic (D11); fetch parity notes (no env proxy; `fetch` injection); webhook raw-body precondition and `verified: null` warning; migration pointer to spec §7; ToC with unique headings; no empty headings
- [ ] `grep -nE "task_id|succeed'|accessKey|secretKey|kling-v1\b|kling-v2-master|kling-v2-6|kling-video-o1" README.md` → 0 **(V9)**; `kling-image-o1` appears only in the image model table
- [ ] `CHANGELOG.md`: `## [Unreleased]` → `## [2.0.0] - <date>`; *Removed* / *Changed* / *Added* transcribed from spec §7; *Changed* names the semantics-without-signature items: `TaskStatus` `succeed → succeeded`, default models + policy, string `MediaSource` no longer a path, `outputsExpireAt`
- [ ] `docs/api/README.md` refresh one-liner run into a temp dir; diff empty or every difference explained

### Package
- [ ] `package.json`: `version: "2.0.0"` (by hand); `engines.node >=20.0.0`; `dependencies` = `commander`, `dotenv`, `ora`; confirm `devDependencies` has `madge`, `eslint-plugin-import`, `eslint-import-resolver-typescript` and no `semantic-release`/`nock` (entry points, `exports` and `files` were switched in 2a₀)
- [ ] `ci.yml`: add `test -f dist/index.js && test -f dist/cli/index.js`
- [ ] Merge `release/2.0` → `main` locally; `git pull --ff-only origin main` is a no-op; `npm ci && npm run lint && npm run build && npm test && npm run check:cycles && npx tsc --noEmit` on the **merged** tree
- [ ] **(V7)** `grep -rnE "kling-v1\b|kling-v1-5|kling-v1-6|kling-v2-master|kling-v2-1-master|kling-v2-5-turbo|kling-v2-6|kling-v2-new|kling-video-o1|'kling-v2'" src` → 0
- [ ] **(V8)** `npm pack --dry-run` lists `dist/index.js`, `dist/cli/index.js`; no `dist/auth.*`, `dist/api.js`, `dist/cli.js`; `node -e "import('./dist/index.js').then(m=>console.log(Object.keys(m).sort().join('\n')))"` prints every value export in spec §6.4
- [ ] **(V5)** smoke script passes against `dist/`
- [ ] **(V15) Release-blocking blanks filled** in this file: Phase 0 all five probes, 1c smoke `code`, 2a₁ Q2 and Q13, 2a₂ V6 (incl. audio-track check) and Q11, 3a V10 image, Q15 per legacy product. (Not blocking: 2b V10 omni, 5 Q1, Q9-revoked. The three Phase 0 resource probes ARE blocking — §10.15.)
- [ ] Push `main`; `npm publish` (Alex); `npm view kling-api version` → `2.0.0`
- [ ] Install into a consumer; one `video.textToVideo` end-to-end

---

## Phase 7 — Post-release live parameter battery (Alex, 2026-09-21)

`test(live): full request-parameter battery against the published 2.0.0 tarball`

Not part of the 2.0.0 publish gate (V15 is). Runs after 6c, against the package **as installed** — published to local Verdaccio first, installed into a scratch consumer with the `@uluops`-style `.npmrc` opt-in, so what is exercised is the packed tarball (files field, exports, types), not the source tree. Spends real units; the packs expire 2026-10-20/21, so this runs inside that window or on a renewed pack.

- [ ] `npm publish --registry http://localhost:4873/` of the 2.0.0 candidate; `npm install kling-api@2.0.0` in `scratch/live-battery/` with `.npmrc` → Verdaccio; remove `.npmrc` and jq-scan the lockfile afterwards (CLAUDE.md Verdaccio discipline)
- [ ] `scripts/live-battery.mjs`: for each create endpoint, one call per **enum value** of each settings field (resolution × duration × aspect ratio × audio, one axis varied at a time from the cheapest baseline), each `contents[].type` the model supports, `extraSettings` passthrough of a harmless unknown key, and one deliberately invalid value per field to confirm the vendor's `1201` message names the field the way our validator does
- [ ] Legacy image products: `model_name` × `resolution` × `aspect_ratio` (incl. `auto` on omni), `image_reference` on `kling-v2-1`, `result_type: series` on `kling-v3-omni`, outpaint ratios at the `3×` boundary
- [ ] Resources: element `image_refer` and `video_refer` (a hosted clip), voice from `video_id`, avatar `pro`, TTS both languages
- [ ] Recovery: `tasks.recover(product, externalId)` for every product created above — closes §11 Q15 per product; `tasks.get` with 100 ids (Q13 re-check on the published build)
- [ ] Record per call: request body, `code`, `task_state`, deduction, wall time; totals per pack; anything the vendor accepted that our validator rejects (or vice versa) becomes an issue against `config/models.ts`
- [ ] Budget: estimate before running (cheapest settings ≈ 0.3–0.8 video units per 3–5 s clip; image 1k ≈ 8 units on `kling-v3`); confirm with Alex if the total exceeds what §10.17 authorised

---

## Cross-phase invariants (check at every commit)

- [ ] Nothing outside `src/codecs/` reads a vendor-spelled field: `grep -rnE "task_status|task_result|task_status_msg|'succeed'|create_time|update_time|external_task_id|data\.id\b" src --include='*.ts' | grep -v '^src/codecs/'` → 0 (D3; `outputs`, `status`, `externalId` are normalized names and are allowed anywhere)
- [ ] No `null` sent for an unset optional body field (builder tests assert absence, not `null`)
- [ ] Every vendor enum value in `config/models.ts` / `config/constants.ts` appears verbatim in a `docs/api/*.md` file (test)
- [ ] `KLING_API_KEY` never logged in full; `redactKey` at every log site touching config
- [ ] `madge --circular` clean; `no-restricted-paths` per spec §5 clean
- [ ] Writes (`kind: 'write'`) are never retried after a response, and `isRetryable()` is `false` on every write error — the V11 tests stay green
- [ ] Before 2a₀, `npm test` runs both the 1.x suite and `test/2.0/`; after 2a₀, `test/` contains only `test/2.0/`

---

## Open items carried from the spec (§11) — close here when resolved

| Q | Closes in | Result |
|---|---|---|
| Q1 callback shape / signing for 3.0-omni | Phase 5 | `________` |
| Q2 `POST /tasks` time field type | Phase 2a | `________` |
| Q3 3.0-turbo `audio` | 2a₂ V6 audio-track check | inferred always-on (pricing); confirm: `________` |
| §10.11 default video model | settled 2026-09-20 | `kling-3.0-turbo` (Alex) |
| §10.15 resource live creates release-blocking? | settled 2026-09-20 | blocking — the three Phase 0 resource probes are in V15 (Alex) |
| §10.16 concurrency queue stays out of scope? | settled 2026-09-20 | out of scope for 2.0 (Alex) |
| §10.17 live-programme budget (~8–10 units) | settled 2026-09-20 | up to ~20 units authorised as a block; pack expires **2026-10-20** — run the live items before then; record each spend in its blank (Alex) |
| Q15 legacy `GET /v1/<product>/{external_task_id}` per product | 2a₁ live / V10 blanks | `________` |
| Q14 undici behaviours on Node 20/22 | 1c (V14) | all three hold on Node 24 locally; CI matrix 20/22 on every push |
| Q4 omni `duration` with reference video; `shot_type` | Phase 2b (document only) | `________` |
| Q7 element delete path / shared library | Phase 4a | `________` |
| Q9 code for a garbage key; revoked key | Phase 1a smoke control | `________` |
| Q11 `external_task_id` idempotency | Phase 2a | `________` |
| Q12 legacy image timestamps ms | Phase 1b fixtures (normalise-and-warn) | `________` |
| Q13 `/tasks` id cap | Phase 2a | `________` |
| A5 API Key on legacy writes | **Phase 0 gate** (image + TTS) | image `________` · tts `________` |
