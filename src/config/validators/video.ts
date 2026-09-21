/**
 * Video parameter rules (spec D6, D9; App. B §2). One function per product, taking
 * `(params, caps, policy)`; every rule cites its `docs/api/` line and carries its class.
 * `caps` is undefined for an unknown model → shape rules only.
 */
import { MODELED_OPTIONS, MODELED_SETTINGS } from '../constants.js';
import type { TextToVideoParams } from '../../codecs/params.js';
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
  const contiguous = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
  return contiguous && sorted.length > 2 ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(' | ');
}
