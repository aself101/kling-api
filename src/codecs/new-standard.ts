/**
 * New-standard codec — parse half (spec D3, D4; §8 V1, V2).
 *
 * The new standard is every path-per-model video endpoint (`POST /text-to-video/<model>`,
 * …) and the unified task queries (`GET /tasks`, `POST /tasks`). Its envelope is
 * `data.id` / `data.status` (`succeeded`) / `outputs[]` / `billing[]`, and its callback
 * body is the same record without the envelope (`docs/api/kling-get-started-callbacks.md`,
 * "New Callback Function"). The build half is at the bottom of the file (2a₂ onward).
 *
 * Every vendor-spelled field name in this file is read HERE and nowhere else (D3).
 * Source: `docs/api/kling-3.0-turbo-t2v.md` Response Examples (fence lines 109, 172, 356);
 * the fixtures under `test/2.0/fixtures/new/` are those examples.
 */
import type { CommonOptions, ImageToVideoParams, TextToVideoParams } from './params.js';
import type {
  AudioOutput,
  BillingEntry,
  ElementOutput,
  ImageOutput,
  Task,
  TaskOutput,
  VideoOutput,
  VoiceOutput,
} from './task.js';
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

const STANDARD = 'new' as const;

/** Result of `POST /tasks` (cursor query). */
export interface CursorPage {
  tasks: Task[];
  count: number;
  nextCursor?: string;
  hasMore: boolean;
}

// ============================================================================
// Envelope-level parsers
// ============================================================================

/** `POST /<product>/<model>` → the created task (no outputs yet). */
export function parseCreate(json: unknown, ctx?: ParseContext): Task {
  const data = requireObject(envelopeData(json, STANDARD), STANDARD, 'data');
  return parseTaskRecord(data, ctx, 'data');
}

/** `GET /tasks?task_ids=…` → `data[]`. The vendor answers `[]` for unknown ids; the caller computes `missing`. */
export function parseTasks(json: unknown, ctx?: ParseContext): Task[] {
  const data = requireArray(envelopeData(json, STANDARD), STANDARD, 'data');
  return data.map((rec, i) => parseTaskRecord(requireObject(rec, STANDARD, `data[${i}]`), ctx, `data[${i}]`));
}

/** `POST /tasks` → `data.result[]` with cursor fields. */
export function parseCursor(json: unknown, ctx?: ParseContext): CursorPage {
  const data = requireObject(envelopeData(json, STANDARD), STANDARD, 'data');
  const result = requireArray(data.result, STANDARD, 'data.result');
  const tasks = result.map((rec, i) =>
    parseTaskRecord(requireObject(rec, STANDARD, `data.result[${i}]`), ctx, `data.result[${i}]`)
  );
  return {
    tasks,
    count: typeof data.count === 'number' ? data.count : tasks.length,
    nextCursor: optString(data.next_cursor),
    hasMore: data.has_more === true,
  };
}

// ============================================================================
// Record-level parser (shared by the envelope parsers and, in 4a, the webhook)
// ============================================================================

/**
 * One task record — the shape inside `data`, `data[]`, `data.result[]`, and the raw
 * callback body. `raw` is the record itself, not the envelope, so a task parsed from a
 * callback and the same task parsed from `GET /tasks` carry the same `raw`.
 */
export function parseTaskRecord(rec: JsonObject, ctx?: ParseContext, path = 'data'): Task {
  const id = requireString(rec.id, STANDARD, `${path}.id`);
  const status = parseStatus(rec.status, STANDARD, `${path}.status`);
  const updatedAt = optTimestampMs(rec.update_time, `${path}.update_time`, ctx);
  const task: Task = {
    id,
    standard: STANDARD,
    status,
    outputs: Array.isArray(rec.outputs) ? parseOutputs(rec.outputs, `${path}.outputs`, ctx) : [],
    raw: rec,
  };
  if (ctx?.product !== undefined) task.product = ctx.product;
  const message = optString(rec.message);
  if (message !== undefined) task.message = message;
  const externalId = optString(rec.external_id);
  if (externalId !== undefined) task.externalId = externalId;
  const createdAt = optTimestampMs(rec.create_time, `${path}.create_time`, ctx);
  if (createdAt !== undefined) task.createdAt = createdAt;
  if (updatedAt !== undefined) task.updatedAt = updatedAt;
  const expires = outputsExpireAt(status, updatedAt);
  if (expires !== undefined) task.outputsExpireAt = expires;
  if (Array.isArray(rec.billing)) task.billing = parseBilling(rec.billing, `${path}.billing`, ctx);
  return task;
}

// ============================================================================
// Outputs — discriminated on `type`; a malformed entry is dropped with a warning
// ============================================================================

function parseOutputs(list: unknown[], path: string, ctx: ParseContext | undefined): TaskOutput[] {
  const out: TaskOutput[] = [];
  list.forEach((entry, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(entry)) return void ctx?.warn?.(`${p}: not an object — dropped`);
    const parsed = parseOutput(entry, p, ctx);
    if (parsed) out.push(parsed);
  });
  return out;
}

function parseOutput(o: JsonObject, p: string, ctx: ParseContext | undefined): TaskOutput | undefined {
  switch (o.type) {
    case 'video': {
      const id = optString(o.id);
      const url = optString(o.url);
      if (id === undefined || url === undefined) return dropped(p, 'video without id/url', ctx);
      const v: VideoOutput = { type: 'video', id, url };
      const watermarkUrl = optString(o.watermark_url);
      if (watermarkUrl !== undefined) v.watermarkUrl = watermarkUrl;
      const durationSeconds = optSeconds(o.duration);
      if (durationSeconds !== undefined) v.durationSeconds = durationSeconds;
      return v;
    }
    case 'image': {
      const url = optString(o.url);
      if (url === undefined) return dropped(p, 'image without url', ctx);
      const im: ImageOutput = { type: 'image', url };
      const watermarkUrl = optString(o.watermark_url);
      if (watermarkUrl !== undefined) im.watermarkUrl = watermarkUrl;
      const groupId = optString(o.group_id);
      if (groupId !== undefined) im.groupId = groupId;
      return im;
    }
    case 'audio': {
      const id = optString(o.id);
      if (id === undefined) return dropped(p, 'audio without id', ctx);
      const a: AudioOutput = { type: 'audio', id };
      const mp3Url = optString(o.mp3_url);
      if (mp3Url !== undefined) a.mp3Url = mp3Url;
      const wavUrl = optString(o.wav_url);
      if (wavUrl !== undefined) a.wavUrl = wavUrl;
      const mp3 = optSeconds(o.mp3_duration);
      if (mp3 !== undefined) a.mp3DurationSeconds = mp3;
      const wav = optSeconds(o.wav_duration);
      if (wav !== undefined) a.wavDurationSeconds = wav;
      return a;
    }
    case 'voice': {
      const id = optString(o.id);
      const name = optString(o.name);
      if (id === undefined || name === undefined) return dropped(p, 'voice without id/name', ctx);
      const v: VoiceOutput = { type: 'voice', id, name, status: parseResourceStatus(o.status, `${p}.status`, ctx) };
      const url = optString(o.url);
      if (url !== undefined) v.url = url;
      const ownedBy = optString(o.owned_by);
      if (ownedBy !== undefined) v.ownedBy = ownedBy;
      return v;
    }
    case 'element': {
      const id = optString(o.id);
      const name = optString(o.name);
      if (id === undefined || name === undefined) return dropped(p, 'element without id/name', ctx);
      const e: ElementOutput = { type: 'element', id, name, status: parseResourceStatus(o.status, `${p}.status`, ctx), raw: o };
      const description = optString(o.description);
      if (description !== undefined) e.description = description;
      if (o.element_type === 'video_character_elements' || o.element_type === 'multi_image_elements') {
        e.elementType = o.element_type;
      }
      return e;
    }
    default:
      return dropped(p, `unknown output type ${JSON.stringify(o.type)}`, ctx);
  }
}

function dropped(p: string, why: string, ctx: ParseContext | undefined): undefined {
  ctx?.warn?.(`${p}: ${why} — dropped; the vendor entry is in raw`);
  return undefined;
}

// ============================================================================
// Billing — `charge_type` selects which optional fields are meaningful
// ============================================================================

function parseBilling(list: unknown[], path: string, ctx: ParseContext | undefined): BillingEntry[] {
  const out: BillingEntry[] = [];
  list.forEach((entry, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(entry)) return void ctx?.warn?.(`${p}: not an object — dropped`);
    const chargeType = entry.charge_type;
    const amount = optString(entry.amount);
    if ((chargeType !== 'cash' && chargeType !== 'unit') || amount === undefined) {
      return void ctx?.warn?.(`${p}: charge_type ${JSON.stringify(chargeType)} / amount ${JSON.stringify(entry.amount)} — dropped`);
    }
    const b: BillingEntry = { chargeType, amount };
    if (chargeType === 'cash') {
      if (entry.cash_type === 'balance' || entry.cash_type === 'test_balance') b.cashType = entry.cash_type;
      const currency = optString(entry.currency);
      if (currency !== undefined) b.currency = currency;
      const listPrice = optString(entry.list_price);
      if (listPrice !== undefined) b.listPrice = listPrice;
    } else if (entry.package_type === 'video' || entry.package_type === 'image' || entry.package_type === 'audio') {
      b.packageType = entry.package_type;
    }
    out.push(b);
  });
  return out;
}

// ============================================================================
// Build half (spec D3, D6, D9; App. B §2.0–2.1) — landed in 2a₂
// ============================================================================

/** The new-standard request body. `prompt` (t2v) XOR `contents[]` (every other product). */
export interface NewStandardBody {
  prompt?: string;
  contents?: Record<string, unknown>[];
  settings?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

/**
 * The shared `options` block (App. B §2.0). Unset optionals are OMITTED, never `null`.
 * `externalId` is already resolved by the product module (`resolveExternalId`): the
 * caller's value, a UUID, or undefined when opted out.
 */
export function buildOptions(params: CommonOptions, externalId: string | undefined): Record<string, unknown> | undefined {
  const options: Record<string, unknown> = {};
  if (params.callbackUrl !== undefined) options.callback_url = params.callbackUrl;
  if (externalId !== undefined) options.external_task_id = externalId;
  if (params.watermark !== undefined) options.watermark_info = { enabled: params.watermark };
  if (params.extraOptions) Object.assign(options, params.extraOptions);
  return Object.keys(options).length > 0 ? options : undefined;
}

/** `POST /text-to-video/<model>` body (App. B §2.1, §2.3, §2.8, §2.11). Validation has already run. */
export function buildTextToVideo(params: TextToVideoParams, externalId: string | undefined): NewStandardBody {
  const settings: Record<string, unknown> = {};
  if (params.resolution !== undefined) settings.resolution = params.resolution;
  if (params.aspectRatio !== undefined) settings.aspect_ratio = params.aspectRatio;
  if (params.duration !== undefined) settings.duration = params.duration;
  if (params.audio !== undefined) settings.audio = params.audio;
  if (params.multiShot !== undefined) settings.multi_shot = params.multiShot;
  if (params.extraSettings) Object.assign(settings, params.extraSettings);
  const body: NewStandardBody = { prompt: params.prompt };
  if (Object.keys(settings).length > 0) body.settings = settings;
  const options = buildOptions(params, externalId);
  if (options) body.options = options;
  return body;
}

/** Media already resolved by the product module (`media/source.ts`) — a URL or a Base64 string, either way sent in `url`. */
export interface ResolvedMediaFields {
  firstFrame: string;
  lastFrame?: string;
}

/**
 * `POST /image-to-video/<model>` body (App. B §2.2, §2.4, §2.9, §2.12): `contents[]` from
 * the named fields in vendor order — prompt, first_frame, last_frame, element*, voice*,
 * then `extraContents` — and `settings` without `aspect_ratio` (the frame sets it).
 * `@name` references in the prompt that match no content `id` produce a WARNING through
 * `warn`, not an error (D6; the vendor's guidance is advisory).
 */
export function buildImageToVideo(params: ImageToVideoParams, media: ResolvedMediaFields, externalId: string | undefined, warn?: (m: string) => void): NewStandardBody {
  const contents: Record<string, unknown>[] = [{ type: 'prompt', text: params.prompt }, { type: 'first_frame', url: media.firstFrame }];
  if (media.lastFrame !== undefined) contents.push({ type: 'last_frame', url: media.lastFrame });
  const ids: string[] = [];
  params.elements?.forEach((e, i) => {
    const id = e.id ?? `element_${i + 1}`;
    ids.push(id);
    contents.push({ type: 'element', element_id: e.elementId, id });
  });
  params.voices?.forEach((v, i) => {
    const id = v.id ?? `voice_${i + 1}`;
    ids.push(id);
    contents.push({ type: 'voice', voice_id: v.voiceId, id });
  });
  if (params.extraContents) contents.push(...params.extraContents);
  warnUnresolvedReferences(params.prompt, ids, warn);

  const settings: Record<string, unknown> = {};
  if (params.resolution !== undefined) settings.resolution = params.resolution;
  if (params.duration !== undefined) settings.duration = params.duration;
  if (params.audio !== undefined) settings.audio = params.audio;
  if (params.multiShot !== undefined) settings.multi_shot = params.multiShot;
  if (params.extraSettings) Object.assign(settings, params.extraSettings);
  const body: NewStandardBody = { contents };
  if (Object.keys(settings).length > 0) body.settings = settings;
  const options = buildOptions(params, externalId);
  if (options) body.options = options;
  return body;
}

/** Every `@name` in the prompt should name a content `id` (App. B §2.4 "@Zhang", §2.9 "@1"). Advisory. */
export function warnUnresolvedReferences(prompt: string, ids: string[], warn?: (m: string) => void): void {
  if (!warn) return;
  const known = new Set(ids);
  const seen = new Set<string>();
  for (const m of prompt.matchAll(/@([\p{L}\p{N}_-]+)/gu)) {
    const name = m[1];
    if (known.has(name) || seen.has(name)) continue;
    seen.add(name);
    warn(`prompt references @${name} but no contents[] entry has id "${name}"${ids.length > 0 ? ` (ids: ${ids.join(', ')})` : ''} — the vendor will not resolve it`);
  }
}
