# Kling API — NEW-standard generation contracts (extracted from vendor docs)

Source directory: `/Users/aself/uluops/misc/npm-packages/kling-api/docs/api/` (read-only pass, 2026-09-20).
Files read: 14 video docs, 7 image docs, 3 guides (24 files). Plus a deprecation-only grep of `kling-updates-api.md` (out of the listed scope; flagged wherever used).

Method note: the `## Query Task (By task ID)` + `## Query Task (By Cursor)` tail of every video doc was extracted and `md5`'d/`diff`'d rather than re-read 14 times; the four doc pairs sharing a path were `diff`'d whole-file. Results are recorded in §1 and §3.

---

## 1. ENDPOINT TABLE

Base URL (all docs, `kling-guide-quick-start.md`): `https://api-singapore.klingai.com`. Auth (all): header `Authorization: Bearer <API_KEY>`, `Content-Type: application/json`.

Standard classification rule applied: NEW = model id in the URL path, no `model_name` in the request-body table, body nests `settings`/`options`, tasks queried via `/tasks`. LEGACY = `/v1/...` path, `model_name` in body table (or a `/v1/` path with no model field at all), tasks queried via `/v1/<product>/{id}`.

| # | Doc file | Method + path | Standard | Product family | Notes |
|---|---|---|---|---|---|
| 1 | `kling-3.0-turbo-t2v.md` | `POST /text-to-video/kling-3.0-turbo` | NEW | Video / text-to-video | `prompt` is a top-level string (not `contents[]`) |
| 2 | `kling-3.0-turbo-i2v.md` | `POST /image-to-video/kling-3.0-turbo` | NEW | Video / image-to-video | `contents[]`; first_frame only |
| 3 | `kling-omni-3.0-t2v.md` | `POST /text-to-video/kling-3.0` | NEW | Video / text-to-video (Kling 3.0) | filename says "omni", path model is `kling-3.0`; source tab group is `3-0-omni` |
| 4 | `kling-omni-3.0-i2v.md` | `POST /image-to-video/kling-3.0` | NEW | Video / image-to-video (Kling 3.0) | same naming quirk as #3 |
| 5 | `kling-omni-3.0-ovg.md` | `POST /omni-video/kling-3.0-omni` | NEW | Video / omni video generation (Kling 3.0 Omni) | the only endpoint whose path model is `kling-3.0-omni` |
| 6 | `kling-omni-3.0-motion-control.md` | `POST /motion-control/kling-3.0` | NEW | Video / motion control (Kling 3.0) | PAIR with #7 |
| 7 | `kling-motion-control-3.0.md` | `POST /motion-control/kling-3.0` | NEW | Video / motion control (Kling 3.0) | PAIR with #6 |
| 8 | `kling-o1-video.md` | `POST /omni-video/kling-o1` | NEW | Video / omni video generation (Kling O1) | |
| 9 | `kling-2.6-t2v.md` | `POST /text-to-video/kling-2.6` | NEW | Video / text-to-video | |
| 10 | `kling-2.6-i2v.md` | `POST /image-to-video/kling-2.6` | NEW | Video / image-to-video | has `voice` content type |
| 11 | `kling-2.6-motion-control.md` | `POST /motion-control/kling-2.6` | NEW | Video / motion control (Kling 2.6) | PAIR with #12 |
| 12 | `kling-motion-control-2.6.md` | `POST /motion-control/kling-2.6` | NEW | Video / motion control (Kling 2.6) | PAIR with #11 |
| 13 | `kling-2.5-turbo-t2v.md` | `POST /text-to-video/kling-2.5-turbo` | NEW | Video / text-to-video | |
| 14 | `kling-2.5-turbo-i2v.md` | `POST /image-to-video/kling-2.5-turbo` | NEW | Video / image-to-video | |
| 15 | `kling-image-omni-3.0-generation.md` | `POST /v1/images/generations` | **LEGACY** (`model_name` in body: `kling-v2-1`, `kling-v3`) | Image / text-to-image + image-to-image | PAIR with #18 |
| 16 | `kling-image-omni-3.0-image-omni.md` | `POST /v1/images/omni-image` | **LEGACY** (`model_name`: `kling-image-o1`, `kling-v3-omni`) | Image / omni image generation | PAIR with #17 |
| 17 | `kling-image-o1-generation.md` | `POST /v1/images/omni-image` | **LEGACY** (same) | Image / omni image generation | PAIR with #16 |
| 18 | `kling-image-2.1-generation.md` | `POST /v1/images/generations` | **LEGACY** (same as #15) | Image / text-to-image + image-to-image | PAIR with #15 |
| 19 | `kling-image-2.1-multi-image-to-image.md` | `POST /v1/images/multi-image2image` | **LEGACY** (`model_name`: `kling-v2-1` only) | Image / multi-image-to-image | |
| 20 | `kling-image-common-subject-completion.md` | `POST /v1/general/ai-multi-shot` | **LEGACY** (no model field at all; `/v1/`) | Image / AI multi-shot (subject completion) | |
| 21 | `kling-image-common-outpainting.md` | `POST /v1/images/editing/expand` | **LEGACY** (no model field at all; `/v1/`) | Image / outpainting | |

**Headline:** every video doc in scope is NEW-standard; **no image doc is** — all seven use `/v1/` paths, legacy `task_id`/`task_status`/`task_result` response shapes, and (where a model is selectable) `model_name` in the body. There is no NEW-standard image generation endpoint in this corpus. §2 therefore covers the 11 distinct NEW video endpoints; §1a summarises the legacy image bodies for the model matrix only.

### 1a. Doc pairs documenting the same endpoint — content comparison (`diff` of whole files)

| Pair | Differences |
|---|---|
| `kling-omni-3.0-motion-control.md` vs `kling-motion-control-3.0.md` | Header only: H1 (`# Motion Control` vs `# Motion Control 3.0`), `> Source:` URL (`/api/video/3-0-omni/motion-control` vs `/api/video/motion-control`), `Current Tab`/`Sibling Tabs` lines. **Body byte-identical.** |
| `kling-2.6-motion-control.md` vs `kling-motion-control-2.6.md` | Header only (H1, Source `/api/video/2-6/motion-control` vs `/api/video/motion-control/2-6`, tabs). **Body byte-identical.** |
| `kling-image-omni-3.0-image-omni.md` vs `kling-image-o1-generation.md` | Header only (H1 `# Omni Image Generation` vs `# Image Generation`, Source `/api/image/3-0-omni/image-omni` vs `/api/image/o1/image-generation`, tabs). **Body byte-identical.** |
| `kling-image-omni-3.0-generation.md` vs `kling-image-2.1-generation.md` | Header only (H1 `# Image Generation` vs `# Text to Image/Image to Image`, Source `/api/image/3-0-omni/image-generation` vs `/api/image/2-1/image-generation`, tabs). **Body byte-identical.** |

So the vendor site publishes one page per endpoint and mounts it under several nav locations; the corpus captured each mount. No material content divergence in any pair.

---

## 2. PER-ENDPOINT REQUEST SCHEMA (NEW standard, 11 distinct endpoints)

Conventions: "Req" = the doc's Required column. Enums quoted exactly. Field-note constraints paraphrased tightly, numeric limits verbatim.

### 2.0 Shared `options` block (identical semantics in all 14 video docs)

| Field path | Type | Req | Default | Enum | Notes |
|---|---|---|---|---|---|
| `options` | object | No | - | - | |
| `options.callback_url` | string | No | - | - | "If configured, the server will actively notify when the task status changes"; schema → Callback Protocol |
| `options.external_task_id` | string | No | - | - | Does not overwrite system task id; usable in queries; "must be unique within a single user account" |
| `options.watermark_info` | object | No | - | - | `{ "enabled": boolean }`; "Custom watermark is not supported at this time" |
| `options.watermark_info.enabled` | boolean | No | `false` | - | true → also generate watermarked result. Listed as its own table row **only** in the two 3.0-turbo docs; the other 12 define it in the field notes. |

### 2.1 `POST /text-to-video/kling-3.0-turbo` — `kling-3.0-turbo-t2v.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `prompt` | string | **Yes** | - | - |
| `settings` | object | No | - | - |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p` |
| `settings.aspect_ratio` | string | No | `16:9` | `16:9`, `9:16`, `1:1` |
| `settings.duration` | int | No | `5` | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` |
| `options.*` | | | | see §2.0 |

Field notes:
- `prompt`: "cannot exceed 3072 characters, and it is recommended that the content length not exceed 2500 characters". Positive + negative descriptions in one string (there is no `negative_prompt` anywhere in the NEW standard).
- Multi-shot prompt syntax (3.0 Turbo): `"shot n, m, words; shot n, m, words;"` separated by half-width semicolons; `n` = shot sequence number, "supports up to 6 storyboards and at least 1"; `m` = shot duration, each ≥ 1 s, sum of all shot durations = total video duration; `words` = shot prompt, max length 512.
- No `settings.audio` and no `settings.multi_shot` on 3.0 Turbo (contrast 3.0 / 3.0 Omni). Capability map nonetheless lists 3.0 Turbo "Native Audio: Supported" — see §6.

### 2.2 `POST /image-to-video/kling-3.0-turbo` — `kling-3.0-turbo-i2v.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `contents` | array | **Yes** | - | - |
| `contents[].type` | string | **Yes** | - | `prompt`, `first_frame` |
| `contents[].text` | string | No | - | - |
| `contents[].url` | string | No | - | - |
| `settings` | object | No | - | - |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p` |
| `settings.duration` | int | No | `5` | `3`…`15` (same 13-value list as §2.1) |
| `options.*` | | | | §2.0 (+ explicit `options.watermark_info.enabled` row) |

No `settings.aspect_ratio` (true of every i2v endpoint — the frame image sets it).

Field notes:
- `contents`: "Place fields related to the same material in the same object". Shape: `[{ "type": "prompt", "text": "…" }, { "type": "first_frame", "url": "…" }]`.
- `contents[].text` JSON comment: "cannot exceed 2500 characters; Required" (within a `prompt` object). Same 3.0 Turbo multi-shot syntax as §2.1.
- `contents[].url` (first_frame): "URL or Base64"; formats `.jpg, .jpeg, .png`; file ≤ 50MB; width and height ≥ 300px; aspect ratio 1:2.5 – 2.5:1.
- "Currently, only First Frame is supported. First Frame + Last Frame and Last Frame-only are not supported yet."

### 2.3 `POST /text-to-video/kling-3.0` — `kling-omni-3.0-t2v.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `prompt` | string | **Yes** | - | - |
| `settings` | object | No | - | - |
| `settings.multi_shot` | boolean | No | `true` | - |
| `settings.audio` | string | No | `off` | `native`, `off` |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p`, `4k` |
| `settings.aspect_ratio` | string | No | `16:9` | `16:9`, `9:16`, `1:1` |
| `settings.duration` | int | No | `5` | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` |
| `options.*` | | | | §2.0 |

Field notes:
- `prompt`: "Maximum length: 3072 characters (recommended: ≤ 2500)".
- Multi-shot syntax (Kling 3.0): `"shot n, m, words; shot n, m, words;"`; `n` 1–6 shots; `m` each ≥ 1s, sum = total duration; `words` max 512 chars.
- `settings.multi_shot`: "When set to false, multi-shot prompts will not produce multi-shot output."
- `settings.audio`: `native` = native audio matching visuals; `off` = no audio.

### 2.4 `POST /image-to-video/kling-3.0` — `kling-omni-3.0-i2v.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `contents` | array | **Yes** | - | - |
| `contents[].type` | string | **Yes** | - | `prompt`, `first_frame`, `last_frame`, `element` |
| `settings` | object | No | - | - |
| `settings.multi_shot` | boolean | No | `true` | - |
| `settings.audio` | string | No | `off` | `native`, `off` |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p`, `4k` |
| `settings.duration` | int | No | `5` | `3`…`15` |
| `options.*` | | | | §2.0 |

Content-object shapes (from field notes):
- `{ "type": "prompt", "text": string }` — text ≤ 3072 chars, recommended ≤ 2500; required.
- `{ "type": "first_frame" | "last_frame", "url": string }` — url "URL or Base64"; `.jpg/.jpeg/.png`; ≤ 50MB; ≥ 300px each side; ratio 1:2.5–2.5:1. "Required in the first_frame, optional in the last_frame". "Supports first-frame-to-video and first-and-last-frame-to-video generation; last-frame-only video generation is not supported."
- `{ "type": "element", "element_id": string, "id": string }` — `element_id` from the Element API (required); `id` = "Input index ID, used to specify in prompt, ... must not be duplicated" (required). "Up to 3 Elements can be specified."
- Prompt referencing: "Specify an element in the format of @xxx, such as @Zhang." Avoid names that are substrings of one another (`@Zhang` vs `@ZhangSan`); avoid names overlapping prompt text (`@gmail`). Same multi-shot syntax as §2.3.

### 2.5 `POST /omni-video/kling-3.0-omni` — `kling-omni-3.0-ovg.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `contents` | array | **Yes** | - | - |
| `contents[].type` | string | **Yes** | - | `prompt`, `first_frame`, `last_frame`, `refer_image`, `feature_video`, `base_video`, `element` |
| `settings` | object | No | - | - |
| `settings.multi_shot` | boolean | No | `true` | - |
| `settings.audio` | string | No | `off` | `native`, `original`, `off` |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p`, `4k` |
| `settings.aspect_ratio` | string | No | `16:9` | `16:9`, `9:16`, `1:1` |
| `settings.duration` | int | No | `5` | `3`…`15` |
| `options.*` | | | | §2.0 |

Content-object shapes:
- `{ "type": "prompt", "text": string }` — ≤ 3072 chars, recommended ≤ 2500.
- `{ "type": "first_frame"|"last_frame"|"refer_image", "url": string, "id": string }` — `id` **optional** here ("input index ID, used to specify in prompt"). Image: `.jpg/.jpeg/.png`, ≤ 50MB, ≥ 300px, ratio 1:2.5–2.5:1.
- `{ "type": "feature_video"|"base_video", "url": string, "id": string }` — `url` "through URLs" (no Base64 mentioned); `id` optional. Video: `.mp4, .mov`; ≤ 200MB; duration 3 s (incl.) – 15.5 s (incl.); width/height 700px–4553px inclusive, total pixel area ≤ 8294400; aspect ratio 0.4–2; frame rate 24–60fps ("the frame rate for generating videos is 24fps"). "Maximum 1 reference video. After adding a reference video, add at most one video character element."
- `{ "type": "element", "element_id": string, "id": string }` — both **required**.

Prompt referencing: "Specify an image, an Element, a video in the format of @xxx, such as @image_1, @Zhang, @video_1." Same substring/overlap cautions. Multi-shot syntax as §2.3 (Kling 3.0 Omni).

Matrices / mutual exclusions:
- Image-count limits: no ref video + only multi-image elements → refer images + multi-image elements ≤ 7; no ref video + both video-character and multi-image elements → refer images + multi-image elements ≤ 4; with ref video + only multi-image elements → ≤ 4; **with a reference video, video-character elements and reference images are not supported at the same time.**
- Element-count limits: first frame / first+last frame → max 3 elements; no ref video + only video-character elements → ≤ 3; no ref video + both kinds → video-character ≤ 3 and (refer images + multi-image) ≤ 4; with ref video + only video-character → ≤ 1; with ref video → not both kinds.
- Frames: only "first frame only" and "first + last frame"; "Last frame only" not supported.
- `feature_video`: "Supports multi-shot videos, in which case the multi_shot parameter can only be true." "Native audio generation is not supported and the audio parameter can only be off in this case."
- `base_video` (video to edit): no first/last frame; no multi-shot; `audio` cannot be `native` (examples use `original`).
- `settings.audio`: `native` = generated audio; `original` = "retains the original sound of the reference video"; `off`.
- `settings.aspect_ratio`: "When there is no first frame or reference video, the current parameter is required." (Table says No — see §6.)
- Examples: `feature_video` and `base_video` examples omit `settings.duration` entirely; the doc does not state whether duration is derived from the reference video.

### 2.6 `POST /motion-control/kling-3.0` — `kling-omni-3.0-motion-control.md` ≡ `kling-motion-control-3.0.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `contents` | array | **Yes** | - | - |
| `contents[].type` | string | **Yes** | - | `prompt`, `image`, `video`, `element` |
| `settings` | object | No | - | - |
| `settings.character_orientation` | string | **Yes** | - | `image`, `video` |
| `settings.audio` | string | No | `original` | `original`, `off` |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p` |
| `options.*` | | | | §2.0 |

No `settings.duration`, no `settings.aspect_ratio`, no `multi_shot` (output length follows the motion video).

Content-object shapes:
- `{ "type": "prompt", "text": string }` — ≤ 2500 chars; "You can add elements to the screen and achieve motion effects through prompt" (Motion Control user guide).
- `{ "type": "image", "url": string }` — appearance reference; URL or Base64; `.jpg/.jpeg/.png`; ≤ 50MB; ≥ 300px; ratio 1:2.5–2.5:1. Content guidance: proportions should match the reference video; upper/full body + head visible; avoid extreme orientations; supports realistic and stylized humanoid characters.
- `{ "type": "video", "url": string }` — motion reference; `.mp4/.mov`; ≤ 100 MB; width/height 340px–3850px inclusive; **min 3 s**; max depends on `character_orientation`: `video` → up to 30 s, `image` → up to 10 s. Single continuous take, one person recommended (largest person used if several); result may be shorter than input if motion is hard to extract ("Deduction is calculated based on the output video duration"); system validates and returns an error code on problems.
- `{ "type": "element", "element_id": string, "id": string }` — all required; "At most 1 element can be specified." "When using an Element, the generated video always follows the character orientation from the reference video."
- `settings.character_orientation`: `image` → match reference image, ref video ≤ 10s; `video` → match reference video, ref video ≤ 30s.

### 2.7 `POST /omni-video/kling-o1` — `kling-o1-video.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `contents` | array | **Yes** | - | - |
| `contents[].type` | string | **Yes** | - | `prompt`, `first_frame`, `last_frame`, `refer_image`, `feature_video`, `base_video`, `element` |
| `settings` | object | No | - | - |
| `settings.audio` | string | No | `off` | `original`, `off` |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p` |
| `settings.aspect_ratio` | string | No | `16:9` | `16:9`, `9:16`, `1:1` |
| `settings.duration` | int | No | `5` | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10` |
| `options.*` | | | | §2.0 |

No `multi_shot`; no `native` audio option (only `original`/`off`).

Content-object shapes: same seven types and JSON shapes as §2.5, with these O1-specific limits:
- prompt `text` ≤ 2500 chars (not 3072). Referencing `@image_1`, `@Zhang`, `@video_1`; same substring/overlap cautions; no multi-shot syntax.
- Images: `.jpg/.jpeg/.png`, ≤ 50MB, ≥ 300px, 1:2.5–2.5:1. Limits: no ref video → refer images + multi-image elements ≤ 7; with ref video → ≤ 4. Frames: first-only or first+last; "Last frame only" not supported; "When using both the first and last frames, no additional reference images can be added."
- Videos: `.mp4/.mov`; ≤ 200MB; duration 3 s–**10 s** inclusive; width/height 700px–**2160px** inclusive; 24–60fps; "Add at most one reference video." `feature_video`: "Only supports defining the first frame of the video, not the last frame." `base_video`: no first or last frame.
- Elements: "Currently, the model only supports multi-image elements; video elements are not yet supported." Limits: first+last frames → Elements not supported; no ref video → refer images + Elements ≤ 7; with ref video → ≤ 4.
- `settings.aspect_ratio`: "When there is no first frame and reference video, the current parameter is required."
- `settings.duration`: "When using the first frame to generate a video without any other reference images (refer_image) or videos (feature_video/base_video), only 5-second or 10-second videos can be generated."

### 2.8 `POST /text-to-video/kling-2.6` — `kling-2.6-t2v.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `prompt` | string | **Yes** | - | - |
| `settings` | object | No | - | - |
| `settings.audio` | string | No | `off` | `native`, `off` |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p` |
| `settings.aspect_ratio` | string | No | `16:9` | `16:9`, `9:16`, `1:1` |
| `settings.duration` | int | No | `5` | `5`, `10` |
| `options.*` | | | | §2.0 |

Field notes: `prompt` max 2500 chars. **"When generating videos with native audio, only 1080P resolution is supported."** (stated under both `audio` and `resolution`).

### 2.9 `POST /image-to-video/kling-2.6` — `kling-2.6-i2v.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `contents` | array | **Yes** | - | - |
| `contents[].type` | string | **Yes** | - | `prompt`, `first_frame`, `last_frame`, `voice` |
| `settings` | object | No | - | - |
| `settings.audio` | string | No | `off` | `native`, `off` |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p` |
| `settings.duration` | int | No | `5` | `5`, `10` |
| `options.*` | | | | §2.0 |

Content-object shapes:
- `{ "type": "prompt", "text": string }` — ≤ 2500 chars. "Specify a voice in the format of @xxx, such as @sweet." (Example uses `@1` with voice `id: "1"`.)
- `{ "type": "first_frame"|"last_frame", "url": string }` — first required, last optional; same image limits (≤ 50MB, ≥ 300px, 1:2.5–2.5:1, jpg/jpeg/png); last-frame-only unsupported; **"When generating videos using the first and last frames, only 1080p resolution is supported."**
- `{ "type": "voice", "voice_id": string, "id": string }` — `voice_id` "returned through custom voice API" or a system preset (Voice Management doc, out of scope); `id` = prompt index, unique. "At most 2 voices can be referenced." "When specifying a voice, the sound parameter audio cannot be off."
- `settings.audio`: `native` → only 1080P; `off` → "designated voice is not supported".

### 2.10 `POST /motion-control/kling-2.6` — `kling-2.6-motion-control.md` ≡ `kling-motion-control-2.6.md`

Identical to §2.6 except:
- `contents[].type` enum is `prompt`, `image`, `video` — **no `element`**.
- `settings.character_orientation` notes lack the element clause.
- Description of `settings` still says "such as resolution, duration, etc" although there is no duration field.
All limits (image ≤ 50MB/≥300px; video `.mp4/.mov`, ≤ 100 MB, 340–3850px, ≥ 3 s, ≤ 30 s for `video` orientation / ≤ 10 s for `image` orientation; `audio` default `original`; `resolution` `720p`/`1080p`) are the same as §2.6.

### 2.11 `POST /text-to-video/kling-2.5-turbo` — `kling-2.5-turbo-t2v.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `prompt` | string | **Yes** | - | - |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p` |
| `settings.aspect_ratio` | string | No | `16:9` | `16:9`, `9:16`, `1:1` |
| `settings.duration` | int | No | `5` | `5`, `10` |
| `options.*` | | | | §2.0 |

`prompt` max 2500 chars. No audio, no multi-shot.

### 2.12 `POST /image-to-video/kling-2.5-turbo` — `kling-2.5-turbo-i2v.md`

| Field path | Type | Req | Default | Enum |
|---|---|---|---|---|
| `contents` | array | **Yes** | - | - |
| `contents[].type` | string | **Yes** | - | `prompt`, `first_frame`, `last_frame` |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p` |
| `settings.duration` | int | No | `5` | `5`, `10` |
| `options.*` | | | | §2.0 |

Prompt ≤ 2500; frames: first required, last optional, last-only unsupported; image limits as elsewhere; **"First + last frame only supports 1080p resolution."**

### 2.13 Cross-endpoint content-type vocabulary (NEW standard)

| `contents[].type` | Fields | Appears in |
|---|---|---|
| `prompt` | `text` | all `contents[]` endpoints |
| `first_frame` | `url` (+ optional `id` on omni-video) | 3.0-turbo i2v, 3.0 i2v, 3.0-omni ovg, o1, 2.6 i2v, 2.5-turbo i2v |
| `last_frame` | `url` (+ optional `id` on omni-video) | 3.0 i2v, 3.0-omni ovg, o1, 2.6 i2v, 2.5-turbo i2v (not 3.0-turbo) |
| `refer_image` | `url`, `id`(opt) | 3.0-omni ovg, o1 |
| `feature_video` | `url`, `id`(opt) | 3.0-omni ovg, o1 |
| `base_video` | `url`, `id`(opt) | 3.0-omni ovg, o1 |
| `element` | `element_id`, `id` (both req) | 3.0 i2v, 3.0-omni ovg, 3.0 motion-control, o1 |
| `voice` | `voice_id`, `id` (both req) | 2.6 i2v only |
| `image` (appearance ref) | `url` | motion-control 3.0 / 2.6 |
| `video` (motion ref) | `url` | motion-control 3.0 / 2.6 |

Camera control: **no camera-control field exists in any NEW-standard doc in scope.** `grep -il camera` over the 14 video docs (2026-09-20) hits only the four motion-control docs, and only in the reference-video guidance sentence "Avoid cuts, camera movement, etc." — no field. Camera direction, if any, is prompt-driven. Likewise `negative_prompt` appears in none of the 14 video docs (positive/negative go in one `prompt`/`text` string).
End frame: expressed as `contents[].type = "last_frame"`; there is no `image_tail` field in the NEW standard. Last-frame-only is unsupported everywhere.

---

## 3. COMMON CONTRACT (NEW standard)

Verified by extracting the tail of each video doc from `## Query Task (By task ID)` onward and hashing: two hashes across 14 files. `kling-3.0-turbo-t2v.md` and `kling-3.0-turbo-i2v.md` share one; the other 12 share the other. The only difference between the two variants is the type of `start_time`/`end_time` in the cursor query (below).

### 3.1 Create-task response (all 14 docs; only comment wording differs)

```
code         int     // 0 on success; see Error Codes
message      string
request_id   string
data.id           string   // system task ID (3.0-turbo docs show "893605946402811985")
data.status       string   // enum: submitted, processing, succeeded, failed
data.create_time  long     // Unix ms
data.update_time  long     // Unix ms
data.external_id  string   // the custom task ID, "if any"
```
Note the key is `external_id` on responses but `options.external_task_id` on requests.

### 3.2 `GET /tasks` (Query Task by task ID)

- "The API currently supports querying async tasks only."
- Query params (table says Required: No for both; notes say exactly one must be used):

| Param | Type | Notes |
|---|---|---|
| `task_ids` | string | comma-separated batch; mutually exclusive with `external_task_ids` |
| `external_task_ids` | string | comma-separated batch; mutually exclusive with `task_ids` |

The field notes call both "Request path parameter, fill the value directly in the request path", but the example is a query string: `GET /tasks?external_task_ids=123`. Treat as query-string.

Response:
```
code, message, request_id
data[]                         // array (one entry per task)
data[].id             string
data[].status         string   // submitted, processing, succeeded, failed
data[].message        string   // failure reason when failed (e.g. content risk control)
data[].create_time    long ms
data[].update_time    long ms
data[].external_id    string
data[].outputs[]               // typed union on outputs[].type ∈ image, video, audio, element, voice
data[].billing[]
```

`outputs[]` variants (exact property names):

| `type` | Properties |
|---|---|
| `video` | `id` (string, "Video ID"), `url` (string, hotlink-protected; "cleared after 30 days"), `watermark_url` (string), `duration` (**string**, seconds) |
| `image` | `url`, `watermark_url`, `group_id` (string, "Only appears when generating grouped images") — **no `id`, no `index`** |
| `audio` | `id`, `mp3_url`, `wav_url`, `mp3_duration` (string), `wav_duration` (string) |
| `voice` | `id`, `name`, `url`, `owned_by` ("kling" = official library, else creator ID), `status` (enum: `succeeded`, `deleted`) |
| `element` | `id`, `name`, `description`, `element_type` (enum: `video_character_elements`, `multi_image_elements`), `references[]` (each `{type ∈ image|video|voice, role, url}`; image `role` ∈ `frontal`, `reference`; video/voice `role` fixed `refer`; voice refs add `id`, `name`, `owned_by`), `owned_by`, `status` (`succeeded`, `deleted`), `tags[]` (`{id:int, name, description}`) |

`billing[]` entries:
```
charge_type   string  // "cash" (balance) | "unit" (resource package)
cash_type     string  // only when charge_type=cash: "balance" | "test_balance"
amount        string  // decimal; discount price (cash) or units (unit)
currency      string  // only when cash: fixed "CNY/USD"
package_type  string  // only when unit: enum video, image, audio
list_price    string  // only when cash
```

There is **no `task_result`** object in the NEW standard; the legacy `task_result.videos[]`/`images[]` is replaced by `outputs[]`. Watermark variants are the sibling `watermark_url` on `video`/`image` outputs (present regardless of `watermark_info.enabled`? — not stated; §6).

### 3.3 `POST /tasks` (Query Task by cursor)

Request body:

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `start_time` | `long` (3.0-turbo docs) / `string` (other 12) | No | `end_time - 30 days` | Unix ms; must be earlier than `end_time` |
| `end_time` | `long` / `string` (same split) | No | `current time` | Unix ms |
| `cursor` | string | No | - | "Use the next_cursor returned by the previous query"; "When cursor is not empty, start_time and end_time are ignored" |
| `limit` | int | No | `100` | "Maximum value: 500" |
| `filters` | array | No | - | `[{ "key": …, "values": [...] }]` |
| `filters[].key` | string | No | - | enum `status`, `product_type` |
| `filters[].values` | array | No | - | for `status`: `submitted`, `processing`, `succeeded`, `failed`; for `product_type`: `video`, `image`, `try_on` |

The 3.0-turbo examples send `"start_time": 1781193600000` (number); the other 12 send `"start_time": "1781193600000"` (quoted string). Flagged in §6.

Response:
```
code, message, request_id
data.result[]      // same per-task object as GET /tasks data[] (id, status, message, create_time, update_time, external_id, outputs[], billing[])
data.count         int      // "Number of query results"
data.next_cursor   string
data.has_more      boolean
```

### 3.4 Status enum

NEW standard, everywhere: `submitted`, `processing`, `succeeded`, `failed`.
Legacy (image docs in scope): `submitted`, `processing`, `succeed`, `failed` — note `succeed` vs `succeeded`. A shared client type must not conflate them.

### 3.5 `product_type` filter values

`video`, `image`, `try_on` (no `audio`, though `billing[].package_type` lists `audio`).

### 3.6 Legacy image contract, for contrast (not the NEW standard)

Create response: `data.task_id`, `data.task_status`, `data.task_info.external_task_id`, `data.created_at`, `data.updated_at`. Query: `GET /v1/<product>/{id}` (path `task_id`, or `external_task_id`), list via `GET /v1/<product>?pageNum=&pageSize=` (pageNum 1–1000, pageSize 1–500). Result: `data.task_result.images[] {index, url, watermark_url}`; omni-image adds `task_result.result_type` and `task_result.series_images[]`; ai-multi-shot uses `images[] {index (0-2), url_1, url_2, url_3}`. Deductions: `final_unit_deduction`, `final_balance_deduction.{quota,list_price}`, plus echoed `watermark_info.enabled`.

---

## 4. MODEL MATRIX

### 4.1 Video model ids (URL path segments)

| Path model id | Capability-map name | Endpoints (NEW) | Modes / settings | resolution | duration (s) | aspect_ratio | audio |
|---|---|---|---|---|---|---|---|
| `kling-3.0-turbo` | Kling 3.0 Turbo | `/text-to-video/kling-3.0-turbo`, `/image-to-video/kling-3.0-turbo` | single-shot + multi-shot via prompt syntax (≤ 6 shots); i2v first_frame only | `720p`, `1080p` | `3`–`15` (every int) | t2v: `16:9`, `9:16`, `1:1` | no `audio` field in docs (cap map says Native Audio "Supported" — §6) |
| `kling-3.0` | Kling 3.0 | `/text-to-video/kling-3.0`, `/image-to-video/kling-3.0`, `/motion-control/kling-3.0` | `multi_shot` bool (default true); i2v first/first+last; `element` ≤ 3; motion control with `character_orientation` `image`/`video`, `element` ≤ 1 | t2v/i2v: `720p`, `1080p`, `4k`; motion-control: `720p`, `1080p` (cap map: "4K is not supported") | t2v/i2v `3`–`15`; motion control: none (follows ref video, 3–30 s / 3–10 s) | t2v: `16:9`, `9:16`, `1:1` | t2v/i2v `native`/`off` (default `off`); motion control `original`/`off` (default `original`) |
| `kling-3.0-omni` | Kling 3.0 Omni | `/omni-video/kling-3.0-omni` | multi_shot; first/last/refer_image; feature_video/base_video (1 max, 3–15.5 s); elements (both kinds) with count matrices | `720p`, `1080p`, `4k` | `3`–`15` | `16:9`, `9:16`, `1:1` (required when no first frame / ref video) | `native`, `original`, `off` (default `off`; `native` forbidden with base_video; only `off` with feature_video) |
| `kling-o1` | Kling O1 | `/omni-video/kling-o1` | first/last/refer_image; feature_video/base_video (1 max, 3–10 s, ≤ 2160px); multi-image elements only; no multi-shot | `720p`, `1080p` | `3`–`10`; first-frame-only → `5` or `10` | `16:9`, `9:16`, `1:1` (required when no first frame and no ref video) | `original`, `off` (default `off`) |
| `kling-2.6` | Kling 2.6 | `/text-to-video/kling-2.6`, `/image-to-video/kling-2.6`, `/motion-control/kling-2.6` | i2v first/first+last (first+last → 1080p only); `voice` ≤ 2 (i2v only; requires audio ≠ off); motion control (no element) | `720p`, `1080p`; native audio → 1080p only | `5`, `10` (t2v/i2v); motion control none | t2v: `16:9`, `9:16`, `1:1` | t2v/i2v `native`/`off` (default `off`); motion control `original`/`off` |
| `kling-2.5-turbo` | Kling 2.5 Turbo | `/text-to-video/kling-2.5-turbo`, `/image-to-video/kling-2.5-turbo` | i2v first/first+last (first+last → 1080p only); no audio; no multi-shot | `720p`, `1080p` | `5`, `10` | t2v: `16:9`, `9:16`, `1:1` | none |

Capability-map (`kling-guide-capability-map-video.md`, updated 2026-05-19) additions per model:
- Generation range: 3.0 Turbo 3~15s / 720P,1080P; 3.0 3~15s / 720P,1080P,4K; 3.0 Omni 3~15s / 720P,1080P,4K; O1 3~10s / 720P,1080P; 2.6 3~10s / 720P,1080P; 2.5 Turbo 5s,10s / 720P,1080P.
- T2V: Multi-shot — 3.0 Turbo, 3.0, 3.0 Omni Supported; O1, 2.6, 2.5 Turbo Not. Native audio — 3.0 Turbo, 3.0, 3.0 Omni, 2.6 Supported; O1, 2.5 Turbo Not. "Voice Control (Human Voice)" — Not Supported for all in T2V. O1 and 2.6 single-shot: "Only supports 5s or 10s duration"; 2.6 adds "720P supports silent videos only".
- I2V: First/Last Frame — 3.0 Turbo Not; 3.0, 3.0 Omni, O1 Supported; 2.6 "Only supports 1080P silent videos"; 2.5 Turbo "Only supports 1080P". End Frame Only — Not Supported for all. Element Control — 3.0, 3.0 Omni Supported; O1 "Multi-image elements only"; others Not. Voice Control — 2.6 only ("Only supports 5s or 10s duration and 1080P videos"). Motion Control — 3.0 ("4K is not supported") and 2.6 Supported; others Not. Video Reference — 3.0 Omni and O1 Supported.
- Global (all model versions): Avatar, Lip Sync, Multi-element Video Editing, Video to Audio, Text to Audio (docs for these are out of scope).

### 4.2 Image model ids (`model_name` enum values; all LEGACY `/v1/` endpoints)

| `model_name` | Capability-map name | Endpoint(s) | resolution | aspect_ratio | Other |
|---|---|---|---|---|---|
| `kling-v3` | Kling Image 3.0 | `/v1/images/generations` (default there) | `1k`, `2k` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9` (no `auto`) | `element_list` (elements + images ≤ 10); `n` 1–9; cap map: Subject Control "Multi-image main image only"; Multi-image to Image Not Supported; Series Not Supported |
| `kling-v3-omni` | Kling Image 3.0 Omni | `/v1/images/omni-image` | `1k`, `2k`, `4k` | above + `auto` | `image_list` + `element_list` ≤ 10; `result_type` `single`/`series`; `series_amount` `2`–`9` or `auto`; cap map: T2I "Auto ratio is not supported"; Series Supported; Multi-image Supported |
| `kling-image-o1` | Kling Image O1 | `/v1/images/omni-image` (default there) | endpoint enum `1k`,`2k`,`4k`; cap map says **1K, 2K only** | above + `auto` | cap map: Series Not Supported; Multi-image Supported |
| `kling-v2-1` | Kling Image 2.1 | `/v1/images/generations`; `/v1/images/multi-image2image` (only value, default) | `1k`, `2k` | 8 ratios, no `auto` | only model supporting `image_reference` (`subject`/`face`), `image_fidelity` [0,1] default 0.5, `human_fidelity` [0,1] default 0.45; multi-image2image: `subject_image_list` 1–4, `scene_image`, `style_image`; cap map: Series "Supported" (§6) |
| (none) | — | `/v1/general/ai-multi-shot` (`element_frontal_image`), `/v1/images/editing/expand` (`image`, four `*_expansion_ratio` [0,2], area ≤ 3× original, `prompt`, `n` 1–9) | — | — | Outpainting listed as global capability "All model versions" |

Image capability map: Style Training Not Supported for all; Character/Face Feature Reference only Kling Image 2.1.

---

## 5. DEPRECATION / AVAILABILITY NOTES

Within the 24 in-scope files:
- `kling-image-omni-3.0-generation.md` ≡ `kling-image-2.1-generation.md` (Description): "the original model field has been changed to model_name ... If you continue to use the original model field, it will not have any impact ... equivalent to the default behavior when model_name is empty (i.e., call the V1 model)." — legacy `model` field still accepted; empty `model_name` → "V1 model" (contradicts the table default `kling-v3`, see §6).
- `kling-3.0-turbo-i2v.md`: "Currently, only First Frame is supported. First Frame + Last Frame and Last Frame-only are not supported yet."
- `kling-o1-video.md`: "Currently, the model only supports multi-image elements; video elements are not yet supported."
- Every doc: "Custom watermark(s) not supported at this time / currently."
- Result retention: all output URLs "will be cleared after 30 days".
- `kling-guide-quick-start.md`: "guide for using the new system's API services"; auth is API Key bearer only; domain `https://api-singapore.klingai.com`.
- No file in scope marks any model as discontinued, legacy, or recommends a replacement. `grep -i "deprecat|discontinu|legacy|no longer|retire|sunset"` over the 24 files → 0 hits (2026-09-20).

Out of scope but directly relevant (`kling-updates-api.md`, deprecation-grep only):
- 07/15/2026: "More video models support the new API (same as Kling 3.0 Turbo API) ... Models added: Kling 3.0, Kling 3.0 Omni, Kling 3.0 Motion Control, Kling 2.6, Kling 2.6 Motion Control, Kling 2.5 Turbo. **The legacy API will continue to be available with no current plans for deprecation.**"
- 06/17/2026: Kling 3.0 Turbo released; "The new API supports authentication via API Key only. Please migrate as soon as possible" (i.e. JWT-style auth is not carried into the new API). Billing: 0.8 units/s at 720P, 1.0 unit/s at 1080P.
- 06/17/2026: 3.0 Omni reference video expanded to 3–15 s and 4K; feature-ref multi-shot requires "set multi_shot to true, set shot_type to intelligence" — `shot_type` appears **nowhere** in `kling-omni-3.0-ovg.md`.
- Video-effect discontinuations (`magic_match_tree` 2026-07-03; `kiss, fight, hug, thumbs_up, tiger_hug, pet_lion, 3d_cartoon_1` 2026-01-30; `celebration, c4d_cartoon` 2025-12-30) — effects endpoint, not in scope.

---

## 6. OPEN QUESTIONS / CONTRADICTIONS

1. **`start_time`/`end_time` type in `POST /tasks`** — `long` with numeric literals in `kling-3.0-turbo-t2v.md` / `kling-3.0-turbo-i2v.md`; `string` with quoted literals in the other 12 video docs. Server tolerance unknown; a client should probably accept both and pick one to send.
2. **3.0 Turbo prompt length** — `kling-3.0-turbo-t2v.md` says ≤ 3072 (recommended ≤ 2500); `kling-3.0-turbo-i2v.md`'s `contents[].text` JSON comment says "cannot exceed 2500 characters". Same model, different limit.
3. **3.0 Turbo native audio** — capability map (`kling-guide-capability-map-video.md`) lists Native Audio "Supported" for Kling 3.0 Turbo in both T2V and I2V, but neither 3.0-turbo endpoint doc has a `settings.audio` field. Either audio is always-on/prompt-driven or the map is wrong.
4. **`settings.character_orientation` Required=Yes inside optional `settings`** (motion control 3.0 and 2.6). A required field nested in a not-required object; treat `settings` as effectively required for motion control.
5. **`settings.aspect_ratio` Required=No but "required when there is no first frame or reference video"** (`kling-omni-3.0-ovg.md`, `kling-o1-video.md`). Conditional requirement not expressible in the table; the default `16:9` may or may not apply in that case.
6. **Kling O1 duration** — endpoint enum `3`–`10`, with a 5/10-only constraint stated only for first-frame-without-other-refs. Capability map says O1 T2V single-shot "Only supports 5s or 10s duration" (no first frame involved). Which durations pure-text O1 accepts is ambiguous.
7. **`duration` with reference videos on `/omni-video/kling-3.0-omni`** — the `feature_video` and `base_video` examples omit `settings.duration`; the doc never says whether duration is ignored/derived. Also `updates-api` mentions a `shot_type: intelligence` parameter for feature-ref multi-shot that no in-scope doc defines.
8. **Naming drift: "omni" files documenting `kling-3.0`** — `kling-omni-3.0-t2v.md`, `kling-omni-3.0-i2v.md`, `kling-omni-3.0-motion-control.md` all target path model `kling-3.0`, not `kling-3.0-omni`; only `kling-omni-3.0-ovg.md` targets `kling-3.0-omni`. The vendor groups them under the "3-0-omni" nav tab. Also the capability map lists Motion Control as "Not Supported" for Kling 3.0 Omni but "Supported" for Kling 3.0 — consistent with the path, inconsistent with the file names. (Also: `kling-omni-3.0-t2v.md` has a literal " copy" in its filename — a stray duplicate name, and no non-"copy" sibling exists.)
9. **`GET /tasks` params described as "Request path parameter"** while the example and the table header (`### Query Params`) show a query string. Treat as query string.
10. **`image` output has no `id` or `index`** while `video`/`audio` outputs do; grouping is via `group_id`. Ordering of multiple images in `outputs[]` is not stated.
11. **`watermark_url` presence** — returned in the schema unconditionally; whether it is empty/absent when `watermark_info.enabled=false` is not stated.
12. **Status enum spelling** — NEW `succeeded` vs legacy `succeed`. Any shared status type must handle both; `product_type` filter has no `audio` while `billing[].package_type` does.
13. **Image capability map vs endpoint enums** — (a) Kling Image O1: map says 1K/2K, `/v1/images/omni-image` enum includes `4k` (default `model_name` there is `kling-image-o1`); (b) Kling Image 2.1 "Series Image Generation: Supported" but no 2.1 endpoint exposes `result_type`/`series_amount`; (c) `/v1/images/generations` default `model_name` = `kling-v3` in the table, but the Description says an empty `model_name` calls "the V1 model".
14. **Legacy image docs are all that exist for images** — the task brief anticipated NEW-standard image endpoints; none are in this corpus. If the SDK needs NEW-standard image generation, the docs for it were not captured (check `https://kling.ai/document-api/llms.txt`).
15. **Element / voice management** — `element_id` (3.0 i2v, ovg, motion-control 3.0, o1) and `voice_id` (2.6 i2v) are obtained from Element/Voice Management endpoints (`kling-omni-3.0-element-mgt.md`, `kling-o1-element-mgt.md`, `kling-2.6-voice-mgt.md`, `kling-omni-3.0-voice-mgt.md`) which were not in scope; the `outputs[]` union already carries `element` and `voice` result shapes, implying those endpoints are also NEW-standard `/tasks` consumers — unverified here.
16. **3.0 Turbo `options` table shape** — the two 3.0-turbo docs list `options.watermark_info.enabled` as a table row and describe `contents[].text`/`contents[].url` as table rows; the other 12 docs push those into notes. Cosmetic, but a schema generator reading tables will see different field sets.
