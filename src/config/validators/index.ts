/**
 * Validators Module
 *
 * Barrel export for all validation functions and types.
 * Maintains backwards compatibility with the original validators.ts exports.
 */

// Shared validation utilities
export {
  ValidationError,
  validateRange,
  validateEnumValue,
  validatePromptLength,
  validateRequired,
  validateModel,
} from './helpers.js';
export type { Range } from './helpers.js';

// Video validators
export {
  validateTextToVideoParams,
  validateImageToVideoParams,
  validateExtendVideoParams,
  validateMultiImageToVideoParams,
  validateOmniVideoParams,
} from './video.js';

// Image validators
export {
  validateImageGenParams,
  validateImageExpandParams,
  validateOmniImageParams,
  validateMultiImageToImageParams,
} from './image.js';

// Avatar validator
export { validateAvatarParams } from './avatar.js';
