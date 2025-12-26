/**
 * Kling API Parameter Validators
 *
 * Validation functions for all API parameters including text-to-video,
 * image-to-video, image generation, image expansion, and avatar creation.
 */

import type {
  TextToVideoParams,
  ImageToVideoParams,
  ImageGenParams,
  ImageExpandParams,
  AvatarParams,
  ExtendVideoParams,
  MultiImageToVideoParams,
  OmniVideoParams,
  OmniImageParams,
  MultiImageToImageParams,
  CameraType,
  CameraConfig,
} from '../types.js';

import {
  MAX_PROMPT_LENGTH,
  MAX_VOICE_LIST_LENGTH,
  VALID_VIDEO_MODES,
  VALID_VIDEO_ASPECT_RATIOS,
  VALID_VIDEO_DURATIONS,
  VALID_IMAGE_ASPECT_RATIOS,
  VALID_IMAGE_RESOLUTIONS,
  VALID_CAMERA_TYPES,
  CFG_SCALE_RANGE,
  IMAGE_FIDELITY_RANGE,
  HUMAN_FIDELITY_RANGE,
  EXPANSION_RATIO_RANGE,
  MAX_TOTAL_EXPANSION,
  N_RANGE,
  MAX_MULTI_IMAGE_VIDEO_COUNT,
  MAX_SUBJECT_IMAGE_COUNT,
  VALID_OMNI_IMAGE_ASPECT_RATIOS,
  VALID_MULTI_IMAGE_TO_IMAGE_MODELS,
  CAMERA_CONFIG_RANGE,
  MAX_CAMERA_CONFIG_NON_ZERO,
} from './constants.js';

import { TEXT_TO_VIDEO_MODELS, IMAGE_TO_VIDEO_MODELS, IMAGE_GEN_MODELS } from './models.js';

// ============================================================================
// ValidationError Class
// ============================================================================

/** Validation error with field information */
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(`${field}: ${message}`);
    this.name = 'ValidationError';
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/** Range definition for numeric validation */
interface Range {
  readonly min: number;
  readonly max: number;
}

/**
 * Validate that a value is within a numeric range
 * @throws ValidationError if value is outside range
 */
function validateRange(field: string, value: number, range: Range): void {
  if (value < range.min || value > range.max) {
    throw new ValidationError(field, `must be between ${range.min} and ${range.max}`);
  }
}

/**
 * Validate that a value is one of the allowed enum values
 * @throws ValidationError if value is not in allowed list
 */
function validateEnumValue<T extends string>(
  field: string,
  value: T,
  allowed: readonly T[] | T[]
): void {
  if (!allowed.includes(value)) {
    throw new ValidationError(field, `must be one of: ${allowed.join(', ')}`);
  }
}

/**
 * Validate prompt length (for optional prompts)
 * @throws ValidationError if prompt exceeds max length
 */
function validatePromptLength(field: string, prompt: string | undefined): void {
  if (prompt && prompt.length > MAX_PROMPT_LENGTH) {
    throw new ValidationError(field, `cannot exceed ${MAX_PROMPT_LENGTH} characters`);
  }
}

/**
 * Validate a required string field is present and non-empty
 * @throws ValidationError if field is missing or empty
 */
function validateRequired(field: string, value: string | undefined, label?: string): void {
  if (!value || value.trim() === '') {
    throw new ValidationError(field, `${label ?? field} is required`);
  }
}

/**
 * Validate model exists in model registry
 * @returns The model capabilities
 * @throws ValidationError if model is invalid
 */
function validateModel<T>(
  modelName: string | undefined,
  defaultModel: string,
  registry: Record<string, T>
): T {
  const model = modelName ?? defaultModel;
  if (!(model in registry)) {
    throw new ValidationError(
      'model_name',
      `Invalid model. Must be one of: ${Object.keys(registry).join(', ')}`
    );
  }
  return registry[model];
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
// Image Generation Validation
// ============================================================================

/**
 * Validate image generation parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateImageGenParams(params: ImageGenParams): void {
  const modelCaps = validateModel(params.model_name, 'kling-v1', IMAGE_GEN_MODELS);

  // Validate prompts
  validateRequired('prompt', params.prompt, 'Prompt');
  validatePromptLength('prompt', params.prompt);
  validatePromptLength('negative_prompt', params.negative_prompt);

  // Validate image_reference
  if (params.image_reference) {
    if (!modelCaps.supportsImageReference) {
      throw new ValidationError(
        'image_reference',
        'image_reference is only supported by kling-v1-5'
      );
    }
    validateEnumValue('image_reference', params.image_reference, ['subject', 'face'] as const);
    if (!params.image) {
      throw new ValidationError('image', 'image is required when using image_reference');
    }
  }

  // Validate fidelity ranges
  if (params.image_fidelity !== undefined) {
    validateRange('image_fidelity', params.image_fidelity, IMAGE_FIDELITY_RANGE);
  }
  if (params.human_fidelity !== undefined) {
    if (params.image_reference !== 'face') {
      throw new ValidationError('human_fidelity', 'human_fidelity requires image_reference="face"');
    }
    validateRange('human_fidelity', params.human_fidelity, HUMAN_FIDELITY_RANGE);
  }

  // Validate n (number of images)
  if (params.n !== undefined) {
    if (!Number.isInteger(params.n)) {
      throw new ValidationError('n', 'n must be an integer');
    }
    if (params.n < 1 || params.n > modelCaps.maxN) {
      throw new ValidationError('n', `n must be between 1 and ${modelCaps.maxN}`);
    }
  }

  // Validate enum fields
  if (params.resolution)
    validateEnumValue('resolution', params.resolution, VALID_IMAGE_RESOLUTIONS);
  if (params.aspect_ratio)
    validateEnumValue('aspect_ratio', params.aspect_ratio, VALID_IMAGE_ASPECT_RATIOS);
}

// ============================================================================
// Image Expansion Validation
// ============================================================================

/**
 * Validate image expansion parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateImageExpandParams(params: ImageExpandParams): void {
  validateRequired('image', params.image, 'Image');

  // Validate all expansion ratios
  const ratioFields = [
    'up_expansion_ratio',
    'down_expansion_ratio',
    'left_expansion_ratio',
    'right_expansion_ratio',
  ] as const;

  for (const field of ratioFields) {
    const value = params[field];
    if (value === undefined || value === null) {
      throw new ValidationError(field, `${field} is required`);
    }
    validateRange(field, value, EXPANSION_RATIO_RANGE);
  }

  // Validate total expansion (max 3x original area)
  const verticalExpansion = 1 + params.up_expansion_ratio + params.down_expansion_ratio;
  const horizontalExpansion = 1 + params.left_expansion_ratio + params.right_expansion_ratio;
  const totalExpansion = verticalExpansion * horizontalExpansion;

  if (totalExpansion > MAX_TOTAL_EXPANSION) {
    throw new ValidationError(
      'expansion',
      `Total expanded area (${totalExpansion.toFixed(2)}x) exceeds maximum of ${MAX_TOTAL_EXPANSION}x original`
    );
  }
}

// ============================================================================
// Avatar Validation
// ============================================================================

/**
 * Validate avatar parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateAvatarParams(params: AvatarParams): void {
  validateRequired('image', params.image, 'Portrait image');

  // Validate audio (mutually exclusive)
  if (!params.audio_id && !params.sound_file) {
    throw new ValidationError('audio', 'Either audio_id or sound_file is required');
  }
  if (params.audio_id && params.sound_file) {
    throw new ValidationError('audio', 'Cannot use both audio_id and sound_file');
  }

  validatePromptLength('prompt', params.prompt);
  if (params.mode) validateEnumValue('mode', params.mode, VALID_VIDEO_MODES);
}

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

// ============================================================================
// Omni Image Validation
// ============================================================================

/**
 * Validate omni image parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateOmniImageParams(params: OmniImageParams): void {
  // Validate prompt (required)
  validateRequired('prompt', params.prompt, 'Prompt');
  validatePromptLength('prompt', params.prompt);

  // Validate model
  if (params.model_name && params.model_name !== 'kling-image-o1') {
    throw new ValidationError('model_name', 'Only kling-image-o1 is supported');
  }

  // Validate image_list
  if (params.image_list) {
    for (let i = 0; i < params.image_list.length; i++) {
      const item = params.image_list[i];
      if (!item.image || item.image.trim() === '') {
        throw new ValidationError(`image_list[${i}].image`, 'Image is required');
      }
    }
  }

  // Validate n
  if (params.n !== undefined) {
    if (!Number.isInteger(params.n)) {
      throw new ValidationError('n', 'n must be an integer');
    }
    validateRange('n', params.n, N_RANGE);
  }

  // Validate resolution
  if (params.resolution) {
    validateEnumValue('resolution', params.resolution, VALID_IMAGE_RESOLUTIONS);
  }

  // Validate aspect_ratio (includes 'auto')
  if (params.aspect_ratio) {
    validateEnumValue('aspect_ratio', params.aspect_ratio, [...VALID_OMNI_IMAGE_ASPECT_RATIOS]);
  }
}

// ============================================================================
// Multi-Image-to-Image Validation
// ============================================================================

/**
 * Validate multi-image-to-image parameters
 *
 * @param params - Parameters to validate
 * @throws ValidationError if any parameter is invalid
 */
export function validateMultiImageToImageParams(params: MultiImageToImageParams): void {
  // Validate subject_image_list (required)
  if (!params.subject_image_list || params.subject_image_list.length === 0) {
    throw new ValidationError('subject_image_list', 'At least one subject image is required');
  }
  if (params.subject_image_list.length > MAX_SUBJECT_IMAGE_COUNT) {
    throw new ValidationError(
      'subject_image_list',
      `Maximum ${MAX_SUBJECT_IMAGE_COUNT} subject images allowed`
    );
  }

  // Validate each subject image
  for (let i = 0; i < params.subject_image_list.length; i++) {
    const item = params.subject_image_list[i];
    if (!item.subject_image || item.subject_image.trim() === '') {
      throw new ValidationError(
        `subject_image_list[${i}].subject_image`,
        'Subject image is required'
      );
    }
  }

  // Validate prompts
  validatePromptLength('prompt', params.prompt);

  // Validate model
  if (params.model_name) {
    validateEnumValue('model_name', params.model_name, [...VALID_MULTI_IMAGE_TO_IMAGE_MODELS]);
  }

  // Validate n
  if (params.n !== undefined) {
    if (!Number.isInteger(params.n)) {
      throw new ValidationError('n', 'n must be an integer');
    }
    validateRange('n', params.n, N_RANGE);
  }

  // Validate aspect_ratio
  if (params.aspect_ratio) {
    validateEnumValue('aspect_ratio', params.aspect_ratio, VALID_IMAGE_ASPECT_RATIOS);
  }
}
