/**
 * Video parameter rules (spec D6, D9; App. B §2). One function per product, taking
 * `(params, caps, policy)`; every rule cites its `docs/api/` line and carries its class.
 * `caps` is undefined for an unknown model → shape rules only.
 */
import { MODELED_OPTIONS, MODELED_SETTINGS } from '../constants.js';
import type { ImageToVideoParams, MotionControlParams, OmniVideoParams, TextToVideoParams } from '../../codecs/params.js';
import type { VideoModelCaps } from '../models.js';
import { capability, isInteger, rejectModeledExtras, shape, type ValidationPolicy } from './helpers.js';

/** The loosest documented prompt cap — what an unknown model is held to (it should not be stricter than the newest known model). */
const MAX_PROMPT_UNKNOWN_MODEL = 3072;

const AUDIO_MODES = new Set(['native', 'original', 'off']);
const T2V_ASPECT_RATIOS = new Set(['16:9', '9:16', '1:1']);

export function validateTextToVideo(params: TextToVideoParams, caps: VideoModelCaps | undefined, policy: ValidationPolicy): void {
  const product = 'text-to-video';
  const model = params.model ?? caps?.id ?? '(unknown)';

  // [shape] prompt — required; ≤ 3072 on 3.0-era models, ≤ 2500 on 2.x (kling-3.0-turbo-t2v.md
  // "cannot exceed 3072 characters"; kling-2.6-t2v.md "max 2500").
  shape(typeof params.prompt === 'string' && params.prompt.trim().length > 0, 'prompt', 'prompt is required and must be a non-empty string');
  const maxPrompt = caps?.maxPromptLength ?? MAX_PROMPT_UNKNOWN_MODEL;
  shape(params.prompt.length <= maxPrompt, 'prompt', `prompt is ${params.prompt.length} characters; ${model} allows at most ${maxPrompt}`);

  // [shape] types of the optional settings.
  shape(params.duration === undefined || isInteger(params.duration), 'duration', 'duration must be an integer number of seconds');
  shape(params.resolution === undefined || typeof params.resolution === 'string', 'resolution', 'resolution must be a string');
  shape(params.aspectRatio === undefined || typeof params.aspectRatio === 'string', 'aspectRatio', 'aspectRatio must be a string');
  shape(params.audio === undefined || AUDIO_MODES.has(params.audio), 'audio', "audio must be 'native', 'original' or 'off'");
  shape(params.multiShot === undefined || typeof params.multiShot === 'boolean', 'multiShot', 'multiShot must be a boolean');
  shape(params.callbackUrl === undefined || /^https?:\/\//.test(params.callbackUrl), 'callbackUrl', 'callbackUrl must be an http(s) URL');
  rejectModeledExtras(params.extraSettings, MODELED_SETTINGS, 'extraSettings');
  rejectModeledExtras(params.extraOptions, MODELED_OPTIONS, 'extraOptions');

  if (!caps) return; // unknown model: shape only (D9)

  // [capability] the model has a t2v endpoint (App. B §1).
  capability(caps.products.includes(product), 'model', `${model} has no /text-to-video endpoint (products: ${caps.products.join(', ')})`, policy);

  // [capability] resolution ∈ the model's t2v set (§2.1: 720p|1080p; §2.3 adds 4k).
  const resolutions = caps.resolutions[product] ?? [];
  if (params.resolution !== undefined) {
    capability(resolutions.includes(params.resolution), 'resolution', `${model} text-to-video accepts resolution ${resolutions.join(' | ')}, not ${params.resolution}`, policy);
  }

  // [capability] aspect ratio — 16:9 | 9:16 | 1:1 on every t2v endpoint.
  if (params.aspectRatio !== undefined) {
    capability(T2V_ASPECT_RATIOS.has(params.aspectRatio), 'aspectRatio', `aspectRatio must be 16:9, 9:16 or 1:1, not ${params.aspectRatio}`, policy);
  }

  // [capability] duration ∈ the model's set (3–15 on 3.0-era, 5|10 on 2.x).
  const durations = caps.durations[product];
  if (params.duration !== undefined && durations) {
    capability(durations.includes(params.duration), 'duration', `${model} text-to-video accepts duration ${describeSet(durations)} s, not ${params.duration}`, policy);
  }

  // [capability] audio — only where the model has the field. 3.0-turbo has none: native
  // audio is always on (inferred from kling-pricing-video.md, §11 Q3).
  const audio = caps.audio[product];
  if (params.audio !== undefined) {
    if (!audio) {
      const why =
        caps.id === 'kling-3.0-turbo'
          ? "native audio is always on for kling-3.0-turbo (inferred from pricing; pass capabilityValidation: 'warn' to send anyway)"
          : `${model} text-to-video has no audio setting`;
      capability(false, 'audio', why, policy);
    } else {
      const ok = capability(audio.includes(params.audio), 'audio', `${model} text-to-video accepts audio ${audio.join(' | ')}, not ${params.audio}`, policy);
      // [capability] kling-2.6: "When generating videos with native audio, only 1080P
      // resolution is supported." (kling-2.6-t2v.md, under both audio and resolution).
      if (ok && caps.id === 'kling-2.6' && params.audio === 'native') {
        capability(params.resolution === undefined || params.resolution === '1080p', 'resolution', 'kling-2.6 with audio: native supports only 1080p', policy);
      }
    }
  }

  // [capability] multi_shot field exists only on 3.0 / 3.0-omni (§2.3); 3.0-turbo drives
  // multi-shot through the prompt syntax and has no field (§2.1).
  if (params.multiShot !== undefined) {
    capability(caps.multiShotSetting, 'multiShot', `${model} has no multi_shot setting${caps.id === 'kling-3.0-turbo' ? ' — multi-shot on kling-3.0-turbo is driven by the "shot n, m, words;" prompt syntax' : ''}`, policy);
  }
}

function describeSet(values: number[]): string {
  const sorted = [...values].sort((a, b) => a - b);
  const contiguous = sorted.every((v, i) => i === 0 || v === (sorted[i - 1] ?? NaN) + 1);
  return contiguous && sorted.length > 2 ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(' | ');
}

const MAX_I2V_ELEMENTS = 3; // kling-omni-3.0-i2v.md "Up to 3 Elements can be specified."
const MAX_I2V_VOICES = 2; // kling-2.6-i2v.md "At most 2 voices can be referenced."

export function validateImageToVideo(params: ImageToVideoParams, caps: VideoModelCaps | undefined, policy: ValidationPolicy): void {
  const product = 'image-to-video';
  const model = params.model ?? caps?.id ?? '(unknown)';

  // [shape] prompt — required in the `prompt` content object on every i2v endpoint.
  shape(typeof params.prompt === 'string' && params.prompt.trim().length > 0, 'prompt', 'prompt is required and must be a non-empty string');
  const maxPrompt = caps?.maxPromptLength ?? MAX_PROMPT_UNKNOWN_MODEL;
  shape(params.prompt.length <= maxPrompt, 'prompt', `prompt is ${params.prompt.length} characters; ${model} allows at most ${maxPrompt}`);

  // [shape] firstFrame required; last-frame-only is unsupported on every endpoint (§2.2, §2.4, §2.9, §2.12).
  shape(params.firstFrame !== undefined && params.firstFrame !== null, 'firstFrame', 'firstFrame is required (last-frame-only generation is not supported by any model)');

  // [shape] array bounds — the vendor's hard limits, independent of model.
  shape(params.elements === undefined || (Array.isArray(params.elements) && params.elements.length <= MAX_I2V_ELEMENTS), 'elements', `elements: at most ${MAX_I2V_ELEMENTS} (kling-omni-3.0-i2v.md)`);
  shape(params.voices === undefined || (Array.isArray(params.voices) && params.voices.length <= MAX_I2V_VOICES), 'voices', `voices: at most ${MAX_I2V_VOICES} (kling-2.6-i2v.md)`);
  params.elements?.forEach((e, i) => shape(typeof e.elementId === 'string' && e.elementId.length > 0, `elements[${i}].elementId`, `elements[${i}].elementId is required`));
  params.voices?.forEach((v, i) => shape(typeof v.voiceId === 'string' && v.voiceId.length > 0, `voices[${i}].voiceId`, `voices[${i}].voiceId is required`));
  const ids = [...(params.elements ?? []).map((e) => e.id), ...(params.voices ?? []).map((v) => v.id)].filter((id): id is string => id !== undefined);
  shape(new Set(ids).size === ids.length, 'elements', 'content ids must be unique across elements and voices ("must not be duplicated")');

  // [shape] common types.
  shape(params.duration === undefined || isInteger(params.duration), 'duration', 'duration must be an integer number of seconds');
  shape(params.audio === undefined || AUDIO_MODES.has(params.audio), 'audio', "audio must be 'native', 'original' or 'off'");
  shape(params.multiShot === undefined || typeof params.multiShot === 'boolean', 'multiShot', 'multiShot must be a boolean');
  shape(params.callbackUrl === undefined || /^https?:\/\//.test(params.callbackUrl), 'callbackUrl', 'callbackUrl must be an http(s) URL');
  rejectModeledExtras(params.extraSettings, MODELED_SETTINGS, 'extraSettings');
  rejectModeledExtras(params.extraOptions, MODELED_OPTIONS, 'extraOptions');
  shape(!('aspectRatio' in params) || (params as { aspectRatio?: unknown }).aspectRatio === undefined, 'aspectRatio', 'image-to-video has no aspect_ratio setting — the first frame sets it');

  if (!caps) return; // unknown model: shape only (D9)

  capability(caps.products.includes(product), 'model', `${model} has no /image-to-video endpoint (products: ${caps.products.join(', ')})`, policy);

  const resolutions = caps.resolutions[product] ?? [];
  if (params.resolution !== undefined) {
    capability(resolutions.includes(params.resolution), 'resolution', `${model} image-to-video accepts resolution ${resolutions.join(' | ')}, not ${params.resolution}`, policy);
  }
  const durations = caps.durations[product];
  if (params.duration !== undefined && durations) {
    capability(durations.includes(params.duration), 'duration', `${model} image-to-video accepts duration ${describeSet(durations)} s, not ${params.duration}`, policy);
  }

  const types = new Set(caps.contentTypes[product] ?? []);
  // [capability] lastFrame — 3.0-turbo: "Currently, only First Frame is supported" (§2.2);
  // 2.6 / 2.5-turbo: "first and last frames … only 1080p" (§2.9, §2.12).
  if (params.lastFrame !== undefined) {
    const ok = capability(types.has('last_frame'), 'lastFrame', `${model} image-to-video supports the first frame only (no last_frame content)`, policy);
    if (ok && (caps.id === 'kling-2.6' || caps.id === 'kling-2.5-turbo')) {
      capability(params.resolution === undefined || params.resolution === '1080p', 'resolution', `${model} with first + last frame supports only 1080p`, policy);
    }
  }
  // [capability] elements — 3.0 only (§2.4).
  if (params.elements !== undefined && params.elements.length > 0) {
    capability(types.has('element'), 'elements', `${model} image-to-video does not take element contents (kling-3.0 does)`, policy);
  }
  // [capability] voices — 2.6 only, and "the sound parameter audio cannot be off" (§2.9).
  if (params.voices !== undefined && params.voices.length > 0) {
    const ok = capability(types.has('voice'), 'voices', `${model} image-to-video does not take voice contents (kling-2.6 does)`, policy);
    if (ok) capability(params.audio !== 'off', 'audio', 'voices require audio to be native (the vendor: "audio cannot be off" when a voice is specified)', policy);
  }
  // [capability] audio / multiShot — same as t2v.
  const audio = caps.audio[product];
  if (params.audio !== undefined) {
    if (!audio) {
      capability(false, 'audio', caps.id === 'kling-3.0-turbo' ? "native audio is always on for kling-3.0-turbo (inferred from pricing; pass capabilityValidation: 'warn' to send anyway)" : `${model} image-to-video has no audio setting`, policy);
    } else {
      const ok = capability(audio.includes(params.audio), 'audio', `${model} image-to-video accepts audio ${audio.join(' | ')}, not ${params.audio}`, policy);
      if (ok && caps.id === 'kling-2.6' && params.audio === 'native') {
        capability(params.resolution === undefined || params.resolution === '1080p', 'resolution', 'kling-2.6 with audio: native supports only 1080p', policy);
      }
    }
  }
  if (params.multiShot !== undefined) {
    capability(caps.multiShotSetting, 'multiShot', `${model} has no multi_shot setting${caps.id === 'kling-3.0-turbo' ? ' — multi-shot on kling-3.0-turbo is driven by the "shot n, m, words;" prompt syntax' : ''}`, policy);
  }
}

// ── omni-video (App. B §2.5 kling-3.0-omni, §2.7 kling-o1) ──────────────────────────

/** Kind-independent envelopes: reference images + elements, without / with a reference video (§2.5, §2.7 — every matrix cell sums to these or less). */
const OMNI_REFS_MAX_NO_VIDEO = 7;
const OMNI_REFS_MAX_WITH_VIDEO = 4;
/** With frames (first or first+last) on 3.0-omni: "max 3 elements". */
const OMNI_ELEMENTS_MAX_WITH_FRAMES = 3;

export function validateOmniVideo(params: OmniVideoParams, caps: VideoModelCaps | undefined, policy: ValidationPolicy): void {
  const product = 'omni-video';
  const model = params.model ?? caps?.id ?? '(unknown)';
  const hasFirst = params.firstFrame !== undefined;
  const hasLast = params.lastFrame !== undefined;
  const refVideo = params.featureVideo ? 'feature' : params.baseVideo ? 'base' : undefined;
  const referCount = params.referImages?.length ?? 0;
  const elements = params.elements ?? [];

  // [shape] prompt.
  shape(typeof params.prompt === 'string' && params.prompt.trim().length > 0, 'prompt', 'prompt is required and must be a non-empty string');
  const maxPrompt = caps?.maxPromptLength ?? MAX_PROMPT_UNKNOWN_MODEL;
  shape(params.prompt.length <= maxPrompt, 'prompt', `prompt is ${params.prompt.length} characters; ${model} allows at most ${maxPrompt}`);

  // [shape] frames: last-frame-only is unsupported on both omni models.
  shape(!hasLast || hasFirst, 'lastFrame', 'lastFrame requires firstFrame (last-frame-only generation is not supported)');

  // [shape] at most one reference video ("Maximum 1 reference video"; "Add at most one reference video").
  shape(!(params.featureVideo && params.baseVideo), 'baseVideo', 'featureVideo and baseVideo are mutually exclusive — at most one reference video');
  for (const [field, v] of [['featureVideo', params.featureVideo], ['baseVideo', params.baseVideo]] as const) {
    if (v !== undefined) shape(typeof v === 'object' && typeof v.url === 'string' && v.url.length > 0, field, `${field}.url is required — reference videos are passed by URL (the Kling API has no upload endpoint)`);
  }

  // [shape] base_video shapes a PAID edit: no frames, no multi-shot, no generated audio
  // (§2.5 "no first/last frame; no multi-shot; audio cannot be native"). Never warned past.
  if (refVideo === 'base') {
    shape(!hasFirst && !hasLast, 'firstFrame', 'baseVideo (video to edit) cannot be combined with firstFrame / lastFrame');
    shape(params.multiShot !== true, 'multiShot', 'baseVideo does not support multi-shot (multiShot must not be true)');
    shape(params.audio !== 'native', 'audio', "baseVideo keeps or drops the source sound: audio must be 'original' or 'off', not 'native'");
  }
  // [shape] feature_video: "the audio parameter can only be off"; "multi_shot … can only be true".
  if (refVideo === 'feature') {
    shape(params.audio === undefined || params.audio === 'off', 'audio', "featureVideo does not support audio generation: audio must be 'off' (the vendor default) when a feature video is given");
    shape(params.multiShot !== false, 'multiShot', 'featureVideo supports multi-shot videos and multiShot must not be false');
  }

  // [shape] elements / refer images: ids, uniqueness, array types.
  shape(Array.isArray(elements), 'elements', 'elements must be an array');
  elements.forEach((e, i) => shape(typeof e.elementId === 'string' && e.elementId.length > 0, `elements[${i}].elementId`, `elements[${i}].elementId is required`));
  shape(params.referImages === undefined || Array.isArray(params.referImages), 'referImages', 'referImages must be an array');
  params.referImages?.forEach((r, i) => shape(r !== null && typeof r === 'object' && 'source' in r, `referImages[${i}]`, `referImages[${i}].source is required`));
  const ids = [...elements.map((e) => e.id), ...(params.referImages ?? []).map((r) => r.id), params.featureVideo?.id, params.baseVideo?.id].filter((id): id is string => id !== undefined);
  shape(new Set(ids).size === ids.length, 'elements', 'content ids must be unique across elements, reference images and videos ("must not be duplicated")');

  // [shape] common types.
  shape(params.duration === undefined || isInteger(params.duration), 'duration', 'duration must be an integer number of seconds');
  shape(params.audio === undefined || AUDIO_MODES.has(params.audio), 'audio', "audio must be 'native', 'original' or 'off'");
  shape(params.multiShot === undefined || typeof params.multiShot === 'boolean', 'multiShot', 'multiShot must be a boolean');
  shape(params.callbackUrl === undefined || /^https?:\/\//.test(params.callbackUrl), 'callbackUrl', 'callbackUrl must be an http(s) URL');
  rejectModeledExtras(params.extraSettings, MODELED_SETTINGS, 'extraSettings');
  rejectModeledExtras(params.extraOptions, MODELED_OPTIONS, 'extraOptions');

  // aspect_ratio: the vendor's field notes say "required when there is no first frame or
  // reference video"; its table says No and its own "Only prompt" example omits it
  // (App. B §6). A WARNING, not a rule class — a throw would refuse the vendor's example.
  if (params.aspectRatio === undefined && !hasFirst && refVideo === undefined) {
    policy.warn(`aspectRatio is not set and there is no firstFrame or reference video — the vendor's field notes call it required here (its table and example do not); the vendor default 16:9 will apply if accepted`);
  }

  if (!caps) return; // unknown model: shape only (D9)

  capability(caps.products.includes(product), 'model', `${model} has no /omni-video endpoint (products: ${caps.products.join(', ')})`, policy);
  const resolutions = caps.resolutions[product] ?? [];
  if (params.resolution !== undefined) capability(resolutions.includes(params.resolution), 'resolution', `${model} accepts resolution ${resolutions.join(' | ')}, not ${params.resolution}`, policy);
  if (params.aspectRatio !== undefined) capability(T2V_ASPECT_RATIOS.has(params.aspectRatio), 'aspectRatio', `aspectRatio must be 16:9, 9:16 or 1:1, not ${params.aspectRatio}`, policy);
  const durations = caps.durations[product];
  if (params.duration !== undefined && durations) capability(durations.includes(params.duration), 'duration', `${model} accepts duration ${describeSet(durations)} s, not ${params.duration}`, policy);
  const audio = caps.audio[product];
  if (params.audio !== undefined && audio) capability(audio.includes(params.audio), 'audio', `${model} accepts audio ${audio.join(' | ')}, not ${params.audio}`, policy);
  if (params.multiShot !== undefined) capability(caps.multiShotSetting, 'multiShot', `${model} has no multi_shot setting`, policy);

  // [capability] count envelopes (kind-independent — every cell of the vendor matrices sums to these).
  const refsMax = refVideo ? OMNI_REFS_MAX_WITH_VIDEO : OMNI_REFS_MAX_NO_VIDEO;
  capability(referCount + elements.length <= refsMax, 'referImages', `reference images + elements must total at most ${refsMax} ${refVideo ? 'with' : 'without'} a reference video (got ${referCount} + ${elements.length})`, policy);

  if (caps.id === 'kling-3.0-omni') {
    if (hasFirst) capability(elements.length <= OMNI_ELEMENTS_MAX_WITH_FRAMES, 'elements', `with a first frame, at most ${OMNI_ELEMENTS_MAX_WITH_FRAMES} elements (got ${elements.length})`, policy);
    // Kind-specific cells, only when every element declares its kind.
    if (elements.length > 0 && elements.every((e) => e.kind !== undefined)) {
      const videoChar = elements.filter((e) => e.kind === 'video_character').length;
      const multi = elements.filter((e) => e.kind === 'multi_image').length;
      if (refVideo) {
        capability(!(videoChar > 0 && multi > 0), 'elements', 'with a reference video, video-character and multi-image elements cannot be combined', policy);
        capability(videoChar <= 1, 'elements', `with a reference video, at most 1 video-character element (got ${videoChar})`, policy);
        capability(!(videoChar > 0 && referCount > 0), 'referImages', 'with a reference video, video-character elements and reference images are not supported at the same time', policy);
        capability(referCount + multi <= OMNI_REFS_MAX_WITH_VIDEO, 'referImages', `with a reference video, reference images + multi-image elements ≤ ${OMNI_REFS_MAX_WITH_VIDEO} (got ${referCount + multi})`, policy);
      } else {
        capability(videoChar <= 3, 'elements', `at most 3 video-character elements (got ${videoChar})`, policy);
        if (videoChar > 0 && multi > 0) capability(referCount + multi <= 4, 'referImages', `with both element kinds, reference images + multi-image elements ≤ 4 (got ${referCount + multi})`, policy);
        else capability(referCount + multi <= OMNI_REFS_MAX_NO_VIDEO, 'referImages', `reference images + multi-image elements ≤ ${OMNI_REFS_MAX_NO_VIDEO} (got ${referCount + multi})`, policy);
      }
    }
  }

  if (caps.id === 'kling-o1') {
    // §2.7: multi-image elements only; first+last ⇒ no elements and no extra reference
    // images; feature_video ⇒ no last frame; first frame alone ⇒ duration 5 | 10.
    elements.forEach((e, i) => capability(e.kind !== 'video_character', `elements[${i}]`, 'kling-o1 supports multi-image elements only; video-character elements are not yet supported', policy));
    if (hasFirst && hasLast) {
      capability(elements.length === 0, 'elements', 'kling-o1 with first + last frame does not support elements', policy);
      capability(referCount === 0, 'referImages', 'kling-o1 with first + last frame does not take additional reference images', policy);
    }
    if (refVideo === 'feature') capability(!hasLast, 'lastFrame', 'kling-o1 featureVideo supports defining the first frame only, not the last', policy);
    if (hasFirst && !hasLast && referCount === 0 && refVideo === undefined && params.duration !== undefined) {
      capability(params.duration === 5 || params.duration === 10, 'duration', 'kling-o1 with a first frame and no other references generates only 5 s or 10 s videos', policy);
    }
  }
}

// ── motion-control (App. B §2.6 kling-3.0, §2.10 kling-2.6) ─────────────────────────

const MOTION_ORIENTATIONS = new Set(['image', 'video']);

export function validateMotionControl(params: MotionControlParams, caps: VideoModelCaps | undefined, policy: ValidationPolicy): void {
  const product = 'motion-control';
  const model = params.model ?? caps?.id ?? '(unknown)';

  // [shape] image and video references are required; the video is URL-only; the orientation is required.
  shape(params.image !== undefined && params.image !== null, 'image', 'image (appearance reference) is required');
  shape(params.video !== undefined && params.video !== null, 'video', 'video (motion reference) is required');
  const videoUrl = typeof params.video === 'string' ? params.video : params.video?.url;
  shape(typeof videoUrl === 'string' && videoUrl.length > 0, 'video', 'video must be a URL string or { url } — the Kling API has no upload endpoint for video');
  shape(MOTION_ORIENTATIONS.has(params.characterOrientation), 'characterOrientation', "characterOrientation is required: 'image' (follow the reference image; reference video ≤ 10 s) or 'video' (follow the reference video; ≤ 30 s)");
  if (params.prompt !== undefined) {
    shape(typeof params.prompt === 'string', 'prompt', 'prompt must be a string');
    const maxPrompt = caps?.maxPromptLength ?? MAX_PROMPT_UNKNOWN_MODEL;
    shape(params.prompt.length <= maxPrompt, 'prompt', `prompt is ${params.prompt.length} characters; ${model} allows at most ${maxPrompt}`);
  }
  if (params.element !== undefined) shape(typeof params.element === 'object' && typeof params.element.elementId === 'string' && params.element.elementId.length > 0, 'element', 'element.elementId is required');
  shape(params.audio === undefined || params.audio === 'original' || params.audio === 'off', 'audio', "motion-control audio must be 'original' or 'off'");
  shape(params.callbackUrl === undefined || /^https?:\/\//.test(params.callbackUrl), 'callbackUrl', 'callbackUrl must be an http(s) URL');
  rejectModeledExtras(params.extraSettings, MODELED_SETTINGS, 'extraSettings');
  rejectModeledExtras(params.extraOptions, MODELED_OPTIONS, 'extraOptions');

  if (!caps) return;

  capability(caps.products.includes(product), 'model', `${model} has no /motion-control endpoint (products: ${caps.products.join(', ')})`, policy);
  const resolutions = caps.resolutions[product] ?? [];
  if (params.resolution !== undefined) capability(resolutions.includes(params.resolution), 'resolution', `${model} motion-control accepts resolution ${resolutions.join(' | ')}, not ${params.resolution} (4k is not supported on motion control)`, policy);
  const audio = caps.audio[product];
  if (params.audio !== undefined && audio) capability(audio.includes(params.audio), 'audio', `${model} motion-control accepts audio ${audio.join(' | ')}, not ${params.audio}`, policy);
  // [capability] element — 3.0 only (§2.10: 2.6's contents enum has no `element`).
  if (params.element !== undefined) capability((caps.contentTypes[product] ?? []).includes('element'), 'element', `${model} motion-control does not take an element (kling-3.0 does)`, policy);
}
