/**
 * Utils Constants
 *
 * Shared constants for utility functions.
 */

// ============================================================================
// Export Constants
// ============================================================================

/** Exponential backoff base multiplier in milliseconds */
export const BACKOFF_BASE_MS = 1000;

/** Maximum video file size (500MB) */
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

/** Video download timeout in milliseconds (2 minutes) */
export const VIDEO_DOWNLOAD_TIMEOUT = 120000;

/** Image/audio download timeout in milliseconds (1 minute) */
export const MEDIA_DOWNLOAD_TIMEOUT = 60000;

/** Maximum number of redirects allowed */
export const MAX_REDIRECTS = 5;

// ============================================================================
// Internal Constants (used by security module)
// ============================================================================

/** Private IP ranges for SSRF protection */
export const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^localhost$/i,
  /^metadata\.google\.internal$/i,
];

/** Cloud metadata endpoints to block */
export const BLOCKED_HOSTS = ['169.254.169.254', 'metadata.google.internal', 'metadata.aws'];
