/**
 * Capability registry skeleton (spec D9). Empty tables and their types only.
 *
 * 2a₂ appends `VIDEO_MODELS` rows and 3a appends `IMAGE_MODELS` rows; each chain owns
 * its own table so the two can land in parallel without touching shared lines (run #3
 * architect F-11, excavator A48). Import graph: this file may import `codecs/task`
 * (types) only (§5).
 */
import type { Product } from '../codecs/task.js';

// ============================================================================
// Video (new standard, path-per-model)
// ============================================================================

export type KnownVideoModel = 'kling-3.0-turbo' | 'kling-3.0' | 'kling-3.0-omni' | 'kling-o1' | 'kling-2.6' | 'kling-2.5-turbo';
/** Known ids autocomplete; an unknown id is passed through with shape-only validation (D9). */
export type VideoModel = KnownVideoModel | (string & {});
export type Resolution = '720p' | '1080p' | '4k';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type AudioMode = 'native' | 'original' | 'off';
export type ContentType =
  | 'prompt'
  | 'first_frame'
  | 'last_frame'
  | 'refer_image'
  | 'feature_video'
  | 'base_video'
  | 'element'
  | 'voice'
  | 'image'
  | 'video';

export interface VideoModelCaps {
  id: KnownVideoModel;
  products: Product[];
  /** Per product — motion-control has no 4k on 3.0. */
  resolutions: Partial<Record<Product, Resolution[]>>;
  /** `null` = follows the reference video. */
  durations: number[] | null;
  /** `null` = the model has no audio field. */
  audio: AudioMode[] | null;
  multiShot: boolean;
  contentTypes: Partial<Record<Product, ContentType[]>>;
}

/** Filled in 2a₂ from App. B §4.1. */
export const VIDEO_MODELS: Readonly<Record<KnownVideoModel, VideoModelCaps>> = {} as Record<KnownVideoModel, VideoModelCaps>;

// ============================================================================
// Image (legacy standard, `model_name`)
// ============================================================================

export type KnownImageModel = 'kling-v3' | 'kling-v3-omni' | 'kling-v2-1' | 'kling-v2' | 'kling-image-o1';
export type ImageModel = KnownImageModel | (string & {});
export type ImageResolution = '1k' | '2k' | '4k';

export interface ImageModelCaps {
  id: KnownImageModel;
  products: Product[];
  resolutions: Partial<Record<Product, ImageResolution[]>>;
  aspectRatios: string[];
  /** Max `n` per request. */
  maxN: number;
}

/** Filled in 3a from App. B §4.2. */
export const IMAGE_MODELS: Readonly<Record<KnownImageModel, ImageModelCaps>> = {} as Record<KnownImageModel, ImageModelCaps>;
