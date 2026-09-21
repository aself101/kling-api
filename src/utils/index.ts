/**
 * Utils barrel — logger, security, file I/O (spec §5: `utils/*` are kept).
 *
 * The 1.x media helpers (`media.ts`, `downloads.ts`, `polling.ts`) are gone: their checks
 * were ported into `media/source.ts` and `media/download.ts` (2c) and `handlers/poller.ts`
 * (2a₁); the 1.x reference copy kept under `docs/reference/` through 2a₀–2b was deleted at 2c.
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
export { assertSafeUrl, isPublicAddress, redactKey, sanitizeError, isProduction, UnsafeUrlError } from './security.js';
export type { AssertSafeUrlOptions, LookupFn, UrlRejection } from './security.js';

// File I/O
export {
  ensureDirectory,
  generateFilename,
  sanitizePromptForFilename,
  saveFile,
  saveMetadata,
} from './file-io.js';

