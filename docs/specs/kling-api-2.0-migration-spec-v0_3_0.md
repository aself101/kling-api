# kling-api 2.0 — Migration Specification

| | |
|---|---|
| **Version** | v0.3.0 (draft — revised after pre-implementation run #1; resubmitted) |
| **Date** | 2026-09-20 |
| **Target repo** | `kling-api` (`misc/npm-packages/kling-api`, published as `kling-api` on npm) |
| **From → To** | `1.0.0` (2025-12-27, `264da22`) → `2.0.0` |
| **Decision owner** | Alex |
| **Settled decisions** | Major bump; API Key is the only credential; JWT (AccessKey/SecretKey) removed; full reboot of the public surface rather than an incremental patch. Default video model `kling-3.0-turbo`; default omni-image `kling-v3-omni`; native `fetch` replaces axios; `engines.node >=20`; elements/voices/avatar/TTS ship in 2.0.0. **semantic-release removed; publishing is manual.** *(Alex, 2026-09-20.)* |
| **Companion** | [Implementation checklist](kling-api-2.0-migration-checklist.md) — sub-phase work items, LOC budgets, and the check that closes each |
| **Appendices** | [A — v1 surface map](appendices/A-v1-surface-map.md) · [B — new-standard contracts](appendices/B-new-standard-contracts.md) · [C — legacy and platform contracts](appendices/C-legacy-and-platform-contracts.md) |
| **Review record** | Tracker project `kling-api`, pre-implementation run #1 (2026-09-20): architect 65 REVISE, assumption-excavator 80 EXAMINED, docs-validator 69 PARTIALLY_DOCUMENTED; 49 findings. §13 maps each required change to where this revision answers it. |
| **Vendor source** | `docs/api/*.md` — 50 pages fetched 2026-09-20 from the URLs in `https://kling.ai/document-api/llms.txt` (all of *Docs*, *Video APIs*, *Image APIs*, *Assets & Billing*, *Updates*, *Pricing* (base), plus `effects/video-effects`; the four e-commerce pages and the two solutions-pricing pages were not fetched) |

Every `file:line` below was verified against the working tree on 2026-09-20 (the architect re-verified 14/14 sampled). Claims about the vendor API are cited to a file under `docs/api/`; claims marked **[LIVE]** were confirmed by an HTTP call from this machine on 2026-09-20 against `https://api-singapore.klingai.com` (§1.2). Claims marked `[VERIFY]` could not be discharged from the docs or a read-only probe and are collected in §11.

---

## 0. Summary

The library's first live call in nine months failed with

> `The model 'kling-v1' has been discontinued and is no longer available.`

Investigation found the model error is the smallest of four changes:

1. **Authentication moved.** New-design endpoints accept only a static **API Key** bearer token and reject the JWT built from AccessKey/SecretKey with `401 / code 1002` **[LIVE]**. The API Key also authenticates every legacy endpoint tested **[LIVE — three read endpoints]**; whether it authenticates legacy *writes* is a Phase 0 gate (§9), not an assumption.
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
- Concurrency is per account, model version, and package type; an image task with `n` consumes `n` slots; over-limit returns `code 1303` *"parallel task over resource pack limit"* with **no `data`** and the vendor recommends exponential backoff from ≥1 s (App. C §3). Retry policy is in D10 and is **not** "retry everything retryable": a create that has received any HTTP response is never re-sent by the library, because a `5002` *"internal timeout, usually due to a backlog"* is exactly the case where the task may already exist and a retry would bill twice.

---

## 2. Vendor landscape (what exists on 2026-09-20)

### 2.1 Two design standards, by product

| Standard | Products | Create | Query | Status enum | Result |
|---|---|---|---|---|---|
| **NEW** (path-per-model) | text-to-video, image-to-video, omni-video, motion-control | `POST /<product>/<model>` body `{prompt \| contents[], settings{}, options{}}` | `GET /tasks?task_ids=a,b` · `GET /tasks?external_task_ids=…` · `POST /tasks {start_time,end_time,cursor,limit,filters[]}` | `submitted, processing, succeeded, failed` | `data.id`, `data.status`, `data.message`, `data.outputs[]` (typed union), `data.billing[]` — **no product or model field** |
| **LEGACY** (`/v1/`) | image generation, omni-image, multi-image-to-image, outpainting, ai-multi-shot; avatar, lip-sync, TTS, text-to-audio, video-to-audio, face/image recognition, multi-elements, effects; element & voice management | `POST /v1/<product>` flat body, `model_name` where selectable | `GET /v1/<product>/{id}` · `GET /v1/<product>?pageNum&pageSize` | `submitted, processing, succeed, failed` | `data.task_id`, `data.task_status`, `data.task_status_msg`, `data.task_result.{images[],videos[],audios[],elements[],voices[]}`, `final_unit_deduction`, `final_balance_deduction` |
| **Account** (neither prefix) | usage, billing ledgers | `GET /account/costs` (unchanged since 2024, *"free to call … QPS<=1"*), `POST /account/billing/balance`, `POST /account/billing/package` (added 07/06/2026) | — | — | App. C §6 |

Base URL is `https://api-singapore.klingai.com` for all three (`docs/api/kling-get-started-authentication.md`). Auth header is `Authorization: Bearer <API_KEY>` on every documented endpoint (48/48 pages).

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

The vendor table has 24 rows (23 error codes + success). The library's `ERROR_CODES` (`src/config/constants.ts:155-187`) has 19 codes + `SUCCESS` and misnames several (e.g. `1102` is *"Resource pack exhausted or expired"*, not `CONCURRENT_LIMIT`; `1202` is *"requested method is invalid"* (404), not `PARAM_OUT_OF_RANGE`). Missing: `1303` (concurrency over package limit, 429), `1304` (IP whitelist, 429), `5002` (internal timeout, 504). `1003`/`1004` (`nbf`/`exp`) become unreachable once JWT is gone.

---

## 3. Current surface, as it stands (App. A)

`KlingAPI` exposes 29 public methods (App. A §1.1): **10 create/query pairs over 20 flat-body `/v1/` endpoints** (App. A §2 table; its prose says 18 and is wrong) plus `/account/costs`, two `waitFor*Result`, two `save*Result`, `healthCheck`, `getToken`, `refreshToken`. Every create defaults to a model that no longer appears in any vendor enum except `multiImageToImage → kling-v2` (also gone; the endpoint now lists only `kling-v2-1`). The CLI has **10 generating subcommands** (5 video, 4 image, 1 avatar — App. A §6); 7 default to a dead model (App. A §6.5).

Response-shape coupling is concentrated but wide: `data.task_id` is read at 12 sites, `data.task_status` at 12, `task_result.videos|images` at 10, all funnelling through one poll predicate at `src/handlers/result-poller.ts:31,40` (App. A §2.1, §5). Auth is JWT end-to-end with the header injected by an unconditional axios interceptor (`src/client/http-client.ts:68-74`); `KlingConfig` has no API-key field (App. A §4).

axios is used in **three** places, not one: the client (`src/client/http-client.ts`), and the media/download utilities (`src/utils/downloads.ts:38-39,65-66`, `src/utils/media.ts:88-89,164-165`) which rely on `maxContentLength` and `maxRedirects` — knobs native `fetch` does not have. D12 specifies the port.

Tests: 16 files / **8,300 lines** (App. A §7 table sum), all pinned to `/v1/` paths, `model_name: 'kling-v1'`, `task_status: 'succeed'`, and a `^Bearer eyJ` JWT-shape regex. They are a specification of the 1.x contract and will be replaced, not migrated.

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
- The `401 / 1002` message **[LIVE]** is surfaced verbatim by `KlingAPIError`. The library adds one hint only: if `1000`–`1004` is returned and the key is empty, the message names the two sources. Whether a *revoked* key also returns `1002` is §11 Q9; the smoke script's control probe records it.
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
  createdAt: number;               // ms (both standards; codec asserts a plausible epoch-ms range, §11 Q12)
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
- The saver's metadata sidecar records `product`, `standard`, the *request* the handle was created from (model included), and `raw` — `model` is not on `Task` because no vendor envelope carries it.

### D5. Query routing: `TaskHandle` from every create; product-neutral escape hatches

Unified `/tasks` only knows new-standard tasks; legacy tasks are queried at `GET /v1/<product>/{id}`. A bare `getTask(id)` cannot work without knowing the product. Every create returns:

```ts
export interface TaskHandle {
  id: string;
  externalId?: string;
  standard: Standard;
  product: Product;
  request: Record<string, unknown>;              // the normalized params the create was built from (model, resolution, …)
  get(options?: RequestOptions): Promise<Task>;
  wait(options?: WaitOptions): Promise<Task>;    // resolves on succeeded; throws KlingTaskFailedError on failed, KlingPollTimeoutError on deadline
}
```

`TaskHandle` is an **interface in `codecs/task.ts`**; its implementation is `createHandle(core, product, id, request)` in `products/tasks.ts`, which owns the product → path routing table. Codecs import no HTTP. Two concurrent `wait()` calls on one handle share a single poll loop (a memoized promise cleared on settle).

Escape hatches — named by *what the caller holds*, not by vendor standard, so a future image move changes no method names:

- `tasks.get(ids: string | string[], { byExternalId?: boolean, signal? })` → `Task[]` — new-standard batch (`GET /tasks`). Ids are chunked at 50 per request (the vendor states no cap; §11 Q13). Results have `standard: 'new'` and `product` undefined.
- `tasks.list({ startTime?, endTime?, cursor?, limit?, status?, productType?, signal? })` → `{ tasks, count, nextCursor, hasMore }` — new-standard cursor (`POST /tasks`).
- `tasks.getByProduct(product: Product, id: string)` → `Task` — routes by product: new-standard products go to `/tasks`, legacy products to `/v1/<path>/{id}`. This is the method for reconstituting a stored id.
- `tasks.listByProduct(product: LegacyProduct, { pageNum?, pageSize? })` → `Task[]` — legacy per-product list.
- `tasks.handle(product, id, request?)` → `TaskHandle`.

Rejected: a `getTask(id)` that tries `/tasks` then probes each legacy product. Up to 6 round trips for a legacy id, and `/tasks` returns `200 data: []` for unknown ids **[LIVE]**, so "not here" is indistinguishable from "nowhere".

### D6. Video surface (new standard only) (defaults settled)

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

Cross-field rules are **plain validator functions** in `src/config/validators/video.ts` (the existing pattern), one per product, taking `(params, caps)`. Each carries a comment citing the `docs/api/` line. The rules that exist in the docs today (App. B §2): 2.6 native audio ⇒ 1080p; 2.6 / 2.5-turbo first+last ⇒ 1080p; 2.6 `voices` ⇒ `audio ≠ off`, ≤2; 3.0-omni `baseVideo` ⇒ `audio ≠ native`, no frames, no multi-shot; 3.0-omni `featureVideo` ⇒ `audio = off`, `multiShot ≠ false`; omni `aspectRatio` required when no first frame and no reference video; O1 first-frame-only ⇒ duration 5|10; motion-control reference video ≤10 s (`image`) / ≤30 s (`video`) — URL-only, stated in the message as uncheckable client-side; element/refer-image count matrices (App. B §2.5). Media-size rules apply to Buffers and local files; URLs are not fetched to check. Prompt length: 3072 for 3.0 / 3.0-omni / 3.0-turbo t2v, 2500 elsewhere (3.0-turbo i2v says 2500, App. B §6.2).

### D10. Errors and retry

```ts
class KlingError extends Error { requestId?: string }
class KlingAPIError extends KlingError { code: number; httpStatus: number; isRetryable(): boolean }   // vendor business error
class KlingNetworkError extends KlingError { cause: unknown }                                         // fetch TypeError: DNS, refused, reset — no response received
class KlingTimeoutError extends KlingError { deadlineMs: number }                                     // our AbortController fired (covers headers AND body read)
class KlingResponseError extends KlingError { httpStatus: number; bodySnippet: string }               // non-JSON or unparseable body (CDN 429/502 HTML pages)
class KlingCodecError extends KlingError { standard: Standard; path: string }                         // envelope parsed but not the shape the codec expects
class KlingValidationError extends KlingError { field: string }                                       // = today's ValidationError, renamed for the family
class KlingTaskFailedError extends KlingError { task: Task; code: number | null }                     // vendor message; code null when the envelope carries none
class KlingPollTimeoutError extends KlingError { task: Task | null; elapsedMs: number }
class KlingNoOutputsError extends KlingError { task: Task }
class KlingOutputsExpiredError extends KlingError { task: Task }
```

`ERROR_CODES` is the 24-row vendor table (App. C §2), names from the vendor's *Explanation* column.

**Retry policy (the part run #1 A1 forced):**

| Request class | Retried by the core? | On |
|---|---|---|
| Reads: `GET /tasks`, `POST /tasks` (cursor), `GET /v1/…/{id}`, lists, presets, `/account/*` | Yes, exponential backoff from 1 s, ≤ `retry.maxAttempts` (default 3) | `KlingNetworkError`, `KlingTimeoutError`, HTTP 429/502/503/504, business `1302`/`1303`/`5000`/`5001`/`5002` |
| Creates and deletes (any `POST` that spends or mutates) | **Never re-sent once any HTTP response was received.** Retried only on `KlingNetworkError` where the failure is provably pre-request (DNS, connection refused). A reset after the request was written is *not* retried. | — |
| Downloads (`save()`) | Yes, same list, idempotent by construction | — |

A `1303` on a create surfaces immediately as `KlingAPIError` with `isRetryable() === true`; the consumer decides whether to wait for a slot — the library does not hide queue pressure (A13). `POST /tasks` is a query despite the verb and is classed as a read.

`signal?: AbortSignal` is accepted on every request and on `wait()`; abort surfaces as the caller's `AbortError`, never wrapped.

### D11. HTTP dependency (settled): native `fetch`, with the parity gaps stated

axios is removed. `engines.node >=20.0.0`. Runtime dependencies become `commander`, `dotenv`, `ora` — the latter two imported **only from `src/cli/`**. Parity gaps that consumers must know (README):

- Node's `fetch` (undici) **ignores `HTTP(S)_PROXY`**. `KlingConfig.fetch?: typeof fetch` lets a consumer inject a proxied fetch (`undici.ProxyAgent` via `EnvHttpProxyAgent`, or any WHATWG-compatible implementation). This is also the test seam (§8).
- Redirects: the core uses `redirect: 'error'` for API calls (the API never redirects) and a **manual redirect loop** for downloads (D12).
- Timeout: one `AbortController` deadline per request covers connection, headers, *and* body read (the core reads the body itself), so a stalled body cannot hang past `timeout`.

### D12. Media input and download

```ts
export type MediaSource =
  | string                        // https URL, or a Base64 string (detected by prefix / charset) — NEVER a filesystem path
  | { url: string }
  | { base64: string; mimeType?: string }
  | { path: string }              // explicit local file; read + Base64-encoded with size/dimension/extension checks
  | Buffer | Uint8Array;
```

A bare string is never treated as a path. 1.x's `processMediaSource` read any string that `existsSync` matched (`src/utils/media.ts:62`) — a server passing user input to `imageToVideo` would read from its own disk (run #1 A8). Video inputs (`featureVideo`, `baseVideo`, motion `video`, voice `voiceUrl`) accept `string | { url }` only and throw `KlingValidationError('… must be a URL; the Kling API has no upload endpoint')` otherwise. A 50 MB local image inflates to ~67 MB of JSON; the library caps local/Buffer inputs at 20 MB and says so (the vendor's 50 MB limit is for URLs it fetches itself).

Downloads (`src/utils/downloads.ts`, `src/utils/media.ts` URL branches) are ported to `fetch` preserving the three axios-provided properties run #1 A3 identified: **byte cap** (stream and abort past `MAX_*_SIZE`), **redirect cap** (`redirect: 'manual'`, ≤ `MAX_REDIRECTS` hops), and **per-hop SSRF check** (`validateUrl` on every `Location`, not just the first URL — 1.x checked only the first hop).

### D13. Polling

`pollWithSpinner` is split: `poll()` in the library (no spinner, no TTY), `pollWithSpinner()` in `src/cli/`. Defaults: interval 3 s, deadline 15 min (unchanged, `src/config/constants.ts:27-30`), overridable per `wait()`. The completion predicate is `task.status === 'succeeded' || 'failed'` on the normalized `Task` — one site, both spellings handled upstream.

### D14. Downloads and save

`save(task, dir, { includeWatermark?, signal? })` writes `outputs[]` to `<dir>/<task.id>-<index>.<ext>` where `ext` comes from the response `Content-Type`, falling back to the URL extension, then `.bin` — not a fixed `.png`. Throws `KlingOutputsExpiredError` before any request when `outputsExpireAt < now`. Metadata sidecar per D4.

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

`verifyWebhookSignature({ id, timestamp, signature, rawBody, secret, toleranceSeconds = 300 })` implements the Standard Webhooks scheme the vendor documents (App. C §4d), tested against the vendor's published vector and two controls. `parseCallback(rawBody, headers?, secret?)` → `{ task: Task, verified: boolean | null }` — `null` when no secret was supplied, `false` when headers are absent or fail (legacy-path callbacks may be unsigned, §11 Q1/A14), `true` only on a passing signature. Both callback body shapes parse via the two codecs (detected by `id` vs `task_id`). A callback *receiver* (HTTP server) is out of scope (§12).

### D17. Vendor docs snapshot

`docs/api/` (50 pages) is committed with `docs/api/README.md` recording the fetch date, the `llms.txt` URL, the excluded sections, and the **six body-identical multi-mount pairs that were kept** because their `Source:` URLs differ (App. B §1a lists four, App. C §7.9/§7.10 the other two). Pricing (`kling-pricing-video.md`, `kling-pricing-image.md`) was fetched 2026-09-20 during the v0.3.0 revision because the default-model policy (D6) cites cost — and the fetch changed the policy's wording (§10.11). 50 pages total.

### D18. Documentation

`README.md` rewritten from scratch in Phase 6 (every model name, endpoint, auth claim, and `task.data.task_id` example in it is stale — App. A §8.1). Until then the "1.x is broken" notice sits **at the top**, above Quick Start. `CHANGELOG.md` is hand-maintained (Keep a Changelog): `## [Unreleased]` is added in Phase 0 and accumulates; it becomes `## [2.0.0]` at publish. *Changed* names the semantics-without-signature changes explicitly: `TaskStatus` value `succeed → succeeded`, default models and the cost/newest policy, string `MediaSource` no longer a path.

### D19. Release mechanics (settled: manual)

- Remove `semantic-release` and the six `@semantic-release/*` devDependencies, `.releaserc.json`, and `.github/workflows/release.yml`. `ci.yml` stays and is extended to run on `push` to `main` and `release/**` as well as `pull_request`; it asserts `dist/index.js` and `dist/cli/index.js` exist.
- `package.json#version` is bumped by hand to `2.0.0` in Phase 6; `npm publish` is run by Alex after the Phase 6 checks.
- **Branch strategy:** phases 1–5 land on `release/2.0`. `main` stays at 1.0.0 (docs commits excepted) until Phase 6 merges the branch after `npm run verify` on the merged tree. Nothing published from `main` between now and then.

### D20. Test strategy

- **Seam:** `KlingConfig.fetch` injection. Tests pass a fake `fetch` that records the request and returns a fixture `Response`. No nock, no MockAgent, no `vi.mock('axios')`. One seam, zero new dependencies.
- **Fixtures:** one file per vendor *Request Example* and *Response Example* used, copied verbatim from `docs/api/` with the source path in a header comment. These pin **transcription fidelity** — that the codec produces/consumes exactly what the vendor documents. They do not prove the server accepts it; the vendor's docs have known sample errors (App. C §9 Q17). Server acceptance is proven by the opt-in live tests, one per endpoint family (§8 V10).
- **Controls:** every parser test has a wrong-standard fixture that must throw; every validator rule has a fail case; the smoke script has a garbage-key control.

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
| `products/tasks.ts` | `http/*`, `codecs/*`, `handlers/poller` |
| `products/<other>.ts` | `http/*`, `codecs/*`, `config/*`, `media/*`, `products/tasks` |
| `handlers/saver.ts` | `codecs/task`, `media/download`, `http/errors`, `utils/*` |
| `client.ts` | `products/*`, `http/core`, `config/*` |
| `cli/*` | `client`, `index`, `handlers/*`, `ora`, `dotenv`, `commander` |

No module imports `client.ts` or `cli/*` except `index.ts` / `cli/index.ts`. `madge --circular src` is a CI step once `madge` is added as a devDependency (Phase 1).

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

### 6.3 Resource parameters — mirror App. C §7.1, §7.2, §7.9, §7.10 in camelCase; written in the checklist Phase 4a as the first item, reviewed against the vendor tables before code.

### 6.4 Public exports (`src/index.ts`)

Values: `KlingClient`, `KlingError`, `KlingAPIError`, `KlingNetworkError`, `KlingTimeoutError`, `KlingResponseError`, `KlingCodecError`, `KlingValidationError`, `KlingTaskFailedError`, `KlingPollTimeoutError`, `KlingNoOutputsError`, `KlingOutputsExpiredError`, `verifyWebhookSignature`, `parseCallback`, `save`, `ERROR_CODES`, `VIDEO_MODELS`, `IMAGE_MODELS`, `BASE_URL`.
Types: everything in §6.1–6.3, `Task`, `TaskOutput`, `TaskHandle`, `TaskStatus`, `Standard`, `Product`, `LegacyProduct`, `BillingEntry`, `MediaSource`, `KlingConfig`, `RequestOptions`, `WaitOptions`, `RetryOptions`.

```ts
export interface KlingConfig {
  apiKey?: string;                  // else process.env.KLING_API_KEY
  baseUrl?: string;                 // https only
  timeout?: number;                 // ms, default 30_000; covers body read
  retry?: RetryOptions;             // { maxAttempts?: 3; baseDelayMs?: 1000; maxDelayMs?: 30_000 }
  fetch?: typeof fetch;             // injection seam: proxies, tests
  unknownModels?: 'passthrough' | 'reject';   // default 'passthrough' (D9)
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
2. **Status normalization** — `succeed` → `succeeded`; `succeeded` → `succeeded`; unknown → `KlingCodecError`, never `processing`.
3. **Validator rules (D9)** — pass and fail case per rule; fail message names the field; unknown model id with `unknownModels: 'passthrough'` warns and builds, with `'reject'` throws.
4. **Auth header** — `Authorization: Bearer <apiKey>` verbatim via the injected fetch; `grep -rn "eyJ\|jsonwebtoken\|HS256\|accessKey\|secretKey" src test` → 0.
5. **Live smoke** (`scripts/smoke.mjs`, read-only) — `GET /tasks?task_ids=0` 200; `POST /tasks {limit:1}` 200; `GET /account/costs` 200; `GET /v1/general/presets-voices` 200; **control** garbage key → 401 (record the business code, §11 Q9); exits non-zero if any expected-200 fails or the control returns 200.
6. **Live generation smoke, video** (opt-in) — `kling video t2v -m kling-3.0-turbo -d 3 -r 720p --wait` → playable mp4 (~2.4 units).
7. **Dead-literal census** — `grep -rnE "kling-v1\b|kling-v1-5|kling-v1-6|kling-v2-master|kling-v2-1-master|kling-v2-5-turbo|kling-v2-6|kling-v2-new|kling-video-o1|'kling-v2'" src` → 0 (`kling-v2-1` and `kling-image-o1` legitimately survive).
8. **Packaging** — `npm pack --dry-run` lists `dist/index.js`, `dist/cli/index.js`; no `dist/auth.*`, `dist/api.js`; `node -e "import('kling-api').then(m => console.log(Object.keys(m)))"` lists every value in §6.4; `kling --help` shows no `--access-key`.
9. **Docs** — README contains no `task_id`, `succeed'`, `accessKey`, or dead model literal; the notice is line 1–10 until the rewrite lands.
10. **Live acceptance per endpoint family** (opt-in, spends units; one per family, cheapest settings) — t2v (V6), i2v, omni (first-frame only), motion-control (skip unless a hosted reference video is available), `image.generate -n 1`, `image.omni -n 1`, `voices.create` from a hosted clip, `elements.create` from one frontal image. Each records `task.id` and the billing entry in the checklist.
11. **Retry classification** — mocked `1303` then `200` on a *read* → one retry after ≥1 s; mocked `1303` on a *create* → thrown immediately, `isRetryable() === true`, fetch called once; mocked network error mid-body on a create → thrown, fetch called once.
12. **Import graph** — `madge --circular src` → none; the `no-restricted-paths` rules in §5 pass.
13. **Webhook** — vendor test vector passes; flipped body byte fails; skew 301 s fails.

---

## 9. Phases

**Branch:** `release/2.0` for 1–5; `main` for 0 and 6 (D19). Each sub-phase is one commit, ≤ 500 LOC of source + tests (run #1 AF-003); estimates from the 1.x files each replaces. Test LOC is included in the budget.

| Phase | Scope | Est. LOC (src + test) | Exit criterion |
|---|---|---|---|
| **0 — Gate** (`main`) | ~~Fetch pricing~~ (done in the v0.3.0 revision); move README notice to top; fix `docs/api/README.md` count; add `## [Unreleased]` to CHANGELOG; **run one paid legacy image create with the API Key** (`POST /v1/images/generations`, `kling-v3`, `n=1`, ~cheapest) — its `task_id` and `code: 0` are the gate for deleting `auth.ts` (run #1 A5); remove `release.yml`/`.releaserc.json`/semantic-release deps; extend `ci.yml`. | ~60 | Image create 200; `npm ci && npm test` green on `main`; this spec + checklist at v0.3.0 committed. |
| **1a — Transport** | `http/errors.ts`, `http/core.ts` (deadline, retry policy D10, JSON/non-JSON handling), `config/constants.ts` (vendor error table), `loadApiKey`, `madge` devDep + CI step. Delete `auth.ts`, `axios`, `jsonwebtoken`. | ~450 | V4, V11; smoke V5 passes against the new core. |
| **1b — Task model + codecs** | `codecs/task.ts`, `codecs/new-standard.ts` (parsers), `codecs/legacy.ts` (parsers), fixtures for every *Response Example* in scope. | ~480 | V1 (parse half), V2, V12. |
| **2a — Video t2v/i2v + handles** | `products/tasks.ts` (`createHandle`, `get`, `list`, `getByProduct`, `listByProduct`), `handlers/poller.ts`, `products/video.ts` (t2v, i2v), new-standard builders for those two, `VIDEO_MODELS`, validators for t2v/i2v. | ~500 | V1 (t2v/i2v build), V3 (t2v/i2v rules); live `tasks.list({limit:1})` closes §11 Q2; V6 opt-in. |
| **2b — Video omni + motion** | builders + validators for omni and motion-control, count matrices, `@`-reference check. | ~420 | V1, V3 for both; V10 omni opt-in. |
| **2c — Media + save** | `media/source.ts`, `media/download.ts` (D12), `handlers/saver.ts` (D14). Delete `utils/media.ts`, `utils/downloads.ts`. | ~400 | Byte-cap, redirect-cap, per-hop SSRF tests each with a failing control; `save()` on a V6 task writes an mp4. |
| **3a — Image generate + omni** | `IMAGE_MODELS`, legacy builders, `products/image.ts` (generate, omni), validators. | ~420 | V1, V3; V10 image opt-in (uses the Phase 0 task as first evidence). |
| **3b — Image multi + outpaint + subject-completion** | remaining image builders/validators; `listByProduct` for image products. | ~300 | V1, V3. |
| **4a — Elements + voices** | §6.3 types (reviewed against vendor tables first), `products/elements.ts`, `products/voices.ts`, builders, `delete(kind)`. | ~450 | Contract tests; live `presets()` both return ≥1; §11 Q7 probe. |
| **4b — Avatar + TTS** | `products/avatar.ts` (port), `products/audio.ts`. | ~250 | Contract tests. |
| **5 — Platform** | `products/account.ts` (usage, ledgers), `verifyWebhookSignature`, `parseCallback`. | ~350 | V13; §11 Q1 real-callback check if a receiver is available. |
| **6a — CLI video + image** | `cli/index.ts`, `cli/video.ts`, `cli/image.ts`, credential chain, spinner. Delete `src/cli.ts`. | ~500 | `test/cli.test.ts` rewritten; `kling --help` V8 checks. |
| **6b — CLI resources/tasks/account** | `cli/resources.ts`, `cli/tasks.ts`, `cli/account.ts`. | ~400 | CLI tests. |
| **6c — Docs + package + merge** (`main`) | README rewrite, CHANGELOG `[2.0.0]`, `package.json` (version, exports, engines, deps, files), `npm run verify` on the merged tree, publish (Alex). | ~— | V7, V8, V9; `npm view kling-api version` → `2.0.0`; consumer smoke. |

2a/2b/2c and 3a/3b can proceed in parallel branches off `release/2.0` once 1b lands; 4a depends on 2a (handles).

---

## 10. Decisions put to Alex and their resolution

| # | Question | Recommendation | Resolution |
|---|---|---|---|
| 10.1 | Default video model (D6) | `kling-3.0-turbo` t2v/i2v, `kling-3.0-omni` omni, `kling-3.0` motion | **Settled — as recommended** (2026-09-20). |
| 10.2 | Default omni-image (D7) | `kling-v3-omni` over vendor default `kling-image-o1` | **Settled — newest.** |
| 10.3 | Drop axios for native `fetch` (D11) | Yes | **Settled — yes.** |
| 10.4 | `engines.node >=20` | Yes | **Settled — yes.** |
| 10.5 | Resources in 2.0.0 vs 2.1 (D8) | 2.0.0 | **Settled — 2.0.0.** |
| 10.6 | Retain `raw` on `Task` (D4) | Yes for the first major | Open — proceeding; revisit at 3.0. |
| 10.7 | Spec filing | Package repo `docs/specs/` | Open — proceeding in-repo. |
| 10.8 | Release mechanics (D19) | — | **Settled — manual publish; semantic-release removed** (2026-09-20). |
| 10.9 | Unknown model ids (D9) | Pass through with warning; `unknownModels: 'reject'` opt-in | Recommendation — proceeding unless overruled. |
| 10.10 | Local-file media via `{ path }` only (D12) | Yes — bare strings never touch the filesystem | Recommendation — proceeding unless overruled. |
| 10.11 | Default video model, re-put after pricing was fetched (D6): 10.1 rested on "Turbo is cheapest", which the price list contradicts (`kling-3.0` silent 0.6/s vs Turbo 0.8/s). | Keep `kling-3.0-turbo` — cheapest current-gen *with audio*; a silent default surprises more consumers than a 0.2 unit/s premium | **Open — Alex to confirm or switch to `kling-3.0`.** Spec proceeds with Turbo. |

---

## 11. Open questions and `[VERIFY]` items

| # | Question | Where it bites | Plan |
|---|---|---|---|
| Q1 | Callback shape is framed by *model* on the callbacks page but by *path* on the auth page. Which body does a `/omni-video/kling-3.0-omni` task emit, and are legacy-path callbacks signed? | D16 | `parseCallback` handles both and reports `verified`; confirm with one real callback in Phase 5 if a receiver exists. |
| Q2 | `POST /tasks` `start_time`/`end_time`: `long` in 3.0-turbo docs, `string` elsewhere (App. B §6.1). | `tasks.list` | Send numbers; if 400, strings; pin in a contract test **[LIVE]** Phase 2a. |
| Q3 | ~~3.0 Turbo native audio: capability map says supported, endpoint docs have no `audio` field.~~ **Resolved 2026-09-20:** the pricing table lists Turbo only as "With Native Audio" — audio is always on and there is nothing to configure. | D9 | Validator rejects `audio` on 3.0-turbo with the message "native audio is always on for kling-3.0-turbo". |
| Q4 | `duration` on 3.0-omni with `feature_video`/`base_video`; `shot_type: intelligence` defined nowhere. | D6 | Pass `duration` only if set; document the gap. |
| Q5 | Which legacy video models still answer on `/v1/videos/text2video`? | None for 2.0 | Not probed — costs units; recorded so nobody re-derives it. |
| Q6 | `watermark_url` presence when `watermark_info.enabled=false`. | Saver | Optional; saved only when non-empty. |
| Q7 | Two element-delete paths; shared library? | D8 | Phase 4a: create via video path, delete via image path, observe. |
| Q8 | `kling-video-o3` appears only in element docs. | D9 warning text | Quote the vendor; do not model. |
| Q9 | Which code does a *garbage* key produce (`1000` vs `1002`)? A *revoked* key? | D2 | Smoke control; a revoked-key probe if Alex rotates one. |
| Q10 | `/tasks` returns `200 data: []` for unknown ids **[LIVE]** — also for other accounts' ids? | `tasks.get` | Untestable with one account; document "empty = not visible". |
| Q11 | Is `external_task_id` an idempotency key (does a duplicate create return the existing task or `400`)? | D10 | Phase 2a: submit the same `external_task_id` twice (cheapest t2v); record the response. Until known, creates are never auto-retried. |
| Q12 | Are legacy *image* product timestamps ms? (Video and voice samples are; image samples not checked.) | D4 | Codec asserts `1.6e12 < t < 4e12` and throws `KlingCodecError` otherwise; fixture tests cover image products. |
| Q13 | Maximum ids per `GET /tasks?task_ids=`; URL length. | D5 | Chunk at 50; probe 100 once in Phase 2a. |

Client-side edge cases now specified: concurrent `wait()` (D5, shared loop); `succeeded` with empty outputs (D4); Base64 body inflation (D12, 20 MB cap); HTTP 429 with a non-JSON body (D10, `KlingResponseError`, retryable on reads); `external_task_id` reuse (Q11).

---

## 12. Out of scope for 2.0

- Virtual try-on, apparel replicator, goods studio, video commerce — not fetched, not modelled.
- Video effects, lip-sync, face detection, image recognition, multi-element editing, text-to-audio, video-to-audio — App. C §7; 2.x minors.
- A callback **receiver** (HTTP server) — the library verifies and parses; the consumer hosts.
- Client-side concurrency limiting / job queue — `1303` is surfaced, not managed (D10).
- Any upload/hosting for video inputs — the vendor has no upload endpoint.
- The uluops tracker/registry ecosystem — `kling-api` is standalone; the tracker run record is review bookkeeping, not a dependency.

---

## 13. Run #1 findings → where this revision answers them

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

---

## Revision history

| Version | Date | Change |
|---|---|---|
| v0.1.0 | 2026-09-20 | Initial draft from the three appendix reports and the live probes. Settled: major bump, API Key only, JWT removed, full reboot. |
| v0.2.0 | 2026-09-20 | §10.1–10.5 resolved by Alex; companion checklist added; submitted to the pre-implementation pipeline (run #1: architect 65 REVISE, excavator 80, docs 69). |
| v0.3.0 | 2026-09-20 | Revised on run #1's 49 findings (§13). New: D10 retry policy and error family, D12 `MediaSource` union and download port, D19 manual release + branch strategy (semantic-release removed — Alex), D20 test seam, §5 import graph, §6 complete types and export set, §9 sub-phases with LOC budgets and a Phase 0 write-probe gate, D9 unknown-model passthrough, D4 `standard`/`product?`/`outputsExpireAt`, D5 product-neutral query names. Corrected counts (§2.5, §3), survivors (§0), D17. |
