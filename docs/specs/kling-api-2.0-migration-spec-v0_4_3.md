# kling-api 2.0 — Migration Specification

| | |
|---|---|
| **Version** | v0.4.3 (approved for implementation; Phase 0 in progress — live findings folded in) |
| **Date** | 2026-09-20 |
| **Target repo** | `kling-api` (`misc/npm-packages/kling-api`, published as `kling-api` on npm) |
| **From → To** | `1.0.0` (2025-12-27, `264da22`) → `2.0.0` |
| **Decision owner** | Alex |
| **Settled decisions** | Major bump; API Key is the only credential; JWT (AccessKey/SecretKey) removed; full reboot of the public surface rather than an incremental patch. Default video model `kling-3.0-turbo` *(re-confirmed §10.11 on the corrected premise: cheapest current-gen with native audio)*; default omni-image `kling-v3-omni`; native `fetch` replaces axios; `engines.node >=20`; elements/voices/avatar/TTS ship in 2.0.0. **semantic-release removed; publishing is manual.** *(Alex, 2026-09-20.)* |
| **Companion** | [Implementation checklist](kling-api-2.0-migration-checklist.md) — sub-phase work items, LOC budgets, and the check that closes each |
| **Appendices** | [A — v1 surface map](appendices/A-v1-surface-map.md) · [B — new-standard contracts](appendices/B-new-standard-contracts.md) · [C — legacy and platform contracts](appendices/C-legacy-and-platform-contracts.md) |
| **Review record** | Tracker project `kling-api`, pre-implementation runs (2026-09-20): **#1** architect 65 REVISE · excavator 80 · docs 69 (49 findings); **#2** on v0.3.0: architect 79 REVISE · excavator 83 · docs 83 DOCUMENTED (39 findings); **#3** on v0.4.0: architect 86 **PROCEED** · excavator 79 · docs 93 · anxiety-reader 86 CONFIDENCE_WARRANTED · synthesis 84 INTEGRATED — all gates passed (59 findings). §13 maps every finding of all three runs to where it is answered. |
| **Vendor source** | `docs/api/*.md` — 50 pages fetched 2026-09-20 from the URLs in `https://kling.ai/document-api/llms.txt` (all of *Docs*, *Video APIs*, *Image APIs*, *Assets & Billing*, *Updates*, *Pricing* (base), plus `effects/video-effects`; the four e-commerce pages and the two solutions-pricing pages were not fetched) |

Every `file:line` below was verified against the working tree on 2026-09-20 (the architect re-verified 14/14 sampled). Claims about the vendor API are cited to a file under `docs/api/`; claims marked **[LIVE]** were confirmed by an HTTP call from this machine on 2026-09-20 against `https://api-singapore.klingai.com` (§1.2). Claims marked `[VERIFY]` could not be discharged from the docs or a read-only probe and are collected in §11.

---

## 0. Summary

The library's first live call in nine months failed with

> `The model 'kling-v1' has been discontinued and is no longer available.`

Investigation found the model error is the smallest of four changes:

1. **Authentication moved.** New-design endpoints accept only a static **API Key** bearer token and reject the JWT built from AccessKey/SecretKey with `401 / code 1002` **[LIVE]**. The API Key also authenticates every legacy endpoint tested — three reads on 2026-09-20 and, at the Phase 0 gate, **one paid write per legacy family 2.0 ships (image generate, TTS, voice create, element create, avatar create) [LIVE 2026-09-20/21]**. The superset claim is discharged for writes; `auth.ts` may go at 2a₀.
2. **Video moved to a new API design standard.** Model version is in the URL path (`POST /text-to-video/kling-3.0-turbo`), the body nests `settings`/`options` with a typed `contents[]` array, tasks are queried through a unified `GET /tasks?task_ids=` / `POST /tasks` (cursor), the response carries `data.id` / `data.status` / `outputs[]`, and the terminal status is spelled **`succeeded`**. All 14 video pages in the vendor index are on this standard (App. B §1).
3. **Image did not move.** All 7 image pages — including the current-generation `kling-v3` and `kling-v3-omni` — remain on legacy `/v1/images/...` paths with `model_name` in the body, `data.task_id` / `task_status` / `task_result.images[]`, and terminal status spelled **`succeed`** (App. B §1, §3.6). There is no new-standard image endpoint anywhere in the vendor index.
4. **The model registry is dead.** Of the 12 model literals the library ships (App. A §3), **two** still appear in a vendor enum — `kling-v2-1` (image generation, multi-image-to-image) and `kling-image-o1` (omni-image). The vendor's update log records no discontinuation for any of the twelve (App. C §5c); models are being gated server-side without a published sunset list. The corollary shapes D9: a registry that *rejects* unknown ids would recreate this failure in the other direction the next time the vendor ships a model.

2.0 is therefore a **two-standard client under one credential**: one HTTP core, an API Key, two request/response codecs, and a normalized `Task` model that hides the `succeed`/`succeeded` and `task_result`/`outputs` split from consumers — while the query surface still has to know which standard a task id belongs to (D5).

---

## 1. Evidence

### 1.1 Trigger

```text
$ kling video t2v --prompt "an astronaut arrives at a new planet ..." --wait
[INFO] Model: kling-v1
[ERROR] Generation failed: The model 'kling-v1' has been discontinued and is no longer available.
```

`kling-v1` is the default for `textToVideo` (`src/operations/video.ts:44`), `imageToVideo` (`:103`), `generateImage` (`src/operations/image.ts:42`), and the CLI `t2v`/`i2v`/`image generate` commands (`src/cli.ts:2079,2114,2232`). The request *reached the model gate* — the legacy endpoint, path, body shape, and JWT all still worked. Only the model name failed. That is the fact that makes the legacy transport reusable for images.

### 1.2 Live probes (read-only, 2026-09-20)

Signing done with Node `crypto` (HS256, `iss`/`exp`/`nbf` exactly as `src/auth.ts:83-107`); API Key from `KLING_API_KEY`.

| Call | JWT (AK/SK) | API Key |
|---|---|---|
| `GET /account/costs?start_time&end_time` (legacy) | 200 | 200 |
| `GET /v1/videos/text2video?pageNum=1&pageSize=1` (legacy list) | 200, `task_status: "succeed"` | 200 |
| `GET /v1/general/presets-voices` (legacy) | — | 200 |
| `GET /tasks?task_ids=1` (new) | **401** `{"code":1002,"message":"Authentication error. The current API does not support AK/SK; please go to the console (https://kling.ai/dev/api-key) to create API key."}` | 200, `data: []` |
| `POST /tasks {"limit":2}` (new, cursor) | **401** code 1002 | 200, `data: {count: 0, has_more: false}` |

The 200 on `/v1/videos/text2video` returned the 2025-12-27 task, so the legacy surface is live and retains history; it is models, not paths, that are being retired. **All three legacy probes are reads.** No write endpoint has been exercised with the API Key; the auth page's heading `### API Key (for all models)` and the 06/17/2026 update *"Fully compatible with existing models"* (App. C §1, §5a) are the only evidence for writes, and code `1103` *"Unauthorized access to requested resource, such as API/model"* shows per-resource authorization exists. Phase 0 discharges this with one paid legacy image create before `auth.ts` is deleted (§9).

### 1.3 Vendor statements that bound the design

- Auth page: `### API Key (for all models)` vs `### Access Key / Secret Key (API only applicable to legacy version design standards)` — *"The model version information located in the path is the new version, while the value set as the model_name parameter is the legacy version."* (`docs/api/kling-get-started-authentication.md`; App. C §1)
- Updates, 06/17/2026: *"The new API supports authentication via API Key only. Please migrate as soon as possible."* and *"Authentication can now be completed using only an API Key … Fully compatible with existing models and can be used alongside AK/SK authentication."* (App. C §5a)
- Updates, 07/15/2026: new API generalized to Kling 3.0, 3.0 Omni, 3.0 Motion Control, 2.6, 2.6 Motion Control, 2.5 Turbo; *"The legacy API will continue to be available with no current plans for deprecation."* (App. C §5a). This is a statement of intent, not a contract; the design treats a future image move as a 3.0 event (D3) and keeps the standard split out of method *names* (D5).
- Callback page: the new callback shape is *"Applicable to APIs based on new design standards"*; the legacy shape is *"Applicable to Kling 3.0 Omni and earlier models"* (App. C §4). The two statements are framed on different axes (path vs model) and are not reconciled by the vendor — §11 Q1.

### 1.4 Retention and concurrency facts that shape defaults

- Every output URL *"will be cleared after 30 days"* (all endpoint docs). The download step is load-bearing, and `Task` carries the expiry (D4) so a consumer reading a stored id at day 31 gets an expiry error, not a download error.
- **Resource packages are per product type, and so is the balance an endpoint can draw on.** The trial account holds a *Video* pack only; `POST /v1/images/generations` with the API Key returned `429 / 1102 Account balance not enough` **[LIVE 2026-09-20]** while TTS and voice creates on the same key succeeded — so `1102` on one family says nothing about auth and nothing about another family. The image side of the live programme needs an image pack (§10.17; Alex purchasing).
- Concurrency is per account, model version, and package type; an image task with `n` consumes `n` slots; over-limit returns `code 1303` *"parallel task over resource pack limit"* with **no `data`** and the vendor recommends exponential backoff from ≥1 s (App. C §3). Retry policy is in D10 and is **not** "retry everything retryable": a create that has received any HTTP response is never re-sent by the library, because a `5002` *"internal timeout, usually due to a backlog"* is exactly the case where the task may already exist and a retry would bill twice.

---

## 2. Vendor landscape (what exists on 2026-09-20)

### 2.1 Two design standards, by product

| Standard | Products | Create | Query | Status enum | Result |
|---|---|---|---|---|---|
| **NEW** (path-per-model) | text-to-video, image-to-video, omni-video, motion-control | `POST /<product>/<model>` body `{prompt \| contents[], settings{}, options{}}` | `GET /tasks?task_ids=a,b` · `GET /tasks?external_task_ids=…` · `POST /tasks {start_time,end_time,cursor,limit,filters[]}` | `submitted, processing, succeeded, failed` | `data.id`, `data.status`, `data.message`, `data.outputs[]` (typed union), `data.billing[]` — **no product or model field** |
| **LEGACY** (`/v1/`) | image generation, omni-image, multi-image-to-image, outpainting, ai-multi-shot; avatar, lip-sync, TTS, text-to-audio, video-to-audio, face/image recognition, multi-elements, effects; element & voice management | `POST /v1/<product>` flat body, `model_name` where selectable | `GET /v1/<product>/{id}` · `GET /v1/<product>?pageNum&pageSize` | `submitted, processing, succeed, failed` | `data.task_id`, `data.task_status`, `data.task_status_msg`, `data.task_result.{images[],videos[],audios[],elements[],voices[]}`, `final_unit_deduction`, `final_balance_deduction` |
| **Account** (neither prefix) | usage, billing ledgers | `GET /account/costs` (unchanged since 2024, *"free to call … QPS<=1"*), `POST /account/billing/balance`, `POST /account/billing/package` (added 07/06/2026) | — | — | App. C §6 |

Base URL is `https://api-singapore.klingai.com` for all three (`docs/api/kling-get-started-authentication.md`). Auth header is `Authorization: Bearer <API_KEY>` on every documented endpoint (all 50 pages; the two pricing pages carry no endpoint).

### 2.2 Video models on the new standard (App. B §4.1)

| Path model id | Create endpoints | `resolution` | `duration` (s, int) | `aspect_ratio` (t2v / omni only) | `settings.audio` | Other settings | `contents[].type` supported |
|---|---|---|---|---|---|---|---|
| `kling-3.0-turbo` | `/text-to-video/`, `/image-to-video/` | `720p`,`1080p` | `3`–`15` | `16:9`,`9:16`,`1:1` | *(no field — native audio is always on; the pricing table lists Turbo only as "With Native Audio")* | — | i2v: `prompt`, `first_frame` only |
| `kling-3.0` | `/text-to-video/`, `/image-to-video/`, `/motion-control/` | `720p`,`1080p`,`4k` (motion: no `4k`) | `3`–`15` (motion: none) | `16:9`,`9:16`,`1:1` | `native`,`off` (motion: `original`,`off`, default `original`) | `multi_shot` bool (default `true`); motion: `character_orientation` `image`\|`video` **required** | i2v: `prompt`,`first_frame`,`last_frame`,`element`(≤3); motion: `prompt`,`image`,`video`,`element`(≤1) |
| `kling-3.0-omni` | `/omni-video/` | `720p`,`1080p`,`4k` | `3`–`15` | `16:9`,`9:16`,`1:1` (required when no first frame / ref video) | `native`,`original`,`off` | `multi_shot` | `prompt`,`first_frame`,`last_frame`,`refer_image`,`feature_video`,`base_video`,`element` — count matrices in App. B §2.5 |
| `kling-o1` | `/omni-video/` | `720p`,`1080p` | `3`–`10` (first-frame-only: `5`\|`10`) | as above | `original`,`off` | — | as 3.0-omni; multi-image elements only; ref video 3–10 s ≤2160px |
| `kling-2.6` | `/text-to-video/`, `/image-to-video/`, `/motion-control/` | `720p`,`1080p`; **native audio ⇒ 1080p only; first+last frame ⇒ 1080p only** | `5`,`10` | `16:9`,`9:16`,`1:1` | `native`,`off` (motion: `original`,`off`) | motion: `character_orientation` | i2v: `prompt`,`first_frame`,`last_frame`,`voice`(≤2, requires `audio≠off`); motion: `prompt`,`image`,`video` |
| `kling-2.5-turbo` | `/text-to-video/`, `/image-to-video/` | `720p`,`1080p`; **first+last ⇒ 1080p** | `5`,`10` | `16:9`,`9:16`,`1:1` | *(none)* | — | i2v: `prompt`,`first_frame`,`last_frame` |

Cross-cutting facts: there is **no `negative_prompt`**, **no `cfg_scale`**, **no `mode` (`std`/`pro`)**, **no `camera_control`**, and **no `image_tail`** anywhere in the new standard (App. B §2.13). Negative descriptions go in the prompt string; `mode` is replaced by `resolution` (the billing ledger maps legacy `std→720p`, `pro→1080p`, App. C §6); end frames are `contents[].type: "last_frame"`. Prompt limit is 2500 chars except Kling 3.0 / 3.0 Omni / 3.0 Turbo t2v at 3072 (recommended ≤2500). Image inputs are *"URL or Base64"*, `.jpg/.jpeg/.png`, ≤50 MB, ≥300 px, ratio 1:2.5–2.5:1. **Video inputs are URL only** (`feature_video`, `base_video`, motion `video`) — there is no upload endpoint.

Shared `options` block: `callback_url`, `external_task_id` (must be unique per account — whether the vendor treats it as an idempotency key is §11 Q11), `watermark_info.enabled` (default `false`, custom watermarks unsupported).

### 2.3 Image models on the legacy standard (App. B §4.2; tables extracted 2026-09-20)

| Endpoint | `model_name` enum (doc default in bold) | Fields beyond `prompt` |
|---|---|---|
| `POST /v1/images/generations` | `kling-v2-1`, **`kling-v3`** | `negative_prompt`, `image`, `image_reference` (`subject`\|`face`, **2.1 only**), `image_fidelity` [0,1] 0.5, `human_fidelity` [0,1] 0.45 (*"only takes effect when image_reference is subject"*, 2.1 only — `docs/api/kling-image-2.1-generation.md:83-85`), `element_list[].element_id` (long), `resolution` `1k`\|`2k`, `n` 1–9, `aspect_ratio` (8 values, no `auto`), `watermark_info`, `callback_url`, `external_task_id` |
| `POST /v1/images/omni-image` | **`kling-image-o1`**, `kling-v3-omni` | `image_list[].image`, `element_list[].element_id`, `resolution` `1k`\|`2k`\|`4k` (O1: 1k/2k per capability map), `result_type` `single`\|`series`, `series_amount` `2`–`9`\|`auto`, `n`, `aspect_ratio` incl. `auto`, watermark/callback/external |
| `POST /v1/images/multi-image2image` | **`kling-v2-1`** (only value) | `subject_image_list[].subject_image` (1–4), `scene_image`, `style_image`, `n`, `aspect_ratio`, watermark/callback/external |
| `POST /v1/images/editing/expand` | *(none)* | `image`, four `*_expansion_ratio` [0,2] (area ≤3×), `prompt`, `n`, watermark/callback/external |
| `POST /v1/general/ai-multi-shot` | *(none)* | `element_frontal_image`, callback/external — returns `images[] {index 0-2, url_1, url_2, url_3}` |

Query: `GET /v1/<product>/{task_id}` (also accepts `external_task_id` per most docs), list `GET /v1/<product>?pageNum=[1,1000]&pageSize=[1,500]`. Result `task_result.images[] {index, url, watermark_url}`; omni-image adds `result_type` and `series_images[]`.

### 2.4 Legacy resource endpoints in scope for 2.0

Needed because the new video standard references them by id:

- **Elements** — `POST /v1/general/advanced-custom-elements` (async; `reference_type` `image_refer`\|`video_refer`, `element_image_list{frontal_image, refer_images[]}`, `element_video_list{refer_videos[]}`, `element_voice_id`, `tag_list[]`), `GET …/{id}`, `GET …` list, `GET /v1/general/advanced-presets-elements`, delete `POST /v1/general/delete-advanced-elements` (video docs) **vs** `POST /v1/general/delete-elements` (image docs) — the *only* body-level difference between the two element doc families (App. C §7.9).
- **Voices** — `POST /v1/general/custom-voices` (`voice_name`, `voice_url` 5–30 s **or** `video_id`), `GET …/{id}`, `GET …` list (`pageSize` [1,1000] here), `GET /v1/general/presets-voices`, `POST /v1/general/delete-voices` (App. C §7.10).
- **Avatar** — `POST /v1/videos/avatar/image2video` unchanged from what `src/operations/avatar.ts` implements (App. C §7.1); carries over with the credential and result-normalization changes only.
- **TTS** — `POST /v1/audio/tts` synchronous, returns `task_result.audios[]` directly; feeds avatar `audio_id` (App. C §7.2).

Everything else legacy (lip-sync, face/image recognition, multi-elements, text-to-audio, video-to-audio, effects) is documented in App. C §7 and deferred to 2.x minors (§12).

### 2.5 Error codes (App. C §2, verbatim vendor table)

The vendor table has **22 rows (21 error codes + success)** — `0`, `1000`–`1004`, `1100`–`1103`, `1200`–`1203`, `1300`–`1304`, `5000`–`5002` (`docs/api/kling-get-started-error-codes.md`, counted 2026-09-20; v0.3.0 said 24 and was wrong). The library's `ERROR_CODES` (`src/config/constants.ts:155-187`) has 19 codes + `SUCCESS`, one of which (`QUEUE_FULL: 1104`) exists in no vendor table, and misnames several (e.g. `1102` is *"Resource pack exhausted or expired"*, not `CONCURRENT_LIMIT`; `1202` is *"requested method is invalid"* (404), not `PARAM_OUT_OF_RANGE`). Missing: `1303` (concurrency over package limit, 429), `1304` (IP whitelist, 429), `5002` (internal timeout, 504). `1003`/`1004` (`nbf`/`exp`) become unreachable once JWT is gone.

---

## 3. Current surface, as it stands (App. A)

`KlingAPI` exposes 29 public methods (App. A §1.1): **10 create/query pairs over 20 flat-body `/v1/` endpoints** (App. A §2 table; App. A's closing summary separately counts 18 *GET call sites*, a different metric) plus `/account/costs`, two `waitFor*Result`, two `save*Result`, `healthCheck`, `getToken`, `refreshToken`. Every create defaults to a model that no longer appears in any vendor enum except `multiImageToImage → kling-v2` (also gone; the endpoint now lists only `kling-v2-1`). The CLI has **10 generating subcommands** (5 video, 4 image, 1 avatar — App. A §6); 7 default to a dead model (App. A §6.5).

Response-shape coupling is concentrated but wide: `data.task_id` is read at 12 sites, `data.task_status` at 12, `task_result.videos|images` at 10, all funnelling through one poll predicate at `src/handlers/result-poller.ts:31,40` (App. A §2.1, §5). Auth is JWT end-to-end with the header injected by an unconditional axios interceptor (`src/client/http-client.ts:68-74`); `KlingConfig` has no API-key field (App. A §4).

axios is used in **three** places, not one: the client (`src/client/http-client.ts`), and the media/download utilities (`src/utils/downloads.ts:38-39,65-66`, `src/utils/media.ts:88-89,164-165`) which rely on `maxContentLength` and `maxRedirects` — knobs native `fetch` does not have. D12 specifies the port.

Tests: 16 files / **8,300 lines** (App. A §7 table sum), all pinned to `/v1/` paths, `model_name: 'kling-v1'`, `task_status: 'succeed'`, and a `^Bearer eyJ` JWT-shape regex. They are a specification of the 1.x contract and are deleted in one commit (§3.1), not migrated.

### 3.1 Disposition of every 1.x file, by phase

Run #2 F1: Phase 1a as written in v0.3.0 deleted `src/client/` and `src/auth.ts` while `src/api.ts:11` and `src/operations/{video,image,avatar}.ts` still imported them, and 10 of 16 test files imported `auth.js`/`http-client`/`axios`/`nock` — the tree would not compile, on a branch where CI runs on every push. The rule is now: **1a is additive; nothing 1.x is deleted until the single removal commit 2a₀**, after the Phase 0 write-probe gate.

| 1.x path | Disposition | Phase |
|---|---|---|
| `src/auth.ts`, `src/client/http-client.ts`, `src/client/index.ts` | deleted | 2a₀ |
| `src/api.ts` | deleted (replaced by `src/client.ts` + `src/index.ts`, created in 1a beside it) | 2a₀ |
| `src/operations/{video,image,avatar,index}.ts` | deleted (replaced by `src/products/*`) | 2a₀ |
| `src/types.ts` | deleted (replaced by `src/codecs/task.ts` + per-product param types) | 2a₀ |
| `src/handlers/result-poller.ts`, `src/handlers/file-saver.ts`, `src/handlers/index.ts` | deleted (replaced by `handlers/poller.ts`, `handlers/saver.ts` in 2a₁/2c) | 2a₀ |
| `src/utils/polling.ts`, `src/utils/downloads.ts` | deleted (replaced by `handlers/poller.ts`, `media/download.ts`) | 2a₀ |
| `src/utils/media.ts` | **kept through 2a₀, deleted in 2c** after `media/source.ts` ports its `validateImageBuffer`/`validateAudioExtension` checks — the only 1.x source file that outlives 2a₀, because its checks are the port's reference (run #3 anxiety F1) | 2c |
| `src/utils/index.ts`, `src/config/index.ts` (barrels) | **trimmed in 2a₀**: re-exports of deleted modules removed; `utils/index.ts` keeps `media.js` until 2c | 2a₀ |
| `src/config/constants.ts` | **rewritten in 1a₁** (done `a14f839`): the six `import type … from '../types.js'` (lines 7-14) replaced by local aliases so the file survives `types.ts`'s deletion; vendor error table added as `ERROR_CODES_V2`. The `VALID_*` arrays 1.x validators import are **removed in 2a₀**, not 1a — 1a is additive | 1a₁ / 2a₀ |
| `vitest.config.ts` coverage `include` | rewritten to `src/**/*.ts` (today it names `src/api.ts`, `src/auth.ts`, and two nonexistent files) | 2a₀ |
| `package.json` `exports['./api']` (undocumented in App. A §0's table but present at lines 16-19), `scripts.kling*` (point at `dist/cli.js`) | removed / repointed | 2a₀ |
| `src/utils/{logger,security,file-io,constants}.ts` | kept; `security.ts` hardened in 2c (D12) | — |
| `src/config/{constants,models,loaders,index}.ts`, `src/config/validators/*` | rewritten in place | 1a (constants, loaders), 2a₂ (models, video validators), 3a (image validators) |
| `src/cli.ts` | deleted; `src/cli/index.ts` stub (prints "2.0 in progress", exit 1) created in 2a₀; real CLI in 6a/6b | 2a₀ |
| `src/errors.ts` | deleted (replaced by `http/errors.ts`) | 2a₀ |
| `test/**` (16 files) | deleted | 2a₀ |
| `package.json` `main`/`types`/`bin`/`exports` | switched to the 2.0 layout in 2a₀; `axios`, `jsonwebtoken`, `@types/jsonwebtoken`, `nock` removed in 2a₀ | 2a₀ |

Between 1a and 2a₀ the repo builds and tests both the 1.x surface and the new core side by side (1.x tests untouched, new tests under `test/2.0/`). Between 2a₀ and 6c the published surface is the growing 2.0 one; `main` never sees it until 6c.

Release automation: `.github/workflows/release.yml` runs `npx semantic-release` on every push to `main` and asserts `test -f dist/api.js` (`:41`), which 2.0 deletes. `.releaserc.json` publishes to npm and rewrites `CHANGELOG.md`. Both go (D19). `ci.yml` (lint/build/test/tsc on `pull_request`) stays.

Two disposals already made: `docs/KLING_API_REFERENCE.md` deleted (it documented three endpoint paths that never matched `src/`, App. A §8.2); `README.md` carries a "1.x is broken" notice (moved to the top of the file in this revision).

---

## 4. Decisions

Each decision records the alternative that was rejected and why. **(settled)** = made by Alex on 2026-09-20; §10 records the recommendations he resolved.

### D1. Version and compatibility (settled)

`2.0.0`. No compatibility shims, no deprecated re-exports, no `legacy` mode flag. Every create method's default model is dead, so a 1.x consumer's first call fails regardless; a shim would preserve the *appearance* of compatibility while every default path throws. A clean break with a written migration table (§7) is more honest.

### D2. Authentication (settled)

- The only credential is an **API Key**. `KlingConfig.apiKey?: string`; env `KLING_API_KEY`. **The library reads the constructor argument and `process.env.KLING_API_KEY` only.** The `./.env` and `~/.kling/.env` lookups (`src/config/loaders.ts:46-67`) move to the CLI layer — a library that silently reads the home directory is a surprise for a server consumer (run #1 A8).
- **Removed:** `src/auth.ts` (`KlingAuth`, `decodeToken`, `isTokenExpired`), the `./auth` subpath export, `KlingAPI.getToken()` / `refreshToken()`, `jsonwebtoken` and `@types/jsonwebtoken`.
- The `401 / 1002` message **[LIVE]** is surfaced verbatim by `KlingAPIError` — with one caveat learned at 1c: **a garbage API Key also returns `1002` with the identical "does not support AK/SK … create API key" text [LIVE 2026-09-21]**, so the vendor's message is not diagnostic and the README says so ("1002 means the Authorization header was not accepted — check the key, not the auth scheme"). The library adds one hint only: if `1000`–`1004` is returned and the key is empty, the message names the two sources. Whether a *revoked* key also returns `1002` is the remaining half of §11 Q9.
- Redaction (`src/utils/security.ts` `redactKey`) is retained; the key is never logged in full.

Rejected: dual-auth with per-endpoint branching (App. A §4.4 item 5). It would ship a credential that authenticates half the surface and 401s the other half, with the boundary set by the vendor's product taxonomy rather than anything visible to the consumer.

### D3. One HTTP core, two codecs, one file layout

```text
src/http/core.ts              fetch wrapper: base URL, API Key header, deadline, retry (D10), error mapping
src/codecs/new-standard.ts    build {prompt|contents, settings, options}; parse create / GET /tasks / POST /tasks
src/codecs/legacy.ts          build flat body; parse data.task_id/task_status/task_result
src/codecs/task.ts            Task, TaskOutput, TaskHandle *types only* (no HTTP import)
```

The codec, not the caller, owns the vendor property paths. **Nothing outside `src/codecs/` reads `task_status`, `task_result`, `succeed`, `data.id`, `create_time`, or any other vendor-spelled field.** Consumers, the saver, and the CLI read the normalized `Task` — `task.outputs`, `task.status` — which is the point of the boundary. (v0.2.0 listed `outputs` among the forbidden reads; that was a contradiction with D4 and is corrected.)

Rejected: two client classes (`KlingVideo`, `KlingImage`). It would leak the vendor's accident of history into the consumer's imports, and the vendor has already moved one product family once — the codec boundary is where the *next* move gets absorbed. If images move to the new standard, `codecs/legacy.ts` shrinks and the public surface does not change (the one exception is `tasks.getByProduct`, D5, which becomes a no-op alias).

Renames, each with its reason: `operations/` → `products/` because the modules are now organized by vendor product (which selects the codec), not by verb; `client/` → `http/` because the auth class that justified "client" is gone and what remains is a transport; `KlingAPI` → `KlingClient` because the 1.x class name is the most-grepped symbol in consumers and a *different* name makes the breaking change fail at compile time rather than at the first vendor 401. `expandImage` → `outpaint` because the vendor's own page is titled *Outpainting* and the CLI subcommand should match the vendor vocabulary a user searches for (`docs/api/kling-image-common-outpainting.md`).

### D4. Normalized `Task` model

```ts
export type TaskStatus = 'submitted' | 'processing' | 'succeeded' | 'failed';
export type Standard = 'new' | 'legacy';

export type Product =
  | 'text-to-video' | 'image-to-video' | 'omni-video' | 'motion-control'         // new standard
  | 'image-generation' | 'omni-image' | 'multi-image-to-image' | 'outpainting'   // legacy
  | 'subject-completion' | 'avatar' | 'element' | 'voice';                        // legacy
export type LegacyProduct = Exclude<Product, 'text-to-video' | 'image-to-video' | 'omni-video' | 'motion-control'>;

export interface Task {
  id: string;
  standard: Standard;              // always known: which codec parsed it
  product?: Product;               // known from creates and product-scoped queries; ABSENT for /tasks results (the vendor envelope carries no product)
  status: TaskStatus;              // legacy 'succeed' → 'succeeded' in the codec
  message?: string;                // legacy task_status_msg / new data.message
  externalId?: string;
  createdAt: number;               // ms. Both standards document ms; if a value is < 1e11 the codec treats it as seconds, multiplies, and logs a warning (§11 Q12) — it does not throw
  updatedAt: number;               // ms
  outputsExpireAt?: number;        // updatedAt + 30 d when status === 'succeeded' — vendor: "cleared after 30 days"
  outputs: TaskOutput[];           // [] until succeeded
  billing?: BillingEntry[];        // new standard; legacy deductions mapped when present
  raw: unknown;                    // the vendor envelope, untouched
}

export type TaskOutput =
  | { type: 'video'; id: string; url: string; watermarkUrl?: string; durationSeconds?: number }
  | { type: 'image'; url: string; watermarkUrl?: string; index?: number; groupId?: string }
  | { type: 'audio'; id: string; mp3Url?: string; wavUrl?: string; mp3DurationSeconds?: number; wavDurationSeconds?: number }
  | { type: 'element'; id: string; name: string; description?: string; elementType?: 'video_character_elements' | 'multi_image_elements'; status: 'succeeded' | 'deleted'; raw: unknown }
  | { type: 'voice'; id: string; name: string; url?: string; ownedBy?: string; status: 'succeeded' | 'deleted' };

export interface BillingEntry {
  chargeType: 'cash' | 'unit';
  cashType?: 'balance' | 'test_balance';   // cash only
  amount: string;                           // decimal string as the vendor sends it
  currency?: string;                        // cash only ("CNY/USD")
  packageType?: 'video' | 'image' | 'audio';// unit only
  listPrice?: string;                       // cash only
}
```

- Durations are **numbers in seconds**; the vendor sends strings on the new standard (App. B §3.2) and the codec parses them.
- Legacy `task_result.videos[]` / `images[]` / `audios[]` / `elements[]` / `voices[]` map onto the same union. Legacy audio names (`url_mp3`, `duration_mp3`) and new ones (`mp3_url`, `mp3_duration`) both map to the camelCase fields.
- A `succeeded` task with empty `outputs[]` is terminal-and-empty: `wait()` resolves, `save()` throws `KlingNoOutputsError`. It is not re-polled.
- `raw` is kept for the first major because the vendor's docs have known sample-JSON errors (App. C §9 Q17); revisit at 3.0 (§10.6).
- The saver's metadata sidecar records `product`, `standard`, the *request* the handle was created from (model included) **with media fields redacted to `{ kind, bytes, sha256 }`** by the *product module* before it calls `createHandle` — `products/video.ts` knows which fields are media and may import `media/*`; `products/tasks.ts` does neither (run #3 architect F-5) — and `raw`. `model` is not on `Task` because no vendor envelope carries it.

### D5. Query routing: `TaskHandle` from every create; product-neutral escape hatches

Unified `/tasks` only knows new-standard tasks; legacy tasks are queried at `GET /v1/<product>/{id}`. A bare `getTask(id)` cannot work without knowing the product. Every create returns:

```ts
export interface TaskHandle {
  id: string;
  externalId: string;                            // ALWAYS set: the library generates a UUID external_task_id when the caller supplies none (D10 — recovery key for a create whose response was lost)
  standard: Standard;
  product: Product;
  request: Record<string, unknown>;              // the normalized params the create was built from (model, resolution, …)
  get(options?: RequestOptions): Promise<Task>;
  wait(options?: WaitOptions): Promise<Task>;    // resolves on succeeded; throws KlingTaskFailedError on failed, KlingPollTimeoutError on deadline
}
```

`TaskHandle` is an **interface in `codecs/task.ts`**; its implementation is `createHandle(core, product, id, request)` in `products/tasks.ts`, which owns the product → path routing table. Codecs import no HTTP. Two concurrent `wait()` calls on one handle share a single poll loop (a memoized promise cleared on settle). **Per-caller options apply per caller:** the shared loop polls at the *shortest* requested interval; each caller's `deadlineMs` and `signal` are enforced on that caller's returned promise only — caller B aborting rejects B with B's `AbortError` and leaves A polling; the loop itself stops when the last subscriber has settled (run #3 anxiety F4).

Escape hatches — named by *what the caller holds*, not by vendor standard, so a future image move changes no method names:

- `tasks.get(ids: string | string[], { byExternalId?: boolean, signal? })` → `{ tasks: Task[]; missing: string[] }` — new-standard batch (`GET /tasks`). `missing` lists requested ids the vendor did not return (it answers `200 data: []` for unknown ids, so absence is the only signal). Ids are chunked at 50 per request (the vendor states no cap; §11 Q13), chunks run sequentially, and a chunk failure throws `KlingBatchError { tasks (from completed chunks), missing (attempted ids the vendor did not return), unattempted (ids in chunks never sent), cause }` so earlier results are not lost and never-queried ids are not reported as absent (run #3 excavator A43). Results have `standard: 'new'` and `product` undefined — `tasks.list({ productType })` does **not** back-fill `product` either; the vendor's `product_type` (`video` / `image` / `try_on`) is coarser than `Product`.
- `tasks.list({ startTime?, endTime?, cursor?, limit?, status?, productType?, signal? })` → `{ tasks, count, nextCursor, hasMore }` — new-standard cursor (`POST /tasks`).
- `tasks.getByProduct(product: Product, id: string)` → `Task` — routes by product: new-standard products go to `/tasks`, legacy products to `/v1/<path>/{id}`. This is the method for reconstituting a stored id.
- `tasks.listByProduct(product: LegacyProduct, { pageNum?, pageSize? })` → `Task[]` — legacy per-product list.
- `tasks.handle(product, id, request?)` → `TaskHandle`.

Rejected: a `getTask(id)` that tries `/tasks` then probes each legacy product. Up to 6 round trips for a legacy id, and `/tasks` returns `200 data: []` for unknown ids **[LIVE]**, so "not here" is indistinguishable from "nowhere".

### D6. Video surface (new standard only) (default settled §10.11)

| Method | Endpoint | Default model | Notes |
|---|---|---|---|
| `video.textToVideo({ model?, prompt, resolution?, aspectRatio?, duration?, audio?, multiShot?, …common })` | `POST /text-to-video/<model>` | `kling-3.0-turbo` | model ∈ `kling-3.0-turbo`,`kling-3.0`,`kling-2.6`,`kling-2.5-turbo` (or an unknown id, D9) |
| `video.imageToVideo({ model?, prompt, firstFrame, lastFrame?, elements?, voices?, … })` | `POST /image-to-video/<model>` | `kling-3.0-turbo` | `firstFrame`/`lastFrame` are `MediaSource` (D12); `elements` 3.0 only; `voices` 2.6 only |
| `video.omni({ model?, prompt, firstFrame?, lastFrame?, referImages?, featureVideo?, baseVideo?, elements?, … })` | `POST /omni-video/<model>` | `kling-3.0-omni` | model ∈ `kling-3.0-omni`,`kling-o1`; videos are URLs |
| `video.motionControl({ model?, prompt?, image, video, element?, characterOrientation, audio?, resolution?, … })` | `POST /motion-control/<model>` | `kling-3.0` | model ∈ `kling-3.0`,`kling-2.6`; `characterOrientation` required |

The `contents[]` array is assembled by the codec from named fields; `id`s for `@`-references are auto-assigned (`image_1`, `video_1`, element name) unless supplied, and the codec checks every `@name` in the prompt resolves to a content entry — a **warning** via the logger, not an error (the vendor's guidance is advisory, App. B §2.4).

**Dropped from 1.x:** `extendVideo` (`/v1/videos/video-extend`) and `multiImageToVideo` (`/v1/videos/multi-image2video`) — neither appears in `llms.txt` (2026-09-20) and neither has a new-standard equivalent; omni-video's `refer_image` + `element` covers the multi-image case. Also dropped: the legacy `/v1/videos/text2video`, `/v1/videos/image2video`, `/v1/videos/omni-video` transports and every parameter with no new-standard field (`negative_prompt`, `cfg_scale`, `mode`, `camera_control`, `image_tail`, `dynamic_masks`, `voice_list` → `voices`).

**Default-model policy (§10.1 settled on a premise this revision corrects — see §10.11):** the vendor's price list (`docs/api/kling-pricing-video.md`, fetched 2026-09-20) per second at 720p / 1080p:

| Model | Silent | With native audio |
|---|---|---|
| `kling-3.0-turbo` | — (audio always on) | **0.8 / 1.0** |
| `kling-3.0` | 0.6 / 0.8 (4k: 3.0) | 0.9 / 1.2 |
| `kling-3.0-omni` (no video input) | 0.6 / 0.8 | 0.8 / 1.0 |
| `kling-o1` (no video input) | 0.6 / 0.8 | — |
| `kling-2.6` | 0.3 / 0.5 | — / 1.0 |
| `kling-2.5-turbo` | 0.3 / 0.5 | — |

v0.2.0 called `kling-3.0-turbo` "the cheapest current-generation model"; it is not — `kling-3.0` silent is 25% cheaper. The policy is restated as: **video defaults to the cheapest current-generation model whose output includes native audio** (`kling-3.0-turbo` for t2v/i2v; `kling-3.0-omni` for omni, where it ties Turbo's rate; `kling-3.0` for motion control, the only current-gen option). Image defaults to the newest model (D7). Both policies and this table go in the README so a consumer comparing providers at defaults knows the tier and the price. The alternative — default to `kling-3.0` silent and make audio opt-in — is §10.11.

### D7. Image surface (legacy standard, API Key) (defaults settled)

| Method | Endpoint | Default model | Notes |
|---|---|---|---|
| `image.generate({ model?, prompt, negativePrompt?, image?, imageReference?, imageFidelity?, humanFidelity?, elements?, resolution?, n?, aspectRatio?, … })` | `POST /v1/images/generations` | `kling-v3` | `imageReference`/`humanFidelity` are `kling-v2-1`-only — validator **errors**; `humanFidelity` with `imageReference !== 'subject'` — validator **warns** (vendor: *"only takes effect when … subject"*) |
| `image.omni({ model?, prompt, images?, elements?, resolution?, resultType?, seriesAmount?, n?, aspectRatio?, … })` | `POST /v1/images/omni-image` | `kling-v3-omni` | settled §10.2 — the vendor's documented default is the older `kling-image-o1` |
| `image.multiImageToImage({ prompt?, subjectImages, sceneImage?, styleImage?, n?, aspectRatio?, … })` | `POST /v1/images/multi-image2image` | `kling-v2-1` (only) | no model param |
| `image.outpaint({ image, up, down, left, right, prompt?, n?, … })` | `POST /v1/images/editing/expand` | — | renamed from `expandImage` (D3) |
| `image.subjectCompletion({ frontalImage, … })` | `POST /v1/general/ai-multi-shot` | — | new; feeds element creation |

Query via `TaskHandle.get()` → `GET /v1/images/<product>/{id}`; list via `tasks.listByProduct`.

### D8. Resources (legacy standard, API Key) — ships in 2.0.0 (settled)

`elements.{create, get, list, presets, delete}`, `voices.{create, get, list, presets, delete}`, `avatar.create`, `audio.tts` (synchronous; returns `TaskOutput[]` of type `audio` directly). `elements.delete(id, { kind: 'video' | 'image' = 'video' })` because the vendor documents two delete paths for one otherwise-identical surface (App. C §7.9); whether the library is shared is §11 Q7.

### D9. Capability registry: known models validated, unknown models passed through

`src/config/models.ts` is one table keyed by path model id (video) or `model_name` (image):

```ts
interface VideoModelCaps {
  id: KnownVideoModel;
  products: Product[];
  resolutions: Partial<Record<Product, Resolution[]>>;   // motion-control has no 4k on 3.0
  durations: number[] | null;                             // null = follows reference video
  audio: AudioMode[] | null;                              // null = no field
  multiShot: boolean;
  contentTypes: Partial<Record<Product, ContentType[]>>;
}
type ContentType = 'prompt' | 'first_frame' | 'last_frame' | 'refer_image' | 'feature_video' | 'base_video' | 'element' | 'voice' | 'image' | 'video';
```

The `model` parameter is typed `KnownVideoModel | (string & {})` — autocomplete for known ids, no compile error for new ones. **An unknown id is passed through** with a logger warning and *shape-only* validation (required fields, enum types); a known id gets full capability validation. Run #1 A2: the vendor ships path-model ids roughly monthly and this library has shipped once in nine months; a registry that rejects unknown ids is the trigger failure inverted. `KlingClient({ unknownModels: 'reject' })` opts into strictness.

Two escape hatches for **known** ids, because the vendor also adds capabilities to existing models (run #2 A19, A26): `KlingClient({ capabilityValidation: 'warn' })` turns every capability-rule failure (resolution/duration/audio/content-type sets and the cross-field rules below) into a logger warning and sends the request anyway — shape rules (required fields, types) still throw; and every params object accepts `extraSettings?`, `extraOptions?` (new standard `options`) and `extraContents?: Array<Record<string, unknown>>` (appended to `contents[]`), merged *after* validation for fields and content types the library does not know yet. **A key the library already models is rejected in `extra*` with `KlingValidationError`** — the escape hatch cannot silently override a validated field (run #3 excavator A41). Both knobs are documented as "the vendor moved before we did" tools, not as normal use.

Every validator rule in the checklist is labelled **`[shape]`** (always throws: required fields, types, mutually exclusive fields, URL-only media) or **`[capability]`** (subject to `capabilityValidation`); rules that shape a *paid* request in a way the vendor would otherwise accept differently — e.g. `baseVideo` ⇒ no frames — are `[shape]` so `'warn'` cannot send a request the caller did not intend (run #3 excavator A42).

Cross-field rules are **plain validator functions** in `src/config/validators/video.ts` (the existing pattern), one per product, taking `(params, caps)`. Each carries a comment citing the `docs/api/` line. The rules that exist in the docs today (App. B §2): 2.6 native audio ⇒ 1080p; 2.6 / 2.5-turbo first+last ⇒ 1080p; 2.6 `voices` ⇒ `audio ≠ off`, ≤2; 3.0-omni `baseVideo` ⇒ `audio ≠ native`, no frames, no multi-shot; 3.0-omni `featureVideo` ⇒ `audio = off`, `multiShot ≠ false`; omni `aspectRatio` required when no first frame and no reference video; O1 first-frame-only ⇒ duration 5|10; motion-control reference video ≤10 s (`image`) / ≤30 s (`video`) — URL-only, stated in the message as uncheckable client-side; element/refer-image count matrices (App. B §2.5). Media-size rules apply to Buffers and local files; URLs are not fetched to check. Prompt length: 3072 for 3.0 / 3.0-omni / 3.0-turbo t2v, 2500 elsewhere (3.0-turbo i2v says 2500, App. B §6.2).

### D10. Errors and retry

```ts
class KlingError extends Error { requestId?: string }
class KlingAPIError extends KlingError {
  code: number; httpStatus: number;
  request: { kind: 'read' | 'write'; method: string; path: string; externalId?: string };
  taskState: 'not-created' | 'may-exist' | 'n/a';   // for writes: 'not-created' on 4xx business codes (1100-1304 incl. 1303 — the vendor rejected before enqueue);
                                                     // 'may-exist' on 5000/5002, HTTP 502/503/504 and on any response the client could not parse; 'n/a' for reads
  isTransient(): boolean;                            // the vendor's own "try later" signal (1302/1303/5000-5002, 429/502/503/504) — says NOTHING about task state
  isRetryable(): boolean;                            // isTransient() AND request.kind === 'read' — ALWAYS false for a create/delete (run #2 A17)
}
class KlingNetworkError extends KlingError { cause: unknown; externalId?: string; taskState: 'not-created' | 'may-exist' }   // fetch TypeError; 'not-created' only for pre-request failures (ENOTFOUND/ECONNREFUSED), else 'may-exist'
class KlingTimeoutError extends KlingError { deadlineMs: number; attempt: number; attempts: number; externalId?: string; taskState: 'may-exist' | 'n/a' }   // our AbortController fired (covers headers, body write AND body read); a create that times out is ALWAYS 'may-exist'
class KlingResponseError extends KlingError { httpStatus: number; bodySnippet: string; location?: string }   // non-JSON/unparseable body (CDN 429/502 HTML), or an unexpected 3xx from the API host (redirect: 'manual'; `location` carried; not retried — run #2 A30)
class KlingCodecError extends KlingError { standard: Standard; path: string }                         // envelope parsed but not the shape the codec expects
class KlingValidationError extends KlingError { field: string }                                       // = today's ValidationError, renamed for the family
class KlingTaskFailedError extends KlingError { task: Task; code: number | null }                     // vendor message; code null when the envelope carries none
class KlingPollTimeoutError extends KlingError { task: Task | null; elapsedMs: number }
class KlingNoOutputsError extends KlingError { task: Task }
class KlingOutputsExpiredError extends KlingError { task: Task }
class KlingBatchError extends KlingError { tasks: Task[]; missing: string[]; unattempted: string[]; cause: unknown }   // tasks.get: a chunk failed; missing = attempted-and-absent, unattempted = never sent
class KlingDownloadError extends KlingError { url: string; reason: 'too-large' | 'too-many-redirects' | 'blocked-host' | 'http'; httpStatus?: number }
class KlingWebhookError extends KlingError { reason: 'missing-headers' | 'bad-signature' | 'stale-timestamp' }
```

`ERROR_CODES` is the 22-row vendor table (21 codes + success; App. C §2), names from the vendor's *Explanation* column.

**Retry policy (the part run #1 A1 forced):**

| Request class | Retried by the core? | On |
|---|---|---|
| Reads: `GET /tasks`, `POST /tasks` (cursor), `GET /v1/…/{id}`, lists, presets, `/account/*` | Yes, exponential backoff from 1 s, ≤ `retry.maxAttempts` (default 3) | `KlingNetworkError`, `KlingTimeoutError`, HTTP 429/502/503/504, business `1302`/`1303`/`5000`/`5001`/`5002` |
| Creates and deletes (any `POST` that spends or mutates) | **Never re-sent once any HTTP response was received.** Retried only on `KlingNetworkError` where the failure is provably pre-request (DNS, connection refused). A reset after the request was written is *not* retried. | — |
| Downloads (`save()`) | **No — NOT IMPLEMENTED.** The row below records the original intent; the shipped code has no retry on the download path | — |

> **Correction (2026-09-22, ship run #6 anxiety-read):** this row said "Yes, same list, idempotent by construction" from the spec's first draft and was never true of the code. `grep -n 'retry\|attempt' src/media/download.ts src/handlers/saver.ts` → zero hits. A single CDN 5xx or a reset mid-body is an immediate `KlingSaveError`; `written` lists what landed, and calling `save()` again re-downloads every output. The README now states this in the saving section. Left as a correction rather than a silent edit because the spec is the record of what was intended, and download retry is still worth having — it is simply not in 2.0.0.

A `1303` on a create surfaces immediately as `KlingAPIError` with `taskState: 'not-created'`, `isTransient() === true`, `isRetryable() === false`. **The consumer's re-submit decision is keyed on `taskState`, never on `isTransient()`** (run #3 excavator A35 / anxiety F11 — `isTransient()` is also true for `5002`, where the task may already exist): `'not-created'` → safe to re-submit after backoff; `'may-exist'` → recover by external id first (below), re-submit only if recovery returns nothing after the vendor's own status has had time to settle. The README teaches `taskState`; `isTransient()` is documented as a diagnostic, not a decision. `POST /tasks` is a query despite the verb and is classed as a read.

**Lost-response creates are recoverable on every product that carries an `external_task_id` — which is every product except TTS.** Every such create carries an `external_task_id` — the caller's, or a UUID the library generates (opt out with `externalTaskId: false`) — and `TaskHandle.externalId` is set. A create that ends in `KlingTimeoutError` or a post-request `KlingNetworkError` throws with `externalId` and `taskState: 'may-exist'`; the consumer recovers with **`tasks.recover(product, externalId)`**, which routes by standard: new-standard products → `GET /tasks?external_task_ids=`; legacy products → `GET /v1/<product>/{external_task_id}` (the `{id}` segment accepts an external id — `kling-image-omni-3.0-generation.md:172`, App. B §3.6; each product's acceptance is recorded in the V10 blanks). It returns `Task | null`, and `null` means *not visible to this account*, not *never created* — the README says so in those words (run #3 excavator A37 / anxiety F14; v0.4.0 named only the new-standard path and would have sent a legacy consumer to `/tasks`, which answers `data: []` for everything it does not know). **TTS** (`POST /v1/audio/tts`) has no external id field and is synchronous; a lost TTS response is unrecoverable and costs 0.05 units — stated in D8 and the README rather than papered over. Whether the vendor *rejects* a duplicate `external_task_id` is §11 Q11.

`signal?: AbortSignal` is accepted on every request and on `wait()`; abort surfaces as the caller's `AbortError`, never wrapped.

### D11. HTTP dependency (settled): native `fetch`, with the parity gaps stated

axios is removed. `engines.node >=20.0.0`. Runtime dependencies become `commander`, `dotenv`, `ora` — the latter two imported **only from `src/cli/`**. Parity gaps that consumers must know (README):

- Node's `fetch` (undici) **ignores `HTTP(S)_PROXY`**. `KlingConfig.fetch?: typeof fetch` lets a consumer inject a proxied fetch (`undici.ProxyAgent` via `EnvHttpProxyAgent`, or any WHATWG-compatible implementation). This is also the test seam (§8).
- Redirects: the core uses `redirect: 'manual'` everywhere. An unexpected 3xx from the API host becomes `KlingResponseError { location }` — not a retried network error — so a vendor host move is diagnosable (run #2 A30). Downloads follow redirects in a bounded manual loop (D12).
- Timeout: one `AbortController` deadline **per attempt** covers connection, request-body write, headers, *and* response-body read (the core reads the body itself), so a stalled body cannot hang past `timeout`. Across retries a read can take up to `maxAttempts × timeout + Σ backoff` (96 s at defaults: 3 × 30 s + 2 s + 4 s with `attempt` starting at 1 — run #3 anxiety F8); `KlingTimeoutError` carries `attempt`/`attempts` and the README states the arithmetic. **The same deadline covers the upload of a Base64 body:** a 20 MB local image is ~27 MB of JSON, which needs ≥ 7 Mbit/s sustained to fit 30 s. Creates with local media therefore default `timeout` to `max(config.timeout, 30_000 + bodyBytes / 250_000)` (≈ 2 Mbit/s floor) and the README says how to raise it (run #3 anxiety F12, excavator A45).
- The fake-`fetch` unit seam (D20) proves the core against a *model* of undici; three behaviours the design relies on are undici/Node-specific and get one **real-undici integration test each**, run in CI on a Node 20 and 22 matrix (run #2 A23): `redirect: 'manual'` exposing a readable 3xx with `Location`; `TypeError.cause.code` carrying the libuv code (tested against a **hostname** that resolves to loopback, so the dual-stack `AggregateError` path is the one exercised — run #3 anxiety F6); abort propagating into a half-read body stream. **These tests go through `HttpCore`, not bare `fetch`, over `https://localhost:<port>`** — a local `https.createServer` with a self-signed certificate, reached via an injected `fetch` bound to an undici `Agent({ connect: { rejectUnauthorized: false } })`, with `validateUrl` swapped for a test double that permits `localhost`. The core stays https-only in production; nothing in the test relaxes it (run #3 excavator A36 / anxiety F3 — v0.4.0 said `http.createServer`, which the core would have rejected before undici was reached).

### D12. Media input and download

```ts
export type MediaSource =
  | string                        // https URL, or a Base64 string (detected by prefix / charset) — NEVER a filesystem path
  | { url: string }
  | { base64: string; mimeType?: string }
  | { path: string }              // explicit local file; read + Base64-encoded with size/dimension/extension checks
  | Buffer | Uint8Array;
```

A bare string is never treated as a path. 1.x's `processMediaSource` read any string that `existsSync` matched (`src/utils/media.ts:62`) — a server passing user input to `imageToVideo` would read from its own disk (run #1 A8). Video inputs (`featureVideo`, `baseVideo`, motion `video`, voice `voiceUrl`) accept `string | { url }` only and throw `KlingValidationError('… must be a URL; the Kling API has no upload endpoint')` otherwise.

**Size caps are per standard** (run #2 A22 — v0.3.0 had one 20 MB cap, which *raised* the limit on the endpoints where the vendor is strictest): legacy image endpoints document **≤ 10 MB** (`kling-image-2.1-generation.md:77`, `kling-image-o1-generation.md:65`, outpainting, subject-completion, elements) and the codec enforces 10 MB for local/Buffer inputs there, matching 1.x's `MAX_IMAGE_SIZE`; new-standard video endpoints document ≤ 50 MB for URLs (`kling-3.0-turbo-i2v.md:96`), and the library caps *local/Buffer* inputs at 20 MB because a 50 MB Base64 payload inflates to ~67 MB of JSON and no edge request-body limit is published. `resolveMediaSource(src, { kind, standard })` picks the cap; the error names both the cap and the reason. Caps are **decimal megabytes** (10 000 000 / 20 000 000 bytes), so a file that passes is under the vendor's limit whichever unit the vendor means. **An aggregate cap applies per request:** the total Base64 payload across all inline inputs must stay ≤ 40 MB encoded (≈ 30 MB of files) — beyond that `KlingValidationError` tells the caller to host the files and pass URLs (run #3 excavator A45: ten 10 MB omni-image inputs would otherwise produce a ~133 MB body against an unpublished edge limit).

Downloads (`src/utils/downloads.ts`, `src/utils/media.ts` URL branches) are ported to `fetch` preserving the three axios-provided properties run #1 A3 identified: **byte cap** (stream and abort past `MAX_*_SIZE` → `KlingDownloadError('too-large')`), **redirect cap** (`redirect: 'manual'`, ≤ `MAX_REDIRECTS` hops → `'too-many-redirects'`), and **per-hop SSRF check** (`validateUrl` on every `Location`, not just the first URL — 1.x checked only the first hop → `'blocked-host'`). `validateUrl` itself is hardened (run #2 A28): it resolves the hostname with `dns.lookup({ all: true })` and rejects if *any* address is private/loopback/link-local/metadata, in **both** IPv4 (including alternate encodings — decimal, octal, hex — normalized via `net.isIP` after `new URL()`) and IPv6 (`::1`, `fc00::/7`, `fe80::/10`, `::ffff:` v4-mapped). Hostname-regex-only was sufficient when the only URLs came from the vendor's CDN; D16 makes callback bodies a URL source. Two limits are stated rather than hidden (run #3 excavator A38): a **lookup failure** (`ENOTFOUND`, timeout) is `KlingDownloadError('blocked-host')` with the DNS error as `cause` — fail closed; and the check is **time-of-check** — the resolved address is not pinned into the connection, so a host that rebinds between check and fetch defeats it. Pinning requires a custom undici `connect`; it is out of scope for 2.0 and recorded in §12.

### D13. Polling

`pollWithSpinner` is split: `poll()` in the library (no spinner, no TTY), `pollWithSpinner()` in `src/cli/`. Defaults: interval 3 s, deadline 15 min (unchanged, `src/config/constants.ts:27-30`), overridable per `wait()`. The completion predicate is `task.status === 'succeeded' || 'failed'` on the normalized `Task` — one site, both spellings handled upstream.

### D14. Downloads and save

`client.save(task, dir, opts)` forwards the client's `fetch`, `timeout`, and logger (a consumer who injected a proxied `fetch` must be able to download through it — run #2 F8); the standalone `save(task, dir, { includeWatermark?, signal?, fetch?, timeoutMs?, force? })` export exists for tasks not created by this client. Writes `outputs[]` to `<dir>/<task.id>-<index>.<ext>` where `ext` comes from the response `Content-Type`, falling back to the URL extension, then `.bin` — not a fixed `.png`. Throws `KlingOutputsExpiredError` before any request when `outputsExpireAt < now` unless `force: true` — the expiry is *derived* (`updatedAt + 30 d`, D4) and the vendor's clock may be more generous (run #2 A25). Metadata sidecar per D4.

### D15. CLI

```text
kling video t2v | i2v | omni | motion-control
kling image generate | omni | multi | outpaint | subject-completion
kling elements create | get | list | presets | delete
kling voices  create | get | list | presets | delete
kling avatar create
kling audio tts
kling tasks get <ids…> | list [--cursor] [--status] [--product-type] | get-by-product <product> <id>
kling account usage [--days] | balance | packages
```

Global: `--api-key`, `--output-dir`, `--json`, `--debug`, `-q`. The CLI owns the `./.env` / `~/.kling/.env` credential lookup (D2) and the spinner (D13). Removed flags: `--access-key`, `--secret-key`, `--mode`, `--cfg-scale`, `--negative-prompt` (video), `--camera-*`, `--image-tail` (→ `--last-frame`). `--wait` opt-in; `--no-download`; `--with-watermark` added. Local files are passed with `--first-frame ./x.png` and the CLI wraps them as `{ path }` — the string-is-never-a-path rule is a library rule, not a CLI one. Entry: `src/cli/index.ts` → `dist/cli/index.js` (`bin.kling`).

### D16. Callbacks and webhook verification

`verifyWebhookSignature({ id, timestamp, signature, rawBody, secret, toleranceSeconds = 300, now = () => Date.now() })` implements the Standard Webhooks scheme the vendor documents (App. C §4d). `now` is injectable because the vendor's published vector carries timestamp `1781080794` (2026-06-10) — the V13 test pins `now` to the vector's own instant to prove the signature, then moves `now` by 301 s to prove the skew control fails (run #3 anxiety F2; without the seam the two assertions cannot both hold). `parseCallback(rawBody: string | Uint8Array, { headers?, secret? })` → `{ task: Task, verified: true | null }`. When `secret` is supplied, a missing header set, a bad signature, or a stale timestamp **throws `KlingWebhookError`** — the parsed task is never handed back on a failed check (run #2 A21). When no `secret` is supplied, `verified` is `null` and the README says in bold that the body is unauthenticated and `save()` will fetch whatever URLs it names. `rawBody` must be the **exact bytes received** — Express/Fastify JSON parsers re-serialize and break signatures; the README shows `express.raw({ type: 'application/json' })`. Both callback body shapes parse via the two codecs — detected by `id` (new) vs `task_id` (legacy); a body carrying both throws `KlingCodecError`. Whether legacy-path callbacks are signed at all is §11 Q1. A callback *receiver* (HTTP server) is out of scope (§12).

### D17. Vendor docs snapshot

`docs/api/` (50 pages) is committed with `docs/api/README.md` recording the fetch date, the `llms.txt` URL, the excluded sections, and the **six body-identical multi-mount pairs that were kept** because their `Source:` URLs differ (App. B §1a lists four, App. C §7.9/§7.10 the other two). Pricing (`kling-pricing-video.md`, `kling-pricing-image.md`) was fetched 2026-09-20 during the v0.3.0 revision because the default-model policy (D6) cites cost — and the fetch changed the policy's wording (§10.11). 50 pages total.

### D18. Documentation

`README.md` rewritten from scratch in Phase 6 (every model name, endpoint, auth claim, and `task.data.task_id` example in it is stale — App. A §8.1). Until then the "1.x is broken" notice sits **at the top**, above Quick Start. `CHANGELOG.md` is hand-maintained (Keep a Changelog): `## [Unreleased]` is added in Phase 0 and accumulates; it becomes `## [2.0.0]` at publish. *Changed* names the semantics-without-signature changes explicitly: `TaskStatus` value `succeed → succeeded`, default models and the cost/newest policy, string `MediaSource` no longer a path.

### D19. Release mechanics (settled: manual)

- Remove `semantic-release` and the six `@semantic-release/*` devDependencies, `.releaserc.json`, and `.github/workflows/release.yml`. `ci.yml` stays and is extended to run on `push` to `main` and `release/**` and on `pull_request` targeting `main` **or `release/**`** (so parallel sub-phase branches are tested before they merge into `release/2.0` — run #2 A31); from 2a₀ it asserts `dist/index.js` and `dist/cli/index.js` exist.
- `package.json#version` is bumped by hand to `2.0.0` in Phase 6; `npm publish` is run by Alex after the Phase 6 checks.
- **Branch strategy:** phases 1–5 land on `release/2.0`. `main` stays at 1.0.0 (docs commits excepted) until Phase 6 merges the branch after `npm run verify` on the merged tree. Nothing published from `main` between now and then.

### D20. Test strategy

- **Seam:** `KlingConfig.fetch` injection. Tests pass a fake `fetch` that records the request and returns a fixture `Response`. No nock, no MockAgent, no `vi.mock('axios')`. One seam, zero new dependencies.
- **Fixtures:** one file per vendor *Request Example* and *Response Example* used, copied verbatim from `docs/api/` with the source path in a header comment. These pin **transcription fidelity** — that the codec produces/consumes exactly what the vendor documents. They do not prove the server accepts it; the vendor's docs have known sample errors (App. C §9 Q17). Server acceptance is proven by the opt-in live tests, one per endpoint family (§8 V10).
- **Controls:** every parser test has a wrong-standard fixture that must throw; every validator rule has a fail case; the smoke script has a garbage-key control; the import-graph lint has a fixture file with a deliberately illegal import that must fail (`eslint-plugin-import` + `eslint-import-resolver-typescript`, both devDependencies added in 1a — a `no-restricted-paths` rule whose resolver is misconfigured is silently inert, run #2 A27/F4).
- **Real-undici integration tests** (D11): three, on a Node 20/22 CI matrix, against a local `http.createServer` — not the vendor.
- **LOC accounting:** fixture JSON is excluded from the ≤ 500 budget but each sub-phase lists its fixture files; a sub-phase whose source+test LOC exceeds its budget by more than 20 % is split before it merges into `release/2.0` (replaces v0.3.0's "visible, not forbidden" — run #2 F2).

---

## 5. Target architecture

```text
src/
  index.ts                       public barrel — the "." export; re-exports everything in §6.4
  client.ts                      KlingClient: config, namespaces (video, image, elements, voices, avatar, audio, tasks, account)
  config/
    constants.ts                 BASE_URL, limits, ERROR_CODES (vendor table)
    models.ts                    VIDEO_MODELS, IMAGE_MODELS (D9)
    validators/                  video.ts, image.ts, resources.ts, helpers.ts — functions (params, caps) → void | warnings
  codecs/
    task.ts                      types only: Task, TaskOutput, TaskHandle, BillingEntry, Product, Standard
    new-standard.ts              buildX(params) → body; parseCreate/parseTasks/parseCursor → Task
    legacy.ts                    buildX(params) → body; parseCreate/parseTask/parseList → Task
  http/
    core.ts                      HttpCore: request(method, path, body|query, {signal}) with deadline + retry (D10)
    errors.ts                    error family (D10)
  products/
    tasks.ts                     createHandle(), get, list, getByProduct, listByProduct, product→path table
    video.ts  image.ts  elements.ts  voices.ts  avatar.ts  audio.ts  account.ts
  media/
    source.ts                    resolveMediaSource(MediaSource) → { url } | { base64 } (D12)
    download.ts                  fetchToBuffer(url, {maxBytes, maxRedirects, signal}) with per-hop validateUrl (D12)
  handlers/
    poller.ts                    poll(fn, {intervalMs, deadlineMs, signal})
    saver.ts                     save(task, dir, opts)
  webhooks.ts                    verifyWebhookSignature, parseCallback (D16)
  utils/                         logger.ts, security.ts (validateUrl, redactKey), file-io.ts — kept
  cli/
    index.ts                     commander program; credential lookup (.env chain); spinner
    video.ts image.ts resources.ts tasks.ts account.ts
```

**Import graph (edges allowed; anything else is a lint failure via `eslint-plugin-import` `no-restricted-paths`):**

| Module | May import |
|---|---|
| `codecs/task.ts` | nothing internal |
| `codecs/new-standard.ts`, `codecs/legacy.ts` | `codecs/task`, `http/errors` (to throw `KlingCodecError`), `config/constants` |
| `http/errors.ts` | `codecs/task` (types) |
| `http/core.ts` | `http/errors`, `config/constants`, `utils/*` |
| `config/validators/*` | `config/models`, `config/constants`, `http/errors`, `codecs/task` (types) |
| `media/*` | `http/errors`, `utils/security`, `config/constants` |
| `products/tasks.ts` | `http/*`, `codecs/*`, `handlers/poller`, `config/constants`, `node:crypto` |
| `products/<other>.ts` | `http/*`, `codecs/*`, `config/*`, `media/*`, `products/tasks` |
| `handlers/saver.ts` | `codecs/task`, `media/download`, `http/errors`, `utils/*` |
| `handlers/poller.ts` | `http/errors`, `config/constants` |
| `webhooks.ts` | `codecs/*`, `http/errors`, `node:crypto` |
| `config/loaders.ts`, `config/models.ts`, `config/constants.ts` | `codecs/task` (types) only |
| `utils/*` | `config/constants`, sibling `utils/*` |
| `client.ts` | `products/*`, `handlers/saver`, `http/*`, `config/*` |
| `cli/*` | `client`, `index`, `handlers/*`, `ora`, `dotenv`, `commander` |

`node:*` built-ins are unrestricted everywhere. No module imports `client.ts` or `cli/*` except `index.ts` / `cli/index.ts`. The zones are scoped to the 2.0 directories by name (`src/codecs`, `src/http`, `src/products`, `src/media`, `src/handlers`, `src/webhooks.ts`) so the additive 1a window does not lint 1.x files against 2.0 rules (run #3 excavator A44). The failing control is not a fixture on disk: the test calls `ESLint.lintText(source, { filePath: 'src/codecs/illegal.ts' })` with the production config and asserts the `import/no-restricted-paths` message — a virtual path inside a zone, so the control proves the production rule (run #3 excavator A39; a file under `test/` is outside every zone and would fail, or pass, for the wrong reason). Enforcement: `madge --circular src` and `eslint-plugin-import`'s `no-restricted-paths` with this table transcribed into `eslint.config.js`, both added in 1a with a failing control (D20).

`package.json`: `main`/`types` → `dist/index.js` / `dist/index.d.ts`; `exports`: `"."` only (types travel with it) plus `"./package.json"`. The `./auth`, `./utils`, `./config`, `./types` subpaths are removed — `./utils` exposed internals and had a dist-shape caveat (App. A §0). `bin.kling` → `dist/cli/index.js`. `files`: `dist`, `README.md`, `CHANGELOG.md`, `LICENSE`.

---

## 6. Types

### 6.1 Video parameters

```ts
export type KnownVideoModel = 'kling-3.0-turbo' | 'kling-3.0' | 'kling-3.0-omni' | 'kling-o1' | 'kling-2.6' | 'kling-2.5-turbo';
export type VideoModel = KnownVideoModel | (string & {});
export type Resolution = '720p' | '1080p' | '4k';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type AudioMode = 'native' | 'original' | 'off';

export interface CommonOptions {
  callbackUrl?: string;
  externalTaskId?: string;
  watermark?: boolean;
  signal?: AbortSignal;
}

export interface TextToVideoParams extends CommonOptions {
  model?: VideoModel;               // default 'kling-3.0-turbo'
  prompt: string;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  duration?: number;
  audio?: AudioMode;
  multiShot?: boolean;
}
export interface ImageToVideoParams extends Omit<TextToVideoParams, 'aspectRatio'> {
  firstFrame: MediaSource;
  lastFrame?: MediaSource;
  elements?: Array<{ elementId: string; id?: string }>;
  voices?: Array<{ voiceId: string; id?: string }>;
}
export interface OmniVideoParams extends CommonOptions {
  model?: VideoModel;               // default 'kling-3.0-omni'
  prompt: string;
  firstFrame?: MediaSource; lastFrame?: MediaSource;
  referImages?: Array<{ source: MediaSource; id?: string }>;
  featureVideo?: { url: string; id?: string };
  baseVideo?: { url: string; id?: string };
  elements?: Array<{ elementId: string; id: string }>;
  resolution?: Resolution; aspectRatio?: AspectRatio; duration?: number;
  audio?: AudioMode; multiShot?: boolean;
}
export interface MotionControlParams extends CommonOptions {
  model?: VideoModel;               // default 'kling-3.0'
  prompt?: string;
  image: MediaSource;
  video: string | { url: string };
  element?: { elementId: string; id: string };
  characterOrientation: 'image' | 'video';
  audio?: 'original' | 'off';
  resolution?: '720p' | '1080p';
}
```

### 6.2 Image parameters

```ts
export type KnownImageModel = 'kling-v3' | 'kling-v3-omni' | 'kling-image-o1' | 'kling-v2-1';
export type ImageModel = KnownImageModel | (string & {});
export type ImageResolution = '1k' | '2k' | '4k';
export type ImageAspectRatio = AspectRatio | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';

export interface ImageGenerateParams extends CommonOptions {
  model?: ImageModel;               // default 'kling-v3'
  prompt: string;
  negativePrompt?: string;
  image?: MediaSource;
  imageReference?: 'subject' | 'face';        // kling-v2-1 only
  imageFidelity?: number;                     // [0,1]
  humanFidelity?: number;                     // [0,1]; kling-v2-1 only; effective only with imageReference 'subject'
  elements?: Array<{ elementId: string }>;
  resolution?: '1k' | '2k';
  n?: number;                                 // 1–9
  aspectRatio?: ImageAspectRatio;
}
export interface OmniImageParams extends CommonOptions {
  model?: ImageModel;               // default 'kling-v3-omni'
  prompt: string;
  images?: MediaSource[];
  elements?: Array<{ elementId: string }>;
  resolution?: ImageResolution;
  resultType?: 'single' | 'series';
  seriesAmount?: number | 'auto';             // 2–9
  n?: number;
  aspectRatio?: ImageAspectRatio | 'auto';
}
export interface MultiImageToImageParams extends CommonOptions {
  prompt?: string;
  subjectImages: MediaSource[];               // 1–4
  sceneImage?: MediaSource;
  styleImage?: MediaSource;
  n?: number;
  aspectRatio?: ImageAspectRatio;
}
export interface OutpaintParams extends CommonOptions {
  image: MediaSource;
  up: number; down: number; left: number; right: number;   // each [0,2]; area ≤ 3×
  prompt?: string;
  n?: number;
}
export interface SubjectCompletionParams extends CommonOptions { frontalImage: MediaSource }
```

### 6.3 Resource parameters (from App. C §7.1, §7.2, §7.9, §7.10)

```ts
export interface AvatarCreateParams extends CommonOptions {          // POST /v1/videos/avatar/image2video
  image: MediaSource;                          // jpg/jpeg/png, ≤ 10 MB, ≥ 300 px, 1:2.5–2.5:1
  audioId?: string;                            // XOR soundFile; from TTS / voices, ≤ 30 days old, 2–300 s
  soundFile?: MediaSource;                     // mp3/wav/m4a/aac, ≤ 5 MB, 2–300 s
  prompt?: string;                             // ≤ 2500
  mode?: 'std' | 'pro';                        // default 'std' — the ONE surviving use of mode; legacy endpoint
}
export interface TtsParams {                                          // POST /v1/audio/tts (synchronous; no callback/externalTaskId fields exist)
  text: string;                                // ≤ 1000
  voiceId: string;                             // TTS has ITS OWN voice catalogue (e.g. 'oversea_male1', from the vendor's external Voice Guide, docs/api/kling-text-to-speech.md:49) — a /v1/general/presets-voices id returns 1201 'Voice id not found' [LIVE 2026-09-20]
  voiceLanguage: 'zh' | 'en';                  // vendor: Required Yes, default 'zh' — library requires it
  voiceSpeed?: number;                         // [0.8, 2.0], default 1.0
  signal?: AbortSignal;
}
export interface ElementCreateParams extends CommonOptions {         // POST /v1/general/advanced-custom-elements
  name: string;                                // element_name ≤ 20
  description: string;                         // element_description ≤ 100
  referenceType: 'image_refer' | 'video_refer';
  frontalImage?: MediaSource;                  // element_image_list.frontal_image — required for image_refer
  referImages?: MediaSource[];                 // element_image_list.refer_images[] — 1–3, required for image_refer
  referVideos?: Array<string | { url: string }>; // element_video_list.refer_videos[] — ≤ 1; mp4/mov, 3–8 s, 1080p, 16:9|9:16, ≤ 200 MB; URL only
  voiceId?: string;                            // element_voice_id
  tags?: string[];                             // tag_list[].tag_id — vendor ids 'o_101'…'o_108'
}
export interface ElementDeleteOptions { kind?: 'video' | 'image' }   // default 'video' → /v1/general/delete-advanced-elements; 'image' → /v1/general/delete-elements
export interface VoiceCreateParams extends CommonOptions {           // POST /v1/general/custom-voices
  name: string;                                // voice_name ≤ 20
  voiceUrl?: string;                           // XOR videoId; mp3/wav/mp4/mov, 5–30 s; URL only
  videoId?: string;                            // a 2.6-with-sound, avatar, or lip-sync output
}
export interface PageOptions { pageNum?: number; pageSize?: number; signal?: AbortSignal }   // pageNum 1–1000; pageSize 1–500 (voices: 1–1000)
```

Query/list/presets methods take an id or `PageOptions` and return `Task` / `Task[]` whose `outputs[]` are `element` or `voice` entries (D4).

### 6.4 Public exports (`src/index.ts`)

Values: `KlingClient`, `KlingError`, `KlingAPIError`, `KlingNetworkError`, `KlingTimeoutError`, `KlingResponseError`, `KlingCodecError`, `KlingValidationError`, `KlingTaskFailedError`, `KlingPollTimeoutError`, `KlingNoOutputsError`, `KlingOutputsExpiredError`, `KlingBatchError`, `KlingDownloadError`, `KlingWebhookError`, `verifyWebhookSignature`, `parseCallback`, `save`, `ERROR_CODES`, `VIDEO_MODELS`, `IMAGE_MODELS`, `BASE_URL`.
Types: everything in §6.1–6.3, `Task`, `TaskOutput`, `TaskHandle`, `TaskStatus`, `Standard`, `Product`, `LegacyProduct`, `BillingEntry`, `MediaSource`, `KlingConfig`, `RequestOptions`, `WaitOptions`, `RetryOptions`, `SaveOptions`, `PageOptions`.

```ts
export interface KlingConfig {
  apiKey?: string;                  // else process.env.KLING_API_KEY
  baseUrl?: string;                 // https only
  timeout?: number;                 // ms, default 30_000; covers body read
  retry?: RetryOptions;             // { maxAttempts?: 3; baseDelayMs?: 1000; maxDelayMs?: 30_000 }
  fetch?: typeof fetch;             // injection seam: proxies, tests
  unknownModels?: 'passthrough' | 'reject';   // default 'passthrough' (D9)
  capabilityValidation?: 'error' | 'warn';    // default 'error' (D9) — known-model capability rules only; shape rules always throw
  logger?: Logger;
}
```

---

## 7. Migration table — 1.x method → 2.0 disposition

| 1.x (`KlingAPI`) | 2.0 | Change class |
|---|---|---|
| `new KlingAPI({ accessKey, secretKey })` | `new KlingClient({ apiKey })` | **Breaking** — credential, class name |
| `getToken()`, `refreshToken()` | removed | **Removed** |
| `textToVideo(p)` → `TaskResponse` | `video.textToVideo(p)` → `TaskHandle` | **Breaking** — params, models, return type |
| `queryTextToVideoTask(id)` | `handle.get()` / `tasks.get(id)` | **Breaking** |
| `imageToVideo(p)` (`image`, `image_tail`) | `video.imageToVideo({ firstFrame, lastFrame })` | **Breaking** |
| `omniVideo(p)` (`<<<image_1>>>`, `image_list`, `video_list`, `element_list`) | `video.omni(p)` (`@image_1`, named fields) | **Breaking** — template syntax changed vendor-side |
| `extendVideo`, `queryExtendVideoTask` | removed — no vendor doc | **Removed** |
| `multiImageToVideo`, `queryMultiImageToVideoTask` | removed — use `video.omni({ referImages })` | **Removed** |
| — | `video.motionControl(p)` | **Added** |
| `generateImage(p)` (`kling-v1` default) | `image.generate(p)` (`kling-v3` default) | **Breaking** |
| `omniImage(p)` | `image.omni(p)` (`kling-v3-omni` default) | **Breaking** — default; `resultType`/`seriesAmount` added |
| `multiImageToImage(p)` (`kling-v2` default) | `image.multiImageToImage(p)` (no model param) | **Breaking** |
| `expandImage(p)` | `image.outpaint(p)` | **Renamed** (D3) |
| — | `image.subjectCompletion(p)` | **Added** |
| `createAvatar(p)`, `queryAvatarTask` | `avatar.create(p)` → `TaskHandle` | **Changed** — return type |
| — | `elements.*`, `voices.*`, `audio.tts` | **Added** |
| `waitForVideoResult(id, queryFn, opts)` / `waitForImageResult` | `handle.wait(opts)` | **Breaking** |
| `saveVideoResult(result, dir, prompt)` / `saveImageResult` | `save(task, dir, opts)` | **Changed** |
| `getAccountInfo(start, end, pack?)` | `account.usage(start, end, pack?)` | **Renamed**; `account.balanceLedger`, `account.packageLedger` **Added** |
| `healthCheck()` | `healthCheck()` — `GET /tasks?task_ids=0` | **Changed** — exercises the surface that rejects AK/SK |
| `TaskStatus` `'succeed'` | `'succeeded'` | **Breaking** — value |
| `result.data.task_result.videos[]` | `task.outputs.filter(o => o.type === 'video')` | **Breaking** — shape |
| string param = local file path | `{ path }` / `Buffer`; bare string = URL or Base64 | **Breaking** — semantics (D12) |
| `KLING_ACCESS_KEY`, `KLING_SECRET_KEY` | `KLING_API_KEY` | **Breaking** — env |
| `./auth`, `./utils`, `./config`, `./types` subpath imports | `kling-api` root only | **Breaking** — exports |
| CLI `--access-key --secret-key` | `--api-key` | **Breaking** |
| CLI `video t2v -m kling-v1 --mode pro --cfg-scale 0.5` | `video t2v -m kling-3.0-turbo -r 1080p` | **Breaking** — flags |

---

## 8. Verification

Each item names the check and how it can fail.

1. **Contract fixtures (transcription fidelity)** — per create endpoint, the built body deep-equals the vendor *Request Example* when given the example's inputs (with `undefined` omitted — the fixtures are edited only to remove fields the example itself omits); per query shape, the codec parses the vendor *Response Example* into the expected `Task`. **Control:** wrong-standard fixture → `KlingCodecError`. This proves the codec matches the docs, not that the server accepts it (D20).
2. **Status normalization** — `succeed` → `succeeded`; `succeeded` → `succeeded`; unknown → `KlingCodecError`, never `processing`. Timestamps: `undefined`/`0` stay absent (no `outputsExpireAt`), never `0 × 1000` (run #3 architect edge case).
2b. **SSRF per-hop control** — the blocked second hop is **`https://127.0.0.1/`** (and `https://[::1]/`, `https://0x7f000001/`), so the protocol check passes and the host check is what fires (run #3 anxiety F3).
3. **Validator rules (D9)** — pass and fail case per rule; fail message names the field; unknown model id with `unknownModels: 'passthrough'` warns and builds, with `'reject'` throws.
4. **Auth header** — `Authorization: Bearer <apiKey>` verbatim via the injected fetch; `grep -rn "eyJ\|jsonwebtoken\|HS256\|accessKey\|secretKey" src test` → 0.
5. **Live smoke** (`scripts/smoke.mjs`, read-only) — `GET /tasks?task_ids=0` 200; `POST /tasks {limit:1}` 200; `GET /account/costs` 200; `GET /v1/general/presets-voices` 200; **control** garbage key → 401 (record the business code, §11 Q9); exits non-zero if any expected-200 fails or the control returns 200.
6. **Live generation smoke, video** (opt-in) — `kling video t2v -m kling-3.0-turbo -d 3 -r 720p --wait` → playable mp4 (~2.4 units).
7. **Dead-literal census** — `grep -rnE "kling-v1\b|kling-v1-5|kling-v1-6|kling-v2-master|kling-v2-1-master|kling-v2-5-turbo|kling-v2-6|kling-v2-new|kling-video-o1|'kling-v2'" src` → 0 (`kling-v2-1` and `kling-image-o1` legitimately survive).
8. **Packaging** — `npm pack --dry-run` lists `dist/index.js`, `dist/cli/index.js`; no `dist/auth.*`, `dist/api.js`; `node -e "import('kling-api').then(m => console.log(Object.keys(m)))"` lists every value in §6.4; `kling --help` shows no `--access-key`.
9. **Docs** — README contains no `task_id`, `succeed'`, `accessKey`, or dead model literal; the notice is line 1–10 until the rewrite lands.
10. **Live acceptance per endpoint family** (opt-in, spends units; one per family, cheapest settings) — t2v (V6), i2v, omni (first-frame only), motion-control (skip unless a hosted reference video is available), `image.generate -n 1`, `image.omni -n 1`, `voices.create` from a hosted clip, `elements.create` from one frontal image. Each records `task.id` and the billing entry in the checklist.
11. **Retry classification** — mocked `1303` then `200` on a *read* → one retry after ≥1 s; mocked `1303` on a *create* → thrown immediately, `taskState === 'not-created'`, `isTransient() === true`, **`isRetryable() === false`**, fetch called once; mocked `5002` on a create → `taskState === 'may-exist'`; mocked network error mid-body on a create → thrown with `externalId`, `taskState === 'may-exist'`, fetch called once; mocked `ECONNREFUSED` on a create → retried, `'not-created'`; mocked HTTP 429 with body code `1102` on a read → **not** retried (permanent — run #3 anxiety F7).
12. **Import graph** — `madge --circular src` → none; the `no-restricted-paths` rules in §5 pass; **control:** a fixture with an illegal import fails the lint.
13. **Webhook** — with `now` pinned to the vector's timestamp: vendor test vector passes; flipped body byte → `KlingWebhookError('bad-signature')`; `now` + 301 s → `'stale-timestamp'`; no headers with a secret → `'missing-headers'`; no secret → `verified: null`.
14. **Real-undici integration** — three tests **through `HttpCore`** against a local `https.createServer` (self-signed; injected fetch with a permissive undici Agent; `validateUrl` test double), Node 20 and 22: manual-redirect `Location` exposure; `cause.code` on a refused connection to a *hostname*; abort mid-body.
15. **Release-blocking live items** (run #2 A34; §10.15 settled) — before 6c publishes, these checklist blanks must be filled: V5 smoke, V6 t2v (with audio-track check), V10 `image.generate`, Q2, Q11, Q13, Q15, and all five Phase 0 write probes (image, TTS, voice, element, avatar — the resource creates are release-blocking per §10.15). V10 omni/motion, Q1, and Q9-revoked are *not* release-blocking and are marked so in the checklist.

---

## 9. Phases

**Branch:** `release/2.0` for 1a–6b; `main` for 0 and 6c (D19). Each sub-phase is one commit, ≤ 500 LOC of source + tests (run #1 AF-003); estimates from the 1.x files each replaces, revised after run #2 F2 split 2a and 6a. Test LOC is in the budget; fixture JSON is not (D20).

| Phase | Scope | Est. LOC (src + test) | Exit criterion |
|---|---|---|---|
| **0 — Gate** (`main`) | Pricing fetched, README notice, `docs/api/README.md`, CHANGELOG `[Unreleased]` (all done); **paid legacy write probes with the API Key, one per legacy write family that 2.0 ships**: image generate (`kling-v3`, `n=1`, 1k), TTS (0.05 units), voice create from a hosted clip, element create from one frontal image, avatar create (cheapest: 720p, shortest audio) — five families, because `1103` is per-resource and an unprobed family would be first exercised after `auth.ts` is gone (run #3 excavator A40 / anxiety F10). On `1103`: check the account's packages before concluding the design is wrong — it is also the entitlement code. Remove `release.yml`/`.releaserc.json`/semantic-release deps; collapse CHANGELOG to one H1; extend `ci.yml` (push + PR on `main`, `release/**`). | ~60 | All five probes `code: 0` (costs recorded in the checklist; roughly 3 units total); `npm ci && npm test` green on `main`; spec + checklist at v0.4.1 committed. |
| **1a — Transport core** (additive) | `http/errors.ts` (~170 src), `http/core.ts` (~220), `config/constants.ts` rewrite (~60 net: local type aliases, vendor error table, dead `VALID_*` removed), `loadApiKey` (~20), `client.ts` skeleton (~30), `index.ts` (~15). Tests: errors (~120), core deadline/retry/redirect/JSON (~260). **Nothing deleted; 1.x still builds and its tests still run.** | ~515 src + ~380 test = ~895 → **split: 1a₁ errors+constants+loaders (~250+~120), 1a₂ core+client+index (~265+~260)** | V4 (new files only), V11; each ≤ 525. |
| **1c — Tooling + integration** | `madge`, `eslint-plugin-import`, resolver, `eslint.config.js` zones (~40), `lintText` control test (~40), three real-undici tests over local https (~150), `scripts/smoke.mjs` (~80), CI matrix (~20). | ~140 src/config + ~190 test = ~330 | V12 (+ control), V14; smoke V5 via `client.http.request()` raw calls. |
| **1b — Task model + codecs** | `codecs/task.ts` (~120 types), `codecs/new-standard.ts` parsers (~110), `codecs/legacy.ts` parsers (~130); fixtures for every *Response Example* in scope (JSON outside the budget; ~14 files listed). Tests: table tests + cross-codec controls (~200). | ~360 src + ~200 test = ~560 → **at the 20 % line; split legacy parsers into 1b₂ if the fixture count grows** | V1 (parse half), V2. |
| **2a₀ — Remove 1.x** | The §3.1 deletion commit: `auth.ts`, `client/`, `api.ts`, `operations/`, `types.ts`, `errors.ts`, `handlers/*`, `utils/{polling,downloads}.ts`, `cli.ts`, 16 tests; **`utils/index.ts` and `config/index.ts` trimmed** (re-exports of deleted modules removed — `utils/media.ts` stays until 2c); `vitest` coverage `include` → `src/**/*.ts`; stub `cli/index.ts`; `package.json` `main`/`bin`/`exports` (incl. `./api`) and `scripts.kling*` switched; `axios`, `jsonwebtoken`, `@types/jsonwebtoken`, `nock` removed; `ci.yml` dist assertions added. | deletion + ~30 lines of barrel/config edits | `tsc --noEmit && npm run build && npm test` green with only `test/2.0/`; `npm pack --dry-run` shows the 2.0 layout. |
| **2a₁ — Tasks + poller** | `products/tasks.ts` (~190: `createHandle`, `get` → `{tasks, missing}`, `list`, `getByProduct`, `listByProduct`, `recover`, `handle`, `healthCheck`, product→path table, `config/models.ts` skeleton so 2a₂/3a extend rather than create), `handlers/poller.ts` (~50), UUID `external_task_id` generation. Tests: shared-`wait()` semantics, chunking/`missing`/`unattempted`/`KlingBatchError`, `recover` routing per standard (~240). | ~240 src + ~240 test = ~480 | Live `tasks.list({limit:1})` closes Q2; live 100-id `get` closes Q13. |
| **2a₂ — Video t2v/i2v** | `VIDEO_MODELS` rows (~60), new-standard builders for t2v/i2v (~90), `products/video.ts` two methods + media redaction (~70), validators for t2v/i2v with `capabilityValidation` and `extra*` (~120). Tests: 8 request fixtures, ~15 rules × pass/fail (~260). | ~340 src + ~260 test = ~600 → **split: 2a₂ t2v (~170+~130), 2a₃ i2v (~170+~130)** | V1 (8 fixtures), V3; V6 opt-in (release-blocking); Q11 probe. |
| **2b — Video omni + motion** | builders (~90) + validators (~110) for omni and motion-control, count matrices, `@`-reference check; tests: 4 fixtures + matrices (~220). | ~200 src + ~220 test | V1, V3; V10 omni opt-in (not release-blocking). |
| **2c — Media + save** | `media/source.ts` (~90, per-standard + aggregate caps), `media/download.ts` (~80, D12, hardened `validateUrl`), `handlers/saver.ts` (~60, D14, `client.save`, `force`); delete `utils/media.ts`; tests (~220). | ~230 src + ~220 test | Byte-cap, redirect-cap, per-hop SSRF (IPv4 alt-encoding + IPv6 + DNS) tests each with a failing control; `save()` on the V6 task writes an mp4. |
| **3a — Image generate + omni** | `IMAGE_MODELS` (~40), legacy builders (~70), `products/image.ts` generate/omni (~40), validators (~50); tests (~220). | ~200 src + ~220 test | V1, V3; V10 image (release-blocking; the Phase 0 probe task is the first evidence). |
| **3b — Image multi + outpaint + subject-completion** | remaining builders/validators (~140); `listByProduct` fixtures; tests (~160). | ~140 src + ~160 test | V1, V3. |
| **4a — Elements + voices** | §6.3 types (~60), `products/elements.ts` (~90), `products/voices.ts` (~80), `delete(kind)`; tests (~220). | ~230 src + ~220 test | Contract tests; live `presets()` both ≥ 1; Q7 probe. |
| **4b — Avatar + TTS** | `products/avatar.ts` port (~70), `products/audio.ts` (~50); tests (~130). | ~120 src + ~130 test | Contract tests; TTS live call (already exercised in Phase 0). |
| **5 — Platform** | `products/account.ts` (~70), `webhooks.ts` (~100: `verifyWebhookSignature` with `now`, `parseCallback`); tests incl. vector + controls (~180). | ~170 src + ~180 test | V13; Q1 if a receiver is available (not release-blocking). |
| **6a₁ — CLI core + video** | `cli/index.ts` (program, `.env` chain, spinner, shared option parsing — ~140), `cli/video.ts` (4 subcommands ~220). Tests: help/defaults/required for 4 subcommands (~120). | ~360 src + ~120 test = ~480 | `kling --help` V8 checks; video subcommand tests. |
| **6a₂ — CLI image + tests** | `cli/image.ts` (5 subcommands ~200). Tests: image subcommands + `--json` shapes (~160). | ~200 src + ~160 test = ~360 | CLI tests green. |
| **6b — CLI resources/tasks/account** | `cli/resources.ts` (~120), `cli/tasks.ts` (~70), `cli/account.ts` (~50); tests (~160). | ~240 src + ~160 test | CLI tests. |
| **6c — Docs + package + merge** (`main`) | README rewrite, CHANGELOG `[2.0.0]`, `package.json` (version, engines, files), `ci.yml` dist assertions, `npm run verify` on the merged tree, release-blocking blanks (V15) filled, publish (Alex). | docs | V7, V8, V9, V15; `npm view kling-api version` → `2.0.0`; consumer smoke. |

**Ordering and file ownership** (run #3 architect F-11, excavator A48): 1a₁ → 1a₂ → 1c → 1b → 2a₀ → 2a₁ are strictly sequential. After 2a₁: 2a₂ → 2a₃ → 2b are sequential (they share `codecs/new-standard.ts` and `validators/video.ts`); 3a → 3b are sequential (they share `codecs/legacy.ts`); the **video chain and the image chain run in parallel** with each other and with 2c; `config/models.ts` has its skeleton from 2a₁ and each chain appends its own table (`VIDEO_MODELS` / `IMAGE_MODELS`) — no shared lines. 4a depends on 2a₁; 4b on 2c (media). Budget rule: fixture JSON is outside the number; an overrun > 20 % splits the sub-phase before merge (D20). Budgets above are per-file src + test estimates (run #2 required change 2, actually done in this revision).

---

## 10. Decisions put to Alex and their resolution

| # | Question | Recommendation | Resolution |
|---|---|---|---|
| 10.1 | Default video model (D6) | `kling-3.0-turbo` t2v/i2v, `kling-3.0-omni` omni, `kling-3.0` motion | Settled 2026-09-20 on a premise later corrected — **superseded by 10.11.** |
| 10.2 | Default omni-image (D7) | `kling-v3-omni` over vendor default `kling-image-o1` | **Settled — newest.** |
| 10.3 | Drop axios for native `fetch` (D11) | Yes | **Settled — yes.** |
| 10.4 | `engines.node >=20` | Yes | **Settled — yes.** |
| 10.5 | Resources in 2.0.0 vs 2.1 (D8) | 2.0.0 | **Settled — 2.0.0.** |
| 10.6 | Retain `raw` on `Task` (D4) | Yes for the first major | Open — proceeding; revisit at 3.0. |
| 10.7 | Spec filing | Package repo `docs/specs/` | Open — proceeding in-repo. |
| 10.8 | Release mechanics (D19) | — | **Settled — manual publish; semantic-release removed** (2026-09-20). |
| 10.9 | Unknown model ids (D9) | Pass through with warning; `unknownModels: 'reject'` opt-in | Recommendation — proceeding unless overruled. |
| 10.10 | Local-file media via `{ path }` only (D12) | Yes — bare strings never touch the filesystem | Recommendation — proceeding unless overruled. |
| 10.11 | Default video model, re-put after pricing was fetched (D6): 10.1 rested on "Turbo is cheapest", which the price list contradicts (`kling-3.0` silent 0.6/s vs Turbo 0.8/s). | Keep `kling-3.0-turbo` — cheapest current-gen *with audio*; a silent default surprises more consumers than a 0.2 unit/s premium | **Settled — `kling-3.0-turbo`** (Alex, 2026-09-20, with the corrected premise in front of him; alternatives offered: `kling-3.0` silent at 0.6/s, `kling-3.0` with audio at 0.9/s). Policy in D6/README: "cheapest current-generation model whose output includes native audio". |
| 10.12 | `isRetryable()` on creates (D10, run #2 A17) | Write-aware: `false` for creates/deletes; `isTransient()` exposes the vendor signal | Recommendation — proceeding unless overruled. |
| 10.13 | `parseCallback` on failed verification (D16, run #2 A21) | Throw `KlingWebhookError`; never return the task | Recommendation — proceeding unless overruled. |
| 10.14 | Auto-generated `external_task_id` on every create (D10, run #2 A20) | Yes — UUID when the caller supplies none; `externalTaskId: false` opts out | Recommendation — proceeding unless overruled. |
| 10.15 | Are live *creates* for elements/voices/avatar release-blocking (V15), or does transcription fidelity + a presets read suffice? (run #3 excavator A47) | Blocking — the Phase 0 probes now exercise each family once, so V15 gains them at no extra spend | **Settled — blocking** (Alex, 2026-09-20). V15 includes the three Phase 0 resource probes. |
| 10.16 | Does §12's "concurrency limiting out of scope" stand, given the double-bill corridor lands on the consumer's re-submit decision? (run #3 synthesis CMP-1) | Stands for 2.0 — `taskState` + `recover()` give the consumer the two facts a queue would need; a queue is a 2.x feature | **Settled — out of scope for 2.0** (Alex, 2026-09-20). |
| 10.17 | Live-programme budget: Phase 0 (5 probes), V6, V10 image/omni, Q11 (spends twice by design), Q13 — roughly 8–10 units total against a 100-unit trial pack (run #3 synthesis SCP-2) | Authorise as a block | **Settled — up to ~20 units authorised as a block** (Alex, 2026-09-20: ~10 planned, a further ~10 if needed without asking). The trial pack is use-it-or-lose-it and expires **2026-10-20** (`invalid_time` 1792530513975 from the live `/account/costs` probe), so unspent units have no value after that date — the live programme should run before then. Each spend is recorded in its checklist blank. |

---

## 11. Open questions and `[VERIFY]` items

| # | Question | Where it bites | Plan |
|---|---|---|---|
| Q1 | Callback shape is framed by *model* on the callbacks page but by *path* on the auth page. Which body does a `/omni-video/kling-3.0-omni` task emit, and are legacy-path callbacks signed? | D16 | `parseCallback` handles both and reports `verified`; confirm with one real callback in Phase 5 if a receiver exists. |
| Q2 | `POST /tasks` `start_time`/`end_time`: `long` in 3.0-turbo docs, `string` elsewhere (App. B §6.1). | `tasks.list` | Send numbers; if 400, strings; pin in a contract test **[LIVE]** Phase 2a. |
| Q3 | ~~3.0 Turbo native audio: capability map says supported, endpoint docs have no `audio` field.~~ **Inferred 2026-09-20, not probed:** the pricing table lists Turbo only as "With Native Audio" and the endpoint has no `audio` field, so the working assumption is always-on (run #3 anxiety F15 — an inference from a price list, on which both the validator reject and the D6 default rest). | D9 | Validator rejects `audio` on 3.0-turbo under `capabilityValidation: 'error'` with the message "native audio is always on for kling-3.0-turbo (inferred from pricing; pass capabilityValidation: 'warn' to send anyway)"; V6's output is inspected for an audio track, which closes this. |
| Q4 | `duration` on 3.0-omni with `feature_video`/`base_video`; `shot_type: intelligence` defined nowhere. | D6 | Pass `duration` only if set; document the gap. |
| Q5 | Which legacy video models still answer on `/v1/videos/text2video`? | None for 2.0 | Not probed — costs units; recorded so nobody re-derives it. |
| Q6 | `watermark_url` presence when `watermark_info.enabled=false`. | Saver | Optional; saved only when non-empty. |
| Q7 | Two element-delete paths; shared library? | D8 | Phase 4a: create via video path, delete via image path, observe. |
| Q8 | `kling-video-o3` appears only in element docs. | D9 warning text | Quote the vendor; do not model. |
| Q9 | ~~Which code does a *garbage* key produce (`1000` vs `1002`)?~~ **Answered 2026-09-21: `1002`, with the same misleading AK/SK text.** A *revoked* key? | D2 | Smoke control (done); a revoked-key probe if Alex rotates one. |
| Q10 | `/tasks` returns `200 data: []` for unknown ids **[LIVE]** — also for other accounts' ids? | `tasks.get` | Untestable with one account; document "empty = not visible". |
| Q11 | Is `external_task_id` an idempotency key (does a duplicate create return the existing task or `400`)? | D10 | Phase 2a: submit the same `external_task_id` twice (cheapest t2v); record the response. Until known, creates are never auto-retried. |
| Q12 | Are legacy *image* product timestamps ms? (Video and voice samples are; image samples not checked.) | D4 | Codec normalises: `t < 1e11` → seconds ×1000 with a warning; never throws on units (run #2 A24 — a hard throw would block every image `get()` until a release). Fixture tests cover image products. |
| Q13 | Maximum ids per `GET /tasks?task_ids=`; URL length. | D5 | Chunk at 50; probe 100 once in Phase 2a₁. |
| Q14 | Do the three undici behaviours D11 relies on hold on Node 20 and 22, and on an injected proxied fetch? | D11, D20 | Real-undici integration tests on the CI matrix (V14); injected-fetch divergence is documented, not tested. |
| Q15 | Does every legacy product's `GET /v1/<product>/{id}` accept an `external_task_id` in the path segment (App. B §3.6 says "most docs")? | D10 `recover()` | Recorded per product in the V10 blanks; a product that does not accept it is documented as unrecoverable like TTS. |
| Q16 | Where is the TTS voice catalogue? The docs link an external Voice Guide (`kling-text-to-speech.md:49`) not in the snapshot; only `oversea_male1` is known to work **[LIVE]**. | D8 `audio.tts`, README | Fetch the guide into `docs/api/` if it is retrievable; otherwise ship `voiceId` as a free string with the one known id in the README and the 1201 error mapped to a clear message. |

Client-side edge cases now specified: concurrent `wait()` (D5, shared loop); `succeeded` with empty outputs (D4); Base64 body inflation (D12, 20 MB cap); HTTP 429 with a non-JSON body (D10, `KlingResponseError`, retryable on reads); `external_task_id` reuse (Q11).

---

## 12. Out of scope for 2.0

- Virtual try-on, apparel replicator, goods studio, video commerce — not fetched, not modelled.
- Video effects, lip-sync, face detection, image recognition, multi-element editing, text-to-audio, video-to-audio — App. C §7; 2.x minors.
- A callback **receiver** (HTTP server) — the library verifies and parses; the consumer hosts.
- Client-side concurrency limiting / job queue — `1303` is surfaced with `taskState: 'not-created'`, not managed (D10); §10.16.
- DNS pinning between `validateUrl` and the download connection (D12) — the rebinding window is documented, not closed.
- Any upload/hosting for video inputs — the vendor has no upload endpoint.
- The uluops tracker/registry ecosystem — `kling-api` is standalone; the tracker run record is review bookkeeping, not a dependency.

---

## 13. Review findings → where this revision answers them

### 13.1 Run #1 (v0.2.0 → v0.3.0)

| Finding (agent) | Answer |
|---|---|
| AF-003 phase scope, no LOC (architect) | §9 sub-phased, LOC budgets, branch strategy |
| Release mechanics contradiction; `release.yml` (architect, excavator A6) | D19, §3, Phase 0 |
| `Task.product` unknowable from `/tasks` (architect) | D4 `standard` + optional `product`; sidecar from `handle.request` |
| Transport errors, AbortSignal (architect) | D10 error family, `signal` everywhere |
| `TaskHandle` in codecs; import graph (architect) | D5 factory in `products/tasks.ts`; §5 import table + madge |
| D3/D4 `outputs` contradiction (architect) | D3 reworded; checklist invariant greps vendor paths only |
| Undefined types, export set, `./types` target (architect) | §6.1–6.4, §5 `exports` |
| `human_fidelity` rule (architect) | D7, §2.3 — `subject`, warning |
| Missing checklist items; unsanctioned items (architect) | checklist v0.3.0 |
| Counts (architect, docs-validator) | §2.5, §3 corrected |
| Renames unjustified; `outpaint` (architect) | D3 |
| Spinner in library; `ora`/`dotenv` as library deps (architect, excavator A8) | D2, D11, D13 |
| Retry on create (excavator A1) | D10 policy table; Q11 |
| Closed model registry (excavator A2) | D9 passthrough |
| Kept utils depend on axios (excavator A3) | §3, D12, Phase 2c |
| fetch parity (excavator A4) | D11 |
| API Key on legacy writes (excavator A5) | §0, §1.2, Phase 0 gate |
| Legacy split leaks into names (excavator A7) | D5 product-neutral names |
| Deep-equal proves transcription (excavator A9) | D20, V1 wording, V10 |
| Pricing unfetched (excavator A10) | D17, Phase 0 |
| Default axis unstated (excavator A11) | D6 policy paragraph |
| 30-day retention on `Task` (excavator A12) | D4 `outputsExpireAt`, D14 |
| Single-task scale; uncapped ids (excavator A13) | D10 `1303` surfaced; D5 chunking; Q13 |
| Legacy callbacks signed? (excavator A14) | D16 `verified` tri-state |
| `1002` on revoked key (excavator A15) | Q9 |
| Timestamps ms (excavator A16) | D4, Q12 |
| Two survivors not one; D17 six kept; Docs row 8 (docs-validator) | §0, D17, `docs/api/README.md` |
| README Quick Start before notice; LICENSE link; ToC (docs-validator) | Phase 0 moves notice and fixes link; ToC collisions die with the Phase 6c rewrite |
| App. C stale sibling note (docs-validator) | Note added at App. C line 9 |

### 13.2 Run #2 (v0.3.0 → v0.4.0)

*Rows marked ⚠ were found by run #3 to overclaim and are re-answered in §13.3:* F2 ⚠ (split without itemisation), A20 ⚠ (new standard only), A23 ⚠ (tests could not reach the core), A27 ⚠ (control outside zones), A28 ⚠ (loopback control passed on protocol).

| Finding (agent) | Answer |
|---|---|
| F1 1a deletes modules 1.x still imports; 1.x disposition unstated (architect) | §3.1 disposition table; 1a additive; 2a₀ removal commit |
| F2 2a/6a budgets not credible; "not forbidden" (architect; excavator A32) | §9 split 2a → 2a₀/2a₁/2a₂, 6a → 6a₁/6a₂; D20 fixture rule and 20 % overrun rule |
| F3 `client.ts`/`index.ts`/webhook functions have no phase; 1a smoke (architect) | §5 `webhooks.ts`; 1a creates `client.ts`/`index.ts`; smoke uses raw `http.request` |
| F4/A27 `no-restricted-paths` unprovisioned (architect, excavator) | §5, D20, 1a: plugin + resolver + control |
| F5 §6.3 deferred (architect) | §6.3 written |
| F6 ERROR_CODES 24 vs 22 (architect, docs-validator) | §2.5, D10 references, checklist 1a |
| F7 sidecar media payloads (architect) | D4 redaction |
| F8 `save()` lacks fetch injection (architect) | D14 `client.save` + options |
| F9 default video model settled *and* open (architect) | header, D6 title, §10.11, checklist open-items |
| F10 `KlingDownloadTooLargeError` ad hoc (architect) | D10 `KlingDownloadError { reason }` |
| F11 import rows; `nock` not removed (architect) | §5 rows; 2a₀ |
| F12 stacked timeouts (architect) | D11, `KlingTimeoutError.attempt/attempts` |
| A17 `isRetryable()` on creates (excavator) | D10 write-aware `isRetryable` + `isTransient`; §10.12 |
| A18 one write probe generalized (excavator) | Phase 0: two families (image + TTS) |
| A19/A26 known-model strictness; body-schema drift (excavator) | D9 `capabilityValidation: 'warn'`, `extraSettings` |
| A20 timed-out create unrecoverable (excavator) | D10 auto `external_task_id`, `error.externalId`; §10.14 |
| A21 `parseCallback` returns task unverified (excavator) | D16 throws `KlingWebhookError`; raw-body precondition; §10.13 |
| A22 20 MB cap vs legacy 10 MB (excavator) | D12 per-standard caps |
| A23 fake fetch proves a model (excavator) | D11/D20 real-undici tests; V14; Q14 |
| A24 `create_time` hard-fail (excavator) | D4, Q12 normalise-and-warn |
| A25 `outputsExpireAt` no override (excavator) | D14 `force` |
| A28 `validateUrl` sufficiency (excavator) | D12 hardening |
| A29 chunk semantics (excavator) | D5 `{ tasks, missing }`, `KlingBatchError` |
| A30 API never redirects (excavator) | D10/D11 `redirect: 'manual'`, `KlingResponseError.location` |
| A31 CI PR filter (excavator) | D19 |
| A33 price snapshot (excavator) | D6 table dated; Phase 6c docs-diff already covers `docs/api/` — README table is regenerated from it |
| A34 conditional verification counted as answer (excavator) | §8 V15 release-blocking list |
| App. C §5c 10 of 12; App. A summary 18/8; fences; CHANGELOG order (docs-validator) | Appendices and CHANGELOG edited 2026-09-20 |

---

## Revision history

| Version | Date | Change |
|---|---|---|
| v0.1.0 | 2026-09-20 | Initial draft from the three appendix reports and the live probes. Settled: major bump, API Key only, JWT removed, full reboot. |
| v0.2.0 | 2026-09-20 | §10.1–10.5 resolved by Alex; companion checklist added; submitted to the pre-implementation pipeline (run #1: architect 65 REVISE, excavator 80, docs 69). |
| v0.3.0 | 2026-09-20 | Revised on run #1's 49 findings (§13.1). |
| v0.4.0 | 2026-09-20 | Revised on run #2's 39 findings (§13.2). |
| v0.4.1 | 2026-09-20 | Run #3 PROCEED (architect 86, docs 93, anxiety 86, synthesis 84, excavator 79). Folds in run #3's 59 findings (§13.3): `taskState` on write errors; `tasks.recover()` across both standards, TTS stated unrecoverable; https-through-`HttpCore` undici tests and loopback SSRF control; `lintText` virtual-path lint control; per-caller `wait()` semantics; `unattempted` on `KlingBatchError`; `extraOptions`/`extraContents` with known-key rejection; `[shape]`/`[capability]` rule labels; aggregate 40 MB cap and body-scaled create timeout; DNS fail-closed + TOCTOU stated; `now` injection for webhooks; per-file src/test budgets with 1a → 1a₁/1a₂/1c and 2a₂ → 2a₂/2a₃; §3.1 rows for barrels, `constants.ts`, `media.ts`, vitest, `./api`; Phase 0 probes one per shipped legacy write family; §10.15–10.17 for Alex. |
| v0.4.2 | 2026-09-20 | §10.11 (Turbo, on the corrected premise), §10.15 (resource creates release-blocking), §10.16 (queue out of scope), §10.17 (~10 units authorised) settled by Alex interactively. Approved for implementation; Phase 0 next. |
| v0.4.3 | 2026-09-20 | Phase 0 live results: packages are per product type — image writes return `1102` on a video-only account (not auth); TTS `voice_id` is a separate catalogue (`oversea_male1`), `presets-voices` ids return `1201` (Q16, §6.3). TTS and voice create/delete pass with the API Key at 0.05 units each. |
