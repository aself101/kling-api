/**
 * Avatar Validators
 *
 * Validation functions for avatar creation parameters.
 */

import type { AvatarParams } from '../../types.js';

import { VALID_VIDEO_MODES } from '../constants.js';

import {
  ValidationError,
  validateEnumValue,
  validatePromptLength,
  validateRequired,
} from './helpers.js';

// ============================================================================
// Avatar Validation
// ============================================================================

/**
 * Validate avatar creation parameters
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
