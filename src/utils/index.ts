/**
 * Utils barrel — logger, security, file I/O (spec §5: `utils/*` are kept).
 *
 * The 1.x media helpers moved to `docs/reference/1x-utils-media.ts` at 2a₀ as the port
 * reference for 2c (`media/source.ts`, `media/download.ts`); they were built on the 1.x HTTP
 * client, which 2.0 does not ship. `downloads.ts` and `polling.ts` were deleted at 2a₀.
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

