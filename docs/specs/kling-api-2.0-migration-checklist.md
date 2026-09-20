# kling-api 2.0 — Implementation Checklist

Companion to [`kling-api-2.0-migration-spec-v0_2_0.md`](kling-api-2.0-migration-spec-v0_2_0.md). The spec holds the *why*; this file holds the *what*, in commit order, with the check that closes each item. Decision references (`D3`, `§8.4`) point into the spec. Tick a box only when its check has been run and observed to pass — and, where a control is listed, observed to fail on the control.

Conventions: `[ ]` open · `[x]` done · `[-]` deliberately skipped (write why inline). Each phase ends in one conventional commit; the messages are suggested, not mandated. Verification numbers (`V1`…`V9`) are the spec's §8 items.

---

## Phase 0 — Snapshot and plan of record

`docs(kling-api): snapshot vendor API docs and draft 2.0 migration spec`

- [ ] `docs/api/` contains 48 vendor pages + `README.md`; `ls docs/api | wc -l` → 49
- [ ] No duplicate mounts remain beyond the six body-identical pairs listed in `docs/api/README.md` (the four hand-copied `kling-auth.md` / `kling-callback-protocol.md` / `kling-concurrency.md` / `kling-error-codes.md` are gone; ` copy` suffix gone)
- [ ] `docs/KLING_API_REFERENCE.md` deleted (staged)
- [ ] Spec v0.2.0 + this checklist + appendices A/B/C committed
- [ ] Pre-implementation pipeline run against spec + checklist; findings triaged into this file or the spec's §11 before Phase 1 starts

---

## Phase 1 — Core (D2, D3, D4, D10, D11)

`feat(core)!: API-key auth, fetch transport, dual codecs, normalized Task`

### Remove
- [ ] Delete `src/auth.ts`; remove `./auth` from `package.json#exports`
- [ ] Remove `jsonwebtoken`, `@types/jsonwebtoken`, `axios` from `package.json`; `npm install` regenerates the lockfile
- [ ] Remove `KlingAPI.getToken()` / `refreshToken()` and `KlingHttpClient` equivalents
- [ ] `grep -rn "eyJ\|jsonwebtoken\|HS256\|accessKey\|secretKey\|KLING_ACCESS_KEY\|KLING_SECRET_KEY" src` → 0 hits **(V4)**

### Config and credentials
- [ ] `KlingConfig` = `{ apiKey?, baseUrl?, timeout?, debug?, retry? }`; no `accessKey`/`secretKey`
- [ ] `loadApiKey(cliKey?)` keeps the four-tier chain (arg → `process.env.KLING_API_KEY` → `./.env` → `~/.kling/.env`) — `src/config/loaders.ts:28-74` pattern with one key
- [ ] `.env.example` updated to `KLING_API_KEY=`
- [ ] Missing-key error message names all four sources and `https://kling.ai/dev/api-key`

### HTTP core (`src/http/core.ts`)
- [ ] Native `fetch`; `engines.node` → `>=20.0.0`; `@types/node` matches
- [ ] `Authorization: Bearer <apiKey>` set once, on every request; HTTPS-only base URL guard retained (`http-client.ts:54-56` behaviour)
- [ ] Timeout via `AbortController` (default 30 s, `DEFAULT_TIMEOUT`)
- [ ] Retry with exponential backoff from 1 s on: business codes `1302`, `1303`, `5000`, `5001`, `5002`; HTTP `429`, `502`, `503`, `504`. Non-retryable: everything else, including `1002`
- [ ] `KlingAPIError { code, message, requestId?, httpStatus? }` retained; `isRetryable()` matches the list above
- [ ] `ERROR_CODES` replaced with the 24-row vendor table (App. C §2); names derived from the vendor's *Explanation* column; `1003`/`1004` kept (they exist) but documented as unreachable without JWT
- [ ] Unit test: `1303` response body has **no `data`** (App. C §3) — error construction must not throw on `data === undefined`

### Task model and codecs (`src/codecs/`)
- [ ] `TaskStatus = 'submitted' | 'processing' | 'succeeded' | 'failed'`
- [ ] `Task`, `TaskOutput` union, `BillingEntry`, `TaskHandle` as in spec D4/D5, `raw` retained (§10.6)
- [ ] `codecs/new-standard.ts`: parse create response (`data.id/status/create_time/update_time/external_id`), `GET /tasks` (`data[]`), `POST /tasks` (`data.result[]/count/next_cursor/has_more`); `outputs[]` union incl. `duration` string → number
- [ ] `codecs/legacy.ts`: parse `data.task_id/task_status/task_status_msg/task_info.external_task_id/created_at/updated_at`; `task_result.{videos,images,audios,elements,voices}[]` → `TaskOutput[]`; `succeed` → `succeeded`; legacy audio field names (`url_mp3`, `duration_mp3`) → camelCase
- [ ] Status table test: `succeed` → `succeeded`; `succeeded` → `succeeded`; unknown string → throws **(V2)**
- [ ] Cross-codec control: legacy response fed to the new-standard codec throws; and vice versa **(V1 control)**
- [ ] Contract fixtures: one JSON fixture per vendor *Response Example* used (copied verbatim from `docs/api/`, path recorded in the fixture header)

### Live smoke (`scripts/smoke.mjs`) **(V5)**
- [ ] `GET /tasks?task_ids=0` → 200
- [ ] `POST /tasks {"limit":1}` → 200
- [ ] `GET /account/costs?start_time&end_time` → 200
- [ ] `GET /v1/general/presets-voices` → 200
- [ ] **Control:** same `GET /tasks` with `Bearer garbage` → 401; record which business code (`1000` vs `1002`) it returns and close spec §11 Q9
- [ ] Script exits non-zero if any expected-200 fails or the control returns 200

---

## Phase 2 — Video (D6, D9, D12, D13)

`feat(video)!: new-standard text-to-video, image-to-video, omni-video, motion-control`

### Capability registry (`src/config/models.ts`)
- [ ] `VIDEO_MODELS` keyed by path id: `kling-3.0-turbo`, `kling-3.0`, `kling-3.0-omni`, `kling-o1`, `kling-2.6`, `kling-2.5-turbo`
- [ ] Per model: `products`, `resolutions` per product (3.0 motion-control excludes `4k`), `durations` (`3`–`15` / `5|10` / `3`–`10` / `null` for motion), `audio` modes (`null` for 3.0-turbo and 2.5-turbo), `multiShot`, `contentTypes` per product — values transcribed from spec §2.2 / App. B §4.1 with the doc file cited in a comment per row
- [ ] Unit test asserts every enum value in the table appears verbatim in the cited `docs/api/*.md` (grep-based; catches transcription typos)

### Request builders (`codecs/new-standard.ts`)
- [ ] `textToVideo` body: `{ prompt, settings{resolution,aspect_ratio,duration,audio?,multi_shot?}, options{callback_url,external_task_id,watermark_info{enabled}} }`
- [ ] `imageToVideo` body: `contents[]` = `[{type:'prompt',text}, {type:'first_frame',url}, {type:'last_frame',url}?, {type:'element',element_id,id}*, {type:'voice',voice_id,id}*]`; no `aspect_ratio` in settings
- [ ] `omni` body: seven content types; `id` auto-assigned (`image_1`, `video_1`, …) when omitted; `aspect_ratio` included only when set
- [ ] `motionControl` body: `contents[]` = prompt?, `{type:'image',url}`, `{type:'video',url}`, element?; `settings{character_orientation,audio,resolution}`; no `duration`
- [ ] Undefined optional fields are **omitted**, not sent as `null` (vendor tables have no `null` semantics)
- [ ] Body deep-equals the vendor *Request Example* for each of the 11 endpoints (fixtures from `docs/api/`) **(V1)**

### Validation (`src/config/validators/video.ts`) **(V3)** — each rule has a pass and a fail test; the fail message names the field
- [ ] Model ∈ `products[<endpoint>]`
- [ ] `resolution` ∈ model×product set; `duration` ∈ model set (integer)
- [ ] `aspect_ratio` only on t2v/omni; required on omni when no `firstFrame` and no `featureVideo`/`baseVideo`
- [ ] `audio` only where the model has the field; 2.6 `native` ⇒ `1080p`
- [ ] 2.6 / 2.5-turbo `lastFrame` ⇒ `1080p`; 3.0-turbo rejects `lastFrame`; `lastFrame` without `firstFrame` rejected everywhere
- [ ] 2.6 `voices`: ≤2, requires `audio !== 'off'`, only on i2v
- [ ] `elements`: ≤3 on 3.0 i2v; ≤1 on motion-control; rejected on 2.6 / 2.5-turbo / 3.0-turbo
- [ ] 3.0-omni: `baseVideo` ⇒ no frames, `multiShot` false-or-absent, `audio !== 'native'`; `featureVideo` ⇒ `audio === 'off'`, `multiShot !== false`; ≤1 reference video; refer-image / element count matrices (App. B §2.5)
- [ ] O1: `firstFrame` with no other refs ⇒ `duration ∈ {5,10}`; multi-image elements only
- [ ] Motion-control: `characterOrientation` required; reference-video duration bound documented (≤10 s `image`, ≤30 s `video`) — **URL-only, cannot be checked client-side; message says so**
- [ ] Prompt length: 2500 default; 3072 for 3.0 / 3.0-omni / 3.0-turbo t2v (App. B §6.2 — 3.0-turbo i2v text says 2500; use 2500 for i2v)
- [ ] `@name` references in the prompt resolve to a content `id`; unresolved → **warning** via logger, not error (vendor guidance is advisory)

### Media (D12)
- [ ] `processMediaSource`: URL passthrough; local image → Base64 with existing checks tightened to the new limits (≤50 MB, ≥300 px, 1:2.5–2.5:1, jpg/jpeg/png)
- [ ] Video inputs (`featureVideo`, `baseVideo`, motion `video`): URL only; local path → `ValidationError` naming the missing upload endpoint

### Handles and queries (D5)
- [ ] Every create returns `TaskHandle { id, externalId?, product, get(), wait(opts) }`
- [ ] `tasks.get(ids | {externalIds})` → `GET /tasks?task_ids=` / `?external_task_ids=` (comma-joined; mutually exclusive)
- [ ] `tasks.list({startTime?, endTime?, cursor?, limit?, status?, productType?})` → `POST /tasks`; `limit` ≤ 500; `filters[]` built from `status`/`productType`
- [ ] **Live**: `tasks.list({limit:1})` with numeric `start_time` → 200; if 400, switch to strings and pin in a contract test; close spec §11 Q2
- [ ] `handle.wait()` polls via `pollWithSpinner` on `Task.status`; throws `KlingTaskFailedError` carrying the final `Task`

### Saver (D14)
- [ ] `save(task, dir, { includeWatermark? })` writes `outputs[].type==='video'` to `<dir>/<task.id>-<i>.mp4`; metadata sidecar carries `product`, model, `raw`
- [ ] **Opt-in live** **(V6)**: `kling video t2v -m kling-3.0-turbo -d 3 -r 720p --wait` produces a playable mp4 (≈2.4 units). Record the run's `task.id` and billing entry here: `________`

---

## Phase 3 — Image (D7, D9)

`feat(image)!: legacy-standard image generation on API-key auth with current models`

### Registry
- [ ] `IMAGE_MODELS`: `kling-v3` (generations; 1k/2k; 8 ratios), `kling-v2-1` (generations + multi-image2image; `image_reference` capable), `kling-v3-omni` (omni-image; 1k/2k/4k; `auto` ratio; series), `kling-image-o1` (omni-image; 1k/2k per capability map — validator rejects `4k` with the doc cited)
- [ ] Defaults: `generate` → `kling-v3`; `omni` → `kling-v3-omni` (§10.2); `multiImageToImage` → `kling-v2-1` (no param)

### Builders (`codecs/legacy.ts`)
- [ ] `generate`: flat body with `model_name`, `prompt`, `negative_prompt?`, `image?`, `image_reference?`, `image_fidelity?`, `human_fidelity?`, `element_list[]{element_id}`, `resolution`, `n`, `aspect_ratio`, `watermark_info?`, `callback_url?`, `external_task_id?`
- [ ] `omni`: `model_name`, `prompt`, `image_list[]{image}`, `element_list[]{element_id}`, `resolution`, `result_type`, `series_amount`, `n`, `aspect_ratio`, …
- [ ] `multiImageToImage`: `model_name: 'kling-v2-1'`, `prompt?`, `subject_image_list[]{subject_image}`, `scene_image?`, `style_image?`, `n`, `aspect_ratio`, …
- [ ] `outpaint`: `image`, four `*_expansion_ratio`, `prompt?`, `n`, …
- [ ] Bodies deep-equal the vendor *Request Example*s **(V1)**

### Validation **(V3)**
- [ ] `image_reference` / `human_fidelity` only for `kling-v2-1`; `human_fidelity` requires `image_reference === 'face'`
- [ ] `n` 1–9; omni `series_amount` 2–9 | `auto`; `result_type` enum
- [ ] `aspect_ratio` `auto` only on omni-image
- [ ] Outpaint ratios each [0,2], product ≤ 3× (`MAX_TOTAL_EXPANSION` retained)
- [ ] `subject_image_list` 1–4
- [ ] `element_list` + `image_list` ≤ 10 on omni-image (App. B §4.2)

### Queries and saver
- [ ] `handle.get()` → `GET /v1/images/<product>/{id}`; `tasks.listLegacy(product, {pageNum, pageSize})` → `GET /v1/images/<product>?pageNum&pageSize` (pageNum 1–1000, pageSize 1–500)
- [ ] Legacy list response parses into `Task[]`
- [ ] `save()` writes `outputs[].type==='image'` as `<task.id>-<index>.png`; omni `series_images[]` mapped with `groupId`
- [ ] **Opt-in live**: `kling image generate -m kling-v3 -n 1 --wait` succeeds; record `task.id`: `________`

---

## Phase 4 — Resources (D8; settled for 2.0.0)

`feat(resources): elements, voices, avatar, tts on API-key auth`

- [ ] `elements.create({ name, description, referenceType, frontalImage?, referImages?, referVideos?, voiceId?, tags?, … })` → `POST /v1/general/advanced-custom-elements` → `TaskHandle` (product `element`)
- [ ] `elements.get(id)`, `elements.list({pageNum,pageSize})`, `elements.presets()`; `elements.delete(id, { kind: 'video' | 'image' = 'video' })` → `/v1/general/delete-advanced-elements` | `/v1/general/delete-elements`
- [ ] `voices.create({ name, voiceUrl? | videoId?, … })` → `POST /v1/general/custom-voices` → `TaskHandle`; `voices.get/list/presets/delete` (list `pageSize` ≤ 1000 here)
- [ ] `avatar.create({ image, audioId? | soundFile?, prompt?, mode?, … })` — carried from `src/operations/avatar.ts` with `TaskHandle` return; validator kept (`src/config/validators/avatar.ts`)
- [ ] `audio.tts({ text, voiceId, voiceLanguage, voiceSpeed? })` → synchronous; returns `TaskOutput[]` (type `audio`) directly, not a handle
- [ ] `image.subjectCompletion({ frontalImage })` → `POST /v1/general/ai-multi-shot` → `TaskHandle`; output mapping for `images[]{index,url_1,url_2,url_3}` → three `image` outputs sharing `groupId = index`
- [ ] Contract tests for all create bodies **(V1)**
- [ ] **Live, read-only**: `voices.presets()` and `elements.presets()` return ≥1 item
- [ ] **Live, one create** (spends nothing per docs `[VERIFY]`): create one element via the video path, then `elements.list()` via… both paths are the same list endpoint — instead **delete** it via the *image* delete path and observe success/failure; close spec §11 Q7. Record result: `________`

---

## Phase 5 — Platform (D10 backoff, D16, account ledgers)

`feat(platform): billing ledgers, webhook signature verification, concurrency backoff`

- [ ] `account.usage(startTime, endTime, resourcePackName?)` → `GET /account/costs` (renamed from `getAccountInfo`; double-wrapped `data.data` envelope parsed — App. C §6)
- [ ] `account.balanceLedger({startTime?, endTime?, cursor?, limit?, apiKeyName?})` → `POST /account/billing/balance`
- [ ] `account.packageLedger({… , productType?, packageName? | packageId?})` → `POST /account/billing/package`; `packageName`/`packageId` mutually exclusive
- [ ] `verifyWebhookSignature({ id, timestamp, signature, rawBody, secret, toleranceSeconds = 300 })` — Standard Webhooks HMAC-SHA256 over `{id}.{timestamp}.{rawBody}`, key = base64-decode of secret minus `whsec_`, constant-time compare, multiple space-separated `v1,` signatures accepted
- [ ] Unit test with the vendor test vector (App. C §4d): secret `whsec_dGVzdHNlY3JldHRlc3RzZWNyZXR0ZXN0c2VjcmV0MTI=`, id `9876543210`, ts `1781080794`, body `{"id":"1234567890","status":"succeeded","message":"","create_time":1781080778802,"update_time":1781080794151}` → `v1,UsKlJP00XoQyOn410NM9xv34sP+Gl0jnOO9Lcpr7NJ4=` passes; **control:** flip one body byte → fails; ts skewed 301 s → fails
- [ ] `parseCallback(body)` → `Task` via new-standard codec when `id` present, legacy when `task_id` present; both fixtures from `docs/api/kling-get-started-callbacks.md`
- [ ] Backoff test: mocked `429 {code:1303}` then `200` → single retry after ≥1 s; mocked `1002` → no retry

---

## Phase 6 — CLI, docs, release (D15, D17, D18)

`feat(cli)!: 2.0 command tree` · `docs: rewrite README for 2.0` · release via semantic-release (`BREAKING CHANGE:` footer on the core commit drives the major)

### CLI (`src/cli/`)
- [ ] Split `src/cli.ts` (2,435 lines) into one module per command group
- [ ] Global flags: `--api-key`, `--output-dir`, `--json`, `--debug`, `-q`; removed: `--access-key`, `--secret-key`
- [ ] `video t2v|i2v|omni|motion-control` with flags mirroring D6 params; defaults `kling-3.0-turbo` / `kling-3.0-turbo` / `kling-3.0-omni` / `kling-3.0`; removed flags `--mode`, `--cfg-scale`, `--negative-prompt`, `--camera-*`, `--image-tail` (→ `--last-frame`)
- [ ] `image generate|omni|multi|outpaint`; defaults `kling-v3` / `kling-v3-omni` / (none) / (none)
- [ ] `elements`, `voices`, `avatar`, `tasks get|list`, `account credits|info|balance|packages`
- [ ] `--wait` and `--no-download` retained; `--with-watermark` added
- [ ] `test/cli.test.ts` rewritten against built `dist/cli.js`: help text has no `--access-key`; default model strings present; `kling --version` matches `package.json`

### Docs
- [ ] `README.md` rewritten: install, `KLING_API_KEY`, one example per namespace, `TaskHandle`/`Task` usage, model table (from `VIDEO_MODELS`/`IMAGE_MODELS`), migration pointer to spec §7; remove `README.md:90` link and the two coverage/test-count badges (or regenerate them)
- [ ] `grep -nE "task_id|succeed'|accessKey|secretKey|kling-v1|kling-v2-master|kling-v2-6|kling-video-o1|kling-image-o1" README.md` → 0 **(V9)** (note `kling-image-o1` legitimately appears in the image model table — allow that one line)
- [ ] `CHANGELOG.md` `## [2.0.0]`: *Removed* / *Changed* / *Added* sections transcribed from spec §7; *Changed* explicitly names the two semantics-without-signature changes: `TaskStatus` value `succeed → succeeded`, and default models
- [ ] `docs/api/README.md` refresh instructions still work (run the one-liner into a temp dir; diff is empty or explained)

### Package
- [ ] `package.json`: `version` left to semantic-release; `exports` = `.`, `./types`, `./config`; `./auth` and `./utils` removed; `engines.node >=20.0.0`; `dependencies` = `commander`, `dotenv`, `ora`
- [ ] `npm run build && npm test && npm run lint` clean
- [ ] Dead-literal census **(V7)**: `grep -rnE "kling-v1\b|kling-v1-5|kling-v1-6|kling-v2-master|kling-v2-1-master|kling-v2-5-turbo|kling-v2-6|kling-v2-new|kling-video-o1|'kling-v2'" src` → 0
- [ ] `npm pack --dry-run` **(V8)**: lists `dist/index.js`, `dist/cli.js`; no `dist/auth.*`, no `dist/api.js`
- [ ] `node -e "import('./dist/index.js').then(m=>console.log(Object.keys(m)))"` lists `KlingClient`, `KlingAPIError`, `KlingTaskFailedError`, `verifyWebhookSignature`
- [ ] Smoke script **(V5)** passes with the published-shape build
- [ ] Publish; `npm view kling-api version` → `2.0.0`; install into the multi-provider app and run one t2v end-to-end

---

## Cross-phase invariants (check at every commit)

- [ ] Nothing outside `src/codecs/` mentions `task_status`, `task_result`, `outputs`, `'succeed'`, or `data.id` — `grep -rn "task_status\|task_result\|\.outputs\b\|'succeed'\|data\.id\b" src --include='*.ts' | grep -v src/codecs/` → 0 (D3)
- [ ] No `null` is ever sent in a request body for an unset optional field
- [ ] Every vendor enum value in `src/config/models.ts` and `src/config/constants.ts` appears verbatim in a `docs/api/*.md` file (test)
- [ ] `KLING_API_KEY` is never logged in full; `redactKey` covers every log site that touches config

---

## Open items carried from the spec (§11) — close here when resolved

| Q | Closes in | Result |
|---|---|---|
| Q1 callback shape for 3.0-omni tasks | Phase 5 | `________` |
| Q2 `POST /tasks` time field type | Phase 2 | `________` |
| Q3 3.0-turbo `audio` | next `docs/api` refresh | `________` |
| Q4 omni `duration` with reference video; `shot_type` | Phase 2 (document only) | `________` |
| Q7 element delete path / shared library | Phase 4 | `________` |
| Q9 `1000` vs `1002` for a malformed key | Phase 1 smoke control | `________` |
