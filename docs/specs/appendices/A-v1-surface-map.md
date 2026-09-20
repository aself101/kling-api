# kling-api Surface Map

Package root: `/Users/aself/uluops/misc/npm-packages/kling-api`
Scope: `src/`, `test/`, `README.md`, `docs/KLING_API_REFERENCE.md`, `package.json`. `docs/api/` explicitly excluded (vendor docs).

All line numbers verified 2026-09-20 by direct file reads (`Read`) and `grep -n`. Where a search claims exhaustiveness ("every X"), the exact command is shown so it can be re-run.

---

## 0. package.json surface (exports map)

`package.json:11-36`:

| Subpath export | `import` target | `types` target | Source file |
|---|---|---|---|
| `.` | `./dist/api.js` | `./dist/api.d.ts` | `src/api.ts` |
| `./api` | `./dist/api.js` | `./dist/api.d.ts` | `src/api.ts` |
| `./auth` | `./dist/auth.js` | `./dist/auth.d.ts` | `src/auth.ts` |
| `./utils` | `./dist/utils.js` | `./dist/utils.d.ts` | `src/utils/index.ts` (barrel; note `dist/utils.js` implies a top-level `src/utils.ts` re-export or tsc flattening — see caveat below) |
| `./config` | `./dist/config/index.js` | `./dist/config/index.d.ts` | `src/config/index.ts` |
| `./types` | `./dist/types.js` | `./dist/types.d.ts` | `src/types.ts` |

Other package.json facts:
- `package.json:2` name `kling-api`, `package.json:3` version `1.0.0`, `package.json:7` `"type": "module"`.
- `package.json:8-10` bin: `kling` → `./dist/cli.js` (built from `src/cli.ts`).
- `package.json:87-93` runtime deps: `axios ^1.6.2`, `commander ^11.1.0`, `dotenv ^16.3.1`, `jsonwebtoken ^9.0.2`, `ora ^8.0.1`.
- **CAVEAT `[VERIFY]`**: `./utils` export resolves to `./dist/utils.js` (singular file), but the source barrel lives at `src/utils/index.ts` (a directory). This only works if `tsc` emits `dist/utils.js` from a `src/utils.ts`-shaped entry or if there's a build step not inspected here (not in scope per task: docs/README/package.json/src/test only — no `tsconfig.json` path-mapping or build-output was inspected). Flagged because migration work touching `./utils` exports should confirm the dist emission shape before assuming `src/utils/index.ts` is the only relevant file.

---

## 1. PUBLIC API SURFACE

### 1.1 `src/api.ts` exports

| Export | Kind | Line |
|---|---|---|
| `KlingAPIError` (re-export from `./errors.js`) | class | `src/api.ts:37` |
| `KlingAPI` | class | `src/api.ts:62` |
| `default` (= `KlingAPI`) | default export | `src/api.ts:481` |

`KlingAPI` public methods (all instance methods; constructor at `src/api.ts:77`, `constructor(config: KlingConfig = {})`):

| Method | Line | Params | Return |
|---|---|---|---|
| `get client()` | `src/api.ts:67-69` | none | `import('axios').AxiosInstance` |
| `getAccountInfo` | `src/api.ts:93` | `(startTime: number, endTime: number, resourcePackName?: string)` | `Promise<AccountInfoResponse>` |
| `textToVideo` | `src/api.ts:120` | `(params: TextToVideoParams)` | `Promise<TaskResponse>` |
| `queryTextToVideoTask` | `src/api.ts:130` | `(taskId: string)` | `Promise<VideoTaskResult>` |
| `imageToVideo` | `src/api.ts:144` | `(params: ImageToVideoParams)` | `Promise<TaskResponse>` |
| `queryImageToVideoTask` | `src/api.ts:154` | `(taskId: string)` | `Promise<VideoTaskResult>` |
| `generateImage` | `src/api.ts:168` | `(params: ImageGenParams)` | `Promise<TaskResponse>` |
| `queryImageGenTask` | `src/api.ts:178` | `(taskId: string)` | `Promise<ImageTaskResult>` |
| `expandImage` | `src/api.ts:192` | `(params: ImageExpandParams)` | `Promise<TaskResponse>` |
| `queryImageExpandTask` | `src/api.ts:202` | `(taskId: string)` | `Promise<ImageTaskResult>` |
| `createAvatar` | `src/api.ts:216` | `(params: AvatarParams)` | `Promise<TaskResponse>` |
| `queryAvatarTask` | `src/api.ts:226` | `(taskId: string)` | `Promise<VideoTaskResult>` |
| `extendVideo` | `src/api.ts:244` | `(params: ExtendVideoParams)` | `Promise<TaskResponse>` |
| `queryExtendVideoTask` | `src/api.ts:254` | `(taskId: string)` | `Promise<VideoTaskResult>` |
| `multiImageToVideo` | `src/api.ts:272` | `(params: MultiImageToVideoParams)` | `Promise<TaskResponse>` |
| `queryMultiImageToVideoTask` | `src/api.ts:282` | `(taskId: string)` | `Promise<VideoTaskResult>` |
| `omniVideo` | `src/api.ts:302` | `(params: OmniVideoParams)` | `Promise<TaskResponse>` |
| `queryOmniVideoTask` | `src/api.ts:312` | `(taskId: string)` | `Promise<VideoTaskResult>` |
| `omniImage` | `src/api.ts:330` | `(params: OmniImageParams)` | `Promise<TaskResponse>` |
| `queryOmniImageTask` | `src/api.ts:340` | `(taskId: string)` | `Promise<ImageTaskResult>` |
| `multiImageToImage` | `src/api.ts:358` | `(params: MultiImageToImageParams)` | `Promise<TaskResponse>` |
| `queryMultiImageToImageTask` | `src/api.ts:368` | `(taskId: string)` | `Promise<ImageTaskResult>` |
| `waitForVideoResult` | `src/api.ts:384` | `(taskId: string, queryFn = this.queryTextToVideoTask.bind(this), options: PollOptions = {})` | `Promise<VideoTaskResult>` |
| `waitForImageResult` | `src/api.ts:400` | `(taskId: string, queryFn = this.queryImageGenTask.bind(this), options: PollOptions = {})` | `Promise<ImageTaskResult>` |
| `saveVideoResult` | `src/api.ts:420` | `(result: VideoTaskResult, outputDir: string, prompt?: string)` | `Promise<string[]>` |
| `saveImageResult` | `src/api.ts:436` | `(result: ImageTaskResult, outputDir: string, prompt?: string)` | `Promise<string[]>` |
| `healthCheck` | `src/api.ts:453` | none | `Promise<boolean>` |
| `getToken` | `src/api.ts:469` | none | `string` |
| `refreshToken` | `src/api.ts:476` | none | `void` |

Every `KlingAPI` method delegates to a standalone function in `operations/*`, `handlers/*`, or `httpClient` directly — `KlingAPI` itself has no HTTP or business logic beyond `getAccountInfo` and `healthCheck` (`src/api.ts:93-108`, `453-462`).

### 1.2 `src/types.ts` exports (exhaustive — `grep -n "^export" src/types.ts`)

| Export | Line |
|---|---|
| `type VideoMode` | `src/types.ts:11` |
| `type VideoDuration` | `src/types.ts:14` |
| `type VideoAspectRatio` | `src/types.ts:17` |
| `type ImageAspectRatio` | `src/types.ts:20` |
| `type ImageResolution` | `src/types.ts:23` |
| `type ImageReferenceType` | `src/types.ts:26` |
| `type SoundOption` | `src/types.ts:29` |
| `type CameraType` | `src/types.ts:32-37` |
| `type TaskStatus` | `src/types.ts:40` |
| `type TextToVideoModel` | `src/types.ts:43-49` |
| `type ImageToVideoModel` | `src/types.ts:52-60` |
| `type ImageGenModel` | `src/types.ts:63` |
| `type OmniVideoModel` | `src/types.ts:66` |
| `type OmniImageModel` | `src/types.ts:69` |
| `interface CameraConfig` | `src/types.ts:76-91` |
| `interface CameraControl` | `src/types.ts:94-99` |
| `interface VoiceReference` | `src/types.ts:106-109` |
| `interface TextToVideoParams` | `src/types.ts:116-139` |
| `interface DynamicMask` | `src/types.ts:146-151` |
| `interface ImageToVideoParams` | `src/types.ts:154-185` |
| `interface ExtendVideoParams` | `src/types.ts:197-208` |
| `interface MultiImageVideoItem` | `src/types.ts:215-218` |
| `interface MultiImageToVideoParams` | `src/types.ts:226-245` |
| `interface ImageGenParams` | `src/types.ts:252-277` |
| `interface ImageExpandParams` | `src/types.ts:284-299` |
| `interface AvatarParams` | `src/types.ts:306-321` |
| `interface OmniVideoImageItem` | `src/types.ts:328-333` |
| `interface OmniImageListItem` | `src/types.ts:336-339` |
| `interface OmniVideoListItem` | `src/types.ts:342-345` |
| `interface OmniElementListItem` | `src/types.ts:348-351` |
| `type OmniImageAspectRatio` | `src/types.ts:354` |
| `interface OmniVideoParams` | `src/types.ts:363-382` |
| `interface OmniImageParams` | `src/types.ts:390-409` |
| `type MultiImageToImageModel` | `src/types.ts:416` |
| `interface SubjectImageItem` | `src/types.ts:419-422` |
| `interface MultiImageToImageParams` | `src/types.ts:430-449` |
| `interface TaskResponse` | `src/types.ts:456-478` |
| `interface VideoResult` | `src/types.ts:481-488` |
| `interface ImageResult` | `src/types.ts:491-496` |
| `interface VideoTaskResult` | `src/types.ts:499-527` |
| `interface ImageTaskResult` | `src/types.ts:530-558` |
| `type ResourcePackStatus` | `src/types.ts:565` |
| `type ResourcePackType` | `src/types.ts:568` |
| `interface ResourcePack` | `src/types.ts:571-590` |
| `interface AccountInfoResponse` | `src/types.ts:593-609` |
| `interface ErrorResponse` | `src/types.ts:616-623` |
| `ERROR_CODES` (re-export from `./config/constants.js`) | `src/types.ts:626` |
| `interface PollOptions` | `src/types.ts:633-642` |
| `interface KlingConfig` | `src/types.ts:649-660` |

`KlingConfig` fields (`src/types.ts:649-660`): `accessKey?`, `secretKey?`, `baseUrl?` (default `https://api-singapore.klingai.com`), `timeout?`, `debug?`. **No API-key/bearer-token field exists today** — relevant to the JWT→static-key migration (see §4).

### 1.3 `src/config/index.ts` exports (barrel — `src/config/index.ts:9-52`)

| Export | From | Line(s) |
|---|---|---|
| `BASE_URL, DEFAULT_TIMEOUT, DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT, MAX_PROMPT_LENGTH, MAX_IMAGE_SIZE, MAX_AUDIO_SIZE, MIN_IMAGE_DIMENSION, MIN_AUDIO_DURATION, MAX_AUDIO_DURATION, VALID_VIDEO_ASPECT_RATIOS, VALID_IMAGE_ASPECT_RATIOS, VALID_VIDEO_MODES, VALID_VIDEO_DURATIONS, VALID_IMAGE_RESOLUTIONS, VALID_CAMERA_TYPES, SUPPORTED_IMAGE_FORMATS, SUPPORTED_AUDIO_FORMATS, ERROR_CODES, VALID_OMNI_IMAGE_ASPECT_RATIOS, VALID_MULTI_IMAGE_TO_IMAGE_MODELS` | `./constants.js` | `src/config/index.ts:9-31` |
| `TEXT_TO_VIDEO_MODELS, IMAGE_TO_VIDEO_MODELS, IMAGE_GEN_MODELS` | `./models.js` | `src/config/index.ts:34` |
| `loadCredentials, loadConfig` | `./loaders.js` | `src/config/index.ts:37` |
| `ValidationError, validateTextToVideoParams, validateImageToVideoParams, validateImageGenParams, validateImageExpandParams, validateAvatarParams, validateExtendVideoParams, validateMultiImageToVideoParams, validateOmniVideoParams, validateOmniImageParams, validateMultiImageToImageParams` | `./validators/index.js` | `src/config/index.ts:40-52` |

Note: `validateRange`, `validateEnumValue`, `validatePromptLength`, `validateRequired`, `validateModel` (helpers, `src/config/validators/helpers.ts:38-96`) are exported from `src/config/validators/index.ts:9-17` but are **not** re-exported from `src/config/index.ts` — they are not part of the `./config` public subpath surface, only reachable via a deep import of `src/config/validators/index.ts` (not itself a package.json export target).

### 1.4 `src/utils/index.ts` exports (barrel — `src/utils/index.ts:9-51`)

| Export | From | Line(s) |
|---|---|---|
| `BACKOFF_BASE_MS, MAX_VIDEO_SIZE, VIDEO_DOWNLOAD_TIMEOUT, MEDIA_DOWNLOAD_TIMEOUT, MAX_REDIRECTS` | `./constants.js` | `src/utils/index.ts:9-15` |
| `logger` (value), `LoggerFunction, Logger` (types) | `./logger.js` | `src/utils/index.ts:18-19` |
| `validateUrl, redactKey, sanitizeError, isProduction` | `./security.js` | `src/utils/index.ts:22` |
| `ensureDirectory, generateFilename, sanitizePromptForFilename, saveFile, saveMetadata` | `./file-io.js` | `src/utils/index.ts:25-31` |
| `isHttpUrl, processMediaSource, imageToBase64, validateImageBuffer, validateImageExtension, audioToBase64, validateAudioExtension, copyOptionalParams` (values), `MediaConverter` (type) | `./media.js` | `src/utils/index.ts:34-44` |
| `downloadVideo, downloadImage` | `./downloads.js` | `src/utils/index.ts:47` |
| `pollWithSpinner, sleep, formatDuration` (values), `PollOptions` (type) | `./polling.js` | `src/utils/index.ts:50-51` |

Note: `PRIVATE_IP_PATTERNS`, `BLOCKED_HOSTS` are exported from `src/utils/constants.ts:31,44` but **not** re-exported by the `src/utils/index.ts` barrel — internal-only.

### 1.5 `src/auth.ts` exports

| Export | Kind | Line |
|---|---|---|
| `KlingAuth` | class | `src/auth.ts:39` |
| `decodeToken` | function `(token: string) => KlingJwtPayload \| null` | `src/auth.ts:234` |
| `isTokenExpired` | function `(token: string) => boolean` | `src/auth.ts:249` |
| `default` (= `KlingAuth`) | default export | `src/auth.ts:259` |

`KlingAuth` public methods: `constructor(accessKey: string, secretKey: string)` (`src/auth.ts:61`), `generateToken(): string` (`src/auth.ts:83`), `isTokenValid(): boolean` (`src/auth.ts:118`), `getValidToken(): string` (`src/auth.ts:137`), `refreshToken(): string` (`src/auth.ts:152`), `getAuthorizationHeader(): string` (`src/auth.ts:161`), `clearCache(): void` (`src/auth.ts:170`), `getTimeUntilExpiry(): number` (`src/auth.ts:180`), `getRedactedAccessKey(): string` (`src/auth.ts:198`), `validateCredentials(): boolean` (`src/auth.ts:213`).

`KlingJwtPayload` (`src/auth.ts:11-18`, not exported) — `{ iss: string; exp: number; nbf: number }`. `KlingJwtHeader` (`src/auth.ts:21-24`, not exported) — `{ alg: 'HS256'; typ: 'JWT' }`.

### 1.6 `src/errors.ts` exports

| Export | Kind | Line |
|---|---|---|
| `KlingAPIError` | class extends `Error` | `src/errors.ts:15` |

Constructor: `(message: string, public code: number, public requestId?: string, public httpStatus?: number)` (`src/errors.ts:16-21`). Method: `isRetryable(): boolean` (`src/errors.ts:31-38`) — true iff `code === ERROR_CODES.SERVICE_UNAVAILABLE` or `httpStatus` is `502`/`503`/`504`.

---

## 2. ENDPOINTS

Search used: `grep -rn "'/v1\|\`/v1\|'/account" src/` and `grep -rn "client.request" src/operations src/api.ts`.

| Endpoint (method + path) | Called from (function:file:line) | Request body construction | Response fields the code depends on |
|---|---|---|---|
| `POST /v1/videos/text2video` | `videoOps.textToVideo` — `src/operations/video.ts:60` | Flat top-level object: `{ model_name, prompt, ...copyOptionalParams }` built at `src/operations/video.ts:43-58`; default `model_name ?? 'kling-v1'` (`:44`) | `TaskResponse.data.task_id`/`data.task_status` (via caller, e.g. `src/cli.ts:487`) |
| `GET /v1/videos/text2video/{taskId}` | `videoOps.queryTextToVideoTask` — `src/operations/video.ts:74` | path param only | `VideoTaskResult.data.task_status`, `.data.task_status_msg`, `.data.task_result.videos[]` (consumed in `src/handlers/result-poller.ts:31,40,42` and `src/handlers/file-saver.ts:31,38,45-51`) |
| `POST /v1/videos/image2video` | `videoOps.imageToVideo` — `src/operations/video.ts:126` | Flat: `{ model_name ?? 'kling-v1', image, image_tail?, ...copyOptionalParams }` (`src/operations/video.ts:102-124`); `image`/`image_tail` pre-processed via `processMediaSource`+`imageToBase64` (`:95-100`) | same as above |
| `GET /v1/videos/image2video/{taskId}` | `videoOps.queryImageToVideoTask` — `src/operations/video.ts:140` | path param | same |
| `POST /v1/videos/video-extend` | `videoOps.extendVideo` — `src/operations/video.ts:170` | Flat: `{ video_id, ...copyOptionalParams(['prompt','negative_prompt','cfg_scale','callback_url']) }` (`src/operations/video.ts:164-168`) | same |
| `GET /v1/videos/video-extend/{taskId}` | `videoOps.queryExtendVideoTask` — `src/operations/video.ts:184` | path param | same |
| `POST /v1/videos/multi-image2video` | `videoOps.multiImageToVideo` — `src/operations/video.ts:230` | Flat: `{ model_name ?? 'kling-v1-6', image_list: [{image}], prompt, ...copyOptionalParams }` (`src/operations/video.ts:209-228`); each `image` base64-processed in parallel (`:209-213`) | same |
| `GET /v1/videos/multi-image2video/{taskId}` | `videoOps.queryMultiImageToVideoTask` — `src/operations/video.ts:244` | path param | same |
| `POST /v1/videos/omni-video` | `videoOps.omniVideo` — `src/operations/video.ts:301` | Flat: `{ model_name ?? 'kling-video-o1', prompt, image_list?, video_list?, element_list?, ...copyOptionalParams }` (`src/operations/video.ts:270-299`) | same |
| `GET /v1/videos/omni-video/{taskId}` | `videoOps.queryOmniVideoTask` — `src/operations/video.ts:315` | path param | same |
| `POST /v1/images/generations` | `imageOps.generateImage` — `src/operations/image.ts:63` | Flat: `{ model_name ?? 'kling-v1', prompt, image?, ...copyOptionalParams }` (`src/operations/image.ts:41-61`) | `ImageTaskResult.data.task_status`, `.data.task_result.images[]` (`src/handlers/file-saver.ts:73,80-96`) |
| `GET /v1/images/generations/{taskId}` | `imageOps.queryImageGenTask` — `src/operations/image.ts:77` | path param | same |
| `POST /v1/images/editing/expand` | `imageOps.expandImage` — `src/operations/image.ts:107` | Flat: `{ image, up_expansion_ratio, down_expansion_ratio, left_expansion_ratio, right_expansion_ratio, ...copyOptionalParams }` (`src/operations/image.ts:97-105`) | same |
| `GET /v1/images/editing/expand/{taskId}` | `imageOps.queryImageExpandTask` — `src/operations/image.ts:121` | path param | same |
| `POST /v1/images/omni-image` | `imageOps.omniImage` — `src/operations/image.ts:173` | Flat: `{ model_name ?? 'kling-image-o1', prompt, image_list?, element_list?, ...copyOptionalParams }` (`src/operations/image.ts:145-171`) | same |
| `GET /v1/images/omni-image/{taskId}` | `imageOps.queryOmniImageTask` — `src/operations/image.ts:187` | path param | same |
| `POST /v1/images/multi-image2image` | `imageOps.multiImageToImage` — `src/operations/image.ts:241` | Flat: `{ model_name ?? 'kling-v2', subject_image_list: [{subject_image}], scene_image?, style_image?, ...copyOptionalParams }` (`src/operations/image.ts:218-239`) | same |
| `GET /v1/images/multi-image2image/{taskId}` | `imageOps.queryMultiImageToImageTask` — `src/operations/image.ts:255` | path param | same |
| `POST /v1/videos/avatar/image2video` | `avatarOps.createAvatar` — `src/operations/avatar.ts:43` | Flat: `{ image, audio_id? \| sound_file?, ...copyOptionalParams(['prompt','mode','callback_url','external_task_id']) }` (`src/operations/avatar.ts:30-41`) | `VideoTaskResult` same as video ops |
| `GET /v1/videos/avatar/image2video/{taskId}` | `avatarOps.queryAvatarTask` — `src/operations/avatar.ts:57` | path param | same |
| `GET /account/costs` | `KlingAPI.getAccountInfo` — `src/api.ts:107` (calls `httpClient.request` directly, bypassing `operations/`) | Query params `{ start_time, end_time, resource_pack_name? }` (`src/api.ts:98-106`) | `AccountInfoResponse.data.resource_pack_subscribe_infos[]` (consumed in `src/cli.ts:1697,1713-1719,1732-1739,1812,1822-1838,1859-1884`) |

Every one of the above is **flat top-level body** (no nested `settings`/`options` object anywhere in `src/`) — confirmed by `grep -rn "payload = {" src/operations` and manual read of all 4 operations files. None uses a `settings:`/`options:` nesting key (`grep -rn "settings:\|options:" src/operations src/api.ts` → no matches).

**All 18 task-creating/querying endpoints are under `/v1/...` except `/account/costs`.** This means the vendor's stated migration (unified `GET /tasks?task_ids=`, path-per-model `POST /text-to-video/{model}`) requires touching **every** function in `src/operations/video.ts`, `src/operations/image.ts`, `src/operations/avatar.ts`, plus `src/api.ts:107` if `/account/costs` also moves off `/v1` (not stated in the task, but worth flagging as `[VERIFY]` against current vendor docs).

### 2.1 Response property-path dependencies (exact strings the code reads)

Search: `grep -rn "\.task_id\b\|\.task_status\b\|task_result\.\|\.videos\b\|\.images\b" src/handlers src/operations src/api.ts src/cli.ts`.

| Property path | Where read |
|---|---|
| `response.data.task_id` (creation response) | `src/cli.ts:487,589,674,772,886,1003,1098,1203,1308,1541`; `src/handlers/file-saver.ts:46,90` |
| `result.data.task_status` | `src/handlers/result-poller.ts:31,40`; `src/cli.ts:495,597,682,783,894,1011,1106,1211,1319,1549` |
| `result.data.task_status_msg` | `src/handlers/result-poller.ts:42`; `src/cli.ts:509,612,697,797,908,1026,1122,1226,1335,1559` |
| `result.data.task_result.videos` / `.videos.length` / `.videos[i].url` / `.videos[i].id` / `.videos[i].duration` | `src/handlers/file-saver.ts:31,38,42,47-49`; `src/cli.ts:332,352` |
| `result.data.task_result.images` / `.images.length` / `.images[i].url` / `.images[i].index` | `src/handlers/file-saver.ts:73,80-92`; `src/cli.ts:384,1012,1212,1320` |
| `result.data.created_at` | `src/handlers/file-saver.ts:50,93` |
| `response.data.resource_pack_subscribe_infos` | `src/cli.ts:1697,1812` |

`handlers/result-poller.ts` — `waitForTaskResult` (`src/handlers/result-poller.ts:22-49`) is the single choke point: it polls via `pollWithSpinner` (`src/utils/polling.ts:37`) checking `result.data.task_status === 'succeed' || result.data.task_status === 'failed'` (`:31`), then throws `KlingAPIError` if `'failed'` (`:40-45`). **Every** `waitFor*Result` call (video and image) funnels through this one function — a single edit point for the `succeed`→`succeeded` rename, but `data.task_status` (not `data.status`) is the field name baked into the check, and `data.task_id` (not `data.id`) is baked into 12+ call sites in `cli.ts` and 2 in `file-saver.ts`.

`handlers/file-saver.ts` — `saveVideoResult` (`src/handlers/file-saver.ts:26-58`) requires `result.data.task_result?.videos?.length` (`:31`) or throws; `saveImageResult` (`:68-101`) requires `result.data.task_result?.images?.length` (`:73`) or throws. Both read `result.data.task_id` for metadata (`:46,90`).

`utils/polling.ts` — `pollWithSpinner<T>` (`src/utils/polling.ts:37-89`) is generic/agnostic to field names; it takes a caller-supplied `isComplete` predicate (the `task_status === 'succeed'`/`'failed'` check lives in the *caller*, `result-poller.ts:31`, not in `polling.ts` itself).

---

## 3. MODEL REGISTRY

Search used: `grep -rn "'kling-[a-z0-9.-]*'" src/` (full output below, tabulated by literal).

| Model literal | Every file:line |
|---|---|
| `kling-v1` | `src/api.ts:54` (doc comment, actually `kling-v2-master` — see note*), `src/cli.ts:2078,2079,2114,2232`, `src/config/models.ts:23,58,128`, `src/config/validators/image.ts:53`, `src/config/validators/video.ts:121,122,168,169`, `src/operations/image.ts:42`, `src/operations/video.ts:44,103`, `src/types.ts:44,53,63` |
| `kling-v1-5` | `src/config/models.ts:65,129`, `src/types.ts:54,63` |
| `kling-v1-6` | `src/cli.ts:2078,2160`, `src/config/models.ts:24,72`, `src/config/validators/video.ts:281`, `src/operations/video.ts:216`, `src/types.ts:45,55,228` |
| `kling-v2` | `src/cli.ts:2320`, `src/config/constants.ts:142`, `src/config/models.ts:130`, `src/operations/image.ts:219`, `src/types.ts:63,416` |
| `kling-v2-1` | `src/config/constants.ts:142`, `src/config/models.ts:86,132`, `src/types.ts:57,63,416` |
| `kling-v2-1-master` | `src/cli.ts:2078`, `src/config/models.ts:30,93`, `src/types.ts:47,58` |
| `kling-v2-5-turbo` | `src/cli.ts:2078`, `src/config/models.ts:35,100`, `src/types.ts:48,59` |
| `kling-v2-6` | `src/cli.ts:2078`, `src/config/models.ts:40,107`, `src/types.ts:49,60` |
| `kling-v2-master` | `src/api.ts:54` (doc example), `src/cli.ts:2078`, `src/config/models.ts:25,79`, `src/types.ts:46,56` |
| `kling-v2-new` | `src/config/models.ts:131`, `src/types.ts:63` |
| `kling-video-o1` | `src/cli.ts:2189`, `src/config/validators/video.ts:311`, `src/operations/video.ts:271`, `src/types.ts:66` |
| `kling-image-o1` | `src/cli.ts:2291`, `src/config/validators/image.ts:160`, `src/operations/image.ts:146`, `src/types.ts:69` |

\* `src/api.ts:54` is a JSDoc `@example` block showing `model_name: 'kling-v2-master'`, not the default; the runtime default for `textToVideo` is `'kling-v1'` (`src/operations/video.ts:44`).

### 3.1 Capability tables (`src/config/models.ts`)

| Table | Line range | Keys (models) |
|---|---|---|
| `TEXT_TO_VIDEO_MODELS: Record<TextToVideoModel, {supportsCfgScale, supportsSound, supportsCameraControl}>` | `src/config/models.ts:15-41` | `kling-v1`(23), `kling-v1-6`(24), `kling-v2-master`(25-29), `kling-v2-1-master`(30-34), `kling-v2-5-turbo`(35-39), `kling-v2-6`(40) |
| `IMAGE_TO_VIDEO_MODELS: Record<ImageToVideoModel, {supportsCfgScale, supportsImageTail, supportsVoiceList, supportsDynamicMasks, supportsCameraControl}>` | `src/config/models.ts:48-114` | `kling-v1`(58-64), `kling-v1-5`(65-71), `kling-v1-6`(72-78), `kling-v2-master`(79-85), `kling-v2-1`(86-92), `kling-v2-1-master`(93-99), `kling-v2-5-turbo`(100-106), `kling-v2-6`(107-113) |
| `IMAGE_GEN_MODELS: Record<ImageGenModel, {supportsImageReference, maxN}>` | `src/config/models.ts:121-133` | `kling-v1`(128), `kling-v1-5`(129), `kling-v2`(130), `kling-v2-new`(131), `kling-v2-1`(132) |

### 3.2 Defaults via `??` (model_name fallback)

| File:line | Fallback |
|---|---|
| `src/operations/video.ts:44` | `textToVideo`: `params.model_name ?? 'kling-v1'` |
| `src/operations/video.ts:103` | `imageToVideo`: `params.model_name ?? 'kling-v1'` |
| `src/operations/video.ts:216` | `multiImageToVideo`: `params.model_name ?? 'kling-v1-6'` |
| `src/operations/video.ts:271` | `omniVideo`: `params.model_name ?? 'kling-video-o1'` |
| `src/operations/image.ts:42` | `generateImage`: `params.model_name ?? 'kling-v1'` |
| `src/operations/image.ts:146` | `omniImage`: `params.model_name ?? 'kling-image-o1'` |
| `src/operations/image.ts:219` | `multiImageToImage`: `params.model_name ?? 'kling-v2'` |
| `src/config/validators/video.ts:121-122` | `validateTextToVideoParams`: `validateModel(params.model_name, 'kling-v1', TEXT_TO_VIDEO_MODELS)`; local `const model = params.model_name ?? 'kling-v1'` |
| `src/config/validators/video.ts:168-169` | `validateImageToVideoParams`: same pattern, default `'kling-v1'` |
| `src/config/validators/image.ts:53` | `validateImageGenParams`: `validateModel(params.model_name, 'kling-v1', IMAGE_GEN_MODELS)` |

`validateModel` (`src/config/validators/helpers.ts:83-96`) throws `ValidationError('model_name', ...)` if the resolved model string is not a key in the passed registry — this is the enforcement point that will reject any new path-per-model name until the registries in `config/models.ts` and the unions in `types.ts` are updated.

### 3.3 Hard-coded single-model checks (not registry-driven)

| File:line | Check |
|---|---|
| `src/config/validators/video.ts:281` | `multiImageToVideo`: `if (params.model_name && params.model_name !== 'kling-v1-6') throw ...` — only one model ever allowed |
| `src/config/validators/video.ts:311` | `omniVideo`: `if (params.model_name && params.model_name !== 'kling-video-o1') throw ...` |
| `src/config/validators/image.ts:160` | `omniImage`: `if (params.model_name && params.model_name !== 'kling-image-o1') throw ...` |

### 3.4 Constants / literal-array registries

| Constant | Line | Values |
|---|---|---|
| `VALID_MULTI_IMAGE_TO_IMAGE_MODELS` | `src/config/constants.ts:142` | `['kling-v2', 'kling-v2-1'] as const` |
| `MultiImageToImageModel` (type) | `src/types.ts:416` | `'kling-v2' \| 'kling-v2-1'` |

Used by `validateMultiImageToImageParams` (`src/config/validators/image.ts:230-232`) via `validateEnumValue('model_name', params.model_name, [...VALID_MULTI_IMAGE_TO_IMAGE_MODELS])`, and by CLI option help/default (`src/cli.ts:2319-2320`).

### 3.5 CLI option defaults / help text with model literals

| File:line | Command | Default | Help text literal list |
|---|---|---|---|
| `src/cli.ts:2077-2080` | `video text2video -m/--model` | `'kling-v1'` | `kling-v1, kling-v1-6, kling-v2-master, kling-v2-1-master, kling-v2-5-turbo, kling-v2-6` (built from an inline object literal at `:2078`, independent of `TEXT_TO_VIDEO_MODELS`) |
| `src/cli.ts:2114` | `video image2video -m/--model` | `'kling-v1'` | plain string `'Model name'`, no enumerated list |
| `src/cli.ts:2160` | `video multi-image -m/--model` | `'kling-v1-6'` | plain string |
| `src/cli.ts:2189` | `video omni -m/--model` | `'kling-video-o1'` | plain string |
| `src/cli.ts:2229-2233` | `image generate -m/--model` | `'kling-v1'` | hard-coded string `` `Model: kling-v1, kling-v1-5, kling-v2, kling-v2-new, kling-v2-1` `` |
| `src/cli.ts:2291` | `image omni -m/--model` | `'kling-image-o1'` | plain string |
| `src/cli.ts:2317-2321` | `image multi -m/--model` | `'kling-v2'` | `` `Model: ${[...VALID_MULTI_IMAGE_TO_IMAGE_MODELS].join(', ')}` `` (only one that's registry-driven) |

**Note:** `src/cli.ts:14-16` (top-of-file JSDoc usage comment) also hard-codes the full model lists in a comment — will go stale independent of code changes.

---

## 4. AUTH

### 4.1 `src/auth.ts` — JWT generation (`KlingAuth`)

- Constructor requires non-empty `accessKey`/`secretKey` strings (`src/auth.ts:61-71`) — throws plain `Error`, not `KlingAPIError`.
- `generateToken()` (`src/auth.ts:83-107`): builds header `{ alg: 'HS256', typ: 'JWT' }` and payload `{ iss: accessKey, exp: now+1800, nbf: now-5 }`, signs with `jwt.sign(payload, this.secretKey, { algorithm: 'HS256', header })` (`:97-100`), caches token + expiry (`:103-104`).
- `getValidToken()` (`:137-143`) returns cached token if `isTokenValid()` (`:118-127`, buffer = 300s) else regenerates.
- `getAuthorizationHeader()` (`:161-163`) returns literal string `` `Bearer ${this.getValidToken()}` ``.
- `getRedactedAccessKey()` (`:198-203`) — last-4-chars redaction for logging.

### 4.2 `src/client/http-client.ts` — how the header actually gets attached

- Constructor (`src/client/http-client.ts:35-80`) calls `loadCredentials(config.accessKey, config.secretKey)` (`:37`, from `config/loaders.ts`), throws if either is missing (`:39-47`), constructs `this.auth = new KlingAuth(...)` (`:49`).
- `this.baseUrl = config.baseUrl ?? BASE_URL` (`:50`); **hard HTTPS enforcement**: `if (!this.baseUrl.startsWith('https://')) throw new Error('Base URL must use HTTPS protocol')` (`:54-56`) — this would also reject a non-HTTPS override for a hypothetical new-style base URL, but new-style Kling endpoints are HTTPS too, so not itself a blocker.
- Axios instance created with `baseURL`, `timeout`, and a static `Content-Type: application/json` header (`:59-65`) — **no `Authorization` header set here**.
- Request interceptor (`:68-74`) is the single place the auth header is injected: `headers.Authorization = this.auth.getAuthorizationHeader()` — this runs on **every** request, uniformly, regardless of endpoint. This is the one code path that would need branching logic (legacy JWT vs. new static key) if both auth styles must coexist.
- `request<T>()` (`:91-129`) takes `method: 'GET' | 'POST'` and calls `this.client.get(endpoint, {params: data})` or `this.client.post(endpoint, data)` — endpoint paths are passed in by the callers (operations modules), not derived from any URL-pattern/auth-style table.
- `getToken()` (`:176-178`), `refreshToken()` (`:180-185`) delegate to `this.auth`.

### 4.3 Credential sourcing — `src/config/loaders.ts`

`loadCredentials(cliAccessKey?, cliSecretKey?)` (`src/config/loaders.ts:28-74`) priority chain:
1. CLI-passed params if both present (`:33-35`)
2. `process.env.KLING_ACCESS_KEY` / `KLING_SECRET_KEY` if both present (`:38-43`)
3. Local `./.env` via `dotenv.parse` (`:46-55`)
4. Global `~/.kling/.env` via `dotenv.parse` (`:58-67`)
5. Fallback to whatever's in `process.env` even if partial (`:70-73`)

`loadConfig()` (`:103-113`) reads `KLING_OUTPUT_DIR`, `KLING_POLL_INTERVAL` (×1000), `KLING_TIMEOUT` (×1000) — unrelated to auth but same env-var convention.

`src/cli.ts:406-424` (`initializeApi`) calls `loadCredentials` then constructs `new KlingAPI({ accessKey, secretKey, debug })` — exits process(1) if either is missing.

`.env.example` was not read in depth but is referenced by `README.md:606-654` (`Authentication Setup`) documenting the same 4-tier priority.

### 4.4 What would need to change for static-API-key (bearer token) support alongside JWT

1. **`KlingConfig`** (`src/types.ts:649-660`) has no `apiKey`/token field — needs a new optional field (e.g. `apiKey?: string`).
2. **`loadCredentials`** (`src/config/loaders.ts:28-74`) is hard-wired to the `accessKey`+`secretKey` pair and env vars `KLING_ACCESS_KEY`/`KLING_SECRET_KEY` — needs a parallel path for a single `KLING_API_KEY` (name TBD) with its own priority chain, or an extension of the existing chain to recognize a third credential shape.
3. **`KlingHttpClient` constructor** (`src/client/http-client.ts:35-80`) unconditionally requires `accessKey`+`secretKey` and throws otherwise (`:39-47`) — this guard must be relaxed to accept "either JWT creds OR a static key."
4. **`KlingAuth`** (`src/auth.ts:39-223`) is JWT-only; there is no sibling class/strategy for a static bearer token. A new type (e.g. `KlingStaticAuth` with `getAuthorizationHeader() => 'Bearer ' + apiKey`) would need to satisfy the same shape the interceptor expects.
5. **The request interceptor** (`src/client/http-client.ts:68-74`) calls `this.auth.getAuthorizationHeader()` unconditionally — if legacy `/v1/...` endpoints must keep using JWT while new path-per-model endpoints use the static key, the interceptor (or a wrapper) needs to branch on the outgoing `endpoint`/URL (e.g. does it start with `/v1/`?) to pick the auth strategy. Nothing in the current code inspects the endpoint at auth-header-build time — `requestConfig.url` is available inside the interceptor callback but is not currently read.
6. **`getToken()`/`refreshToken()`** on both `KlingAPI` (`src/api.ts:469-478`) and `KlingHttpClient` (`:176-185`) are JWT-specific ("Force refresh the authentication token" / "Get the current authentication token") — semantically meaningless for a static key; would need to become no-ops or throw for static-key mode, and their JSDoc (`src/api.ts:464-468`) already says "Current JWT token", which would be misleading if reused for static-key config.
7. **`ERROR_CODES.AUTH_*`** (`src/config/constants.ts:159-164`) and `docs/KLING_API_REFERENCE.md:98-102` map error codes to JWT-specific failure reasons ("Token not yet valid", "Token has expired") — a static key won't produce `nbf`/`exp` failures, so error-message mapping in `KlingHttpClient.handleError` (`src/client/http-client.ts:137-169`) doesn't currently special-case anything by code (it just passes through), so no change strictly required there, but docs would mislead.

---

## 5. STATUS/ENUM DEPENDENCIES (`TaskStatus`)

Type definition: `TaskStatus = 'submitted' | 'processing' | 'succeed' | 'failed'` (`src/types.ts:40`).

Search used: `grep -rn "task_status" src/` and `grep -rn "'succeed'\|'failed'\|'submitted'\|'processing'" src/`.

| Comparison site | File:line | Detail |
|---|---|---|
| Poll-complete predicate | `src/handlers/result-poller.ts:31` | `result.data.task_status === 'succeed' \|\| result.data.task_status === 'failed'` — the only place `'submitted'`/`'processing'` are implicitly relevant (as the "not yet complete" states; neither literal string appears anywhere in `src/` outside the type definition itself) |
| Failure branch | `src/handlers/result-poller.ts:40` | `if (result.data.task_status === 'failed')` → throws `KlingAPIError` |
| CLI success branches (×10, one per command handler) | `src/cli.ts:495, 597, 682, 783, 894, 1011, 1106, 1211, 1319, 1549` | Each is `if (result.data.task_status === 'succeed') { ... } else { logger.error(...task_status_msg...) }` — duplicated per command rather than centralized |

**No code anywhere switches on `'submitted'` or `'processing'` explicitly** — confirmed by `grep -rn "'submitted'\|'processing'" src/` returning only the type-alias declaration at `src/types.ts:40`. This means the rename `succeed`→`succeeded` touches exactly **11 comparison sites** (1 in `result-poller.ts` for the predicate + 1 for the failure branch + this is actually 2 in result-poller + 10 in cli.ts = **12 total `=== 'succeed'`/`=== 'failed'` occurrences**), plus the type union itself (`types.ts:40`) and every place that reads `task_status_msg` (only meaningful under `'failed'`, unaffected by the `succeed`→`succeeded` rename but affected if the vendor also renames `task_status_msg`).

`docs/KLING_API_REFERENCE.md:329` also documents `**Task Status Values**: submitted, processing, succeed, failed` and `:695-697` documents the lifecycle `submitted → processing → succeed/failed` — both go stale under the migration.

---

## 6. CLI (`src/cli.ts`)

Top-level program: `program` (`src/cli.ts:2047-2060`), name `kling`, version read dynamically from `package.json` (`src/cli.ts:66-71`). Global options: `--access-key`, `--secret-key`, `--output-dir`, `--debug`, `-v/--verbose`, `--json`, `-q/--quiet`, `--examples` (`src/cli.ts:2053-2060`).

### 6.1 `video` command group (`src/cli.ts:2066`)

| Subcommand | Line(s) | Options (defaults in parens) | Calls `KlingAPI` method |
|---|---|---|---|
| `text2video` (alias `t2v`) | `src/cli.ts:2071-2103` | `-p/--prompt <text...>` ([]), `-m/--model <name>` (`kling-v1`), `-n/--negative-prompt`, `--mode` (`std`), `-a/--aspect-ratio` (`16:9`), `-d/--duration` (`5`), `--cfg-scale`, `--sound`, `--camera-type`, `--camera-{horizontal,vertical,pan,tilt,roll,zoom}`, `-w/--wait`, `--no-download`, `--callback-url` | `api.textToVideo` (`:486`), `api.waitForVideoResult` + `api.queryTextToVideoTask.bind(api)` (`:493`) |
| `image2video` (alias `i2v`) | `src/cli.ts:2108-2132` | `-i/--image` (required), `-p/--prompt`, `-m/--model` (`kling-v1`), `-n/--negative-prompt`, `--mode` (`std`), `-d/--duration` (`5`), `--image-tail`, `--cfg-scale`, camera-* , `-w/--wait`, `--no-download`, `--callback-url` | `api.imageToVideo` (`:588`), `api.waitForVideoResult` + `api.queryImageToVideoTask.bind(api)` (`:595`) |
| `extend` | `src/cli.ts:2137-2149` | `--video-id` (required), `-p/--prompt`, `-n/--negative-prompt`, `--cfg-scale`, `-w/--wait`, `--no-download`, `--callback-url` | `api.extendVideo` (`:673`), `api.waitForVideoResult` + `api.queryExtendVideoTask.bind(api)` (`:680`) |
| `multi-image` (alias `mi2v`) | `src/cli.ts:2154-2175` | `--images <paths...>` (required), `-p/--prompt` (required), `-m/--model` (`kling-v1-6`), `-n/--negative-prompt`, `--mode` (`std`), `-a/--aspect-ratio` (`16:9`), `-d/--duration` (`5`), `--cfg-scale`, `-w/--wait`, `--no-download`, `--callback-url` | `api.multiImageToVideo` (`:771`), `api.waitForVideoResult` + `api.queryMultiImageToVideoTask.bind(api)` (`:778-781`) |
| `omni` | `src/cli.ts:2180-2203` | `-p/--prompt` (required), `--images`, `--elements`, `-m/--model` (`kling-video-o1`), `-n/--negative-prompt`, `-a/--aspect-ratio` (`16:9`), `-d/--duration` (`5`), `--cfg-scale`, `-w/--wait`, `--no-download`, `--callback-url` | `api.omniVideo` (`:885`), `api.waitForVideoResult` + `api.queryOmniVideoTask.bind(api)` (`:892`) |
| `examples` | `src/cli.ts:2208-2213` | none | none — prints `showExamples()` (`src/cli.ts:1930-2041`) |

### 6.2 `image` command group (`src/cli.ts:2219`)

| Subcommand | Line(s) | Options (defaults) | Calls |
|---|---|---|---|
| `generate` (alias `gen`) | `src/cli.ts:2224-2259` | `-p/--prompt` ([]), `-m/--model` (`kling-v1`), `-n/--negative-prompt`, `-i/--image`, `--image-reference`, `--image-fidelity`, `--human-fidelity`, `-r/--resolution` (`1k`), `-a/--aspect-ratio` (`1:1`), `-c/--count` (`1`), `-w/--wait`, `--no-download`, `--callback-url` | `api.generateImage` (`:1002`), `api.waitForImageResult` (`:1009`, no bound query fn — uses default `api.queryImageGenTask`) |
| `expand` | `src/cli.ts:2264-2277` | `-i/--image` (required), `--up/--down/--left/--right` (each `0`), `-w/--wait`, `--no-download`, `--callback-url` | `api.expandImage` (`:1097`), `api.waitForImageResult` + `api.queryImageExpandTask.bind(api)` (`:1104`) |
| `omni` | `src/cli.ts:2282-2304` | `-p/--prompt` (required), `--images`, `--elements`, `-m/--model` (`kling-image-o1`), `-r/--resolution` (`1k`), `-a/--aspect-ratio` (`1:1`), `-c/--count` (`1`), `-w/--wait`, `--no-download`, `--callback-url` | `api.omniImage` (`:1202`), `api.waitForImageResult` + `api.queryOmniImageTask.bind(api)` (`:1209`) |
| `multi` (alias `mi2i`) | `src/cli.ts:2309-2333` | `--subject-images` (required), `--scene-image`, `--style-image`, `-p/--prompt`, `-m/--model` (`kling-v2`), `-a/--aspect-ratio` (`1:1`), `-c/--count` (`1`), `-w/--wait`, `--no-download`, `--callback-url` | `api.multiImageToImage` (`:1307`), `api.waitForImageResult` + `api.queryMultiImageToImageTask.bind(api)` (`:1314-1317`) |
| `examples` | `src/cli.ts:2338-2343` | none | prints `showImageExamples()` (`src/cli.ts:1359-1454`) |

### 6.3 `avatar` command group (`src/cli.ts:2349`)

| Subcommand | Line(s) | Options (defaults) | Calls |
|---|---|---|---|
| `create` | `src/cli.ts:2356-2369` | `-i/--image` (required), `--audio-id`, `--audio-file`, `-p/--prompt`, `--mode` (`std`), `-w/--wait`, `--no-download`, `--callback-url` | `api.createAvatar` (`:1540`), `api.waitForVideoResult` + `api.queryAvatarTask.bind(api)` (`:1547`) |
| `examples` | `src/cli.ts:2374-2379` | none | prints `showAvatarExamples()` (`src/cli.ts:1583-1637`) |

### 6.4 `account` command group (`src/cli.ts:2385`)

| Subcommand | Line(s) | Options (defaults) | Calls |
|---|---|---|---|
| `credits` | `src/cli.ts:2390-2396` | `-d/--days` (`30`) | `api.getAccountInfo(startTime, endTime)` (`:1690`) |
| `info` | `src/cli.ts:2401-2407` | `-d/--days` (`90`) | `api.getAccountInfo(startTime, endTime)` (`:1805`) |
| `examples` | `src/cli.ts:2412-2417` | none | prints `showAccountExamples()` (`src/cli.ts:1897-1925`) |

### 6.5 Default-model-per-command summary (for migration impact)

| Command | Default model | Line |
|---|---|---|
| `video text2video` | `kling-v1` | `src/cli.ts:2079` |
| `video image2video` | `kling-v1` | `src/cli.ts:2114` |
| `video multi-image` | `kling-v1-6` | `src/cli.ts:2160` |
| `video omni` | `kling-video-o1` | `src/cli.ts:2189` |
| `image generate` | `kling-v1` | `src/cli.ts:2232` |
| `image omni` | `kling-image-o1` | `src/cli.ts:2291` |
| `image multi` | `kling-v2` | `src/cli.ts:2320` |
| `avatar create` | n/a (no model param) | — |

Every one of these defaults is a **discontinued** model per the migration brief (`kling-v1`, `kling-v1-6`, `kling-v2`) except `kling-video-o1`/`kling-image-o1` (status not stated in the brief — flag `[VERIFY]`).

---

## 7. TESTS

All 16 test files under `test/` (line counts from `wc -l`):

| File | Lines | Covers |
|---|---|---|
| `test/api.test.ts` | 2133 | `KlingAPI` class end-to-end (mocked axios), all endpoint paths, all model literals in payloads, `task_status`/`succeed` branching, `KlingAPIError`, retry/backoff, save-result methods |
| `test/api-network.test.ts` | 253 | `nock`-based network-layer tests (see §7.1) |
| `test/auth.test.ts` | 430 | `KlingAuth` JWT generation/caching/expiry, `decodeToken`, `isTokenExpired` |
| `test/cli.test.ts` | 185 | CLI via `execSync` against built `dist/cli.js` — help text, option requiredness, defaults (see §7.2) |
| `test/config.test.ts` | 1384 | Constants (`BASE_URL`, model tables), `loadCredentials`/`loadConfig`, every `validate*Params` function, `ValidationError`, camera-control validation |
| `test/test-constants.ts` | 86 | Shared numeric/regex constants for tests (not itself a test file) |
| `test/test-setup.ts` | 154 | Shared axios mock factory + mock response factories (`createMockTaskResponse` defaults `status = 'submitted'` at `test/test-setup.ts:68`; `createMockVideoResult`/`createMockImageResult` default `status = 'succeed'` at `:85,111`) |
| `test/utils.test.ts` | 955 | File I/O, image/audio validation, security (`validateUrl`, `redactKey`, `sanitizeError`), polling, image/audio base64 conversion, downloads |
| `test/client/http-client.test.ts` | 483 | `KlingHttpClient` constructor (HTTPS enforcement), request interceptor (Bearer header, JWT format regex), retry/backoff timing, error transformation, token management |
| `test/handlers/file-saver.test.ts` | 430 | `saveVideoResult`/`saveImageResult` |
| `test/handlers/result-poller.test.ts` | 333 | `waitForVideoResult`/`waitForImageResult`, error-code handling on failure |
| `test/integration/downloads.test.ts` | 309 | `downloadVideo`/`downloadImage` with `nock` (3 `nock.` call sites) |
| `test/integration/polling.test.ts` | 309 | Polling integration (no `nock` — 0 call sites found) |
| `test/operations/avatar.test.ts` | 156 | `createAvatar`/`queryAvatarTask` operation functions directly |
| `test/operations/image.test.ts` | 334 | All image operation functions directly |
| `test/operations/video.test.ts` | 366 | All video operation functions directly |

### 7.1 `nock` usage

Only two files use `nock` (`grep -rln "nock" test/` → `test/api-network.test.ts`, `test/integration/downloads.test.ts`). Everything else uses `vi.mock('axios', ...)` at the module level (`test/test-setup.ts:19-36` factory, reused via `test/client/http-client.test.ts:23-38` and similar inline mocks in `api.test.ts`/`operations/*.test.ts`).

`test/api-network.test.ts` is the most representative real-network-shape test:
- Base URL mocked via `nock(BASE_URL)` where `BASE_URL` is imported from `../src/config/constants.js` (`test/api-network.test.ts:18,55`) — i.e., the mock is **not** hard-coded to a URL string, it imports the same constant the client uses, so a `BASE_URL` change in source doesn't break these tests, but a **path** change would (all `.post('/v1/...)`/`.get('/v1/...')` calls are literal strings, e.g. `:56,86,116,137,161,182,192,202,213,230,235,245`).
- Auth header asserted via regex, not exact JWT: `.matchHeader('authorization', /^Bearer /)` (`:62,139`), and `expect(capturedAuthHeader).toMatch(/^Bearer eyJ/)` (`:223`) — the `eyJ` prefix assumption is JWT-specific (base64 of `{"`) and **will fail** if the Authorization value becomes a static API key not shaped like a JWT.
- Model literal `kling-v1` asserted in request body: `expect(body).toHaveProperty('model_name', 'kling-v1')` (`:59`).
- `task_status: 'submitted'`/`'succeed'` literals used in mock responses (`:50,82,130,157`) and asserted (`:144`).
- `/account/costs` mocked with `.query(true)` wildcard (`:183,193,202`) for `healthCheck` tests (`:180-206`).
- Retry-on-502 test (`:228-241`) and no-retry-on-401 test (`:243-251`) both hit `/v1/videos/text2video`.

`test/integration/downloads.test.ts` uses `nock` for `downloadVideo`/`downloadImage` HTTP mocking (URL-based, not `BASE_URL`-scoped since these hit arbitrary media URLs).

### 7.2 CLI test assertions (`test/cli.test.ts`)

Runs the **built** `dist/cli.js` via `execSync` (`test/cli.test.ts:11-26`) — meaning these tests require `npm run build` first and do not exercise `src/cli.ts` directly. Representative assertions: help text contains `--access-key`/`--secret-key` (`:33-34`), version format regex (`:38-39`), `--examples` output (`:42-46`), subcommand help containment checks (`:52-104`), alias acceptance (`:114-129`), required-option error strings like `"required option '-i, --image"` (`:139-155`), and default-value presence in help text: `kling-v1` (`:163-165`), `5` (`:168-170`), `16:9` (`:173-175`), `std` (`:178-180`).

### 7.3 Model/endpoint/status assertion density (representative, not exhaustive counts)

- `test/api.test.ts:198,217,237,255` assert `'/v1/videos/text2video'` as the POST endpoint across 4 different parameter scenarios.
- `test/api.test.ts:296,320,347,374` assert the 4 distinct `GET .../{taskId}` endpoints for text2video/image2video/image-expand/avatar.
- `test/operations/video.test.ts:87-93,105-116` assert `model_name: 'kling-v1'` default and `model_name: 'kling-v2-master'` override against `/v1/videos/text2video`.
- `test/config.test.ts:46-69` asserts `TEXT_TO_VIDEO_MODELS` has keys `kling-v1` (`:52`) and `kling-v2-6` (`:56`), and that every entry has boolean capability flags (`:58-67`).
- `test/config.test.ts:29-37` asserts `BASE_URL` starts with `https://` and contains `klingai.com` — will still pass post-migration if base URL host is unchanged, but says nothing about path scheme.

---

## 8. README.md and docs/KLING_API_REFERENCE.md — statements that go stale under migration

### 8.1 `README.md`

| Line(s) | Claim | Why it goes stale |
|---|---|---|
| `README.md:10` | Links to `docs.qingque.cn` as "the Kling AI API" | Third-party mirror doc, not the vendor's new-model docs |
| `README.md:12,93,106` | "JWT authentication", "JWT authentication details" | New-style endpoints use static API-key bearer, not JWT |
| `README.md:29,45,206,754` (and many more) | `model_name: 'kling-v2-master'` used as the flagship example everywhere | `kling-v2-master` is one of the vendor-discontinued models per the migration brief |
| `README.md:34,59,769,860,896,935,962,1002,1006,1041,1078,1116,1152,1271,1274,1313,1332` | `task.data.task_id` used pervasively as the canonical way to get a task ID | New unified query is `data.id`, not `data.task_id` |
| `README.md:179-180,239,287,360,394-395,467-471,508` | Explicit model enumeration lists (`kling-v1, kling-v1-6, kling-v2-master, kling-v2-1-master, kling-v2-5-turbo, kling-v2-6`, etc.) | All discontinued per migration; new models use `kling-3.0-turbo` etc. |
| `README.md:1171-1205` | "Models" section with 3 capability tables, every row a legacy model name | Entire section describes discontinued models |
| `README.md:1316` (`result.data.task_result.images` loop) | Nested `task_result.videos[]`/`task_result.images[]` read pattern | New unified result shape not nested under `task_result` per migration brief (exact new shape not given in the task — flag `[VERIFY]`) |
| `README.md:606-654` | 4-tier credential priority (constructor / env / local `.env` / global `~/.kling/.env`), all keyed to `accessKey`/`secretKey` | No static-API-key path documented; would need a 5th/alternate mechanism |
| `README.md:1479-1484` | "Camera Control Not Supported... Use kling-v1-6" troubleshooting entry | Recommends a discontinued model |
| `README.md:7-8` | Badges claim "534 tests passing" / "95.29% coverage" | Cosmetic staleness risk if migration changes test count materially — not a functional claim but will drift |

### 8.2 `docs/KLING_API_REFERENCE.md`

| Line(s) | Claim | Why it goes stale |
|---|---|---|
| `docs/KLING_API_REFERENCE.md:27-31` | Base URL `https://api-singapore.klingai.com` | May still be correct for legacy `/v1/...`; unclear if new path-per-model endpoints share this host — `[VERIFY]` |
| `:40-89` | Entire "Authentication" section describes JWT-only (HS256, `iss`/`exp`/`nbf`, Python `jwt.encode` example) | New-style endpoints use static API-key bearer per migration brief; this doc has zero mention of API keys |
| `:158-220` | "Model Capabilities" tables list only `kling-v1`, `kling-v1-5`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1-master`, `kling-v2-5-turbo`, `kling-v2-6`, `kling-image-o1`, `kling-v1`/`v1-5`/`v2`/`v2-new`/`v2-1` for images | Every one of these is a discontinued model per the migration brief; no `kling-3.0-turbo` or other new-model entries exist anywhere in this doc |
| `:225-608` | All "API Endpoints" sections document flat-body `POST /v1/videos/...`, `POST /v1/images/...` with **flat** top-level fields (`model_name`, `prompt`, etc.) | New scheme is path-per-model (`POST /text-to-video/{model}`) with a nested `settings`/`options` body — structurally different from every example in this file |
| `:278,309,329,695-697` | `task_status: "submitted"`/`"succeed"` literals in example JSON and the documented lifecycle `submitted → processing → succeed/failed` | New unified status is `succeeded` (per migration brief), and field may move from `task_status` to `status` |
| `:277,308` and throughout `data` blocks | `"task_id": "string"` shown as the response ID field | New unified response uses `data.id` |
| `:331-343,413,448,487-488,531-533,573-574,607-608` | Every "Query Task List" example uses per-endpoint `GET /v1/.../?pageNum=&pageSize=` | New unified query is `GET /tasks?task_ids=` — a structurally different query mechanism (task-ID-scoped, not paginated-listing) not represented anywhere in this doc |
| `:514,531` (`POST/GET /v1/images/multi-image-generations`) and `:544,573` (`POST/GET /v1/images/image-expansion`) and `:586,606` (`POST/GET /v1/videos/avatar`) | **These three documented paths do NOT match the actual `src/` implementation**, which uses `/v1/images/multi-image2image` (`src/operations/image.ts:241,255`), `/v1/images/editing/expand` (`src/operations/image.ts:107,121`), and `/v1/videos/avatar/image2video` (`src/operations/avatar.ts:43,57`) respectively. This is a **pre-existing doc/code mismatch independent of the migration** — worth fixing regardless, and worth noting so the migration doesn't propagate the wrong (already-stale) paths forward. |
| `:507-535` | Documents `Multi-Image to Image` request body as `{ prompt, images: [...], aspect_ratio, n, callback_url }` | Does not match actual `MultiImageToImageParams`/payload shape (`subject_image_list`, `scene_image`, `style_image` — `src/types.ts:430-449`, `src/operations/image.ts:218-239`) — another pre-existing mismatch |
| `:537-568` | Documents Image Expansion body as `{ image, prompt, expansion_ratio: {top,bottom,left,right}, aspect_ratio, callback_url }` | Actual payload is 4 flat `*_expansion_ratio` fields, no `prompt`, no nested `expansion_ratio` object, no `aspect_ratio` (`src/operations/image.ts:97-105`, `src/types.ts:284-299`) — pre-existing mismatch |
| omni-video/omni-image endpoints | Not documented anywhere in this file | `src/operations/video.ts:301,315` (`/v1/videos/omni-video`) and `src/operations/image.ts:173,187` (`/v1/images/omni-image`) exist in code with zero corresponding section in `docs/KLING_API_REFERENCE.md` — a gap independent of migration, but means this doc was already out of sync with `src/` before any vendor change |
| `:735-748` | "Version History" section stops at v2.6/v2.5-turbo/v2.1-master, dated "December 2024" | No mention of v3.0-turbo or any newer model — confirms this doc predates the vendor changes described in the migration brief |

**No CLI examples appear in `docs/KLING_API_REFERENCE.md`** (it is a pure HTTP-API reference); all CLI examples live in `README.md` (§8.1) and in `src/cli.ts`'s `showExamples()`/`showImageExamples()`/`showAvatarExamples()`/`showAccountExamples()` functions (`src/cli.ts:1930-2041, 1359-1454, 1583-1637, 1897-1925`), which are also stale per the model-literal table in §3.5/§6.5.

---

## 9. VALIDATORS

### 9.1 `src/config/validators/video.ts`

| Function | Line | Params enforced | Model capability flags read |
|---|---|---|---|
| `validateCameraControl` (internal helper) | `src/config/validators/video.ts:59-108` | `camera_control.type` (enum via `VALID_CAMERA_TYPES`, `:69`), `camera_control.config` keys restricted to `VALID_CONFIG_KEYS` (`:50,82-91`), each config value range-checked via `CAMERA_CONFIG_RANGE` (`:94`), max 1 non-zero config value (`MAX_CAMERA_CONFIG_NON_ZERO`, `:101-106`) | `supported: boolean` param — caller passes `modelCaps.supportsCameraControl` |
| `validateTextToVideoParams` | `:120-155` | `model_name` (via `validateModel`, `:121`), `prompt` required + length (`:125-126`), `negative_prompt` length (`:127`), `sound` (enum `on`/`off`, gated by capability, `:130-135`), `cfg_scale` (range, gated by capability, `:138-143`), `mode`/`aspect_ratio`/`duration` (enums, `:146-149`), `camera_control` (delegates to helper, `:152-154`) | Reads `TEXT_TO_VIDEO_MODELS[model].supportsSound` (`:131`), `.supportsCfgScale` (`:139`), `.supportsCameraControl` (`:153`) |
| `validateImageToVideoParams` | `:167-223` | `model_name` (`:168`), `image` required (`:172`), `prompt`/`negative_prompt` length (`:175-176`), `image_tail` (gated by capability + requires `mode==='pro'` + mutual exclusivity with masks/camera_control, `:179-193`), `voice_list` (gated by capability, max length `MAX_VOICE_LIST_LENGTH`, `:196-203`), `cfg_scale` (gated, `:206-211`), `mode`/`aspect_ratio`/`duration` enums (`:214-217`), `camera_control` (`:220-222`) | `IMAGE_TO_VIDEO_MODELS[model].supportsImageTail` (`:180`), `.supportsVoiceList` (`:197`), `.supportsCfgScale` (`:207`), `.supportsCameraControl` (`:221`) |
| `validateExtendVideoParams` | `:235-243` | `video_id` required (`:236`), `prompt`/`negative_prompt` length (`:237-238`), `cfg_scale` range (`:240-242`) | none (no model concept for extend) |
| `validateMultiImageToVideoParams` | `:254-293` | `image_list` non-empty + max `MAX_MULTI_IMAGE_VIDEO_COUNT` + each item non-empty (`:256-273`), `prompt` required+length (`:276-278`), hard-coded `model_name !== 'kling-v1-6'` rejection (`:281-286`), `mode`/`aspect_ratio`/`duration` enums (`:289-292`) | none from `models.ts` — model check is a literal string comparison, not registry-driven |
| `validateOmniVideoParams` | `:305-346` | `prompt` required+length (`:307-308`), hard-coded `model_name !== 'kling-video-o1'` rejection (`:311-313`), `image_list` frame-type constraints (end_frame requires first_frame, max 2 images with end_frame, each item URL required, `:316-340`), `aspect_ratio`/`duration` enums (`:343-345`) | none from `models.ts` |

### 9.2 `src/config/validators/image.ts`

| Function | Line | Params enforced | Model capability flags read |
|---|---|---|---|
| `validateImageGenParams` | `:52-100` | `model_name` (`:53`), `prompt` required+length (`:56-57`), `negative_prompt` length (`:58`), `image_reference` (gated by capability + requires `image`, `:61-72`), `image_fidelity` range (`:75-77`), `human_fidelity` range (requires `image_reference==='face'`, `:78-83`), `n` integer + range vs `modelCaps.maxN` (`:86-93`), `resolution`/`aspect_ratio` enums (`:96-99`) | `IMAGE_GEN_MODELS[model].supportsImageReference` (`:62`), `.maxN` (`:90`) |
| `validateImageExpandParams` | `:112-142` | `image` required (`:113`), all 4 `*_expansion_ratio` required + range (`:116-129`), total-expansion product check vs `MAX_TOTAL_EXPANSION` (`:131-141`) | none |
| `validateOmniImageParams` | `:154-191` | `prompt` required+length (`:156-157`), hard-coded `model_name !== 'kling-image-o1'` rejection (`:160-162`), `image_list` item non-empty (`:165-172`), `n` integer + range (`:175-180`), `resolution` enum (`:183-185`), `aspect_ratio` enum incl. `'auto'` via `VALID_OMNI_IMAGE_ASPECT_RATIOS` (`:187-190`) | none from `models.ts` |
| `validateMultiImageToImageParams` | `:203-246` | `subject_image_list` non-empty + max `MAX_SUBJECT_IMAGE_COUNT` + each item non-empty (`:205-224`), `prompt` length (`:227`), `model_name` enum via `VALID_MULTI_IMAGE_TO_IMAGE_MODELS` (`:230-232`), `n` integer + range (`:235-240`), `aspect_ratio` enum (`:243-245`) | none from `models.ts` — enum-based, not capability-table-based |

### 9.3 `src/config/validators/avatar.ts`

| Function | Line | Params enforced |
|---|---|---|
| `validateAvatarParams` | `:28-41` | `image` required (`:29`), mutual-exclusivity+required-one-of `audio_id`/`sound_file` (`:32-37`), `prompt` length (`:39`), `mode` enum (`:40`) |

No model concept for avatar — `AvatarParams` has no `model_name` field at all (`src/types.ts:306-321`).

### 9.4 `src/config/validators/helpers.ts` (shared primitives, used by all of the above)

| Function | Line | Purpose |
|---|---|---|
| `ValidationError` (class) | `:14-22` | `field` + message, `name = 'ValidationError'` |
| `validateRange` | `:38-42` | numeric min/max |
| `validateEnumValue` | `:48-56` | value ∈ allowed list |
| `validatePromptLength` | `:62-66` | vs `MAX_PROMPT_LENGTH` (2500) |
| `validateRequired` | `:72-76` | non-empty string |
| `validateModel` | `:83-96` | looks up `modelName ?? defaultModel` in a `Record<string, T>` registry, throws if absent, returns the capability object — **this is the single choke point that must accept new path-per-model model names** once `TEXT_TO_VIDEO_MODELS`/`IMAGE_TO_VIDEO_MODELS`/`IMAGE_GEN_MODELS` are updated in `src/config/models.ts` |

---

## Summary of migration touch points (cross-reference, not exhaustive by itself — see full sections above)

1. **Endpoints**: 18 flat-body `/v1/...` POST/GET pairs across `src/operations/video.ts`, `src/operations/image.ts`, `src/operations/avatar.ts` (§2) — every `client.request('POST'|'GET', '/v1/...', ...)` call site is a rewrite target for path-per-model + `settings`/`options` nesting.
2. **Response shape**: `data.task_id`→`data.id` and `data.task_status`→`data.status` (values `succeed`→`succeeded`) ripple through `src/types.ts` (5 interfaces), `src/handlers/result-poller.ts` (2 comparisons), `src/handlers/file-saver.ts` (4 reads), and `src/cli.ts` (22+ reads) (§2.1, §5).
3. **Query mechanism**: per-endpoint `GET .../{id}` (18 call sites, §2) → unified `GET /tasks?task_ids=` is an architectural change, not a per-line edit — likely collapses all 9 `query*Task` operation functions into one.
4. **Model registry**: `src/types.ts` unions, `src/config/models.ts` capability tables, `src/config/constants.ts:142`, and hard-coded single-model checks in validators (§3) all enumerate exclusively discontinued models; none contain any new-style model name today.
5. **Auth**: JWT-only end-to-end from `KlingConfig` through `KlingAuth` to the unconditional interceptor in `KlingHttpClient` (§4) — introducing a static-key path is a multi-file change, and the interceptor has no per-endpoint branching today.
6. **CLI defaults**: 7 of 8 subcommands default to a discontinued model (§6.5).
7. **Docs**: `README.md` and `docs/KLING_API_REFERENCE.md` are already stale relative to `src/` in three endpoint paths (multi-image-to-image, image-expansion, avatar — §8.2) *before* accounting for the vendor migration; the migration adds JWT-auth staleness, model-list staleness, and lifecycle/field-name staleness on top.
