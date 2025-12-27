/**
 * Kling API Model Definitions
 *
 * Model capability definitions for text-to-video, image-to-video,
 * and image generation models.
 */

import type { TextToVideoModel, ImageToVideoModel, ImageGenModel } from '../types.js';

// ============================================================================
// Text-to-Video Models
// ============================================================================

/** Text-to-video model capabilities */
export const TEXT_TO_VIDEO_MODELS: Record<
  TextToVideoModel,
  {
    supportsCfgScale: boolean;
    supportsSound: boolean;
    supportsCameraControl: boolean;
  }
> = {
  'kling-v1': { supportsCfgScale: true, supportsSound: false, supportsCameraControl: true },
  'kling-v1-6': { supportsCfgScale: true, supportsSound: false, supportsCameraControl: false },
  'kling-v2-master': {
    supportsCfgScale: false,
    supportsSound: false,
    supportsCameraControl: false,
  },
  'kling-v2-1-master': {
    supportsCfgScale: false,
    supportsSound: false,
    supportsCameraControl: false,
  },
  'kling-v2-5-turbo': {
    supportsCfgScale: false,
    supportsSound: false,
    supportsCameraControl: false,
  },
  'kling-v2-6': { supportsCfgScale: false, supportsSound: true, supportsCameraControl: false },
};

// ============================================================================
// Image-to-Video Models
// ============================================================================

/** Image-to-video model capabilities */
export const IMAGE_TO_VIDEO_MODELS: Record<
  ImageToVideoModel,
  {
    supportsCfgScale: boolean;
    supportsImageTail: boolean;
    supportsVoiceList: boolean;
    supportsDynamicMasks: boolean;
    supportsCameraControl: boolean;
  }
> = {
  'kling-v1': {
    supportsCfgScale: true,
    supportsImageTail: false,
    supportsVoiceList: false,
    supportsDynamicMasks: false,
    supportsCameraControl: false,
  },
  'kling-v1-5': {
    supportsCfgScale: true,
    supportsImageTail: true, // pro only
    supportsVoiceList: false,
    supportsDynamicMasks: true,
    supportsCameraControl: true,
  },
  'kling-v1-6': {
    supportsCfgScale: true,
    supportsImageTail: true,
    supportsVoiceList: false,
    supportsDynamicMasks: true,
    supportsCameraControl: true,
  },
  'kling-v2-master': {
    supportsCfgScale: false,
    supportsImageTail: false,
    supportsVoiceList: false,
    supportsDynamicMasks: false,
    supportsCameraControl: false,
  },
  'kling-v2-1': {
    supportsCfgScale: false,
    supportsImageTail: true, // pro only
    supportsVoiceList: false,
    supportsDynamicMasks: false,
    supportsCameraControl: false,
  },
  'kling-v2-1-master': {
    supportsCfgScale: false,
    supportsImageTail: false,
    supportsVoiceList: false,
    supportsDynamicMasks: false,
    supportsCameraControl: false,
  },
  'kling-v2-5-turbo': {
    supportsCfgScale: false,
    supportsImageTail: true, // pro only
    supportsVoiceList: false,
    supportsDynamicMasks: false,
    supportsCameraControl: false,
  },
  'kling-v2-6': {
    supportsCfgScale: false,
    supportsImageTail: true,
    supportsVoiceList: true,
    supportsDynamicMasks: false,
    supportsCameraControl: false,
  },
};

// ============================================================================
// Image Generation Models
// ============================================================================

/** Image generation model capabilities */
export const IMAGE_GEN_MODELS: Record<
  ImageGenModel,
  {
    supportsImageReference: boolean;
    maxN: number;
  }
> = {
  'kling-v1': { supportsImageReference: false, maxN: 9 },
  'kling-v1-5': { supportsImageReference: true, maxN: 9 },
  'kling-v2': { supportsImageReference: false, maxN: 9 },
  'kling-v2-new': { supportsImageReference: false, maxN: 9 },
  'kling-v2-1': { supportsImageReference: false, maxN: 9 },
};
