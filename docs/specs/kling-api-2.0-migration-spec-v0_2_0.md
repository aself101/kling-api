# kling-api 2.0 — Migration Specification

| | |
|---|---|
| **Version** | v0.2.0 (draft — decisions settled, pre-implementation review pending) |
| **Date** | 2026-09-20 |
| **Target repo** | `kling-api` (`misc/npm-packages/kling-api`, published as `kling-api` on npm) |
| **From → To** | `1.0.0` (2025-12-27, `264da22`) → `2.0.0` |
| **Decision owner** | Alex |
| **Settled decisions** | Major bump; API Key is the only credential; JWT (AccessKey/SecretKey) removed; full reboot of the public surface rather than an incremental patch. Default video model `kling-3.0-turbo`; default omni-image `kling-v3-omni`; native `fetch` replaces axios; `engines.node >=20`; elements/voices/avatar/TTS ship in 2.0.0. *(Alex, 2026-09-20.)* |
| **Companion** | [Implementation checklist](kling-api-2.0-migration-checklist.md) — the phase-by-phase work items and their exit checks |
| **Appendices** | [A — v1 surface map](appendices/A-v1-surface-map.md) · [B — new-standard contracts](appendices/B-new-standard-contracts.md) · [C — legacy and platform contracts](appendices/C-legacy-and-platform-contracts.md) |
| **Vendor source** | `docs/api/*.md` — 48 pages fetched 2026-09-20 from the URLs in `https://kling.ai/document-api/llms.txt` (all of *Docs*, *Video APIs*, *Image APIs*, *Assets & Billing*, *Updates*, plus `effects/video-effects`; the four e-commerce pages and *Pricing* were deliberately not fetched) |

Every `file:line` below was verified against the working tree on 2026-09-20. Claims about the vendor API are cited to a file under `docs/api/`; claims marked **[LIVE]** were confirmed by an HTTP call from this machine on 2026-09-20 against `https://api-singapore.klingai.com` (§1.2). Claims marked `[VERIFY]` could not be discharged from the docs or a read-only probe and are collected in §11.

---

## 0. Summary

The library's first live call in nine months failed with

> `The model 'kling-v1' has been discontinued and is no longer available.`

Investigation found the model error is the smallest of four changes:

1. **Authentication moved.** New-design endpoints accept only a static **API Key** bearer token and reject the JWT built from AccessKey/SecretKey with `401 / code 1002` **[LIVE]**. The API Key also authenticates every legacy endpoint tested **[LIVE]**, so it is a strict superset and the JWT path can be deleted without loss.
2. **Video moved to a new API design standard.** Model version is in the URL path (`POST /text-to-video/kling-3.0-turbo`), the body nests `settings`/`options` with a typed `contents[]` array, tasks are queried through a unified `GET /tasks?task_ids=` / `POST /tasks` (cursor), the response carries `data.id` / `data.status` / `outputs[]`, and the terminal status is spelled **`succeeded`**. All 14 video pages in the vendor index are on this standard (App. B §1).
3. **Image did not move.** All 7 image pages — including the current-generation `kling-v3` and `kling-v3-omni` — remain on legacy `/v1/images/...` paths with `model_name` in the body, `data.task_id` / `task_status` / `task_result.images[]`, and terminal status spelled **`succeed`** (App. B §1, §3.6). There is no new-standard image endpoint anywhere in the vendor index.
4. **The model registry is dead.** Of the 12 model literals the library ships (App. A §3), only `kling-v2-1` (image) still appears in any vendor enum. The vendor's update log records no discontinuation for any of them (App. C §5c); models are being gated server-side without a published sunset list.

2.0 is therefore a **two-standard client under one credential**: one HTTP core, an API Key, two request/response codecs, and a normalized `Task` model that hides the `succeed`/`succeeded` and `task_result`/`outputs` split from consumers.

---

## 1. Evidence

### 1.1 Trigger

```
$ kling video t2v --prompt "an astronaut arrives at a new planet ..." --wait
[INFO] Model: kling-v1
[ERROR] Generation failed: The model 'kling-v1' has been discontinued and is no longer available.
```

`kling-v1` is the default for `textToVideo` (`src/operations/video.ts:44`), `imageToVideo` (`:103`), `generateImage` (`src/operations/image.ts:42`), and the CLI `t2v`/`i2v`/`image generate` commands (`src/cli.ts:2079,2114,2232`). Note the request *reached the model gate* — the legacy endpoint, path, body shape, and JWT all still worked. Only the model name failed. That is the fact that makes the legacy transport reusable for images.

### 1.2 Live probes (read-only, 2026-09-20)

Signing done with Node `crypto` (HS256, `iss`/`exp`/`nbf` exactly as `src/auth.ts:83-107`); API Key from `KLING_API_KEY`.

| Call | JWT (AK/SK) | API Key |
|---|---|---|
| `GET /account/costs?start_time&end_time` (legacy) | 200 | 200 |
| `GET /v1/videos/text2video?pageNum=1&pageSize=1` (legacy list) | 200, `task_status: "succeed"` | 200 |
| `GET /v1/general/presets-voices` (legacy) | — | 200 |
| `GET /tasks?task_ids=1` (new) | **401** `{"code":1002,"message":"Authentication error. The current API does not support AK/SK; please go to the console (https://kling.ai/dev/api-key) to create API key."}` | 200, `data: []` |
| `POST /tasks {"limit":2}` (new, cursor) | **401** code 1002 | 200, `data: {count: 0, has_more: false}` |

The 200 on `/v1/videos/text2video` returned the 2025-12-27 task, so the legacy surface is live and retains history; it is models, not paths, that are being retired.

### 1.3 Vendor statements that bound the design

- Auth page: `### API Key (for all models)` vs `### Access Key / Secret Key (API only applicable to legacy version design standards)` — *"The model version information located in the path is the new version, while the value set as the model_name parameter is the legacy version."* (`docs/api/kling-get-started-authentication.md`; App. C §1)
- Updates, 06/17/2026: *"The new API supports authentication via API Key only. Please migrate as soon as possible."* and *"Authentication can now be completed using only an API Key … Fully compatible with existing models and can be used alongside AK/SK authentication."* (App. C §5a)
- Updates, 07/15/2026: new API generalized to Kling 3.0, 3.0 Omni, 3.0 Motion Control, 2.6, 2.6 Motion Control, 2.5 Turbo; *"The legacy API will continue to be available with no current plans for deprecation."* (App. C §5a)
- Callback page: the new callback shape is *"Applicable to APIs based on new design standards"*; the legacy shape is *"Applicable to Kling 3.0 Omni and earlier models"* (App. C §4). The two statements are framed on different axes (path vs model) and are not reconciled by the vendor — see §11 Q1.

### 1.4 Retention and concurrency facts that shape defaults

- Every output URL *"will be cleared after 30 days"* (all endpoint docs). The current `saveVideoResult`/`saveImageResult` download step (`src/handlers/file-saver.ts`) is therefore load-bearing, not a convenience.
- Concurrency is per account, model version, and package type; an image task with `n` consumes `n` slots; over-limit returns `code 1303` *"parallel task over resource pack limit"* with **no `data`** and the vendor recommends exponential backoff from ≥1 s (App. C §3). The current `isRetryable()` (`src/errors.ts:31-38`) treats only `5001`/502/503/504 as retryable — `1303` is not, and should be.

---

## 2. Vendor landscape (what exists on 2026-09-20)

### 2.1 Two design standards, by product

| Standard | Products | Create | Query | Status enum | Result |
|---|---|---|---|---|---|
| **NEW** (path-per-model) | text-to-video, image-to-video, omni-video, motion-control | `POST /<product>/<model>` body `{prompt \| contents[], settings{}, options{}}` | `GET /tasks?task_ids=a,b` · `GET /tasks?external_task_ids=…` · `POST /tasks {start_time,end_time,cursor,limit,filters[]}` | `submitted, processing, succeeded, failed` | `data.id`, `data.status`, `data.message`, `data.outputs[]` (typed union), `data.billing[]` |
| **LEGACY** (`/v1/`) | image generation, omni-image, multi-image-to-image, outpainting, ai-multi-shot; avatar, lip-sync, TTS, text-to-audio, video-to-audio, face/image recognition, multi-elements, effects; element & voice management | `POST /v1/<product>` flat body, `model_name` where selectable | `GET /v1/<product>/{id}` · `GET /v1/<product>?pageNum&pageSize` | `submitted, processing, succeed, failed` | `data.task_id`, `data.task_status`, `data.task_status_msg`, `data.task_result.{images[],videos[],audios[],elements[],voices[]}`, `final_unit_deduction`, `final_balance_deduction` |
| **Account** (neither prefix) | usage, billing ledgers | `GET /account/costs` (unchanged since 2024, *"free to call … QPS<=1"*), `POST /account/billing/balance`, `POST /account/billing/package` (added 07/06/2026) | — | — | see App. C §6 |

Base URL is `https://api-singapore.klingai.com` for all three (`docs/api/kling-get-started-authentication.md`). Auth header is `Authorization: Bearer <API_KEY>` on every documented endpoint (48/48 pages).

### 2.2 Video models on the new standard (App. B §4.1)

| Path model id | Create endpoints | `resolution` | `duration` (s, int) | `aspect_ratio` (t2v / omni only) | `settings.audio` | Other settings | `contents[].type` supported |
|---|---|---|---|---|---|---|---|
| `kling-3.0-turbo` | `/text-to-video/`, `/image-to-video/` | `720p`,`1080p` | `3`–`15` | `16:9`,`9:16`,`1:1` | *(no field)* | — | i2v: `prompt`, `first_frame` only |
| `kling-3.0` | `/text-to-video/`, `/image-to-video/`, `/motion-control/` | `720p`,`1080p`,`4k` (motion: no `4k`) | `3`–`15` (motion: none) | `16:9`,`9:16`,`1:1` | `native`,`off` (motion: `original`,`off`, default `original`) | `multi_shot` bool (default `true`); motion: `character_orientation` `image`\|`video` **required** | i2v: `prompt`,`first_frame`,`last_frame`,`element`(≤3); motion: `prompt`,`image`,`video`,`element`(≤1) |
| `kling-3.0-omni` | `/omni-video/` | `720p`,`1080p`,`4k` | `3`–`15` | `16:9`,`9:16`,`1:1` (required when no first frame / ref video) | `native`,`original`,`off` | `multi_shot` | `prompt`,`first_frame`,`last_frame`,`refer_image`,`feature_video`,`base_video`,`element` — count matrices in App. B §2.5 |
| `kling-o1` | `/omni-video/` | `720p`,`1080p` | `3`–`10` (first-frame-only: `5`\|`10`) | as above | `original`,`off` | — | as 3.0-omni; multi-image elements only; ref video 3–10 s ≤2160px |
| `kling-2.6` | `/text-to-video/`, `/image-to-video/`, `/motion-control/` | `720p`,`1080p`; **native audio ⇒ 1080p only; first+last frame ⇒ 1080p only** | `5`,`10` | `16:9`,`9:16`,`1:1` | `native`,`off` (motion: `original`,`off`) | motion: `character_orientation` | i2v: `prompt`,`first_frame`,`last_frame`,`voice`(≤2, requires `audio≠off`); motion: `prompt`,`image`,`video` |
| `kling-2.5-turbo` | `/text-to-video/`, `/image-to-video/` | `720p`,`1080p`; **first+last ⇒ 1080p** | `5`,`10` | `16:9`,`9:16`,`1:1` | *(none)* | — | i2v: `prompt`,`first_frame`,`last_frame` |

Cross-cutting facts: there is **no `negative_prompt`**, **no `cfg_scale`**, **no `mode` (`std`/`pro`)**, **no `camera_control`**, and **no `image_tail`** anywhere in the new standard (App. B §2.13). Negative descriptions go in the prompt string; `mode` is replaced by `resolution` (the billing ledger maps legacy `std→720p`, `pro→1080p`, App. C §6); end frames are `contents[].type: "last_frame"`. Prompt limit is 2500 chars except Kling 3.0 / 3.0 Omni / 3.0 Turbo t2v at 3072 (recommended ≤2500). Image inputs are *"URL or Base64"*, `.jpg/.jpeg/.png`, ≤50 MB, ≥300 px, ratio 1:2.5–2.5:1. **Video inputs are URL only** (`feature_video`, `base_video`, motion `video`) — there is no upload endpoint.

Shared `options` block: `callback_url`, `external_task_id` (must be unique per account), `watermark_info.enabled` (default `false`, custom watermarks unsupported).

### 2.3 Image models on the legacy standard (App. B §4.2; tables extracted 2026-09-20)

| Endpoint | `model_name` enum (doc default in bold) | Fields beyond `prompt` |
|---|---|---|
| `POST /v1/images/generations` | `kling-v2-1`, **`kling-v3`** | `negative_prompt`, `image`, `image_reference` (`subject`\|`face`, **2.1 only**), `image_fidelity` [0,1] 0.5, `human_fidelity` [0,1] 0.45, `element_list[].element_id` (long), `resolution` `1k`\|`2k`, `n` 1–9, `aspect_ratio` (8 values, no `auto`), `watermark_info`, `callback_url`, `external_task_id` |
| `POST /v1/images/omni-image` | **`kling-image-o1`**, `kling-v3-omni` | `image_list[].image`, `element_list[].element_id`, `resolution` `1k`\|`2k`\|`4k` (O1: 1k/2k per capability map), `result_type` `single`\|`series`, `series_amount` `2`–`9`\|`auto`, `n`, `aspect_ratio` incl. `auto`, watermark/callback/external |
| `POST /v1/images/multi-image2image` | **`kling-v2-1`** (only value) | `subject_image_list[].subject_image` (1–4), `scene_image`, `style_image`, `n`, `aspect_ratio`, watermark/callback/external |
| `POST /v1/images/editing/expand` | *(none)* | `image`, four `*_expansion_ratio` [0,2] (area ≤3×), `prompt`, `n`, watermark/callback/external |
| `POST /v1/general/ai-multi-shot` | *(none)* | `element_frontal_image`, callback/external — returns `images[] {index 0-2, url_1, url_2, url_3}` |

Query: `GET /v1/<product>/{task_id}` (also accepts `external_task_id` per most docs), list `GET /v1/<product>?pageNum=[1,1000]&pageSize=[1,500]`. Result `task_result.images[] {index, url, watermark_url}`; omni-image adds `result_type` and `series_images[]`.

### 2.4 Legacy resource endpoints in scope for 2.0

Needed because the new video standard references them by id:

- **Elements** — `POST /v1/general/advanced-custom-elements` (async; `reference_type` `image_refer`\|`video_refer`, `element_image_list{frontal_image, refer_images[]}`, `element_video_list{refer_videos[]}`, `element_voice_id`, `tag_list[]`), `GET …/{id}`, `GET …` list, `GET /v1/general/advanced-presets-elements`, delete `POST /v1/general/delete-advanced-elements` (video) **vs** `POST /v1/general/delete-elements` (image) — the *only* body-level difference between the video and image element docs (App. C §7.9).
- **Voices** — `POST /v1/general/custom-voices` (`voice_name`, `voice_url` 5–30 s **or** `video_id`), `GET …/{id}`, `GET …` list (`pageSize` [1,1000] here), `GET /v1/general/presets-voices`, `POST /v1/general/delete-voices` (App. C §7.10).
- **Avatar** — `POST /v1/videos/avatar/image2video` unchanged from what `src/operations/avatar.ts` implements (App. C §7.1), so it carries over with only the credential and result-normalization changes.
- **TTS** — `POST /v1/audio/tts` synchronous, returns `task_result.audios[]` directly; feeds avatar `audio_id` (App. C §7.2).

Everything else legacy (lip-sync, face/image recognition, multi-elements, text-to-audio, video-to-audio, effects) is documented in App. C §7 and deferred (§9 Phase 5).

### 2.5 Error codes (App. C §2, verbatim vendor table)

The vendor table has 24 rows; the library's `ERROR_CODES` (`src/config/constants.ts:155-187`) has 17 and misnames several (e.g. `1102` is *"Resource pack exhausted or expired"*, not `CONCURRENT_LIMIT`; `1202` is *"requested method is invalid"* (404), not `PARAM_OUT_OF_RANGE`). Missing: `1303` (concurrency over package limit, 429), `1304` (IP whitelist, 429), `5002` (internal timeout, 504). `1003`/`1004` (`nbf`/`exp`) become unreachable once JWT is gone.

---

## 3. Current surface, as it stands (App. A)

`KlingAPI` exposes 29 public methods (App. A §1.1): 11 create/query pairs over 18 flat-body `/v1/` endpoints plus `/account/costs`, two `waitFor*Result`, two `save*Result`, `healthCheck`, `getToken`, `refreshToken`. Every create defaults to a model that no longer appears in any vendor enum except `multiImageToImage → kling-v2` (which is *also* gone; the endpoint now lists only `kling-v2-1`). The CLI has 12 generating subcommands; 7 default to a dead model (App. A §6.5).

Response-shape coupling is concentrated but wide: `data.task_id` is read at 12 sites, `data.task_status` at 12, `task_result.videos|images` at 10, all funnelling through one poll predicate at `src/handlers/result-poller.ts:31,40` (App. A §2.1, §5). Auth is JWT end-to-end with the header injected by an unconditional axios interceptor (`src/client/http-client.ts:68-74`); `KlingConfig` has no API-key field (App. A §4).

Tests: 16 files / 13,880 lines, all pinned to `/v1/` paths, `model_name: 'kling-v1'`, `task_status: 'succeed'`, and a `^Bearer eyJ` JWT-shape regex (App. A §7). They are a specification of the 1.x contract and will be replaced, not migrated.

Two disposals already made this session: `docs/KLING_API_REFERENCE.md` was deleted (staged) — it documented three endpoint paths that never matched `src/` even before the vendor moved (App. A §8.2); `README.md:90` still links to it and is covered by Phase 6.

---

## 4. Decisions

Each decision records the alternative that was rejected and why. Decisions marked **(settled)** were made by Alex on 2026-09-20; §10 records the resolution of the ones that were put to him as recommendations.

### D1. Version and compatibility (settled)

`2.0.0`. No compatibility shims, no deprecated re-exports, no `legacy` mode flag. Rationale: every create method's default model is dead, so a 1.x consumer's first call fails regardless; keeping the old surface alive would preserve the *appearance* of compatibility while every default path throws. A clean break with a written migration table (§7) is more honest than a shim.

### D2. Authentication (settled)

- The only credential is an **API Key**. `KlingConfig.apiKey?: string`; env `KLING_API_KEY`; the existing four-tier loader chain (constructor → `process.env` → `./.env` → `~/.kling/.env`, `src/config/loaders.ts:28-74`) is kept with the single key substituted for the pair. The CLI flag becomes `--api-key`.
- **Removed:** `src/auth.ts` (`KlingAuth`, `decodeToken`, `isTokenExpired`), the `./auth` subpath export, `KlingAPI.getToken()` / `refreshToken()`, `jsonwebtoken` and `@types/jsonwebtoken`, `ERROR_CODES.AUTH_TOKEN_EXPIRED`/`AUTH_MISSING_TOKEN`-style JWT naming (replaced by the vendor's own code table, §2.5).
- The `401 / 1002` message *"The current API does not support AK/SK"* **[LIVE]** is surfaced verbatim by `KlingAPIError`; the library adds no wrapping hint, because an API-Key-only library cannot produce it except with a bad key.
- Redaction (`src/utils/security.ts` `redactKey`) is retained for logging the key's tail.

Rejected: dual-auth with per-endpoint branching (App. A §4.4 item 5). It would have shipped a credential that authenticates half the surface and 401s the other half, with the boundary determined by the vendor's product taxonomy rather than anything visible to the consumer.

### D3. One HTTP core, two codecs

```
src/client/http.ts            fetch wrapper: base URL, API Key header, timeout, retry/backoff, error → KlingAPIError
src/codecs/new-standard.ts    build {prompt|contents, settings, options}; parse create/GET /tasks/POST /tasks → Task
src/codecs/legacy.ts          build flat body; parse data.task_id/task_status/task_result → Task
```

The codec, not the caller, owns the response property paths. Nothing outside `src/codecs/` reads `task_status`, `succeed`, `task_result`, `outputs`, or `data.id`. This is the single largest change in the reboot and the one that makes the two-standard vendor invisible to consumers.

Rejected: two separate client classes (`KlingVideo`, `KlingImage`). It would leak the vendor's accident of history into the consumer's imports, and the vendor has already moved one product family once — the codec boundary is where the *next* move gets absorbed.

### D4. Normalized `Task` model

```ts
export type TaskStatus = 'submitted' | 'processing' | 'succeeded' | 'failed';

export interface Task {
  id: string;
  status: TaskStatus;             // legacy 'succeed' → 'succeeded' in the codec
  message?: string;               // legacy task_status_msg / new data.message
  externalId?: string;
  createdAt: number;              // ms
  updatedAt: number;              // ms
  outputs: TaskOutput[];          // [] until succeeded
  billing?: BillingEntry[];       // new standard only; legacy deductions mapped when present
  product: Product;               // which create endpoint produced it (drives query routing, D5)
  raw: unknown;                   // the vendor envelope, untouched
}

export type TaskOutput =
  | { type: 'video'; id: string; url: string; watermarkUrl?: string; durationSeconds?: number }
  | { type: 'image'; url: string; watermarkUrl?: string; index?: number; groupId?: string }
  | { type: 'audio'; id: string; mp3Url?: string; wavUrl?: string; mp3DurationSeconds?: number; wavDurationSeconds?: number }
  | { type: 'element'; id: string; name: string; description?: string; elementType?: 'video_character_elements' | 'multi_image_elements'; status: 'succeeded' | 'deleted'; raw: unknown }
  | { type: 'voice'; id: string; name: string; url?: string; ownedBy?: string; status: 'succeeded' | 'deleted' };
```

- Durations are **numbers in seconds**; the vendor sends strings on the new standard (App. B §3.2) and the codec parses them.
- Legacy `task_result.videos[]` / `images[]` / `audios[]` / `elements[]` / `voices[]` map onto the same union. Legacy audio field names (`url_mp3`, `duration_mp3`) and new ones (`mp3_url`, `mp3_duration`) both map to the camelCase fields (App. C §9 Q14).
- `raw` is kept because the vendor's docs have known sample-JSON errors (App. C §9 Q17) and consumers will need an escape hatch during the first months.

### D5. Query routing: `TaskHandle` returned from every create

Unified `/tasks` only knows about new-standard tasks; legacy tasks must be queried at `GET /v1/<product>/{id}`. A bare `getTask(id)` therefore cannot work without knowing the product. Every create method returns:

```ts
export interface TaskHandle {
  id: string;
  externalId?: string;
  product: Product;
  get(): Promise<Task>;
  wait(options?: PollOptions): Promise<Task>;   // resolves on succeeded, throws KlingTaskFailedError on failed
}
```

plus explicit escape hatches:

- `api.tasks.get(ids: string | string[], { externalIds?: true })` → `Task[]` — new standard batch (`GET /tasks`).
- `api.tasks.list({ startTime?, endTime?, cursor?, limit?, status?, productType? })` → `{ tasks, count, nextCursor, hasMore }` — new standard cursor (`POST /tasks`).
- `api.tasks.getLegacy(product: LegacyProduct, id: string)` → `Task` — for reconstituting a handle from a stored id.
- `api.tasks.handle(product, id)` → `TaskHandle` — same purpose, returns the handle.

Rejected: a `getTask(id)` that tries `/tasks` first and falls back to probing each legacy product path. It costs up to 6 round trips for a legacy id, and the vendor's `/tasks` returns `200 data: []` for unknown ids **[LIVE]** rather than 404, so "not found here" is indistinguishable from "not found anywhere".

### D6. Video surface (new standard only) (defaults settled)

| Method | Endpoint | Default model | Notes |
|---|---|---|---|
| `video.textToVideo({ model?, prompt, resolution?, aspectRatio?, duration?, audio?, multiShot?, callbackUrl?, externalTaskId?, watermark? })` | `POST /text-to-video/<model>` | `kling-3.0-turbo` | model ∈ `kling-3.0-turbo`,`kling-3.0`,`kling-2.6`,`kling-2.5-turbo` |
| `video.imageToVideo({ model?, prompt, firstFrame, lastFrame?, elements?, voices?, … })` | `POST /image-to-video/<model>` | `kling-3.0-turbo` | `firstFrame`/`lastFrame` accept URL, Base64, or local path (base64-encoded by `processMediaSource`); `elements` 3.0 only; `voices` 2.6 only |
| `video.omni({ model?, prompt, firstFrame?, lastFrame?, referImages?, featureVideo?, baseVideo?, elements?, … })` | `POST /omni-video/<model>` | `kling-3.0-omni` | model ∈ `kling-3.0-omni`,`kling-o1`; videos URL-only |
| `video.motionControl({ model?, prompt?, image, video, element?, characterOrientation, audio?, resolution?, … })` | `POST /motion-control/<model>` | `kling-3.0` | model ∈ `kling-3.0`,`kling-2.6`; `characterOrientation` required |

The `contents[]` array is assembled by the codec from the named fields; `id`s for `@`-references are auto-assigned (`image_1`, `video_1`, element name) unless the caller supplies them, and the codec verifies every `@name` in the prompt resolves to a content entry (the vendor only says avoid substrings/overlaps, App. B §2.4 — that is a validator warning, not an error).

**Dropped from 1.x:** `extendVideo` (`/v1/videos/video-extend`) and `multiImageToVideo` (`/v1/videos/multi-image2video`) — neither appears in `llms.txt` (2026-09-20) and neither has a new-standard equivalent; omni-video's `refer_image` + `element` covers the multi-image case. Also dropped: legacy `/v1/videos/text2video`, `/v1/videos/image2video`, `/v1/videos/omni-video` transports and every parameter that has no new-standard field (`negative_prompt`, `cfg_scale`, `mode`, `camera_control`, `image_tail`, `dynamic_masks`, `voice_list` → `voices`).

Default-model policy (settled, §10.1): default to the cheapest current-generation model per endpoint — `kling-3.0-turbo` where available (0.8 units/s @720p vs 3.0's unpublished-here rate; App. C §5a), `kling-3.0` for motion control (only 3.0 and 2.6 exist), `kling-3.0-omni` for omni. Rejected alternative: default to the vendor's documented default (there is none on the new standard — the model is the path).

### D7. Image surface (legacy standard, API Key) (defaults settled)

| Method | Endpoint | Default model | Notes |
|---|---|---|---|
| `image.generate({ model?, prompt, negativePrompt?, image?, imageReference?, imageFidelity?, humanFidelity?, elements?, resolution?, n?, aspectRatio?, … })` | `POST /v1/images/generations` | `kling-v3` | `imageReference`/`humanFidelity` valid only for `kling-v2-1` — validator enforces |
| `image.omni({ model?, prompt, images?, elements?, resolution?, resultType?, seriesAmount?, n?, aspectRatio?, … })` | `POST /v1/images/omni-image` | `kling-v3-omni` | settled §10.2 — the vendor's own documented default is the older `kling-image-o1`; we default to the newest and the CHANGELOG says so |
| `image.multiImageToImage({ prompt?, subjectImages, sceneImage?, styleImage?, n?, aspectRatio?, … })` | `POST /v1/images/multi-image2image` | `kling-v2-1` (only) | model param removed — single value |
| `image.outpaint({ image, up, down, left, right, prompt?, n?, … })` | `POST /v1/images/editing/expand` | — | renamed from `expandImage` |
| `image.subjectCompletion({ frontalImage, … })` | `POST /v1/general/ai-multi-shot` | — | new; feeds element creation. Phase 4. |

Query via `TaskHandle.get()` → `GET /v1/images/<product>/{id}`; list via `api.tasks.listLegacy(product, { pageNum, pageSize })`.

### D8. Resources (legacy standard, API Key) — Phase 4, ships in 2.0.0 (settled)

`api.elements.{create, get, list, presets, delete}`, `api.voices.{create, get, list, presets, delete}`, `api.avatar.create` (carried over), `api.audio.tts` (synchronous; returns `TaskOutput[]` of type `audio` directly). Element delete takes `{ kind: 'video' | 'image' }` because the vendor has two paths for one otherwise-identical surface (App. C §7.9, §9 Q8); default `video`.

### D9. Capability registry and validation

`src/config/models.ts` is rewritten as one table keyed by the **path model id** (video) or `model_name` (image):

```ts
interface VideoModelCaps {
  id: 'kling-3.0-turbo' | 'kling-3.0' | 'kling-3.0-omni' | 'kling-o1' | 'kling-2.6' | 'kling-2.5-turbo';
  products: Product[];                                   // which create endpoints accept it
  resolutions: Record<Product, Resolution[]>;            // motion-control has no 4k on 3.0
  durations: number[] | null;                            // null = follows reference video
  audio: AudioMode[] | null;                             // null = no field
  multiShot: boolean;
  contentTypes: Record<Product, ContentType[]>;
  rules: CrossFieldRule[];                               // e.g. 2.6: audio=native ⇒ resolution=1080p
}
```

Validators run **before** the request and produce `ValidationError` with the vendor's own constraint text, because the vendor's `1201` message is not guaranteed to name the field. The cross-field rules that exist today in the docs (App. B §2): 2.6 native audio ⇒ 1080p; 2.6 / 2.5-turbo first+last ⇒ 1080p; 2.6 `voice` ⇒ `audio ≠ off`, ≤2 voices; 3.0-omni `base_video` ⇒ `audio ≠ native`, no frames, no multi-shot; 3.0-omni `feature_video` ⇒ `audio = off`, `multi_shot = true`; omni `aspect_ratio` required when no first frame and no reference video; O1 first-frame-only ⇒ duration 5|10; motion-control reference video ≤10 s when `character_orientation = image`, ≤30 s when `video`; element/refer-image count matrices (App. B §2.5). Media-size rules (≤50 MB image, ≥300 px, 1:2.5–2.5:1) are enforced for local files and Base64; URLs are not fetched to check.

### D10. Errors and retry

`KlingAPIError { code, message, requestId?, httpStatus? }` retained. `ERROR_CODES` replaced with the 24-row vendor table (App. C §2), names derived from the vendor's *Explanation* column. `isRetryable()` returns true for `1302`, `1303`, `5000`, `5001`, `5002`, and HTTP 429/502/503/504; the HTTP core retries those with exponential backoff from 1 s (vendor guidance) up to a configurable cap. `KlingTaskFailedError extends KlingAPIError` is thrown by `TaskHandle.wait()` with the vendor's `message` and the final `Task`.

### D11. HTTP dependency (settled)

Drop `axios` in favor of Node's global `fetch` (Node ≥18; `engines.node` bumped to `>=20` since 18 reached EOL 2025-04-30). The current interceptor/retry logic (`src/client/http-client.ts`) is ~130 lines and is rewritten anyway for D3. Runtime dependencies become `commander`, `dotenv`, `ora`. Rejected: keeping axios for its interceptor ergonomics — the only interceptor was the auth header, which is now a constant.

### D12. Media input policy

`processMediaSource` (`src/utils/media.ts`) is kept: a string that is an `http(s)` URL is passed through; a local path is read and Base64-encoded with the existing size/dimension/extension checks. **New:** video inputs (`featureVideo`, `baseVideo`, motion `video`, voice `voice_url`) accept URLs only and throw `ValidationError('… must be a URL; the Kling API has no upload endpoint')` for local paths.

### D13. Polling

`pollWithSpinner` (`src/utils/polling.ts`) is kept. Defaults: interval 3 s, timeout 15 min (unchanged, `src/config/constants.ts:27-30`). The predicate moves into the codec's `Task.status` (`succeeded | failed`) — one site, both spellings handled upstream.

### D14. Downloads

`downloadVideo`/`downloadImage` and `saveVideoResult`/`saveImageResult` are kept, retargeted to `Task.outputs[]`. Filenames use `Task.id` and output index; metadata sidecar records `product`, model, and `raw`. Watermarked variants are saved only if `--with-watermark` / `{ includeWatermark: true }`.

### D15. CLI

Command tree mirrors the API namespaces:

```
kling video t2v | i2v | omni | motion-control
kling image generate | omni | multi | outpaint
kling elements create | get | list | presets | delete        (Phase 4)
kling voices  create | get | list | presets | delete         (Phase 4)
kling avatar create                                          (Phase 4)
kling tasks get <ids…> | list [--cursor] [--status] [--product-type]
kling account credits | info | balance | packages
```

Global: `--api-key`, `--output-dir`, `--json`, `--debug`, `-q`. Per-command defaults follow D6/D7. Removed flags: `--access-key`, `--secret-key`, `--mode`, `--cfg-scale`, `--negative-prompt` (video), `--camera-*`, `--image-tail` (→ `--last-frame`). `--wait` remains opt-in; `--no-download` remains.

### D16. Callbacks and webhook verification — Phase 5

`verifyWebhookSignature({ id, timestamp, signature, rawBody, secret })` implementing the Standard Webhooks scheme the vendor documents (App. C §4d) with the vendor's published test vector as a unit test. Both callback body shapes (new and legacy) parse through the same codecs into `Task`.

### D17. Vendor docs snapshot

`docs/api/` (48 pages) is committed with a `docs/api/README.md` recording the fetch date, the `llms.txt` URL, the excluded sections, and the four duplicate mounts that were dropped (the vendor publishes one page under several nav paths; App. B §1a). It is the pinned source the 2.0 surface was derived from and the diff base for the next vendor move. Re-fetch is a one-liner recorded in that README.

### D18. Documentation

`README.md` rewritten from scratch (every model name, endpoint, auth claim, and `task.data.task_id` example in it is stale — App. A §8.1). `CHANGELOG.md` gains a `## [2.0.0]` entry whose *Removed* and *Changed* sections are the §7 table. No standalone API reference document is reintroduced; `docs/api/` is the reference.

---

## 5. Target architecture

```
src/
  index.ts                     public barrel (replaces api.ts as the "." export)
  client.ts                    KlingClient: config, namespaces (video, image, elements, voices, avatar, audio, tasks, account)
  config/
    constants.ts               BASE_URL, limits, ERROR_CODES (vendor table)
    loaders.ts                 loadApiKey(), loadConfig()
    models.ts                  VIDEO_MODELS, IMAGE_MODELS capability tables (D9)
    validators/                per-product validators + cross-field rules
  codecs/
    new-standard.ts            (D3)
    legacy.ts                  (D3)
    task.ts                    Task, TaskOutput, TaskHandle (D4, D5)
  http/
    core.ts                    fetch, auth header, timeout, retry (D10, D11)
    errors.ts                  KlingAPIError, KlingTaskFailedError
  products/
    video.ts                   textToVideo, imageToVideo, omni, motionControl
    image.ts                   generate, omni, multiImageToImage, outpaint, subjectCompletion
    elements.ts  voices.ts  avatar.ts  audio.ts  tasks.ts  account.ts
  handlers/
    poller.ts  saver.ts        (D13, D14)
  utils/                       media, downloads, file-io, logger, polling, security (kept, trimmed)
  cli/                         one file per command group (cli.ts is 2,400 lines today)
```

`package.json#exports`: `.` → `dist/index.js`; `./types` → `dist/codecs/task.d.ts` + param types; `./config` → `dist/config/index.js`. `./auth` and `./utils` subpaths are removed (`./utils` was exposing internals; App. A §0 also flags a dist-shape caveat on it).

---

## 6. Types (sketch of the public parameter surface)

```ts
export type VideoModel = 'kling-3.0-turbo' | 'kling-3.0' | 'kling-3.0-omni' | 'kling-o1' | 'kling-2.6' | 'kling-2.5-turbo';
export type ImageModel = 'kling-v3' | 'kling-v3-omni' | 'kling-image-o1' | 'kling-v2-1';
export type Resolution = '720p' | '1080p' | '4k';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type ImageAspectRatio = AspectRatio | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';
export type AudioMode = 'native' | 'original' | 'off';
export type MediaSource = string;   // URL | Base64 | local path (images); URL only (videos)

export interface CommonOptions {
  callbackUrl?: string;
  externalTaskId?: string;
  watermark?: boolean;             // → options.watermark_info.enabled / watermark_info.enabled
}

export interface TextToVideoParams extends CommonOptions {
  model?: Extract<VideoModel, 'kling-3.0-turbo' | 'kling-3.0' | 'kling-2.6' | 'kling-2.5-turbo'>;
  prompt: string;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  duration?: number;               // int seconds; validated against model
  audio?: AudioMode;               // 3.0 / 2.6 only
  multiShot?: boolean;             // 3.0 only
}

export interface ImageToVideoParams extends Omit<TextToVideoParams, 'aspectRatio'> {
  firstFrame: MediaSource;
  lastFrame?: MediaSource;         // not on 3.0-turbo
  elements?: Array<{ elementId: string; id?: string }>;   // 3.0 only, ≤3
  voices?: Array<{ voiceId: string; id?: string }>;       // 2.6 only, ≤2
}

export interface OmniVideoParams extends CommonOptions {
  model?: 'kling-3.0-omni' | 'kling-o1';
  prompt: string;
  firstFrame?: MediaSource; lastFrame?: MediaSource;
  referImages?: Array<{ url: MediaSource; id?: string }>;
  featureVideo?: { url: string; id?: string };
  baseVideo?: { url: string; id?: string };
  elements?: Array<{ elementId: string; id: string }>;
  resolution?: Resolution; aspectRatio?: AspectRatio; duration?: number;
  audio?: AudioMode; multiShot?: boolean;
}

export interface MotionControlParams extends CommonOptions {
  model?: 'kling-3.0' | 'kling-2.6';
  prompt?: string;
  image: MediaSource;              // appearance reference
  video: string;                   // motion reference, URL only
  element?: { elementId: string; id: string };   // 3.0 only
  characterOrientation: 'image' | 'video';
  audio?: 'original' | 'off';
  resolution?: '720p' | '1080p';
}
```

Image params mirror §2.3 in camelCase; the legacy codec maps them back to snake_case.

---

## 7. Migration table — 1.x method → 2.0 disposition

| 1.x (`KlingAPI`) | 2.0 | Change class |
|---|---|---|
| `new KlingAPI({ accessKey, secretKey })` | `new KlingClient({ apiKey })` | **Breaking** — credential |
| `getToken()`, `refreshToken()` | removed | **Removed** — no token lifecycle |
| `textToVideo(p)` → `TaskResponse` | `video.textToVideo(p)` → `TaskHandle` | **Breaking** — params (no `negative_prompt`/`cfg_scale`/`mode`/`camera_control`), models, return type |
| `queryTextToVideoTask(id)` | `handle.get()` / `tasks.get(id)` | **Breaking** |
| `imageToVideo(p)` (`image`, `image_tail`) | `video.imageToVideo({ firstFrame, lastFrame })` | **Breaking** |
| `omniVideo(p)` (`<<<image_1>>>`, `image_list`, `video_list`, `element_list`) | `video.omni(p)` (`@image_1`, named fields) | **Breaking** — template syntax changed vendor-side |
| `extendVideo`, `queryExtendVideoTask` | removed — no vendor doc | **Removed** |
| `multiImageToVideo`, `queryMultiImageToVideoTask` | removed — use `video.omni({ referImages })` | **Removed** |
| — | `video.motionControl(p)` | **Added** |
| `generateImage(p)` (`kling-v1` default) | `image.generate(p)` (`kling-v3` default) | **Breaking** — models; `image_reference` now 2.1-only |
| `omniImage(p)` | `image.omni(p)` (`kling-v3-omni` default) | **Breaking** — default model; `resultType`/`seriesAmount` added |
| `multiImageToImage(p)` (`kling-v2` default) | `image.multiImageToImage(p)` (no model param) | **Breaking** |
| `expandImage(p)` | `image.outpaint(p)` | **Renamed** |
| — | `image.subjectCompletion(p)` | **Added** (Phase 4) |
| `createAvatar(p)`, `queryAvatarTask` | `avatar.create(p)` → `TaskHandle` | **Changed** — return type only |
| — | `elements.*`, `voices.*`, `audio.tts` | **Added** (Phase 4) |
| `waitForVideoResult(id, queryFn, opts)` / `waitForImageResult` | `handle.wait(opts)` | **Breaking** — no `queryFn` |
| `saveVideoResult(result, dir, prompt)` / `saveImageResult` | `save(task, dir, opts)` | **Changed** — takes `Task` |
| `getAccountInfo(start, end, pack?)` | `account.usage(...)` (same endpoint) | **Renamed**; `account.balanceLedger`, `account.packageLedger` **Added** (Phase 5) |
| `healthCheck()` | `healthCheck()` — now `GET /tasks?task_ids=0` (new standard, exercises the key against the surface that actually rejects AK/SK) | **Changed** |
| `TaskStatus` `'succeed'` | `'succeeded'` | **Breaking** — value |
| `result.data.task_result.videos[]` | `task.outputs.filter(o => o.type === 'video')` | **Breaking** — shape |
| `KLING_ACCESS_KEY`, `KLING_SECRET_KEY` | `KLING_API_KEY` | **Breaking** — env |
| CLI `--access-key --secret-key` | `--api-key` | **Breaking** |
| CLI `video t2v -m kling-v1 --mode pro --cfg-scale 0.5` | `video t2v -m kling-3.0-turbo -r 1080p` | **Breaking** — flags |

---

## 8. Verification

Each item names the check and how it can fail.

1. **Contract tests** (nock or `undici` MockAgent against `BASE_URL`): one test per create endpoint asserting the exact request path and a body deep-equal to the vendor's *Request Example* (App. B §2, App. C §7), and one per query shape asserting the codec parses the vendor's *Response Example* into the expected `Task`. Control: feed the legacy response to the new-standard codec and assert it throws.
2. **Status normalization**: a table test feeding `succeed` (legacy), `succeeded` (new), and an unknown string; the last must throw, not map to `processing`.
3. **Validator rules** (D9): each cross-field rule has a passing and a failing case; the failing case asserts the message names the field.
4. **Auth header**: assert `Authorization: Bearer <apiKey>` verbatim; assert no `eyJ` prefix logic remains (`grep -rn "eyJ\|jsonwebtoken\|HS256" src test` → 0).
5. **Live smoke** (`scripts/smoke.mjs`, read-only, needs `KLING_API_KEY`): `GET /tasks?task_ids=0` → 200; `POST /tasks {limit:1}` → 200; `GET /account/costs` → 200; `GET /v1/general/presets-voices` → 200; and a **control** — the same `GET /tasks` with a garbage key → 401. This is the probe run in §1.2, kept as a script so the next vendor move is caught the same way this one was.
6. **Live generation smoke** (opt-in, spends units): `kling video t2v -m kling-3.0-turbo -d 3 -r 720p --wait` — the cheapest generation the vendor sells (3 s × 0.8 units/s). Not run in CI.
7. **Dead-literal census**: `grep -rnE "kling-v1|kling-v1-5|kling-v1-6|kling-v2-master|kling-v2-1-master|kling-v2-5-turbo|kling-v2-6|kling-v2-new|kling-video-o1|'kling-v2'" src` → 0 hits (only `kling-v2-1`, `kling-2.6`, `kling-2.5-turbo` legitimately survive, in their new spellings).
8. **Packaging**: `npm pack --dry-run` lists `dist/index.js`, `dist/cli.js`, no `dist/auth.*`; `node -e "import('kling-api')"` resolves; `kling --help` shows no `--access-key`.
9. **Docs**: `README.md` contains no `task_id`, `succeed'`, `accessKey`, or dead model literal (grep, same list as item 7).

---

## 9. Phases

Each phase ends in a commit; Phase 6 ends in the `2.0.0` publish.

| Phase | Scope | Exit criterion |
|---|---|---|
| **0 — Snapshot** | Commit `docs/api/` + `docs/api/README.md` (D17); this spec and appendices; the staged deletion of `docs/KLING_API_REFERENCE.md`. | `git status` clean; the spec is the plan of record. |
| **1 — Core** | `http/core.ts` (fetch, API Key, retry), `errors.ts` with vendor code table, `loaders.ts` for `KLING_API_KEY`, `codecs/task.ts` types, both codecs with parse-only coverage. Delete `auth.ts`, axios, jsonwebtoken. | Verification 2, 4; live smoke item 5 passes. |
| **2 — Video** | `products/video.ts` (4 methods), `VIDEO_MODELS` table + validators, `TaskHandle`, `tasks.get/list`. | Verification 1 (video rows), 3; opt-in item 6 produces a downloaded mp4. |
| **3 — Image** | `products/image.ts` (4 methods, `subjectCompletion` deferred to 4), `IMAGE_MODELS`, legacy list/query, saver retarget. | Verification 1 (image rows); an opt-in `image generate -m kling-v3 -n 1` succeeds. |
| **4 — Resources** | `elements`, `voices`, `avatar`, `audio.tts`, `image.subjectCompletion`. | Contract tests; live `voices.presets()` / `elements.presets()` return non-empty **[LIVE-able, read-only]**. |
| **5 — Platform** | `account.balanceLedger/packageLedger`, `verifyWebhookSignature` with vendor test vector, `1303` backoff behaviour test. | Vendor test vector passes; control vector (flipped byte) fails. |
| **6 — CLI, docs, release** | `src/cli/*`, `README.md`, `CHANGELOG.md [2.0.0]`, `package.json` (`version`, `exports`, `engines`, deps), remove dangling `README.md:90` link. | Verification 7, 8, 9; `npm publish`. |

Phases 2 and 3 are independent and can run in parallel branches once Phase 1 lands. Phase 4 depends on 2 (elements/voices are only useful with the video content types that consume them).

---

## 10. Decisions put to Alex and their resolution

All resolved 2026-09-20 unless marked open.

| # | Question | Recommendation | Resolution |
|---|---|---|---|
| 10.1 | Default video model (D6) | `kling-3.0-turbo` for t2v/i2v, `kling-3.0-omni` for omni, `kling-3.0` for motion control | **Settled — as recommended.** |
| 10.2 | Default omni-image model (D7) | `kling-v3-omni` (newest) over the vendor's documented default `kling-image-o1` | **Settled — newest.** |
| 10.3 | Drop axios for native `fetch` (D11) | Yes | **Settled — yes.** |
| 10.4 | `engines.node >=20` (D11) | Yes | **Settled — yes.** |
| 10.5 | Resources in 2.0.0 vs 2.1 (D8) | Ship elements + voices + avatar + TTS in 2.0.0 | **Settled — 2.0.0.** Lip-sync, recognition, multi-elements, audio generation, effects → 2.x minors. |
| 10.6 | Retain `raw` on `Task` (D4) | Yes for the first major | Open — proceeding on the recommendation; revisit at 3.0. |
| 10.7 | Spec filing | Package repo `docs/specs/`; no `uluops-specifications` folder exists for `misc/npm-packages/` | Open — proceeding in-repo. |

---

## 11. Open questions and `[VERIFY]` items

Carried from the appendices where they affect 2.0 behaviour; the rest remain in App. B §6 and App. C §9.

| # | Question | Where it bites | Plan |
|---|---|---|---|
| Q1 | Callback shape is framed by *model* (*"3.0 Omni and earlier"*) on the callbacks page but by *path* on the auth page. Does a `/omni-video/kling-3.0-omni` task emit the new or legacy callback body? | D16 | Parse both shapes; detect by presence of `task_id` vs `id`. Confirm with one real callback in Phase 5. |
| Q2 | `POST /tasks` `start_time`/`end_time` are `long` in the 3.0-turbo docs and `string` in the other 12 (App. B §6.1). | `tasks.list` | Send numbers; if the server 400s, fall back to strings. Contract test pins whichever works **[LIVE]** in Phase 2. |
| Q3 | Kling 3.0 Turbo: capability map says native audio "Supported", endpoint docs have no `audio` field (App. B §6.3). | D9 table | Ship with no `audio` for 3.0-turbo; validator rejects it with a message citing the doc. Re-check on the next `docs/api` refresh. |
| Q4 | `duration` on 3.0-omni with `feature_video`/`base_video` — examples omit it; derivation from the reference video is unstated (App. B §6.7). Also `shot_type: intelligence` is mentioned in the updates log but defined nowhere. | D6 omni | Pass `duration` through only if the caller sets it; document the gap. |
| Q5 | Which legacy *video* models (`kling-v2-6` etc.) still answer on `/v1/videos/text2video`? | None for 2.0 (video leaves the legacy transport) | Not probed — a generation call spends units. Recorded so nobody re-derives it. |
| Q6 | `watermark_url` presence when `watermark_info.enabled=false` (App. B §6.11). | Saver | Treat as optional; save only when non-empty. |
| Q7 | Two element-delete paths (video vs image) for one otherwise-identical surface (App. C §9 Q8). Is the element library shared? | D8 | Expose `kind`; test whether an element created via the video path is visible to the image list **[LIVE-able, read-only after one create]** in Phase 4. |
| Q8 | `kling-video-o3` appears only in element docs — *"video elements … only supported for kling-video-o3 and later"* (App. C §9 Q7). No such model exists elsewhere. | D9 validator warning text | Quote the vendor; do not model it. |
| Q9 | `1002` vs `1000`: which code does a *malformed* (not AK/SK) key produce? | D10 error naming | Control probe in Phase 1 smoke script (garbage key). |
| Q10 | `GET /tasks` returns `200 data: []` for unknown ids **[LIVE]** — does it also do so for ids belonging to another account? | `tasks.get` semantics | Cannot test with one account; document that "empty" means "not visible", not "does not exist". |

---

## 12. Out of scope for 2.0

- Virtual try-on, apparel replicator, goods studio, video commerce (`api/ecommerce-replication/*`) and pricing pages — not fetched, not modelled.
- Video effects (`/v1/videos/effects`, 219 scene names) — documented in App. C §7.11; a 2.x minor.
- Lip-sync, face detection, image recognition, multi-element editing, text-to-audio, video-to-audio — App. C §7; 2.x minors.
- Any client-side upload/hosting for video inputs — the vendor has no upload endpoint; consumers must host.
- The uluops tracker/registry ecosystem — `kling-api` is a standalone package and this spec makes no cross-repo claims.

---

## Revision history

| Version | Date | Change |
|---|---|---|
| v0.1.0 | 2026-09-20 | Initial draft from the three appendix reports and the live probes. Settled: major bump, API Key only, JWT removed, full reboot. |
| v0.2.0 | 2026-09-20 | §10.1–10.5 resolved by Alex (turbo default, newest omni-image, native fetch, Node ≥20, resources in 2.0.0); companion checklist added; submitted to the pre-implementation pipeline. |
