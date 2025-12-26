/**
 * Utils Module
 *
 * Barrel export for all utility functions and types.
 * Maintains backwards compatibility with the original utils.ts exports.
 */

// Constants
export {
  BACKOFF_BASE_MS,
  MAX_VIDEO_SIZE,
  VIDEO_DOWNLOAD_TIMEOUT,
  MEDIA_DOWNLOAD_TIMEOUT,
  MAX_REDIRECTS,
} from './constants.js';

// Logger
export { logger } from './logger.js';
export type { LoggerFunction, Logger } from './logger.js';

// Security
export { validateUrl, redactKey, sanitizeError, isProduction } from './security.js';

// File I/O
export {
  ensureDirectory,
  generateFilename,
  sanitizePromptForFilename,
  saveFile,
  saveMetadata,
} from './file-io.js';

// Media processing
export {
  isHttpUrl,
  processMediaSource,
  imageToBase64,
  validateImageBuffer,
  validateImageExtension,
  audioToBase64,
  validateAudioExtension,
  copyOptionalParams,
} from './media.js';
export type { MediaConverter } from './media.js';

// Downloads
export { downloadVideo, downloadImage } from './downloads.js';

// Polling
export { pollWithSpinner, sleep, formatDuration } from './polling.js';
export type { PollOptions } from './polling.js';
