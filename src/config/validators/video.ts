/**
 * Video Validators
 *
 * Validation functions for video generation parameters including:
 * - Text-to-video
 * - Image-to-video
 * - Video extension
 * - Multi-image-to-video
 * - Omni video
 */

import type {
  TextToVideoParams,
  ImageToVideoParams,
  ExtendVideoParams,
  MultiImageToVideoParams,
  OmniVideoParams,
  CameraType,
  CameraConfig,
} from '../../types.js';

import {
  MAX_VOICE_LIST_LENGTH,
  VALID_VIDEO_MODES,
  VALID_VIDEO_ASPECT_RATIOS,
  VALID_VIDEO_DURATIONS,
  VALID_CAMERA_TYPES,
  CFG_SCALE_RANGE,
  MAX_MULTI_IMAGE_VIDEO_COUNT,
  CAMERA_CONFIG_RANGE,
  MAX_CAMERA_CONFIG_NON_ZERO,
} from '../constants.js';

import { TEXT_TO_VIDEO_MODELS, IMAGE_TO_VIDEO_MODELS } from '../models.js';

import {
  ValidationError,
  validateRange,
  validateEnumValue,
  validatePromptLength,
  validateRequired,
  validateModel,
} from './helpers.js';

// ============================================================================
// Camera Control Validation
// ============================================================================

/** Valid camera config keys */
const VALID_CONFIG_KEYS = ['horizontal', 'vertical', 'pan', 'tilt', 'roll', 'zoom'] as const;

/**
 * Validate camera control settings
 *
 * @param control - Camera control settings
 * @param supported - Whether camera control is supported by the model
 * @throws ValidationError if settings are invalid
 */
function validateCameraControl(
  control: { type?: CameraType; config?: CameraConfig },
  supported: boolean
): void {
  if (!supported) {
    throw new ValidationError('camera_control', 'Camera control is not supported by this model');
  }

  // Validate type
  if (control.type) {
    validateEnumValue('camera_control.type', control.type, VALID_CAMERA_TYPES);
  }

  // Validate config (for type='simple')
  if (control.config) {
    if (control.type && control.type !== 'simple') {
      throw new ValidationError(
        'camera_control.config',
        'config is only valid when type="simple" or type is not set'
      );
    }

    let nonZeroCount = 0;
    const validKeySet = new Set<string>(VALID_CONFIG_KEYS);

    // Single pass: validate keys, check ranges, count non-zero values
    for (const [key, value] of Object.entries(control.config)) {
      if (!validKeySet.has(key)) {
        throw new ValidationError(
          `camera_control.config.${key}`,
          `Invalid config key. Must be one of: ${VALID_CONFIG_KEYS.join(', ')}`
        );
      }

      if (value !== undefined) {
        validateRange(`camera_control.config.${key}`, value, CAMERA_CONFIG_RANGE);
        if (value !== 0) {
          nonZeroCount++;
        }
      }
    }

    if (nonZeroCount > MAX_CAMERA_CONFIG_NON_ZERO) {
      throw new ValidationError(
        'camera_control.config',
        `Only ${MAX_CAMERA_CONFIG_NON_ZERO} config parameter should be non-zero`
      );
    }
  }
}

// ============================================================================
// Text-to-Video Validation
// ============================================================================

/**
 * Validate text-to-video parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateTextToVideoParams(params: TextToVideoParams): void {
  const modelCaps = validateModel(params.model_name, 'kling-v1', TEXT_TO_VIDEO_MODELS);
  const model = params.model_name ?? 'kling-v1';

  // Validate prompt (required)
  validateRequired('prompt', params.prompt, 'Prompt');
  validatePromptLength('prompt', params.prompt);
  validatePromptLength('negative_prompt', params.negative_prompt);

  // Validate sound (v2.6+ only)
  if (params.sound) {
    if (!modelCaps.supportsSound) {
      throw new ValidationError('sound', 'Sound is only supported by kling-v2-6 model');
    }
    validateEnumValue('sound', params.sound, ['on', 'off'] as const);
  }

  // Validate cfg_scale (v1.x only)
  if (params.cfg_scale !== undefined) {
    if (!modelCaps.supportsCfgScale) {
      throw new ValidationError('cfg_scale', `cfg_scale is not supported by ${model}`);
    }
    validateRange('cfg_scale', params.cfg_scale, CFG_SCALE_RANGE);
  }

  // Validate enum fields
  if (params.mode) validateEnumValue('mode', params.mode, VALID_VIDEO_MODES);
  if (params.aspect_ratio)
    validateEnumValue('aspect_ratio', params.aspect_ratio, VALID_VIDEO_ASPECT_RATIOS);
  if (params.duration) validateEnumValue('duration', params.duration, VALID_VIDEO_DURATIONS);

  // Validate camera control
  if (params.camera_control) {
    validateCameraControl(params.camera_control, modelCaps.supportsCameraControl);
  }
}

// ============================================================================
// Image-to-Video Validation
// ============================================================================

/**
 * Validate image-to-video parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateImageToVideoParams(params: ImageToVideoParams): void {
  const modelCaps = validateModel(params.model_name, 'kling-v1', IMAGE_TO_VIDEO_MODELS);
  const model = params.model_name ?? 'kling-v1';

  // Validate image (required)
  validateRequired('image', params.image, 'Image');

  // Validate prompts
  validatePromptLength('prompt', params.prompt);
  validatePromptLength('negative_prompt', params.negative_prompt);

  // Validate image_tail
  if (params.image_tail) {
    if (!modelCaps.supportsImageTail) {
      throw new ValidationError('image_tail', `image_tail is not supported by ${model}`);
    }
    if (params.mode !== 'pro') {
      throw new ValidationError('image_tail', 'image_tail requires mode="pro"');
    }
    // Mutual exclusivity check
    if (params.dynamic_masks || params.static_mask || params.camera_control) {
      throw new ValidationError(
        'image_tail',
        'Cannot use image_tail with dynamic_masks, static_mask, or camera_control'
      );
    }
  }

  // Validate voice_list (v2.6+ only)
  if (params.voice_list && params.voice_list.length > 0) {
    if (!modelCaps.supportsVoiceList) {
      throw new ValidationError('voice_list', 'voice_list is only supported by kling-v2-6');
    }
    if (params.voice_list.length > MAX_VOICE_LIST_LENGTH) {
      throw new ValidationError('voice_list', `Maximum ${MAX_VOICE_LIST_LENGTH} voices allowed`);
    }
  }

  // Validate cfg_scale (v1.x only)
  if (params.cfg_scale !== undefined) {
    if (!modelCaps.supportsCfgScale) {
      throw new ValidationError('cfg_scale', `cfg_scale is not supported by ${model}`);
    }
    validateRange('cfg_scale', params.cfg_scale, CFG_SCALE_RANGE);
  }

  // Validate enum fields
  if (params.mode) validateEnumValue('mode', params.mode, VALID_VIDEO_MODES);
  if (params.aspect_ratio)
    validateEnumValue('aspect_ratio', params.aspect_ratio, VALID_VIDEO_ASPECT_RATIOS);
  if (params.duration) validateEnumValue('duration', params.duration, VALID_VIDEO_DURATIONS);

  // Validate camera control
  if (params.camera_control) {
    validateCameraControl(params.camera_control, modelCaps.supportsCameraControl);
  }
}

// ============================================================================
// Video Extension Validation
// ============================================================================

/**
 * Validate video extension parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateExtendVideoParams(params: ExtendVideoParams): void {
  validateRequired('video_id', params.video_id, 'Video ID');
  validatePromptLength('prompt', params.prompt);
  validatePromptLength('negative_prompt', params.negative_prompt);

  if (params.cfg_scale !== undefined) {
    validateRange('cfg_scale', params.cfg_scale, CFG_SCALE_RANGE);
  }
}

// ============================================================================
// Multi-Image-to-Video Validation
// ============================================================================

/**
 * Validate multi-image-to-video parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateMultiImageToVideoParams(params: MultiImageToVideoParams): void {
  // Validate image_list
  if (!params.image_list || params.image_list.length === 0) {
    throw new ValidationError('image_list', 'At least one image is required');
  }
  if (params.image_list.length > MAX_MULTI_IMAGE_VIDEO_COUNT) {
    throw new ValidationError(
      'image_list',
      `Maximum ${MAX_MULTI_IMAGE_VIDEO_COUNT} images allowed`
    );
  }

  // Validate each image
  for (let i = 0; i < params.image_list.length; i++) {
    const item = params.image_list[i];
    if (!item.image || item.image.trim() === '') {
      throw new ValidationError(`image_list[${i}].image`, 'Image is required');
    }
  }

  // Validate prompt (required for this endpoint)
  validateRequired('prompt', params.prompt, 'Prompt');
  validatePromptLength('prompt', params.prompt);
  validatePromptLength('negative_prompt', params.negative_prompt);

  // Validate model (only kling-v1-6 supported)
  if (params.model_name && params.model_name !== 'kling-v1-6') {
    throw new ValidationError(
      'model_name',
      'Only kling-v1-6 is supported for multi-image-to-video'
    );
  }

  // Validate enum fields
  if (params.mode) validateEnumValue('mode', params.mode, VALID_VIDEO_MODES);
  if (params.aspect_ratio)
    validateEnumValue('aspect_ratio', params.aspect_ratio, VALID_VIDEO_ASPECT_RATIOS);
  if (params.duration) validateEnumValue('duration', params.duration, VALID_VIDEO_DURATIONS);
}

// ============================================================================
// Omni Video Validation
// ============================================================================

/**
 * Validate omni video parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateOmniVideoParams(params: OmniVideoParams): void {
  // Validate prompt (required)
  validateRequired('prompt', params.prompt, 'Prompt');
  validatePromptLength('prompt', params.prompt);

  // Validate model
  if (params.model_name && params.model_name !== 'kling-video-o1') {
    throw new ValidationError('model_name', 'Only kling-video-o1 is supported');
  }

  // Validate image_list constraints
  if (params.image_list) {
    const hasEndFrame = params.image_list.some((img) => img.type === 'end_frame');
    const hasFirstFrame = params.image_list.some((img) => img.type === 'first_frame');

    // End frame requires first frame
    if (hasEndFrame && !hasFirstFrame) {
      throw new ValidationError('image_list', 'End frame image requires a first frame image');
    }

    // End frame not supported with more than 2 images
    if (hasEndFrame && params.image_list.length > 2) {
      throw new ValidationError(
        'image_list',
        'End frame is not supported when there are more than 2 images'
      );
    }

    // Validate each image has a URL
    for (let i = 0; i < params.image_list.length; i++) {
      const item = params.image_list[i];
      if (!item.image_url || item.image_url.trim() === '') {
        throw new ValidationError(`image_list[${i}].image_url`, 'Image URL is required');
      }
    }
  }

  // Validate enum fields
  if (params.aspect_ratio)
    validateEnumValue('aspect_ratio', params.aspect_ratio, VALID_VIDEO_ASPECT_RATIOS);
  if (params.duration) validateEnumValue('duration', params.duration, VALID_VIDEO_DURATIONS);
}
