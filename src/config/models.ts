/**
 * Capability registry (spec D9): one table per standard, keyed by path model id (video)
 * or `model_name` (image). Each row is commented with its `docs/api/` source; a test
 * greps every enum value here against the cited page (V3).
 *
 * `VIDEO_MODELS` is filled here in 2a₂; `IMAGE_MODELS` is filled in 3a — each chain owns
 * its own table so the two land in parallel without touching shared lines (run #3
 * architect F-11, excavator A48). Import graph: `codecs/task`, `codecs/params` (types).
 *
 * Shape note vs the D9 sketch: `durations` and `audio` are PER PRODUCT (like
 * `resolutions`), not per model — `kling-3.0` takes `native|off` on t2v/i2v and
 * `original|off` on motion-control, and its motion-control duration follows the
 * reference video. A model-level field could not say that.
 */
import type {
  AudioMode,
  ContentType,
  ImageResolution,
  KnownImageModel,
  KnownVideoModel,
  Resolution,
} from '../codecs/params.js';
import type { Product } from '../codecs/task.js';

// ============================================================================
// Video (new standard, path-per-model) — App. B §4.1; per-endpoint tables §2.1–2.12
// ============================================================================

export interface VideoModelCaps {
  id: KnownVideoModel;
  products: Product[];
  resolutions: Partial<Record<Product, Resolution[]>>;
  /** Absent for a product = no `duration` setting (motion control follows the reference video). */
  durations: Partial<Record<Product, number[]>>;
  /** Absent for a product = the model has no `settings.audio` field there. */
  audio: Partial<Record<Product, AudioMode[]>>;
  /** Whether `settings.multi_shot` exists. 3.0-turbo does multi-shot through prompt syntax alone and has NO field. */
  multiShotSetting: boolean;
  /** Vendor prompt cap in characters (`prompt` / `contents[].text`). */
  maxPromptLength: number;
  contentTypes: Partial<Record<Product, ContentType[]>>;
}

/** 3–15 s, every integer (`kling-3.0-turbo-t2v.md`, `kling-omni-3.0-t2v.md`, `kling-omni-3.0-ovg.md`). */
const SECONDS_3_TO_15 = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
/** 3–10 s (`kling-o1-video.md`). */
const SECONDS_3_TO_10 = [3, 4, 5, 6, 7, 8, 9, 10];
/** 5 | 10 (`kling-2.6-t2v.md`, `kling-2.5-turbo-t2v.md`). */
const SECONDS_5_OR_10 = [5, 10];

export const VIDEO_MODELS: Readonly<Record<KnownVideoModel, VideoModelCaps>> = {
  // docs/api/kling-3.0-turbo-t2v.md, kling-3.0-turbo-i2v.md. No `audio` field (native audio
  // is always on — inferred from kling-pricing-video.md, §11 Q3), no `multi_shot` field
  // (multi-shot via prompt syntax only). i2v: first_frame only. Prompt ≤ 3072.
  'kling-3.0-turbo': {
    id: 'kling-3.0-turbo',
    products: ['text-to-video', 'image-to-video'],
    resolutions: { 'text-to-video': ['720p', '1080p'], 'image-to-video': ['720p', '1080p'] },
    durations: { 'text-to-video': SECONDS_3_TO_15, 'image-to-video': SECONDS_3_TO_15 },
    audio: {},
    multiShotSetting: false,
    maxPromptLength: 3072,
    contentTypes: { 'image-to-video': ['prompt', 'first_frame'] },
  },
  // docs/api/kling-omni-3.0-t2v.md, kling-omni-3.0-i2v.md, kling-omni-3.0-motion-control.md.
  // 4k on t2v/i2v only ("4K is not supported" for motion control — capability map).
  'kling-3.0': {
    id: 'kling-3.0',
    products: ['text-to-video', 'image-to-video', 'motion-control'],
    resolutions: {
      'text-to-video': ['720p', '1080p', '4k'],
      'image-to-video': ['720p', '1080p', '4k'],
      'motion-control': ['720p', '1080p'],
    },
    durations: { 'text-to-video': SECONDS_3_TO_15, 'image-to-video': SECONDS_3_TO_15 },
    audio: { 'text-to-video': ['native', 'off'], 'image-to-video': ['native', 'off'], 'motion-control': ['original', 'off'] },
    multiShotSetting: true,
    maxPromptLength: 3072,
    contentTypes: {
      'image-to-video': ['prompt', 'first_frame', 'last_frame', 'element'],
      'motion-control': ['prompt', 'image', 'video', 'element'],
    },
  },
  // docs/api/kling-omni-3.0-ovg.md.
  'kling-3.0-omni': {
    id: 'kling-3.0-omni',
    products: ['omni-video'],
    resolutions: { 'omni-video': ['720p', '1080p', '4k'] },
    durations: { 'omni-video': SECONDS_3_TO_15 },
    audio: { 'omni-video': ['native', 'original', 'off'] },
    multiShotSetting: true,
    maxPromptLength: 3072,
    contentTypes: { 'omni-video': ['prompt', 'first_frame', 'last_frame', 'refer_image', 'feature_video', 'base_video', 'element'] },
  },
  // docs/api/kling-o1-video.md. No multi-shot; first-frame-only → 5 | 10 (a validator rule, 2b).
  'kling-o1': {
    id: 'kling-o1',
    products: ['omni-video'],
    resolutions: { 'omni-video': ['720p', '1080p'] },
    durations: { 'omni-video': SECONDS_3_TO_10 },
    audio: { 'omni-video': ['original', 'off'] },
    multiShotSetting: false,
    maxPromptLength: 2500,
    contentTypes: { 'omni-video': ['prompt', 'first_frame', 'last_frame', 'refer_image', 'feature_video', 'base_video', 'element'] },
  },
  // docs/api/kling-2.6-t2v.md, kling-2.6-i2v.md, kling-2.6-motion-control.md.
  // "When generating videos with native audio, only 1080P resolution is supported."
  'kling-2.6': {
    id: 'kling-2.6',
    products: ['text-to-video', 'image-to-video', 'motion-control'],
    resolutions: {
      'text-to-video': ['720p', '1080p'],
      'image-to-video': ['720p', '1080p'],
      'motion-control': ['720p', '1080p'],
    },
    durations: { 'text-to-video': SECONDS_5_OR_10, 'image-to-video': SECONDS_5_OR_10 },
    audio: { 'text-to-video': ['native', 'off'], 'image-to-video': ['native', 'off'], 'motion-control': ['original', 'off'] },
    multiShotSetting: false,
    maxPromptLength: 2500,
    contentTypes: { 'image-to-video': ['prompt', 'first_frame', 'last_frame', 'voice'], 'motion-control': ['prompt', 'image', 'video'] },
  },
  // docs/api/kling-2.5-turbo-t2v.md, kling-2.5-turbo-i2v.md. No audio, no multi-shot.
  'kling-2.5-turbo': {
    id: 'kling-2.5-turbo',
    products: ['text-to-video', 'image-to-video'],
    resolutions: { 'text-to-video': ['720p', '1080p'], 'image-to-video': ['720p', '1080p'] },
    durations: { 'text-to-video': SECONDS_5_OR_10, 'image-to-video': SECONDS_5_OR_10 },
    audio: {},
    multiShotSetting: false,
    maxPromptLength: 2500,
    contentTypes: { 'image-to-video': ['prompt', 'first_frame', 'last_frame'] },
  },
};

/** The page each video model's row is transcribed from, per product — the V3 grep test reads these. */
export const VIDEO_MODEL_SOURCES: Readonly<Record<KnownVideoModel, Partial<Record<Product, string>>>> = {
  'kling-3.0-turbo': { 'text-to-video': 'kling-3.0-turbo-t2v.md', 'image-to-video': 'kling-3.0-turbo-i2v.md' },
  'kling-3.0': { 'text-to-video': 'kling-omni-3.0-t2v.md', 'image-to-video': 'kling-omni-3.0-i2v.md', 'motion-control': 'kling-omni-3.0-motion-control.md' },
  'kling-3.0-omni': { 'omni-video': 'kling-omni-3.0-ovg.md' },
  'kling-o1': { 'omni-video': 'kling-o1-video.md' },
  'kling-2.6': { 'text-to-video': 'kling-2.6-t2v.md', 'image-to-video': 'kling-2.6-i2v.md', 'motion-control': 'kling-2.6-motion-control.md' },
  'kling-2.5-turbo': { 'text-to-video': 'kling-2.5-turbo-t2v.md', 'image-to-video': 'kling-2.5-turbo-i2v.md' },
};

/** Default video model for t2v/i2v: cheapest current-generation model with native audio (§10.11, settled). */
export const DEFAULT_VIDEO_MODEL: KnownVideoModel = 'kling-3.0-turbo';

// ============================================================================
// Image (legacy standard, `model_name`) — filled in 3a from App. B §4.2
// ============================================================================

export interface ImageModelCaps {
  id: KnownImageModel;
  products: Product[];
  resolutions: Partial<Record<Product, ImageResolution[]>>;
  aspectRatios: string[];
  /** Max `n` per request. */
  maxN: number;
}

export const IMAGE_MODELS: Readonly<Record<KnownImageModel, ImageModelCaps>> = {} as Record<KnownImageModel, ImageModelCaps>;
