/**
 * Resource parameter rules (spec D8; App. C §7.1, §7.2, §7.9, §7.10). All `[shape]` — the
 * resource endpoints have no model parameter, so there is no capability row to consult.
 */
import type { AvatarCreateParams, ElementCreateParams, TtsParams, VoiceCreateParams } from '../../codecs/params.js';
import { isInteger, shape } from './helpers.js';

const httpish = (u: string | undefined) => u === undefined || /^https?:\/\//.test(u);
const ELEMENT_TAGS = new Set(['o_101', 'o_102', 'o_103', 'o_104', 'o_105', 'o_106', 'o_107', 'o_108']);

export function validateElementCreate(params: ElementCreateParams): void {
  shape(typeof params.name === 'string' && params.name.trim().length > 0 && params.name.length <= 20, 'name', 'name (element_name) is required and must not exceed 20 characters');
  shape(typeof params.description === 'string' && params.description.trim().length > 0 && params.description.length <= 100, 'description', 'description (element_description) is required and must not exceed 100 characters');
  shape(params.referenceType === 'image_refer' || params.referenceType === 'video_refer', 'referenceType', "referenceType must be 'image_refer' or 'video_refer'");
  if (params.referenceType === 'image_refer') {
    // "at least one frontal reference image (frontal_image), and 1 to 3 additional reference images"; "When reference_type is image_refer, this parameter is required."
    shape(params.frontalImage !== undefined, 'frontalImage', "frontalImage is required for referenceType 'image_refer'");
    shape(Array.isArray(params.referImages) && params.referImages.length >= 1 && params.referImages.length <= 3, 'referImages', "referImages must hold 1–3 images for referenceType 'image_refer'");
    shape(params.referVideos === undefined || params.referVideos.length === 0, 'referVideos', "referVideos is invalid with referenceType 'image_refer' (the vendor: \"invalid when referencing images\")");
  } else {
    // "Required when referencing videos"; "At most 1 video".
    shape(Array.isArray(params.referVideos) && params.referVideos.length === 1, 'referVideos', "referVideos must hold exactly one video URL for referenceType 'video_refer' (3–8 s, 1080p, 16:9 | 9:16, ≤ 200 MB — not checked client-side)");
    shape(params.frontalImage === undefined && (params.referImages === undefined || params.referImages.length === 0), 'frontalImage', "frontalImage / referImages are for 'image_refer'; a video character element is defined by its video");
  }
  params.tags?.forEach((t, i) => shape(ELEMENT_TAGS.has(t), `tags[${i}]`, `tags[${i}] must be one of ${[...ELEMENT_TAGS].join(', ')} (o_101 Hottest … o_108 Others)`));
  shape(httpish(params.callbackUrl), 'callbackUrl', 'callbackUrl must be an http(s) URL');
}

export function validateVoiceCreate(params: VoiceCreateParams): void {
  shape(typeof params.name === 'string' && params.name.trim().length > 0 && params.name.length <= 20, 'name', 'name (voice_name) is required and must not exceed 20 characters');
  const hasUrl = params.voiceUrl !== undefined;
  const hasVideo = params.videoId !== undefined;
  shape(hasUrl !== hasVideo, 'voiceUrl', 'exactly one of voiceUrl / videoId is required');
  if (hasUrl) shape(/^https:\/\//.test(params.voiceUrl!), 'voiceUrl', 'voiceUrl must be an https URL (.mp3/.wav/.mp4/.mov, one clean voice, 5–30 s); the Kling API has no upload endpoint');
  if (hasVideo) shape(typeof params.videoId === 'string' && params.videoId.length > 0, 'videoId', 'videoId must be a non-empty string');
  shape(httpish(params.callbackUrl), 'callbackUrl', 'callbackUrl must be an http(s) URL');
}

export function validateAvatarCreate(params: AvatarCreateParams): void {
  shape(params.image !== undefined && params.image !== null, 'image', 'image is required');
  const hasAudioId = params.audioId !== undefined;
  const hasSound = params.soundFile !== undefined;
  // "Either audio_id or sound_file must be provided (mutually exclusive)".
  shape(hasAudioId !== hasSound, 'audioId', 'exactly one of audioId / soundFile is required');
  if (hasAudioId) shape(typeof params.audioId === 'string' && params.audioId.length > 0, 'audioId', 'audioId must be a non-empty string (a TTS / voice output ≤ 30 days old)');
  shape(params.prompt === undefined || (typeof params.prompt === 'string' && params.prompt.length <= 2500), 'prompt', 'prompt must be at most 2500 characters');
  shape(params.mode === undefined || params.mode === 'std' || params.mode === 'pro', 'mode', "mode must be 'std' or 'pro'");
  shape(httpish(params.callbackUrl), 'callbackUrl', 'callbackUrl must be an http(s) URL');
}

export function validateTts(params: TtsParams): void {
  shape(typeof params.text === 'string' && params.text.trim().length > 0 && params.text.length <= 1000, 'text', 'text is required and must not exceed 1000 characters');
  shape(typeof params.voiceId === 'string' && params.voiceId.length > 0, 'voiceId', "voiceId is required — from the vendor's TTS Voice Guide (e.g. 'oversea_male1'), not from /v1/general/presets-voices");
  shape(params.voiceLanguage === 'zh' || params.voiceLanguage === 'en', 'voiceLanguage', "voiceLanguage is required: 'zh' or 'en'");
  shape(params.voiceSpeed === undefined || (typeof params.voiceSpeed === 'number' && params.voiceSpeed >= 0.8 && params.voiceSpeed <= 2.0), 'voiceSpeed', 'voiceSpeed must be a number in [0.8, 2.0]');
}

/** Legacy list paging (App. C §7.9/7.10): pageNum 1–1000; pageSize 1–500, voices 1–1000. */
export function validatePage(pageNum: number | undefined, pageSize: number | undefined, maxPageSize: number): void {
  shape(pageNum === undefined || (isInteger(pageNum) && pageNum >= 1 && pageNum <= 1000), 'pageNum', `pageNum must be an integer in 1–1000, got ${pageNum}`);
  shape(pageSize === undefined || (isInteger(pageSize) && pageSize >= 1 && pageSize <= maxPageSize), 'pageSize', `pageSize must be an integer in 1–${maxPageSize}, got ${pageSize}`);
}
