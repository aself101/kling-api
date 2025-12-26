/**
 * Test Constants
 *
 * Named constants for magic numbers used in tests. These should align with
 * the corresponding values in the source code for maintainability.
 */

// ============================================================================
// Retry Constants
// ============================================================================

/** Base delay for exponential backoff (milliseconds) - aligns with BACKOFF_BASE_MS */
export const RETRY_BASE_DELAY_MS = 1000;

/** First retry delay: 2^1 * RETRY_BASE_DELAY_MS = 2000ms */
export const FIRST_RETRY_DELAY_MS = 2000;

/** Second retry delay: 2^2 * RETRY_BASE_DELAY_MS = 4000ms */
export const SECOND_RETRY_DELAY_MS = 4000;

/** Third retry delay: 2^3 * RETRY_BASE_DELAY_MS = 8000ms */
export const THIRD_RETRY_DELAY_MS = 8000;

/** Maximum number of retry attempts - aligns with default in KlingAPI._request */
export const MAX_RETRY_ATTEMPTS = 3;

// ============================================================================
// JWT Token Constants
// ============================================================================

/** JWT token validity duration in seconds (30 minutes) - aligns with TOKEN_VALIDITY_SECONDS */
export const JWT_EXPIRY_SECONDS = 1800;

/** JWT token validity in minutes (30 minutes) */
export const JWT_EXPIRY_MINUTES = 30;

/** Token cache buffer in seconds (refresh 5 min before expiry) - aligns with CACHE_BUFFER_SECONDS */
export const TOKEN_EXPIRY_BUFFER_SECONDS = 300;

/** Token cache buffer in minutes (5 minutes) */
export const TOKEN_EXPIRY_BUFFER_MINUTES = 5;

/** Clock skew tolerance in seconds - aligns with CLOCK_SKEW_SECONDS */
export const CLOCK_SKEW_SECONDS = 5;

/** Time at which token reaches buffer boundary (JWT_EXPIRY_MINUTES - TOKEN_EXPIRY_BUFFER_MINUTES) */
export const BUFFER_BOUNDARY_MINUTES = JWT_EXPIRY_MINUTES - TOKEN_EXPIRY_BUFFER_MINUTES; // 25 min

/** Time at which token reaches buffer boundary in milliseconds */
export const BUFFER_BOUNDARY_MS = BUFFER_BOUNDARY_MINUTES * 60 * 1000; // 25 * 60 * 1000

/** Time just past expiry in minutes (JWT_EXPIRY_MINUTES + 1) */
export const PAST_EXPIRY_MINUTES = JWT_EXPIRY_MINUTES + 1; // 31 min

// ============================================================================
// Timeout Constants
// ============================================================================

/** Default request timeout in milliseconds - aligns with DEFAULT_TIMEOUT */
export const DEFAULT_TIMEOUT_MS = 30000;

/** Default poll timeout in milliseconds - aligns with DEFAULT_POLL_TIMEOUT */
export const DEFAULT_POLL_TIMEOUT_MS = 600000;

/** Default poll interval in milliseconds - aligns with DEFAULT_POLL_INTERVAL */
export const DEFAULT_POLL_INTERVAL_MS = 3000;

// ============================================================================
// HTTP Status Codes
// ============================================================================

/** Retryable HTTP status codes */
export const RETRYABLE_STATUS_CODES = [502, 503, 504] as const;

/** Non-retryable HTTP status codes */
export const NON_RETRYABLE_STATUS_CODES = [400, 401, 422, 429] as const;

// ============================================================================
// JWT Format Regex
// ============================================================================

/** JWT token format regex (three base64url segments separated by dots) */
export const JWT_FORMAT_REGEX = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/** Base64 format regex (standard base64 encoding) */
export const BASE64_FORMAT_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;
