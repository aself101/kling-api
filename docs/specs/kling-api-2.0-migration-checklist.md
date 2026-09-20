# kling-api 2.0 — Implementation Checklist

Companion to [`kling-api-2.0-migration-spec-v0_3_0.md`](kling-api-2.0-migration-spec-v0_3_0.md). The spec holds the *why*; this file holds the *what*, in commit order, with the check that closes each item. Decision references (`D3`, `§8.4`) point into the spec; `V<n>` are the spec's §8 verification items. Tick a box only when its check has been run and observed to pass — and, where a control is listed, observed to fail on the control.

Conventions: `[ ]` open · `[x]` done · `[-]` deliberately skipped (write why inline). Each sub-phase is one commit with a ≤ 500 LOC budget (source + tests); budgets are estimates from the 1.x files being replaced and are recorded so an overrun is visible, not forbidden. Commit messages are suggested, not mandated. **Branch:** Phase 0 and 6c on `main`; 1a–6b on `release/2.0` (D19).

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
- [x] `CHANGELOG.md`: add `## [Unreleased]` at the top with the 2.0 breaking-change skeleton (Removed / Changed / Added headings, empty)

### Release automation removal (D19)
- [ ] Delete `.github/workflows/release.yml` and `.releaserc.json`
- [ ] Remove `semantic-release`, `@semantic-release/{changelog,commit-analyzer,git,github,npm,release-notes-generator}` from `devDependencies`; remove the `semantic-release` script; `npm install` regenerates the lockfile
- [ ] `ci.yml`: trigger on `pull_request` **and** `push` to `main`, `release/**`; steps lint → build → test → `tsc --noEmit`; **no** `dist/api.js` assertion (the layout changes in 1a); add `test -f dist/index.js && test -f dist/cli/index.js` only in 6c
- [ ] `npm ci && npm run lint && npm run build && npm test` green on `main` after removal (1.x still builds — nothing in `src/` changed)

### Live gate probes (`KLING_API_KEY` in env)
- [ ] **A5 write probe:** `POST /v1/images/generations` with the API Key, body `{"model_name":"kling-v3","prompt":"a red cube on white","n":1,"resolution":"1k","aspect_ratio":"1:1"}` → `code: 0`, `data.task_id` present. Poll `GET /v1/images/generations/{task_id}` to `succeed`. Record here: task_id `________`, deduction `________`. **This closes the "API Key is a superset" claim for writes; `auth.ts` is not deleted until this box is ticked.**
- [ ] If the probe returns `1002`/`1103`: **stop** — the API-Key-only design is wrong for images and D2 needs revisiting before 1a.
- [ ] Spec + checklist at v0.3.0 committed; pre-implementation pipeline re-run → PROCEED (or findings triaged into §11/§13)

---

## Phase 1a — Transport (`release/2.0`) — budget ~450 LOC

`feat(http)!: fetch transport, API-key auth, error family, retry policy`

### Remove
- [ ] Delete `src/auth.ts`; remove `./auth`, `./utils`, `./config`, `./types` from `package.json#exports` (only `"."` and `"./package.json"` remain — §5)
- [ ] Remove `jsonwebtoken`, `@types/jsonwebtoken`, `axios` from `package.json`
- [ ] Remove `getToken()` / `refreshToken()` (both `KlingAPI` and `KlingHttpClient`); delete `src/client/`
- [ ] `grep -rn "eyJ\|jsonwebtoken\|HS256\|accessKey\|secretKey\|KLING_ACCESS_KEY\|KLING_SECRET_KEY" src` → 0 **(V4)**

### Credentials (D2)
- [ ] `KlingConfig` per §6.4: `apiKey?, baseUrl?, timeout?, retry?, fetch?, unknownModels?, logger?`
- [ ] `loadApiKey(explicit?)` in `config/loaders.ts` reads `explicit ?? process.env.KLING_API_KEY` **only**; the `./.env` / `~/.kling/.env` chain moves to `src/cli/index.ts` in 6a (until then it is deleted from the library and the CLI is the 1.x one, which is broken anyway)
- [ ] Missing-key error names the constructor option, `KLING_API_KEY`, and `https://kling.ai/dev/api-key`
- [ ] `.env.example` → `KLING_API_KEY=`

### `http/errors.ts` (D10)
- [ ] Error family exactly as D10: `KlingError`, `KlingAPIError{code,httpStatus,isRetryable()}`, `KlingNetworkError{cause}`, `KlingTimeoutError{deadlineMs}`, `KlingResponseError{httpStatus,bodySnippet}`, `KlingCodecError{standard,path}`, `KlingValidationError{field}` (replaces `ValidationError`), `KlingTaskFailedError{task,code}`, `KlingPollTimeoutError{task,elapsedMs}`, `KlingNoOutputsError{task}`, `KlingOutputsExpiredError{task}`
- [ ] `ERROR_CODES` = the 24-row vendor table (App. C §2); names from the *Explanation* column; `1003`/`1004` present and commented "unreachable without AK/SK"
- [ ] `isRetryable()`: `1302`, `1303`, `5000`, `5001`, `5002` or `httpStatus ∈ {429,502,503,504}` → true; else false. Test: `1002` → false; `1303` → true
- [ ] Constructing `KlingAPIError` from `{"code":1303,"message":"…","request_id":"…"}` (no `data`) does not throw

### `http/core.ts` (D10, D11)
- [ ] `HttpCore.request({ method, path, query?, body?, signal?, kind: 'read' | 'write' })`
- [ ] `fetch` = `config.fetch ?? globalThis.fetch`; `Authorization: Bearer <apiKey>` and `Content-Type: application/json` on every request; base URL must start with `https://` (else `KlingValidationError`)
- [ ] `redirect: 'error'` on API calls
- [ ] Deadline: one `AbortController` per attempt, `timeout` default 30 000 ms, **covers body read** — test with a fake fetch whose body stream stalls → `KlingTimeoutError`
- [ ] Caller `signal` is chained; caller abort surfaces as the caller's `AbortError`, not wrapped
- [ ] Non-JSON body → `KlingResponseError` with first 200 bytes; JSON with `code !== 0` → `KlingAPIError`; fetch `TypeError` → `KlingNetworkError`
- [ ] **Retry (V11):** `kind: 'read'` retries on `KlingNetworkError`, `KlingTimeoutError`, HTTP 429/502/503/504, retryable business codes; backoff `baseDelayMs * 2^attempt` (default 1 000 ms, cap `maxDelayMs` 30 000, `maxAttempts` 3). `kind: 'write'` retries **only** on `KlingNetworkError` whose `cause.code ∈ {ENOTFOUND, ECONNREFUSED}`; never after any response; never on `ECONNRESET`/timeout
- [ ] Tests: read `1303`→`200` = 2 fetch calls, ≥1 s apart (fake timers); write `1303` = 1 call, throws `KlingAPIError` with `isRetryable() === true`; write `ECONNRESET` mid-body = 1 call, throws `KlingNetworkError`; write `ECONNREFUSED` = retried
- [ ] `madge` added to devDependencies; `npm run check:cycles` = `madge --circular --extensions ts src` in `ci.yml` **(V12)**

### Smoke (`scripts/smoke.mjs`) **(V5)**
- [ ] Uses the new core (`import { KlingClient } from '../dist/index.js'`) — `tasks.get('0')`, `tasks.list({limit:1})`, `account.usage(now-1h, now)`, `voices.presets()` (stub the last two as raw `request()` calls until Phases 4a/5 exist) → all `code: 0`
- [ ] Control: `new KlingClient({ apiKey: 'garbage' }).tasks.get('0')` → `KlingAPIError` with `httpStatus 401`; record `code` here: `________` (closes §11 Q9 for garbage keys)
- [ ] Exit 1 on any expected-success failure or on the control succeeding

---

## Phase 1b — Task model + codec parsers — budget ~480 LOC

`feat(codecs)!: normalized Task and parsers for both vendor standards`

### `codecs/task.ts` (types only — D4, D5)
- [ ] `TaskStatus`, `Standard`, `Product`, `LegacyProduct`, `Task` (with `standard`, `product?`, `outputsExpireAt?`, `raw`), `TaskOutput` union, `BillingEntry`, `TaskHandle` interface (with `request`), `RequestOptions{signal?}`, `WaitOptions{intervalMs?, deadlineMs?, signal?}` — exactly §6/D4/D5
- [ ] File imports nothing from `src/` (import-graph rule §5)

### `codecs/new-standard.ts` parsers
- [ ] `parseCreate(json) → Task` from `data.{id,status,create_time,update_time,external_id}`; `standard: 'new'`; `product` from the caller
- [ ] `parseTasks(json) → Task[]` from `GET /tasks` `data[]` incl. `outputs[]` (video `duration` string → `durationSeconds` number; image `group_id`; audio `mp3_url`…; element `references[]`; voice) and `billing[]` → `BillingEntry[]`
- [ ] `parseCursor(json) → { tasks, count, nextCursor, hasMore }` from `data.result[]`
- [ ] `outputsExpireAt = updatedAt + 30 * 86_400_000` when `status === 'succeeded'`
- [ ] Unknown `status` string → `KlingCodecError` **(V2)**; `create_time` outside `(1.6e12, 4e12)` → `KlingCodecError` (§11 Q12)

### `codecs/legacy.ts` parsers
- [ ] `parseCreate(json)` from `data.{task_id,task_status,task_info.external_task_id,created_at,updated_at}`; `standard: 'legacy'`
- [ ] `parseTask(json)` adds `task_status_msg → message`, `task_result.{videos,images,audios,elements,voices}[] → outputs[]`, `final_unit_deduction`/`final_balance_deduction → billing?`
- [ ] `parseList(json) → Task[]` from `data[]`
- [ ] `succeed → succeeded`; `url_mp3/url_wav/duration_mp3/duration_wav` → camelCase; omni-image `series_images[]` → `image` outputs with `groupId`; ai-multi-shot `images[]{index,url_1,url_2,url_3}` → three `image` outputs with `groupId = String(index)`
- [ ] Same status and timestamp guards as new-standard

### Fixtures and tests **(V1 parse half)**
- [ ] `test/fixtures/<doc-file>/<section>.json` copied verbatim from every *Response Example* the parsers consume (header comment: source path + line); 3.0-turbo t2v create, `GET /tasks`, `POST /tasks`; legacy image generate create/query/list; avatar query; element/voice list; callback bodies (both shapes)
- [ ] Table test: each fixture → expected `Task` (snapshot the normalized object)
- [ ] **Control:** every legacy fixture into `newStandard.parseTask*` → `KlingCodecError`; every new fixture into `legacy.parse*` → `KlingCodecError`

---

## Phase 2a — Video t2v / i2v + task handles — budget ~500 LOC

`feat(video)!: text-to-video, image-to-video, TaskHandle, unified task queries`

### `products/tasks.ts` (D5)
- [ ] Product → path table: new-standard products → `/tasks`; legacy → `/v1/images/generations`, `/v1/images/omni-image`, `/v1/images/multi-image2image`, `/v1/images/editing/expand`, `/v1/general/ai-multi-shot`, `/v1/videos/avatar/image2video`, `/v1/general/advanced-custom-elements`, `/v1/general/custom-voices`
- [ ] `createHandle(core, product, id, request, externalId?) → TaskHandle`; `get()` routes by product; `wait()` shares one in-flight poll promise across concurrent callers (test: two `wait()` calls → one poll loop, both resolve)
- [ ] `wait()` → `KlingTaskFailedError` on `failed` (with `task`, `code` = vendor code or `null`); `KlingPollTimeoutError` on deadline; caller abort → `AbortError`
- [ ] `tasks.get(ids, { byExternalId?, signal? })` chunks at 50 → concatenated `Task[]`; ids joined by comma; `task_ids` and `external_task_ids` never both sent
- [ ] `tasks.list({...})` → `POST /tasks`; `limit ≤ 500`; `filters[]` from `status`/`productType`; **live:** numeric `start_time` → if 400, switch to strings; pin in a contract test; record result in §11 Q2: `________`
- [ ] `tasks.getByProduct(product, id)`, `tasks.listByProduct(product, {pageNum, pageSize})` (pageNum 1–1000, pageSize 1–500), `tasks.handle(product, id, request?)`
- [ ] **Live:** `tasks.get` with 100 ids → record whether 200 or 4xx (§11 Q13): `________`
- [ ] `healthCheck()` = `tasks.get('0')` resolves → `true`; any throw → `false`

### `handlers/poller.ts` (D13)
- [ ] `poll(fn, { intervalMs = 3000, deadlineMs = 900_000, signal })` — no TTY output; tests with fake timers for interval, deadline, abort

### `products/video.ts` + `codecs/new-standard.ts` builders
- [ ] `buildTextToVideo(params)` → `{ prompt, settings{resolution,aspect_ratio,duration,audio?,multi_shot?}, options{callback_url?,external_task_id?,watermark_info?{enabled}} }`; unset optionals **omitted** (never `null`)
- [ ] `buildImageToVideo(params)` → `contents[]` = `[{type:'prompt',text}, {type:'first_frame',url}, {type:'last_frame',url}?, {type:'element',element_id,id}*, {type:'voice',voice_id,id}*]`; `settings` without `aspect_ratio`
- [ ] `video.textToVideo` / `video.imageToVideo` → `POST /<product>/<model>` with `kind: 'write'` → `TaskHandle` (product set, `request` = normalized params)
- [ ] Default model `kling-3.0-turbo` for both
- [ ] **(V1 build half)** built body deep-equals the vendor *Request Example* for 3.0-turbo, 3.0, 2.6, 2.5-turbo t2v and i2v (8 fixtures) given the example's inputs

### `config/models.ts` + validators (D9) **(V3)**
- [ ] `VIDEO_MODELS` for the six ids per spec §2.2, each row commented with its `docs/api/` source
- [ ] Test: every enum value in the table appears verbatim in the cited doc file (grep-based)
- [ ] `model` typing `KnownVideoModel | (string & {})`; unknown id + `unknownModels: 'passthrough'` (default) → logger warning, shape-only validation, request built; `'reject'` → `KlingValidationError`
- [ ] Rules for t2v/i2v, each with pass + fail test, fail message naming the field: model ∈ products; `resolution` ∈ model×product set; `duration` integer ∈ model set; `aspectRatio` t2v only; `audio` only where the model has the field; 2.6 `native` ⇒ `1080p`; 2.6/2.5-turbo `lastFrame` ⇒ `1080p`; 3.0-turbo rejects `lastFrame`; `lastFrame` without `firstFrame` rejected; 2.6 `voices` ≤2, `audio !== 'off'`, i2v only; `elements` ≤3 on 3.0 i2v, rejected on 2.6/2.5-turbo/3.0-turbo; prompt ≤ 3072 (3.0, 3.0-turbo t2v) / 2500 (else)
- [ ] `@name` in prompt with no matching content `id` → logger **warning**, not error

### Live (opt-in, spends units)
- [ ] **V6:** `kling video t2v -m kling-3.0-turbo -d 3 -r 720p --wait` (via a temporary script until 6a) → `succeeded`, one `video` output. Record `task.id` `________`, billing `________`
- [ ] **§11 Q11:** submit the same `externalTaskId` twice (cheapest t2v) → record second response: `________`

---

## Phase 2b — Video omni + motion-control — budget ~420 LOC

`feat(video): omni-video and motion-control`

- [ ] `buildOmni(params)` → seven content types; auto `id`s (`image_1`, `video_1`, element name) when omitted; `settings.aspect_ratio` only when set
- [ ] `buildMotionControl(params)` → `contents[]` prompt?, `{type:'image',url}`, `{type:'video',url}`, element?; `settings{character_orientation,audio,resolution}`; no `duration`
- [ ] `video.omni` (default `kling-3.0-omni`), `video.motionControl` (default `kling-3.0`)
- [ ] **(V1)** body deep-equals vendor examples: `/omni-video/kling-3.0-omni` (t2v, first-frame, feature_video, base_video examples), `/omni-video/kling-o1`, `/motion-control/kling-3.0`, `/motion-control/kling-2.6`
- [ ] **(V3)** rules with pass/fail tests: omni `aspectRatio` required when no `firstFrame` and no reference video; 3.0-omni `baseVideo` ⇒ no frames, `multiShot` not `true`, `audio !== 'native'`; `featureVideo` ⇒ `audio === 'off'`, `multiShot !== false`; ≤1 reference video; refer-image + element count matrices (App. B §2.5, each cell a test); O1: multi-image elements only, `firstFrame` with no other refs ⇒ `duration ∈ {5,10}`, ref video 3–10 s (message: uncheckable client-side); motion: `characterOrientation` required, `element` 3.0 only ≤1, `video` must be `{url}`/https string, ref-video duration bound stated in the message as uncheckable; 3.0 motion excludes `4k`
- [ ] **V10 opt-in:** `video.omni` first-frame-only with a hosted image → `succeeded`. Record: `________`

---

## Phase 2c — Media sources + download + save — budget ~400 LOC

`feat(media)!: explicit MediaSource, fetch-based downloads with byte/redirect/SSRF guards`

### `media/source.ts` (D12)
- [ ] `resolveMediaSource(src: MediaSource, { kind: 'image' | 'video' | 'audio' }) → { url } | { base64 }`
- [ ] Bare string: `https://…` → `{url}`; Base64 (charset check, optional `data:` prefix stripped) → `{base64}`; **anything else → `KlingValidationError`** — never `existsSync`. Test: a string that is a real path on disk → throws
- [ ] `{ path }` / `Buffer` / `Uint8Array`: read, check extension (`jpg/jpeg/png` for images), magic bytes, ≥300 px, ratio 1:2.5–2.5:1, ≤ 20 MB → `{base64}`; over 20 MB → `KlingValidationError` naming the cap and why (JSON inflation)
- [ ] `kind: 'video'` accepts only `https` string or `{url}`; else `KlingValidationError('… must be a URL; the Kling API has no upload endpoint')`
- [ ] Delete `src/utils/media.ts` (`imageToBase64`, `audioToBase64`, `processMediaSource`) after porting the checks

### `media/download.ts` (D12)
- [ ] `fetchToBuffer(url, { maxBytes, maxRedirects = MAX_REDIRECTS, timeoutMs, signal, fetch })`
- [ ] `redirect: 'manual'` loop; **`validateUrl` on the initial URL and on every `Location`** (test: first hop public, second hop `http://127.0.0.1` → throws before the second fetch)
- [ ] Stream the body; abort and throw `KlingValidationError` (or a dedicated `KlingDownloadTooLargeError` if cleaner) once `maxBytes` is exceeded (test: fake stream of `maxBytes + 1`)
- [ ] `> maxRedirects` → throws (test)
- [ ] Delete `src/utils/downloads.ts`

### `handlers/saver.ts` (D14)
- [ ] `save(task, dir, { includeWatermark?, signal? }) → string[]`
- [ ] `KlingOutputsExpiredError` when `outputsExpireAt < Date.now()` — thrown before any fetch (test with a synthetic task)
- [ ] `KlingNoOutputsError` when `status === 'succeeded'` and `outputs.length === 0`
- [ ] Filename `<task.id>-<index>.<ext>`; `ext` from `Content-Type` → URL extension → `bin` (tests for each branch)
- [ ] Sidecar `<task.id>.json`: `{ product, standard, request, outputs, raw }`
- [ ] Watermarked variants only with `includeWatermark`
- [ ] Live (opt-in): `save()` on the V6 task writes a playable mp4

---

## Phase 3a — Image generate + omni — budget ~420 LOC

`feat(image)!: image generation and omni-image on the legacy standard`

- [ ] `IMAGE_MODELS`: `kling-v3` (generations; `1k|2k`; 8 ratios), `kling-v2-1` (generations + multi-image2image; `imageReference`-capable), `kling-v3-omni` (omni-image; `1k|2k|4k`; `auto`; series), `kling-image-o1` (omni-image; `1k|2k` per capability map — `4k` rejected with the doc cited); each row commented with source
- [ ] `legacy.buildGenerate(params)` → flat body `{ model_name, prompt, negative_prompt?, image?, image_reference?, image_fidelity?, human_fidelity?, element_list[]{element_id}, resolution, n, aspect_ratio, watermark_info?, callback_url?, external_task_id? }`
- [ ] `legacy.buildOmniImage(params)` → `{ model_name, prompt, image_list[]{image}, element_list[]{element_id}, resolution, result_type, series_amount, n, aspect_ratio, … }`
- [ ] `image.generate` (default `kling-v3`), `image.omni` (default `kling-v3-omni`) → `POST /v1/images/…` `kind: 'write'` → `TaskHandle` (`standard: 'legacy'`)
- [ ] **(V1)** bodies deep-equal the vendor *Request Example*s in `kling-image-2.1-generation.md` and `kling-image-o1-generation.md`
- [ ] **(V3)** rules: `imageReference`/`humanFidelity` with model ≠ `kling-v2-1` → **error**; `humanFidelity` with `imageReference !== 'subject'` → **warning** (vendor: "only takes effect when … subject"); `imageFidelity`/`humanFidelity` ∈ [0,1]; `n` 1–9; `resolution` per model; `aspectRatio` `auto` only on omni; `seriesAmount` 2–9|`auto`, only with `resultType: 'series'`; `images.length + elements.length ≤ 10` on omni
- [ ] Unknown `model_name` passthrough/reject per `unknownModels`
- [ ] **V10 opt-in:** `image.generate({ prompt, n: 1 })` → `succeeded`, one `image` output (the Phase 0 probe task may be reused as first evidence via `tasks.getByProduct('image-generation', id)`). Record: `________`

---

## Phase 3b — Image multi / outpaint / subject-completion — budget ~300 LOC

`feat(image): multi-image-to-image, outpainting, subject completion`

- [ ] `legacy.buildMultiImageToImage` → `{ model_name: 'kling-v2-1', prompt?, subject_image_list[]{subject_image}, scene_image?, style_image?, n, aspect_ratio, … }`; `subjectImages` 1–4
- [ ] `legacy.buildOutpaint` → `{ image, up_expansion_ratio, down_…, left_…, right_…, prompt?, n, … }`; each ratio ∈ [0,2]; `(1+up+down)*(1+left+right) ≤ 3` (retain `MAX_TOTAL_EXPANSION`)
- [ ] `legacy.buildSubjectCompletion` → `{ element_frontal_image, callback_url?, external_task_id? }`
- [ ] `image.multiImageToImage`, `image.outpaint`, `image.subjectCompletion` → `TaskHandle`
- [ ] **(V1)** bodies deep-equal vendor examples (`kling-image-2.1-multi-image-to-image.md`, `kling-image-common-outpainting.md`, `kling-image-common-subject-completion.md`)
- [ ] `tasks.listByProduct` for all five image products parses via `legacy.parseList` (fixture per product where the doc has a list example)

---

## Phase 4a — Elements + voices — budget ~450 LOC

`feat(resources): element and voice management`

- [ ] **First item:** write §6.3 types for elements/voices from App. C §7.9/§7.10, review each field against the vendor table before any code
- [ ] `elements.create({ name, description, referenceType, frontalImage?, referImages?, referVideos?, voiceId?, tags?, … })` → `POST /v1/general/advanced-custom-elements` → `TaskHandle` (product `element`); image inputs via `resolveMediaSource`, videos URL-only
- [ ] `elements.get(id)`, `elements.list({pageNum,pageSize})`, `elements.presets()` → `Task`/`Task[]` with `element` outputs
- [ ] `elements.delete(id, { kind = 'video' })` → `/v1/general/delete-advanced-elements` | `/v1/general/delete-elements`; `kind: 'write'`
- [ ] `voices.create({ name, voiceUrl? | videoId?, … })` (exactly one of the two) → `POST /v1/general/custom-voices` → `TaskHandle`; `voices.get/list/presets/delete` (list `pageSize ≤ 1000`)
- [ ] **(V1)** contract tests for all create/delete bodies
- [ ] **Live, read-only:** `voices.presets()` and `elements.presets()` each return ≥1 output
- [ ] **§11 Q7 probe (spends an element create):** create one element via the video path; delete it via `kind: 'image'`; record whether delete returns `code: 0`: `________`

---

## Phase 4b — Avatar + TTS — budget ~250 LOC

`feat(resources): avatar and text-to-speech`

- [ ] `avatar.create({ image, audioId? | soundFile?, prompt?, mode?, … })` ported from `src/operations/avatar.ts` + `validators/avatar.ts`; `soundFile` via `resolveMediaSource(kind:'audio')` (≤ 5 MB, `mp3/wav/m4a/aac`); → `TaskHandle` (product `avatar`)
- [ ] `audio.tts({ text, voiceId, voiceLanguage, voiceSpeed? })` → `POST /v1/audio/tts` synchronous → `TaskOutput[]` (type `audio`); `text ≤ 1000`; `voiceSpeed ∈ [0.8, 2.0]`
- [ ] **(V1)** contract tests

---

## Phase 5 — Platform — budget ~350 LOC

`feat(platform): account ledgers, webhook signature verification, callback parsing`

- [ ] `account.usage(startTime, endTime, resourcePackName?)` → `GET /account/costs` (`kind: 'read'`); parse the double envelope (`data.code`, `data.msg`, `data.resource_pack_subscribe_infos[]`)
- [ ] `account.balanceLedger({ startTime?, endTime?, cursor?, limit?, apiKeyName? })` → `POST /account/billing/balance` (`kind: 'read'`)
- [ ] `account.packageLedger({ …, productType?, packageName? | packageId? })` → `POST /account/billing/package`; `packageName`/`packageId` mutually exclusive (test)
- [ ] `verifyWebhookSignature({ id, timestamp, signature, rawBody, secret, toleranceSeconds = 300 })` — HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`, key = base64-decode(secret without `whsec_`), constant-time compare, accepts multiple space-separated `v1,` signatures
- [ ] **(V13)** vendor vector passes: secret `whsec_dGVzdHNlY3JldHRlc3RzZWNyZXR0ZXN0c2VjcmV0MTI=`, id `9876543210`, ts `1781080794`, body `{"id":"1234567890","status":"succeeded","message":"","create_time":1781080778802,"update_time":1781080794151}` → `v1,UsKlJP00XoQyOn410NM9xv34sP+Gl0jnOO9Lcpr7NJ4=`; **controls:** one body byte flipped → false; ts skewed 301 s → false
- [ ] `parseCallback(rawBody, headers?, secret?) → { task, verified: boolean | null }` — `id` present → new codec, `task_id` present → legacy codec; `verified` null (no secret) / false (no or bad headers) / true
- [ ] Fixtures: both callback body shapes from `kling-get-started-callbacks.md`
- [ ] **§11 Q1 (if a receiver is available):** trigger one 3.0-omni task with `callbackUrl`; record body shape and whether signature headers arrived: `________`

---

## Phase 6a — CLI video + image — budget ~500 LOC

`feat(cli)!: 2.0 command tree — video and image`

- [ ] `src/cli/index.ts`: commander program; global `--api-key`, `--output-dir`, `--json`, `--debug`, `-q`; credential chain `--api-key` → `KLING_API_KEY` → `./.env` → `~/.kling/.env` (dotenv lives **here** only); spinner (`ora`) around `wait()` unless `--json`/`-q`
- [ ] `cli/video.ts`: `t2v | i2v | omni | motion-control`; flags mirror §6.1 in kebab-case (`--first-frame`, `--last-frame`, `--refer-image` (repeatable), `--feature-video`, `--base-video`, `--element id:alias` (repeatable), `--voice`, `--character-orientation`, `--audio`, `--multi-shot/--no-multi-shot`, `-r/--resolution`, `-a/--aspect-ratio`, `-d/--duration`, `-m/--model`); file arguments are wrapped as `{ path }` by the CLI; `--wait`, `--no-download`, `--with-watermark`, `--callback-url`, `--external-task-id`
- [ ] `cli/image.ts`: `generate | omni | multi | outpaint | subject-completion`
- [ ] Defaults printed in `--help`: `kling-3.0-turbo` (t2v, i2v), `kling-3.0-omni` (omni), `kling-3.0` (motion), `kling-v3` (generate), `kling-v3-omni` (omni image)
- [ ] Removed flags absent from help: `--access-key`, `--secret-key`, `--mode`, `--cfg-scale`, `--negative-prompt` (video), `--camera-*`, `--image-tail`
- [ ] Delete `src/cli.ts`; `bin.kling` → `dist/cli/index.js`
- [ ] `test/cli.test.ts` rewritten against built `dist/cli/index.js`: help contents, defaults, required-option errors, no dead flags

---

## Phase 6b — CLI resources / tasks / account — budget ~400 LOC

`feat(cli): elements, voices, avatar, audio, tasks, account`

- [ ] `cli/resources.ts`: `elements create|get|list|presets|delete [--kind]`, `voices …`, `avatar create`, `audio tts`
- [ ] `cli/tasks.ts`: `tasks get <ids…> [--by-external-id]`, `tasks list [--cursor] [--status] [--product-type] [--limit]`, `tasks get-by-product <product> <id>`
- [ ] `cli/account.ts`: `account usage [--days 30]`, `account balance`, `account packages`
- [ ] CLI tests extended

---

## Phase 6c — Docs, package, merge, publish (`main`) — no LOC budget (docs)

`docs(kling-api)!: 2.0 README and CHANGELOG` · `chore(release): 2.0.0` (manual)

### Docs
- [ ] `README.md` rewritten: install; `KLING_API_KEY`; one example per namespace; `TaskHandle`/`Task` usage; `MediaSource` rules (string is URL/Base64, `{ path }` for files); model tables generated from `VIDEO_MODELS`/`IMAGE_MODELS`; **default-model policy stated** (video cheapest current-gen, image newest — D6); fetch parity notes (no env proxy; `fetch` injection); migration pointer to spec §7; ToC with unique headings
- [ ] `grep -nE "task_id|succeed'|accessKey|secretKey|kling-v1\b|kling-v2-master|kling-v2-6|kling-video-o1" README.md` → 0 **(V9)**; `kling-image-o1` appears only in the image model table
- [ ] `CHANGELOG.md`: `## [Unreleased]` → `## [2.0.0] - <date>`; *Removed* / *Changed* / *Added* transcribed from spec §7; *Changed* names the semantics-without-signature items: `TaskStatus` `succeed → succeeded`, default models + policy, string `MediaSource` no longer a path, `outputsExpireAt`
- [ ] `docs/api/README.md` refresh one-liner run into a temp dir; diff empty or every difference explained

### Package
- [ ] `package.json`: `version: "2.0.0"` (by hand); `main`/`types` → `dist/index.*`; `exports` = `"."`, `"./package.json"`; `bin.kling` → `dist/cli/index.js`; `engines.node >=20.0.0`; `dependencies` = `commander`, `dotenv`, `ora`; `devDependencies` gains `madge`, loses semantic-release; `files` = `dist`, `README.md`, `CHANGELOG.md`, `LICENSE`
- [ ] `ci.yml`: add `test -f dist/index.js && test -f dist/cli/index.js`
- [ ] Merge `release/2.0` → `main` locally; `git pull --ff-only origin main` is a no-op; `npm ci && npm run lint && npm run build && npm test && npm run check:cycles && npx tsc --noEmit` on the **merged** tree
- [ ] **(V7)** `grep -rnE "kling-v1\b|kling-v1-5|kling-v1-6|kling-v2-master|kling-v2-1-master|kling-v2-5-turbo|kling-v2-6|kling-v2-new|kling-video-o1|'kling-v2'" src` → 0
- [ ] **(V8)** `npm pack --dry-run` lists `dist/index.js`, `dist/cli/index.js`; no `dist/auth.*`, `dist/api.js`, `dist/cli.js`; `node -e "import('./dist/index.js').then(m=>console.log(Object.keys(m).sort().join('\n')))"` prints every value export in spec §6.4
- [ ] **(V5)** smoke script passes against `dist/`
- [ ] Push `main`; `npm publish` (Alex); `npm view kling-api version` → `2.0.0`
- [ ] Install into a consumer; one `video.textToVideo` end-to-end

---

## Cross-phase invariants (check at every commit)

- [ ] Nothing outside `src/codecs/` reads a vendor-spelled field: `grep -rnE "task_status|task_result|task_status_msg|'succeed'|create_time|update_time|external_task_id|data\.id\b" src --include='*.ts' | grep -v '^src/codecs/'` → 0 (D3; `outputs`, `status`, `externalId` are normalized names and are allowed anywhere)
- [ ] No `null` sent for an unset optional body field (builder tests assert absence, not `null`)
- [ ] Every vendor enum value in `config/models.ts` / `config/constants.ts` appears verbatim in a `docs/api/*.md` file (test)
- [ ] `KLING_API_KEY` never logged in full; `redactKey` at every log site touching config
- [ ] `madge --circular` clean; `no-restricted-paths` per spec §5 clean
- [ ] Writes (`kind: 'write'`) are never retried after a response — the V11 tests stay green

---

## Open items carried from the spec (§11) — close here when resolved

| Q | Closes in | Result |
|---|---|---|
| Q1 callback shape / signing for 3.0-omni | Phase 5 | `________` |
| Q2 `POST /tasks` time field type | Phase 2a | `________` |
| Q3 3.0-turbo `audio` | resolved v0.3.0 | always on (pricing table) |
| Q4 omni `duration` with reference video; `shot_type` | Phase 2b (document only) | `________` |
| Q7 element delete path / shared library | Phase 4a | `________` |
| Q9 code for a garbage key; revoked key | Phase 1a smoke control | `________` |
| Q11 `external_task_id` idempotency | Phase 2a | `________` |
| Q12 legacy image timestamps ms | Phase 1b fixtures | `________` |
| Q13 `/tasks` id cap | Phase 2a | `________` |
| A5 API Key on legacy writes | **Phase 0 gate** | `________` |
