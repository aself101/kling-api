/**
 * Download and URL-safety constants (spec D12). The 1.x-only entries were removed at 6c
 * (ship run #4: dead exports were being compiled into the tarball).
 */

// ============================================================================
// Export Constants
// ============================================================================

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

/** Cloud metadata endpoints refused by name (the address forms are caught by the range check). */
export const BLOCKED_HOSTS = ['169.254.169.254', 'metadata.google.internal', 'metadata.aws', 'metadata', 'instance-data'];
