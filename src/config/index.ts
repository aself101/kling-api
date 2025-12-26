/**
 * Kling API Configuration Module
 *
 * Re-exports all configuration components for backwards compatibility.
 * Individual modules can also be imported directly for better tree-shaking.
 */

// Constants
export {
  BASE_URL,
  DEFAULT_TIMEOUT,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_POLL_TIMEOUT,
  MAX_PROMPT_LENGTH,
  MAX_IMAGE_SIZE,
  MAX_AUDIO_SIZE,
  MIN_IMAGE_DIMENSION,
  MIN_AUDIO_DURATION,
  MAX_AUDIO_DURATION,
  VALID_VIDEO_ASPECT_RATIOS,
  VALID_IMAGE_ASPECT_RATIOS,
  VALID_VIDEO_MODES,
  VALID_VIDEO_DURATIONS,
  VALID_IMAGE_RESOLUTIONS,
  VALID_CAMERA_TYPES,
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_AUDIO_FORMATS,
  ERROR_CODES,
} from './constants.js';

// Model definitions
export { TEXT_TO_VIDEO_MODELS, IMAGE_TO_VIDEO_MODELS, IMAGE_GEN_MODELS } from './models.js';

// Configuration loaders
export { loadCredentials, loadConfig } from './loaders.js';

// Validators
export {
  ValidationError,
  validateTextToVideoParams,
  validateImageToVideoParams,
  validateImageGenParams,
  validateImageExpandParams,
  validateAvatarParams,
} from './validators.js';
