/**
 * Image Validators
 *
 * Validation functions for image generation parameters including:
 * - Image generation
 * - Image expansion
 * - Omni image
 * - Multi-image-to-image
 */

import type {
  ImageGenParams,
  ImageExpandParams,
  OmniImageParams,
  MultiImageToImageParams,
} from '../../types.js';

import {
  VALID_IMAGE_ASPECT_RATIOS,
  VALID_IMAGE_RESOLUTIONS,
  IMAGE_FIDELITY_RANGE,
  HUMAN_FIDELITY_RANGE,
  EXPANSION_RATIO_RANGE,
  MAX_TOTAL_EXPANSION,
  N_RANGE,
  MAX_SUBJECT_IMAGE_COUNT,
  VALID_OMNI_IMAGE_ASPECT_RATIOS,
  VALID_MULTI_IMAGE_TO_IMAGE_MODELS,
} from '../constants.js';

import { IMAGE_GEN_MODELS } from '../models.js';

import {
  ValidationError,
  validateRange,
  validateEnumValue,
  validatePromptLength,
  validateRequired,
  validateModel,
} from './helpers.js';

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
