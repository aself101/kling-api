# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

2.0.0 is in specification — see `docs/specs/kling-api-2.0-migration-spec-v0_4_3.md`. The vendor
discontinued every model 1.x defaults to, moved video generation to a new API standard, and made a
static API Key the only credential for it; 1.x cannot generate video against the current API.

### Added
- *(2.0.0, pending)* Kling 3.0 / 3.0 Turbo / 3.0 Omni / O1 / 2.6 / 2.5 Turbo video via the new API standard; motion control; elements and voices; TTS; normalized `Task`/`TaskHandle`; webhook signature verification.
- *(2.0.0, pending)* `client.video.imageToVideo()` → `POST /image-to-video/<model>` with `contents[]` (prompt, first_frame, last_frame, element*, voice*, `extraContents`); `firstFrame`/`lastFrame` are `MediaSource`s — an https URL, a Base64 string (optional `data:` prefix), `{ url }` or `{ base64 }` on this build; `{ path }`/`Buffer` arrive with Phase 2c. **A bare string is never read as a filesystem path.** Inline caps 20 MB (new standard) / 10 MB (legacy), 40 MB encoded per request; a create's deadline grows 4 s per MB of body. `@name` prompt references with no matching content `id` log a warning.
- *(2.0.0, pending)* `client.video.textToVideo()` → `POST /text-to-video/<model>` on the new standard, default `kling-3.0-turbo`; `VIDEO_MODELS` capability registry for the six current video ids with `[shape]`/`[capability]` validation, `unknownModels: 'passthrough' | 'reject'`, `capabilityValidation: 'error' | 'warn'`, and `extraSettings`/`extraOptions` escape hatches (a modeled key in either is rejected). Live-verified 2026-09-20: a 3 s / 720p create cost 2.4 video units and the mp4 carries an AAC audio track with no `audio` field sent — native audio is always on for 3.0-turbo; the vendor **rejects a duplicate `external_task_id`** (`1201` "already exists"), so it doubles as an idempotency key.
- *(2.0.0, pending)* `client.tasks` — `get(ids, { byExternalId })` (unified `GET /tasks`, chunked at **20** ids per request: the live API rejects 21 with `1201`, a cap the vendor docs do not state), `list()` (`POST /tasks` cursor), `getByProduct`, `listByProduct`, `recover(product, externalId)`, `handle()`; `TaskHandle.wait()` shares one poll loop across concurrent callers with per-caller deadline and abort; `client.healthCheck()`; `KlingTaskNotFoundError` (a lookup the vendor answers with `data: []` or a not-found `1201`).
- *(2.0.0, pending)* Codec parse policy: an unknown top-level task status or a wrong-standard envelope throws `KlingCodecError` (never reads as `processing`); a malformed *output* entry is dropped with a logger warning, never a throw; timestamps below 1e11 are read as seconds and scaled with a warning; `Task.outputsExpireAt = updatedAt + 30 d` is derived on `succeeded` tasks from the vendor's stated retention.

### Changed
- *(2.0.0, pending)* `TaskStatus` value `succeed` → `succeeded` (same type, different value — a semantics-without-signature change); every default model; a bare-string media argument is a URL or Base64, never a filesystem path.
- *(2.0.0, pending)* `engines.node` `>=18` → `>=20` (native `fetch`; CI matrix is 20 and 22). Package entry points `dist/api.js` → `dist/index.js`; `bin.kling` → `dist/cli/index.js`.

### Removed
- *(2.0.0, pending)* AccessKey/SecretKey JWT authentication; `extendVideo`; `multiImageToVideo`; the `./api`, `./auth`, `./utils`, `./config`, `./types` subpath exports (only `.` and `./package.json` remain); the `axios` and `jsonwebtoken` runtime dependencies; semantic-release automation.

## [1.0.0] - 2025-12-27


### Fixed

* **api:** correct image expansion and avatar endpoints ([72e54e2](https://github.com/aself101/kling-api/commit/72e54e22dbbff0b26bc02517c955f42cf109719f))


### Added

* **kling-api:** add CLI, modular architecture, and comprehensive tests ([bf197c8](https://github.com/aself101/kling-api/commit/bf197c8a3490adab34f77497a6990ecd9e8a0255))
* **kling-api:** initial release v0.1.0 ([a8237cd](https://github.com/aself101/kling-api/commit/a8237cdee1fd307e72117aecac8abca8cd2d3ff4))

## [0.1.0] - 2025-12-25

### Added
- Initial release of kling-api wrapper
- Text-to-video generation with 6 model variants (kling-v1, kling-v1-6, kling-v2-master, kling-v2-1-master, kling-v2-5-turbo, kling-v2-6)
- Image-to-video animation with 8 model variants
- Image generation with 5 model variants (kling-v1, kling-v1-5, kling-v2, kling-v2-new, kling-v2-1)
- Image expansion (outpainting) with directional control
- Avatar/talking head creation with audio support
- JWT authentication with automatic token management and 5-minute buffer
- Camera control support (presets and fine-grained 6-axis configuration)
- Comprehensive TypeScript type definitions (118+ exported types)
- 534 tests with 95.29% statement coverage
- Production security features:
  - API key redaction in logs
  - SSRF protection with IPv4-mapped IPv6 bypass prevention
  - HTTPS enforcement
  - Error sanitization in production mode
  - Parameter validation before API calls
- Auto-polling with animated spinner UI
- Retry logic with exponential backoff (2s, 4s, 8s)
- Organized data storage with timestamped files and metadata JSON
- Submodule exports for tree-shaking optimization
