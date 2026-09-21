/**
 * Legacy codec — parse half (spec D3, D4, D7, D8; §8 V1, V2).
 *
 * The legacy standard is every `/v1/...` endpoint: all image generation (including the
 * current `kling-v3` / `kling-v3-omni` models), the avatar, element, voice and audio
 * resources. Its envelope is `data.task_id` / `data.task_status` (`succeed`) /
 * `task_result.{videos,images,audios,elements,voices}[]`, with deductions as two flat
 * fields instead of a `billing[]` array. Its callback body is the record without the
 * envelope (`docs/api/kling-get-started-callbacks.md`, "Legacy Callback Function"). The
 * build half is at the bottom of the file (3a/3b).
 *
 * Every vendor-spelled field name in this file is read HERE and nowhere else (D3).
 * Sources, all `docs/api/`: `kling-image-2.1-generation.md` (create/query/list),
 * `kling-image-omni-3.0-image-omni.md` (`series_images[]`),
 * `kling-image-common-subject-completion.md` (`images[].url_1..3`), `kling-avatar.md`,
 * `kling-text-to-speech.md` (`audios[].url`), `kling-text-to-audio.md` (`audios[].url_mp3`),
 * `kling-omni-3.0-element-mgt.md`, `kling-omni-3.0-voice-mgt.md`. The fixtures under
 * `test/2.0/fixtures/legacy/` are those examples.
 */
import type {
  AvatarCreateParams,
  CommonOptions,
  ElementCreateParams,
  ImageGenerateParams,
  MultiImageToImageParams,
  OmniImageParams,
  OutpaintParams,
  SubjectCompletionParams,
  TtsParams,
  VoiceCreateParams,
} from './params.js';
import type { AudioOutput, BillingEntry, ElementOutput, ImageOutput, Task, TaskOutput, VideoOutput, VoiceOutput } from './task.js';
import {
  envelopeData,
  isObject,
  optSeconds,
  optString,
  optTimestampMs,
  outputsExpireAt,
  parseResourceStatus,
  parseStatus,
  requireArray,
  requireObject,
  requireString,
  type JsonObject,
  type ParseContext,
} from './shared.js';

const STANDARD = 'legacy' as const;

/**
 * Marker `groupId` for omni-image `series_images[]` — the vendor returns the primary
 * `images[]` and a second, ordered series in one result; the union has no slot for
 * "which list", so the series carries this constant and the primaries carry none.
 */
export const SERIES_GROUP_ID = 'series';

// ============================================================================
// Envelope-level parsers
// ============================================================================

/** `POST /v1/<product>` → the created task (no `task_result` yet). */
export function parseCreate(json: unknown, ctx?: ParseContext): Task {
  const data = requireObject(envelopeData(json, STANDARD), STANDARD, 'data');
  return parseTaskRecord(data, ctx, 'data');
}

/** `GET /v1/<product>/{id}` → one task with `task_result`. */
export function parseTask(json: unknown, ctx?: ParseContext): Task {
  return parseCreate(json, ctx);
}

/** `GET /v1/<product>?pageNum&pageSize` → `data[]`. */
export function parseList(json: unknown, ctx?: ParseContext): Task[] {
  const data = requireArray(envelopeData(json, STANDARD), STANDARD, 'data');
  return data.map((rec, i) => parseTaskRecord(requireObject(rec, STANDARD, `data[${i}]`), ctx, `data[${i}]`));
}

// ============================================================================
// Record-level parser (shared by the envelope parsers and, in 4a, the webhook)
// ============================================================================

export function parseTaskRecord(rec: JsonObject, ctx?: ParseContext, path = 'data'): Task {
  const id = requireString(rec.task_id, STANDARD, `${path}.task_id`);
  const status = parseStatus(rec.task_status, STANDARD, `${path}.task_status`);
  const updatedAt = optTimestampMs(rec.updated_at, `${path}.updated_at`, ctx);
  const task: Task = {
    id,
    standard: STANDARD,
    status,
    outputs: isObject(rec.task_result) ? parseTaskResult(rec.task_result, `${path}.task_result`, ctx) : [],
    raw: rec,
  };
  if (ctx?.product !== undefined) task.product = ctx.product;
  const message = optString(rec.task_status_msg);
  if (message !== undefined) task.message = message;
  const externalId = isObject(rec.task_info) ? optString(rec.task_info.external_task_id) : undefined;
  if (externalId !== undefined) task.externalId = externalId;
  const createdAt = optTimestampMs(rec.created_at, `${path}.created_at`, ctx);
  if (createdAt !== undefined) task.createdAt = createdAt;
  if (updatedAt !== undefined) task.updatedAt = updatedAt;
  const expires = outputsExpireAt(status, updatedAt);
  if (expires !== undefined) task.outputsExpireAt = expires;
  const billing = parseDeductions(rec);
  if (billing.length > 0) task.billing = billing;
  return task;
}

// ============================================================================
// task_result — five named lists, each its own output type
// ============================================================================

function parseTaskResult(tr: JsonObject, path: string, ctx: ParseContext | undefined): TaskOutput[] {
  const out: TaskOutput[] = [];
  const each = (key: string, fn: (o: JsonObject, p: string) => TaskOutput[] | TaskOutput | undefined): void => {
    const list = tr[key];
    if (list === undefined) return;
    if (!Array.isArray(list)) return void ctx?.warn?.(`${path}.${key}: not an array — dropped`);
    list.forEach((entry, i) => {
      const p = `${path}.${key}[${i}]`;
      if (!isObject(entry)) return void ctx?.warn?.(`${p}: not an object — dropped`);
      const r = fn(entry, p);
      if (Array.isArray(r)) out.push(...r);
      else if (r) out.push(r);
    });
  };

  each('videos', (o, p) => {
    const id = optString(o.id);
    const url = optString(o.url);
    if (id === undefined || url === undefined) return dropped(p, 'video without id/url', ctx);
    const v: VideoOutput = { type: 'video', id, url };
    const watermarkUrl = optString(o.watermark_url);
    if (watermarkUrl !== undefined) v.watermarkUrl = watermarkUrl;
    const durationSeconds = optSeconds(o.duration);
    if (durationSeconds !== undefined) v.durationSeconds = durationSeconds;
    return v;
  });

  // `images[]` comes in two shapes: `{ index, url, watermark_url }` (generation, omni,
  // multi-image, outpainting) and `{ index, url_1, url_2, url_3 }` (subject completion —
  // three candidates per subject). The second fans out to three `image` outputs sharing
  // `groupId = String(index)`.
  each('images', (o, p) => {
    const index = typeof o.index === 'number' ? o.index : undefined;
    const url = optString(o.url);
    if (url !== undefined) return image(url, o.watermark_url, index, undefined);
    const fan: ImageOutput[] = [];
    for (const k of ['url_1', 'url_2', 'url_3'] as const) {
      const u = optString(o[k]);
      if (u !== undefined) fan.push(image(u, undefined, index, index === undefined ? undefined : String(index)));
    }
    return fan.length > 0 ? fan : dropped(p, 'image without url/url_1..3', ctx);
  });

  each('series_images', (o, p) => {
    const url = optString(o.url);
    if (url === undefined) return dropped(p, 'series image without url', ctx);
    return image(url, o.watermark_url, typeof o.index === 'number' ? o.index : undefined, SERIES_GROUP_ID);
  });

  // TTS returns `{ id, url, duration }` (the sample URL is an .mp3); text-/video-to-audio
  // return `{ id, url_mp3, url_wav, duration_mp3, duration_wav }`. Both land on the mp3/wav
  // fields; the plain `url` is read as the mp3 rendition.
  each('audios', (o, p) => {
    const id = optString(o.id);
    if (id === undefined) return dropped(p, 'audio without id', ctx);
    const a: AudioOutput = { type: 'audio', id };
    const mp3Url = optString(o.url_mp3) ?? optString(o.url);
    if (mp3Url !== undefined) a.mp3Url = mp3Url;
    const wavUrl = optString(o.url_wav);
    if (wavUrl !== undefined) a.wavUrl = wavUrl;
    const mp3 = optSeconds(o.duration_mp3) ?? optSeconds(o.duration);
    if (mp3 !== undefined) a.mp3DurationSeconds = mp3;
    const wav = optSeconds(o.duration_wav);
    if (wav !== undefined) a.wavDurationSeconds = wav;
    return a;
  });

  // Legacy elements carry `element_id` (a NUMBER in the docs), `element_name`,
  // `element_description`, `reference_type` — a different vocabulary from the new
  // standard's `element_type`, so `elementType` is left unset and the record is in `raw`.
  each('elements', (o, p) => {
    const rawId = o.element_id;
    const id = typeof rawId === 'number' ? String(rawId) : optString(rawId);
    const name = optString(o.element_name);
    if (id === undefined || name === undefined) return dropped(p, 'element without element_id/element_name', ctx);
    const e: ElementOutput = { type: 'element', id, name, status: parseResourceStatus(o.status, `${p}.status`, ctx), raw: o };
    const description = optString(o.element_description);
    if (description !== undefined) e.description = description;
    return e;
  });

  // Legacy voices have no status field: a listed voice exists, so `succeeded`.
  each('voices', (o, p) => {
    const id = optString(o.voice_id);
    const name = optString(o.voice_name);
    if (id === undefined || name === undefined) return dropped(p, 'voice without voice_id/voice_name', ctx);
    const v: VoiceOutput = { type: 'voice', id, name, status: 'succeeded' };
    const url = optString(o.trial_url);
    if (url !== undefined) v.url = url;
    const ownedBy = optString(o.owned_by);
    if (ownedBy !== undefined) v.ownedBy = ownedBy;
    return v;
  });

  return out;
}

function image(url: string, watermark: unknown, index: number | undefined, groupId: string | undefined): ImageOutput {
  const im: ImageOutput = { type: 'image', url };
  const watermarkUrl = optString(watermark);
  if (watermarkUrl !== undefined) im.watermarkUrl = watermarkUrl;
  if (index !== undefined) im.index = index;
  if (groupId !== undefined) im.groupId = groupId;
  return im;
}

function dropped(p: string, why: string, ctx: ParseContext | undefined): undefined {
  ctx?.warn?.(`${p}: ${why} — dropped; the vendor entry is in raw`);
  return undefined;
}

// ============================================================================
// Deductions → BillingEntry[] (spec D4: "legacy deductions mapped when present")
// ============================================================================

/**
 * `final_unit_deduction` (units, a decimal string) → one `unit` entry;
 * `final_balance_deduction.{quota,list_price}` (cash) → one `cash` entry. The legacy
 * shape names neither currency nor package type, so those stay unset.
 */
function parseDeductions(rec: JsonObject): BillingEntry[] {
  const out: BillingEntry[] = [];
  const units = optString(rec.final_unit_deduction);
  if (units !== undefined) out.push({ chargeType: 'unit', amount: units });
  if (isObject(rec.final_balance_deduction)) {
    const quota = optString(rec.final_balance_deduction.quota);
    if (quota !== undefined) {
      const cash: BillingEntry = { chargeType: 'cash', amount: quota };
      const listPrice = optString(rec.final_balance_deduction.list_price);
      if (listPrice !== undefined) cash.listPrice = listPrice;
      out.push(cash);
    }
  }
  return out;
}

// ============================================================================
// Build half (spec D3, D7; App. B §4.2; spec §2.3) — landed in 3a/3b
// ============================================================================

/** Legacy bodies are flat: every field at the top level, `model_name` selects the model. */
export type LegacyBody = Record<string, unknown>;

/** Shared tail of every legacy create: `watermark_info?`, `callback_url?`, `external_task_id?` (only when set — TTS has none). */
function commonFields(params: CommonOptions, externalId: string | undefined): LegacyBody {
  const out: LegacyBody = {};
  if (params.watermark !== undefined) out.watermark_info = { enabled: params.watermark };
  if (params.callbackUrl !== undefined) out.callback_url = params.callbackUrl;
  if (externalId !== undefined) out.external_task_id = externalId;
  return out;
}

/**
 * `element_list[].element_id` is typed `long` by the vendor and its examples send numbers.
 * The library takes strings (an 18-digit id is not exactly representable as a JS number)
 * and sends a NUMBER when the string is a safe integer, else the string as-is [VERIFY
 * live, Phase 7: whether the vendor accepts a string for an unsafe id].
 */
export function legacyElementId(id: string): number | string {
  return /^\d{1,15}$/.test(id) && Number.isSafeInteger(Number(id)) ? Number(id) : id;
}

/** `POST /v1/images/generations` (kling-image-2.1-generation.md). `image` is already resolved (URL or Base64). */
export function buildImageGeneration(params: ImageGenerateParams, model: string, image: string | undefined, externalId: string | undefined): LegacyBody {
  const body: LegacyBody = { model_name: model, prompt: params.prompt };
  if (params.negativePrompt !== undefined) body.negative_prompt = params.negativePrompt;
  if (image !== undefined) body.image = image;
  if (params.imageReference !== undefined) body.image_reference = params.imageReference;
  if (params.imageFidelity !== undefined) body.image_fidelity = params.imageFidelity;
  if (params.humanFidelity !== undefined) body.human_fidelity = params.humanFidelity;
  if (params.elements !== undefined) body.element_list = params.elements.map((e) => ({ element_id: legacyElementId(e.elementId) }));
  if (params.resolution !== undefined) body.resolution = params.resolution;
  if (params.n !== undefined) body.n = params.n;
  if (params.aspectRatio !== undefined) body.aspect_ratio = params.aspectRatio;
  Object.assign(body, commonFields(params, externalId), params.extraSettings);
  return body;
}

/** `POST /v1/images/omni-image` (kling-image-omni-3.0-image-omni.md, kling-image-o1-generation.md). */
export function buildOmniImage(params: OmniImageParams, model: string, images: string[] | undefined, externalId: string | undefined): LegacyBody {
  const body: LegacyBody = { model_name: model, prompt: params.prompt };
  if (images !== undefined) body.image_list = images.map((image) => ({ image }));
  if (params.elements !== undefined) body.element_list = params.elements.map((e) => ({ element_id: legacyElementId(e.elementId) }));
  if (params.resolution !== undefined) body.resolution = params.resolution;
  if (params.resultType !== undefined) body.result_type = params.resultType;
  if (params.seriesAmount !== undefined) body.series_amount = params.seriesAmount;
  if (params.n !== undefined) body.n = params.n;
  if (params.aspectRatio !== undefined) body.aspect_ratio = params.aspectRatio;
  Object.assign(body, commonFields(params, externalId), params.extraSettings);
  return body;
}

/** `POST /v1/images/multi-image2image` (kling-image-2.1-multi-image-to-image.md). Model fixed to kling-v2-1 by the caller. */
export function buildMultiImageToImage(
  params: MultiImageToImageParams,
  model: string,
  media: { subjectImages: string[]; sceneImage?: string; styleImage?: string },
  externalId: string | undefined
): LegacyBody {
  const body: LegacyBody = { model_name: model };
  if (params.prompt !== undefined) body.prompt = params.prompt;
  if (params.negativePrompt !== undefined) body.negative_prompt = params.negativePrompt;
  body.subject_image_list = media.subjectImages.map((subject_image) => ({ subject_image }));
  if (media.sceneImage !== undefined) body.scene_image = media.sceneImage;
  if (media.styleImage !== undefined) body.style_image = media.styleImage;
  if (params.n !== undefined) body.n = params.n;
  if (params.aspectRatio !== undefined) body.aspect_ratio = params.aspectRatio;
  Object.assign(body, commonFields(params, externalId), params.extraSettings);
  return body;
}

/** `POST /v1/images/editing/expand` (kling-image-common-outpainting.md). */
export function buildOutpaint(params: OutpaintParams, image: string, externalId: string | undefined): LegacyBody {
  const body: LegacyBody = {
    image,
    up_expansion_ratio: params.up,
    down_expansion_ratio: params.down,
    left_expansion_ratio: params.left,
    right_expansion_ratio: params.right,
  };
  if (params.prompt !== undefined) body.prompt = params.prompt;
  if (params.n !== undefined) body.n = params.n;
  Object.assign(body, commonFields(params, externalId), params.extraSettings);
  return body;
}

/** `POST /v1/general/ai-multi-shot` (kling-image-common-subject-completion.md). */
export function buildSubjectCompletion(params: SubjectCompletionParams, frontalImage: string, externalId: string | undefined): LegacyBody {
  return { element_frontal_image: frontalImage, ...commonFields(params, externalId) };
}

// ── resources (4a/4b) ─────────────────────────────────────────────────────────────────

/** `POST /v1/general/advanced-custom-elements` (kling-omni-3.0-element-mgt.md; live-verified body shape, Phase 0). */
export function buildElementCreate(
  params: ElementCreateParams,
  media: { frontalImage?: string; referImages?: string[]; referVideos?: string[] },
  externalId: string | undefined
): LegacyBody {
  const body: LegacyBody = { element_name: params.name, element_description: params.description, reference_type: params.referenceType };
  if (media.frontalImage !== undefined || media.referImages !== undefined) {
    const list: LegacyBody = {};
    if (media.frontalImage !== undefined) list.frontal_image = media.frontalImage;
    if (media.referImages !== undefined) list.refer_images = media.referImages.map((image_url) => ({ image_url }));
    body.element_image_list = list;
  }
  if (media.referVideos !== undefined) body.element_video_list = { refer_videos: media.referVideos.map((video_url) => ({ video_url })) };
  if (params.voiceId !== undefined) body.element_voice_id = params.voiceId;
  if (params.tags !== undefined) body.tag_list = params.tags.map((tag_id) => ({ tag_id }));
  Object.assign(body, commonFields(params, externalId));
  return body;
}

/** `POST /v1/general/custom-voices` (kling-omni-3.0-voice-mgt.md; live-verified, Phase 0). */
export function buildVoiceCreate(params: VoiceCreateParams, externalId: string | undefined): LegacyBody {
  const body: LegacyBody = { voice_name: params.name };
  if (params.voiceUrl !== undefined) body.voice_url = params.voiceUrl;
  if (params.videoId !== undefined) body.video_id = params.videoId;
  Object.assign(body, commonFields(params, externalId));
  return body;
}

/** `POST /v1/videos/avatar/image2video` (kling-avatar.md; live-verified with audio_id, Phase 0). */
export function buildAvatarCreate(params: AvatarCreateParams, media: { image: string; soundFile?: string }, externalId: string | undefined): LegacyBody {
  const body: LegacyBody = { image: media.image };
  if (params.audioId !== undefined) body.audio_id = params.audioId;
  if (media.soundFile !== undefined) body.sound_file = media.soundFile;
  if (params.prompt !== undefined) body.prompt = params.prompt;
  if (params.mode !== undefined) body.mode = params.mode;
  Object.assign(body, commonFields(params, externalId));
  return body;
}

/** `POST /v1/audio/tts` (kling-text-to-speech.md; live-verified, Phase 0). No callback / external id fields exist. */
export function buildTts(params: TtsParams): LegacyBody {
  const body: LegacyBody = { text: params.text, voice_id: params.voiceId, voice_language: params.voiceLanguage };
  if (params.voiceSpeed !== undefined) body.voice_speed = params.voiceSpeed;
  return body;
}
