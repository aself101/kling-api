# kling-api

Node.js client and CLI for the [Kling AI](https://kling.ai) API — video generation on the vendor's new API standard, image generation and resources (elements, voices, avatar, TTS) on the legacy `/v1/` standard, one normalized `Task` model over both, and a static API Key as the only credential.

**2.0 is a full reboot.** The vendor discontinued every model 1.x defaulted to, moved video to a path-per-model API, and made the API Key the only credential that works there. Nothing from 1.x is source-compatible; the [migration table](#migration-from-1x) maps every 1.x method to its 2.0 disposition.

- Node **≥ 20** (native `fetch`; no axios). ESM only.
- Runtime dependencies: `commander`, `dotenv`, `ora` — the latter two used only by the CLI.
- Vendor docs snapshot the library was built against: [`docs/api/`](docs/api/) (fetched 2026-09-20).

## Table of contents

- [Install](#install)
- [Authentication](#authentication)
- [Quick start](#quick-start)
- [How it fits together](#how-it-fits-together)
- [Media inputs](#media-inputs)
- [Default models and the price table](#default-models-and-the-price-table)
- [Video](#video)
- [Image](#image)
- [Elements, voices, avatar, TTS](#elements-voices-avatar-tts)
- [Tasks](#tasks)
- [Saving outputs](#saving-outputs)
- [Account and billing](#account-and-billing)
- [Errors, retries and recovery](#errors-retries-and-recovery)
- [Timeouts, proxies and `fetch`](#timeouts-proxies-and-fetch)
- [Webhooks](#webhooks)
- [CLI](#cli)
- [Model tables](#model-tables)
- [Migration from 1.x](#migration-from-1x)
- [What has been verified live](#what-has-been-verified-live)
- [Known limits](#known-limits)

## Install

```bash
npm install kling-api        # library
npm install -g kling-api     # `kling` CLI
```

## Authentication

Create an API Key in the [Kling console](https://kling.ai/dev/api-key) and pass it or export it:

```ts
import { KlingClient } from 'kling-api';

const client = new KlingClient({ apiKey: process.env.KLING_API_KEY });
// or, with KLING_API_KEY exported, simply:
const client2 = new KlingClient();
```

The library reads exactly two sources: the `apiKey` option and `process.env.KLING_API_KEY`. It never reads `.env` files or your home directory. The **CLI** additionally reads `./.env` and `~/.kling/.env` (see [CLI](#cli)).

AccessKey/SecretKey (JWT) credentials are not accepted: the new-standard endpoints reject them with `401 / 1002 "The current API does not support AK/SK"`, and 2.0 does not implement them anywhere.

## Quick start

```ts
import { KlingClient } from 'kling-api';

const client = new KlingClient();

const handle = await client.video.textToVideo({
  prompt: 'A lighthouse at dusk, waves breaking gently, a gull calling.',
  duration: 3,
  resolution: '720p',
});
console.log(handle.id, handle.externalId); // vendor task id, and the UUID this create carried

const task = await handle.wait(); // polls every 3 s, up to 15 min by default
console.log(task.status, task.outputs); // 'succeeded', [{ type: 'video', url, durationSeconds, … }]
console.log(task.billing); // [{ chargeType: 'unit', amount: '2.4', packageType: 'video' }]

const files = await client.save(task, './output'); // ['output/<id>-0.mp4', 'output/<id>.json']
```

The same from the shell:

```bash
export KLING_API_KEY=…
kling video t2v -p "A lighthouse at dusk" -d 3 -r 720p --wait
```

## How it fits together

The vendor runs **two API design standards at once**, and the library hides the seam:

| | New standard | Legacy standard |
|---|---|---|
| Products | all video: `text-to-video`, `image-to-video`, `omni-video`, `motion-control` | all image; elements, voices, avatar, TTS |
| Endpoint shape | `POST /text-to-video/<model>` — the model is in the path | `POST /v1/images/generations` — `model_name` in the body |
| Task query | unified `GET /tasks?task_ids=…` / `POST /tasks` (cursor) | `GET /v1/<product>/{id}` |
| Terminal status | `succeeded` | `succeed` — the library normalizes it to `succeeded` |

Every create returns a **`TaskHandle`**:

```ts
interface TaskHandle {
  id: string;             // vendor task id
  externalId?: string;    // the external_task_id this create carried (a UUID unless you opted out)
  standard: 'new' | 'legacy';
  product: Product;       // 'text-to-video', 'image-generation', 'element', …
  request: Record<string, unknown>; // what was sent — media inputs redacted to { kind, bytes, sha256 }
  get(): Promise<Task>;
  wait(options?: { intervalMs?, deadlineMs?, signal? }): Promise<Task>;
}
```

and every query returns a **`Task`**:

```ts
interface Task {
  id: string;
  standard: 'new' | 'legacy';
  product?: Product;           // absent for results of the unified /tasks query (the vendor carries no product there)
  status: 'submitted' | 'processing' | 'succeeded' | 'failed';
  message?: string;            // the failure reason when failed
  externalId?: string;
  createdAt?: number;          // Unix ms
  updatedAt?: number;
  outputsExpireAt?: number;    // updatedAt + 30 days on succeeded — the vendor clears output URLs after 30 days
  outputs: TaskOutput[];       // video | image | audio | element | voice entries, camelCase
  billing?: BillingEntry[];    // [{ chargeType: 'unit' | 'cash', amount, packageType?, … }]
  raw: unknown;                // the vendor record, untouched — the escape hatch
}
```

`handle.wait()` resolves on `succeeded`, throws `KlingTaskFailedError` on `failed`, and `KlingPollTimeoutError` on the deadline. Two concurrent `wait()` calls on one handle share a single poll loop; each caller's `deadlineMs` and `signal` apply to that caller only.

`outputsExpireAt` is derived, not vendor-supplied — and it is accurate: the vendor's signed output URLs carry an `Expires=` that matched the derived value within 2 seconds on every task checked. `save()` refuses an expired task unless `force: true`.

## Media inputs

Every image/audio parameter is a `MediaSource`:

```ts
type MediaSource =
  | string                          // an https URL, or a Base64 string (optional data: prefix)
  | { url: string }
  | { base64: string; mimeType?: string }
  | { path: string }                // a local file — read, checked, Base64-encoded
  | Buffer | Uint8Array;
```

**A bare string is never a filesystem path.** 1.x read any string that happened to exist on disk; a server passing user input to `imageToVideo` would have read from its own filesystem. To send a file, pass `{ path: './frame.png' }`. The CLI wraps its file arguments for you.

Local files and buffers are checked before anything is sent: extension (`.jpg/.jpeg/.png`; audio `.mp3/.wav/.m4a/.aac`), magic bytes, and for images the vendor's rules — at least 300 px per side, aspect ratio within 1:2.5 – 2.5:1. Inline caps: **10 MB** per input on the legacy standard (the vendor's documented limit), **20 MB** on the new standard (the vendor documents 50 MB for URLs and nothing for inline; a larger Base64 body inflates the JSON past what an unpublished edge limit is known to accept), and **40 MB** of encoded payload per request across all inputs. Over a cap, the error tells you to host the file and pass a URL.

**Video inputs** (`featureVideo`, `baseVideo`, motion-control `video`, element `referVideos`, `voiceUrl`) accept URLs only — the Kling API has no upload endpoint. Their duration and format bounds (stated on each parameter's JSDoc) are not checked client-side; the vendor returns an error code.

## Default models and the price table

**Video defaults to the cheapest current-generation model whose output includes native audio**; image defaults to the newest model. Per second at 720p / 1080p, from the vendor's price list ([`docs/api/kling-pricing-video.md`](docs/api/kling-pricing-video.md), fetched 2026-09-20):

| Model | Silent | With native audio | Default for |
|---|---|---|---|
| `kling-3.0-turbo` | — (audio always on) | **0.8 / 1.0** | `video.textToVideo`, `video.imageToVideo` |
| `kling-3.0` | 0.6 / 0.8 (4k: 3.0) | 0.9 / 1.2 | `video.motionControl` |
| `kling-3.0-omni` (no video input) | 0.6 / 0.8 | 0.8 / 1.0 | `video.omni` |
| `kling-o1` (no video input) | 0.6 / 0.8 | — | |
| `kling-2.6` | 0.3 / 0.5 | — / 1.0 | |
| `kling-2.5-turbo` | 0.3 / 0.5 | — | |

So a 3-second default text-to-video costs 2.4 video units (verified live). `kling-3.0` silent is 25 % cheaper than the default if you do not need audio — pass `model: 'kling-3.0', audio: 'off'`. Image defaults: `kling-v3` (`image.generate`), `kling-v3-omni` (`image.omni`); `image.multiImageToImage` has exactly one documented model, `kling-v2-1`.

Resource packs are **per product type** (video / image) — a `1102` "balance not enough" on an image endpoint says nothing about your video pack.

## Video

All four methods take the `CommonOptions` — `callbackUrl`, `externalTaskId` (`string | false`), `watermark`, `signal`, `extraSettings`, `extraOptions` — and return a `TaskHandle`.

```ts
// text to video
await client.video.textToVideo({ model: 'kling-3.0', prompt: '…', resolution: '4k', duration: 10, audio: 'native', multiShot: true });

// image to video — first frame required; last frame on kling-3.0 / 2.x (1080p only on 2.x)
await client.video.imageToVideo({
  prompt: '@Zhang turns and waves',
  firstFrame: 'https://…/frame.png',
  lastFrame: { path: './last.png' },
  model: 'kling-3.0',
  elements: [{ elementId: '321930081569316', id: 'Zhang' }], // kling-3.0, ≤ 3
});

// omni video — frames, reference images, ONE reference video, elements
await client.video.omni({
  prompt: '@image_1 in the style of @image_2; then @video_1 continues',
  firstFrame: 'https://…/a.png',            // → id image_1
  referImages: [{ source: 'https://…/b.png' }], // → image_2
  featureVideo: { url: 'https://…/clip.mp4' }, // → video_1 (forces audio 'off')
  elements: [{ elementId: '…', kind: 'multi_image' }],
  resolution: '1080p',
});

// motion control — animate an image with a reference video's motion
await client.video.motionControl({ image: { path: './person.png' }, video: 'https://…/dance.mp4', characterOrientation: 'video', audio: 'original' });
```

Multi-shot on `kling-3.0-turbo` is driven by the prompt syntax `"shot 1, 3, words; shot 2, 4, words;"` — it has no `multi_shot` field, and no `audio` field either (native audio is always on; verified live). `@name` references in a prompt that match no content id produce a **logger warning**, not an error.

### Validation: known models, unknown models, and the escape hatches

Rules come in two classes. **`[shape]`** rules (required fields, types, mutually exclusive fields, anything that changes what a paid request means — e.g. `baseVideo` excludes frames) always throw `KlingValidationError`. **`[capability]`** rules ("does this known model accept this resolution / duration / audio / content type") throw by default and become logger warnings under `new KlingClient({ capabilityValidation: 'warn' })`.

An **unknown model id** is passed through with shape rules only (`unknownModels: 'passthrough'`, the default — the vendor ships new ids monthly); `'reject'` refuses it. `extraSettings` / `extraOptions` / `extraContents` merge fields the library does not model yet; a key the library *does* model is rejected there.

Omni element count matrices are stated by the vendor per element **kind** (video-character vs multi-image), which the id does not reveal — pass `kind` on each element for the exact check, omit it for the kind-independent envelopes.

## Image

Legacy `/v1/` endpoints with the API Key. Same handle/task flow; `image` inputs follow the 10 MB legacy cap.

```ts
await client.image.generate({ prompt: 'a ceramic lighthouse on a windowsill', n: 1, resolution: '1k', aspectRatio: '1:1' });
await client.image.generate({ model: 'kling-v2-1', prompt: '…', image: { path: './ref.png' }, imageReference: 'subject', humanFidelity: 0.5 }); // feature reference: kling-v2-1 only
await client.image.omni({ prompt: 'merge <<image_1>> into <<image_2>>', images: ['https://…/a.png', { path: './b.png' }], resultType: 'series', seriesAmount: 'auto', aspectRatio: 'auto' });
await client.image.multiImageToImage({ prompt: '…', subjectImages: [{ path: './s1.png' }], sceneImage: 'https://…/scene.jpg', n: 2 });
await client.image.outpaint({ image: { path: './a.png' }, up: 0.15, down: 0.15, left: 0.65, right: 0.65 }); // (1+up+down)(1+left+right) ≤ 3
await client.image.subjectCompletion({ frontalImage: 'https://…/face.png' }); // three views → element creation
```

`image.outpaint` is 1.x's `expandImage`, renamed after the vendor's own page title.

## Elements, voices, avatar, TTS

```ts
// an element from images: frontal + 1–3 references (0 units on the trial pack)
const h = await client.elements.create({ name: 'Zhang', description: '…', referenceType: 'image_refer', frontalImage: { path: './front.png' }, referImages: [{ path: './side.png' }], tags: ['o_102'] });
const t = await h.wait();
const element = t.outputs[0]; // { type: 'element', id: '321930081569316', name, status: 'succeeded', raw }
await client.elements.delete(element.id);                    // POST /v1/general/delete-advanced-elements
await client.elements.delete(element.id, { kind: 'image' }); // POST /v1/general/delete-elements — same store (verified live)
await client.elements.presets();                             // the official library

// voices
const v = await client.voices.create({ name: 'mine', voiceUrl: 'https://…/clip.mp3' }); // XOR videoId
await client.voices.presets(); // official voices — NOT the TTS catalogue (below)

// avatar: a talking head from an image and a sound
await client.avatar.create({ image: { path: './portrait.png' }, audioId: '930842553070133305', mode: 'std' }); // audioId XOR soundFile

// TTS is synchronous and returns the audio outputs directly
const audio = await client.audio.tts({ text: 'Hello.', voiceId: 'oversea_male1', voiceLanguage: 'en' });
```

`audio.tts` takes a `voiceId` from the vendor's **TTS Voice Guide** (`oversea_male1`, …) — a `voices.presets()` id returns `1201 "Voice id not found"`. TTS has no `external_task_id`, so a lost TTS response is unrecoverable (0.05 units).

`elements.get(taskId)` / `voices.get(taskId)` take the **creation task** id; `delete` takes the **element / voice** id from the output.

## Tasks

```ts
const { tasks, missing } = await client.tasks.get(['930831534075682845', '…']); // unified GET /tasks, chunked 20 per request
await client.tasks.get('my-external-id', { byExternalId: true });
const page = await client.tasks.list({ startTime, endTime, limit: 100, status: 'succeeded', productType: 'video' }); // POST /tasks cursor
await client.tasks.list({ cursor: page.nextCursor });

await client.tasks.getByProduct('image-generation', '930840436553031693'); // routes legacy products to /v1/<product>/{id}
await client.tasks.listByProduct('voice', { pageNum: 1, pageSize: 100 });
await client.tasks.recover('text-to-video', externalId); // Task | null — see Errors, retries and recovery
client.tasks.handle('omni-video', id);                    // a TaskHandle for a task this process did not create
```

`missing` lists ids the vendor did not return — it answers `200 data: []` for unknown ids, so absence is the only signal. A `tasks.get` chunk that fails throws `KlingBatchError { tasks, missing, unattempted, cause }` so earlier chunks are not lost. The vendor caps `GET /tasks` at **20 ids** per request (undocumented; verified live).

The unified `/tasks` also returns legacy-created tasks (verified live), normalized the same way; `getByProduct` still routes legacy products to `/v1/…` because that envelope carries fields `/tasks` does not.

## Saving outputs

```ts
const files = await client.save(task, './output', { includeWatermark: false, request: handle.request });
// ./output/<task.id>-0.mp4         ext from Content-Type → URL extension → bin
// ./output/<task.id>-1-watermark.mp4  with includeWatermark
// ./output/<task.id>.json          { product, standard, request, outputs, files, raw }
```

Downloads go through the client's `fetch` with a byte cap (default 500 MiB), a redirect cap (5), and a per-hop URL safety check (below). `KlingOutputsExpiredError` is thrown **before any fetch** once `outputsExpireAt` has passed (`force: true` bypasses); `KlingNoOutputsError` for a `succeeded` task with no outputs. The sidecar's `request` is the handle's redacted record — a 20 MB inline frame is a `{ kind, bytes, sha256 }` triple there, not a second copy.

## Account and billing

```ts
const packs = await client.account.usage(Date.now() - 30 * 86_400_000, Date.now());
// [{ name: 'Trial-Video-100Units-5Con-1Months', remainingQuantity: 91.2, totalQuantity: 100, status: 'online', expiresAt, … }]
const cash = await client.account.balanceLedger({ startTime, endTime, limit: 100 });   // per-task cash deductions
const units = await client.account.packageLedger({ startTime, endTime, productType: 'video' }); // per-task unit deductions
```

`usage` is free to call (QPS ≤ 1) and remaining quantities lag by up to 12 h (the vendor's caveat). Ledgers are cursor-paged; a `cursor` overrides every other parameter.

## Errors, retries and recovery

Every error extends `KlingError` (`requestId` when a response was received):

| Class | When | Fields |
|---|---|---|
| `KlingAPIError` | the vendor answered with a business code | `code`, `httpStatus`, `request { kind, method, path, externalId }`, `taskState`, `isTransient()`, `isRetryable()` |
| `KlingNetworkError` | `fetch` failed | `cause`, `externalId`, `taskState` |
| `KlingTimeoutError` | the per-attempt deadline fired | `deadlineMs`, `attempt`, `attempts`, `externalId`, `taskState` |
| `KlingResponseError` | non-JSON body or an unexpected 3xx | `httpStatus`, `bodySnippet`, `location` |
| `KlingCodecError` | the envelope parsed but not into the expected shape | `standard`, `path` |
| `KlingValidationError` | a parameter failed a rule | `field` |
| `KlingTaskFailedError` / `KlingPollTimeoutError` | `wait()` | `task`, `code` / `task`, `elapsedMs` |
| `KlingTaskNotFoundError` | a single-task lookup the vendor cannot see | `product`, `id`, `byExternalId` |
| `KlingNoOutputsError` / `KlingOutputsExpiredError` / `KlingDownloadError` | `save()` | `task` / `task` / `url`, `reason`, `httpStatus` |
| `KlingBatchError` | a `tasks.get` chunk failed | `tasks`, `missing`, `unattempted`, `cause` |
| `KlingWebhookError` | `parseCallback` with a secret | `reason: 'missing-headers' \| 'bad-signature' \| 'stale-timestamp'` |

`ERROR_CODES` is the vendor's 22-row table (21 codes + success).

**Retry policy.** Reads (`GET /tasks`, `POST /tasks`, `GET /v1/…/{id}`, lists, presets, `/account/*`) are retried with exponential backoff (2 s, 4 s; `retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30_000 }`) on network errors, timeouts, HTTP 429/502/503/504 and business codes `1302 1303 5000 5001 5002`. **Creates and deletes are never re-sent once any HTTP response was received** — a `5002 "internal timeout"` is exactly the case where the task may already exist and a retry would bill twice. They are retried only on a provably pre-request network failure (DNS, connection refused).

**Key your re-submit decision on `taskState`, not `isTransient()`:**

- `'not-created'` — the vendor rejected before enqueueing (any 4xx business code, `1303` concurrency included; a pre-request network failure). Safe to re-submit after a backoff.
- `'may-exist'` — `5000`/`5002`, HTTP 502/503/504, an unparseable response, a timeout, a post-request network error. **Recover before re-submitting.**
- `'n/a'` — the request was a read.

`isTransient()` is the vendor's "try later" signal and says nothing about whether the task exists; `isRetryable()` is always `false` for a create.

**Recovery.** Every create carries an `external_task_id` — yours, or a UUID the library generates (opt out with `externalTaskId: false`). After a `may-exist` failure, `err.externalId` is set; call `client.tasks.recover(product, externalId)`. `null` means *not visible to this account*, not *never created*. The vendor also **rejects a duplicate `external_task_id`** (`400 / 1201 "already exists"`, verified live), so re-submitting with the same id after `may-exist` cannot double-bill either way — but it cannot succeed, so recovery is the only path forward. TTS carries no external id and is unrecoverable.

Concurrency refusals (`1303 "parallel task over resource pack limit"`) surface immediately as `KlingAPIError` with `taskState: 'not-created'` — the library does not queue creates for you.

## Timeouts, proxies and `fetch`

```ts
new KlingClient({
  timeout: 30_000,                       // per attempt; covers connection, body write, headers AND body read
  retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 30_000 },
  fetch: myFetch,                        // injection seam: proxies, tests
  logger: { debug, info, warn, error },  // default: silent
  unknownModels: 'passthrough' | 'reject',
  capabilityValidation: 'error' | 'warn',
  baseUrl: 'https://api-singapore.klingai.com', // https only
});
```

- **Worst-case read time** at defaults: 3 attempts × 30 s + 2 s + 4 s backoff = **96 s**. `KlingTimeoutError` carries `attempt` / `attempts`.
- **Creates with inline media** get a longer deadline automatically: `max(timeout, 30 s + 4 s per MB of body)` — a 20 MB frame is ~27 MB of JSON and gets ≥ 110 s. Raise `timeout` for slower uplinks.
- **Proxies:** Node's `fetch` ignores `HTTP(S)_PROXY`. Inject a proxied fetch — e.g. undici's `fetch` bound to an `EnvHttpProxyAgent` or `ProxyAgent` — via the `fetch` option; `save()` downloads through the same fetch.
- **Redirects:** the API core uses `redirect: 'manual'`; an unexpected 3xx from the API host is a `KlingResponseError { location }`, not a silent follow. Downloads follow at most 5 hops, re-checking each `Location`.
- **URL safety:** every download URL — and every redirect hop — is resolved and refused if any address is private, loopback, link-local, multicast or a cloud-metadata endpoint (IPv4 in all spellings, IPv6 incl. mapped v4); a DNS failure fails closed. This is a **time-of-check** guard: the resolved address is not pinned into the connection.

## Webhooks

```ts
import express from 'express';
import { parseCallback } from 'kling-api';

app.post('/kling/callback', express.raw({ type: 'application/json' }), (req, res) => {
  const { task, verified } = parseCallback(req.body, { headers: req.headers, secret: process.env.KLING_WEBHOOK_SECRET });
  // verified === true here: a bad signature, stale timestamp or missing headers would have thrown KlingWebhookError
  res.sendStatus(200);
});
```

`rawBody` must be the **exact bytes received** — a JSON body parser re-serializes and breaks the signature. The vendor signs with the Standard Webhooks scheme once a Webhook Secret exists (`webhook-id`, `webhook-timestamp`, `webhook-signature` headers; HMAC-SHA256 over `${id}.${timestamp}.${rawBody}`; ±5 min skew; rotation lists supported). Its published test vector passes the library's `verifyWebhookSignature`.

**Without a `secret`, `verified` is `null` and the body is unauthenticated.** Anyone who can reach your endpoint can make `save()` fetch whatever URLs they name. Both callback body shapes (new `id`, legacy `task_id`) parse into the same `Task`.

## CLI

```bash
kling --help
kling video t2v -p "…" [-m kling-3.0-turbo] [-r 720p] [-a 16:9] [-d 3] [--audio off] [--wait] [--no-download] [--with-watermark]
kling video i2v -p "…" --first-frame ./a.png [--last-frame ./b.png] [--element id:alias]… [--voice id:alias]…
kling video omni -p "…" [--first-frame …] [--refer-image …]… [--feature-video URL | --base-video URL] [--element id:alias]…
kling video motion-control --image ./p.png --video URL --character-orientation video
kling image generate -p "…" [-m kling-v3] [-n 1] [-r 1k] [-a 1:1] | omni | multi --subject … | outpaint --image … --up 0.1 | subject-completion --frontal-image …
kling elements create --name … --description … --reference-type image_refer --frontal-image … --refer-image … | get <taskId> | list | presets | delete <elementId> [--kind image]
kling voices create --name … --voice-url URL | get | list | presets | delete <voiceId>
kling avatar create --image … --audio-id … [--mode std|pro]
kling audio tts -t "…" --voice-id oversea_male1 --voice-language en
kling tasks get <ids…> [--by-external-id] | list [--days 1] [--limit] [--cursor] [--status] [--product-type] | get-by-product <product> <id> | list-by-product <product> | recover <product> <externalId>
kling account usage [--days 30] | balance | packages
```

Global flags: `--api-key`, `--output-dir` (default `output`), `--json` (machine output on stdout, logs on stderr), `--debug`, `-q`. Credential chain: `--api-key` → `KLING_API_KEY` → `./.env` → `~/.kling/.env`. File arguments are wrapped as `{ path }`; `https://` arguments pass through. `--wait` polls behind a spinner and saves unless `--no-download`. Errors exit 1 and print the error family's fields and cause chain.

## Model tables

Generated from the library's capability registry (`VIDEO_MODELS`, `IMAGE_MODELS`) by `scripts/render-model-tables.mjs`; a test fails when this block drifts.

<!-- model-tables:start -->
### Video models (new API standard, path-per-model)

| Model | Products | Resolution | Duration | Audio | `multi_shot` field | Prompt cap | Default for |
|---|---|---|---|---|---|---|---|
| `kling-3.0-turbo` | text-to-video, image-to-video | text-to-video: 720p \| 1080p<br>image-to-video: 720p \| 1080p | text-to-video: 3–15 s<br>image-to-video: 3–15 s | text-to-video: —<br>image-to-video: — | no | 3072 | t2v, i2v |
| `kling-3.0` | text-to-video, image-to-video, motion-control | text-to-video: 720p \| 1080p \| 4k<br>image-to-video: 720p \| 1080p \| 4k<br>motion-control: 720p \| 1080p | text-to-video: 3–15 s<br>image-to-video: 3–15 s<br>motion-control: — | text-to-video: native \| off<br>image-to-video: native \| off<br>motion-control: original \| off | yes | 3072 | motion-control |
| `kling-3.0-omni` | omni-video | omni-video: 720p \| 1080p \| 4k | omni-video: 3–15 s | omni-video: native \| original \| off | yes | 3072 | omni |
| `kling-o1` | omni-video | omni-video: 720p \| 1080p | omni-video: 3–10 s | omni-video: original \| off | no | 2500 | — |
| `kling-2.6` | text-to-video, image-to-video, motion-control | text-to-video: 720p \| 1080p<br>image-to-video: 720p \| 1080p<br>motion-control: 720p \| 1080p | text-to-video: 5, 10 s<br>image-to-video: 5, 10 s<br>motion-control: — | text-to-video: native \| off<br>image-to-video: native \| off<br>motion-control: original \| off | no | 2500 | — |
| `kling-2.5-turbo` | text-to-video, image-to-video | text-to-video: 720p \| 1080p<br>image-to-video: 720p \| 1080p | text-to-video: 5, 10 s<br>image-to-video: 5, 10 s | text-to-video: —<br>image-to-video: — | no | 2500 | — |

### Image models (legacy `/v1/` standard, `model_name`)

| Model | Products | Resolution | Aspect ratios | Feature reference (`imageReference` / `humanFidelity`) | Series | Default for |
|---|---|---|---|---|---|---|
| `kling-v3` | image-generation | image-generation: 1k \| 2k | 16:9 \| 9:16 \| 1:1 \| 4:3 \| 3:4 \| 3:2 \| 2:3 \| 21:9 | no | no | generate |
| `kling-v2-1` | image-generation, multi-image-to-image | image-generation: 1k \| 2k | 16:9 \| 9:16 \| 1:1 \| 4:3 \| 3:4 \| 3:2 \| 2:3 \| 21:9 | yes | no | multi (only model) |
| `kling-v3-omni` | omni-image | omni-image: 1k \| 2k \| 4k | 16:9 \| 9:16 \| 1:1 \| 4:3 \| 3:4 \| 3:2 \| 2:3 \| 21:9 \| auto | no | yes | omni |
| `kling-image-o1` | omni-image | omni-image: 1k \| 2k | 16:9 \| 9:16 \| 1:1 \| 4:3 \| 3:4 \| 3:2 \| 2:3 \| 21:9 \| auto | no | no | — |
<!-- model-tables:end -->

Every enum value in the registry is grep-verified against the vendor page its row cites (`docs/api/`).

## Migration from 1.x

The full disposition table is [spec §7](docs/specs/kling-api-2.0-migration-spec-v0_4_3.md#7-migration-table--1x-method--20-disposition). The headline changes:

| 1.x | 2.0 |
|---|---|
| `new KlingAPI({ accessKey, secretKey })` | `new KlingClient({ apiKey })` — `KLING_API_KEY` |
| `textToVideo(p)` → `TaskResponse`; `queryTextToVideoTask(id)` | `video.textToVideo(p)` → `TaskHandle`; `handle.get()` / `handle.wait()` |
| `imageToVideo({ image, image_tail })` | `video.imageToVideo({ firstFrame, lastFrame })` |
| `omniVideo` with `<<<image_1>>>`, `image_list`, `video_list` | `video.omni` with `@image_1`, `referImages`, `featureVideo` / `baseVideo` |
| `extendVideo`, `multiImageToVideo` | removed (no vendor endpoint) — use `video.omni({ referImages })` |
| `generateImage` (`kling-v1`), `omniImage`, `multiImageToImage` (`kling-v2`), `expandImage` | `image.generate` (`kling-v3`), `image.omni` (`kling-v3-omni`), `image.multiImageToImage`, `image.outpaint` |
| `createAvatar`; `waitFor*Result`; `save*Result` | `avatar.create` → handle; `handle.wait()`; `client.save(task, dir)` |
| `getAccountInfo` | `account.usage` (+ `balanceLedger`, `packageLedger`) |
| `result.data.task_result.videos[]`; status `'succeed'` | `task.outputs.filter(o => o.type === 'video')`; status `'succeeded'` |
| string parameter = local file path | `{ path }` / `Buffer`; a bare string is a URL or Base64 |
| `./auth`, `./utils`, `./config`, `./types` subpaths | root import only |
| CLI `--access-key --secret-key --mode --cfg-scale --camera-* --image-tail` | `--api-key`; `-r/--resolution`; `--last-frame` |

Semantics that changed **without a type-signature change**: the `TaskStatus` terminal value (`succeed` → `succeeded`); every default model and the policy behind it; a string media argument (URL/Base64, never a path); `outputsExpireAt` now derived on every succeeded task.

## What has been verified live

Against the production API on 2026-09-20 (the spend is recorded per item in the [migration checklist](docs/specs/kling-api-2.0-migration-checklist.md)):

- `video.textToVideo` on `kling-3.0-turbo` (3 s, 720p): succeeded in 28 s, **2.4 units**, mp4 with an AAC track and no `audio` field sent — native audio is always on.
- `video.omni` first-frame-only on `kling-3.0-omni` (3 s, 720p, silent): 83 s, **1.8 units** — the silent rate.
- `image.generate` on `kling-v3` (n=1, 1k): 24 s, **8 image units**; the vendor's signed URL expiry matched the derived `outputsExpireAt` within 2 s.
- `elements.create` (image_refer, 0 units), delete through **either** path → `deleted`; `voices.create` from a TTS clip (0.05), `audio.tts` (0.05), `avatar.create` (4.4 units, Phase 0).
- `tasks.recover` by external id for `image-generation` and `voice`; a duplicate `external_task_id` rejected with `1201`; `GET /tasks` capped at 20 ids; legacy not-found is `1201 "Task not found by id/external id"`.
- `account.usage` reported the remaining units to the decimal the checklist had tallied.

Every builder is also checked against the vendor's own Request Examples (43 fixtures regenerated from `docs/api/`), and every capability-registry value against the page it cites.

## Known limits

- **Not a queue.** Concurrency is per account, model and pack type; `1303` is returned to you, not absorbed.
- **Callback receiver not included**; `parseCallback` is the parsing/verification half. Whether legacy-path callbacks are signed has not been observed live.
- **Element ids are typed `long` by the vendor** and its examples send numbers; the library sends a safe-integer id as a number and an 18-digit id as a string — acceptance of the string form has not been observed live.
- **URL safety is time-of-check**; DNS rebinding between check and fetch is not defended (would need a pinned undici `connect`).
- Reference-video duration/format bounds are stated on the parameters, not checked client-side.

## License

[MIT](LICENSE)
