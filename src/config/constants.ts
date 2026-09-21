/**
 * Kling API Constants
 *
 * API configuration constants, size limits, and valid value arrays.
 */

// Local aliases, structurally identical to the 1.x unions in `../types.ts`.
// They are declared here rather than imported so this file has no dependency on
// `types.ts` — which the 2.0 removal commit (spec §3.1, 2a₀) deletes — and so the
// 1.x import cycle `config/constants.ts ↔ types.ts` is gone (madge baseline, Phase 0).
type VideoAspectRatio = '16:9' | '9:16' | '1:1';
type ImageAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';
type VideoMode = 'std' | 'pro';
type VideoDuration = '5' | '10';
type ImageResolution = '1k' | '2k';
type CameraType =
  | 'simple'
  | 'down_back'
  | 'forward_up'
  | 'right_turn_forward'
  | 'left_turn_forward';

// ============================================================================
// API Configuration
// ============================================================================

/** Kling API base URL */
export const BASE_URL = 'https://api-singapore.klingai.com';

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT = 30000;

/** Default polling interval in milliseconds */
export const DEFAULT_POLL_INTERVAL = 3000;

/** Default polling timeout in milliseconds (15 minutes for video, accommodates pro mode) */
export const DEFAULT_POLL_TIMEOUT = 900000;

// ============================================================================
// Size Limits
// ============================================================================

/** Maximum prompt length */
export const MAX_PROMPT_LENGTH = 2500;

/** Maximum voices allowed in voice_list */
export const MAX_VOICE_LIST_LENGTH = 2;

/** Maximum image file size in bytes (10MB) */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Maximum audio file size in bytes (5MB) */
export const MAX_AUDIO_SIZE = 5 * 1024 * 1024;

/** Minimum image dimension in pixels */
export const MIN_IMAGE_DIMENSION = 300;

/** Minimum audio duration in seconds */
export const MIN_AUDIO_DURATION = 2;

/** Maximum audio duration in seconds */
export const MAX_AUDIO_DURATION = 300;

// ============================================================================
// Valid Value Arrays
// ============================================================================

/** Valid video aspect ratios */
export const VALID_VIDEO_ASPECT_RATIOS: VideoAspectRatio[] = ['16:9', '9:16', '1:1'];

/** Valid image aspect ratios */
export const VALID_IMAGE_ASPECT_RATIOS: ImageAspectRatio[] = [
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '21:9',
];

/** Valid video modes */
export const VALID_VIDEO_MODES: VideoMode[] = ['std', 'pro'];

/** Valid video durations */
export const VALID_VIDEO_DURATIONS: VideoDuration[] = ['5', '10'];

/** Valid image resolutions */
export const VALID_IMAGE_RESOLUTIONS: ImageResolution[] = ['1k', '2k'];

/** Valid camera types */
export const VALID_CAMERA_TYPES: CameraType[] = [
  'simple',
  'down_back',
  'forward_up',
  'right_turn_forward',
  'left_turn_forward',
];

/** Supported image formats */
export const SUPPORTED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png'];

/** Supported audio formats */
export const SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'm4a', 'aac'];

// ============================================================================
// Validation Ranges
// ============================================================================

/** cfg_scale valid range [min, max] */
export const CFG_SCALE_RANGE = { min: 0, max: 1 } as const;

/** image_fidelity valid range [min, max] */
export const IMAGE_FIDELITY_RANGE = { min: 0, max: 1 } as const;

/** human_fidelity valid range [min, max] */
export const HUMAN_FIDELITY_RANGE = { min: 0, max: 1 } as const;

/** Expansion ratio valid range per direction [min, max] */
export const EXPANSION_RATIO_RANGE = { min: 0, max: 2 } as const;

/** Maximum total expansion ratio (area multiplier) */
export const MAX_TOTAL_EXPANSION = 3;

/** Number of generated images range [min, max] */
export const N_RANGE = { min: 1, max: 9 } as const;

/** Maximum images for multi-image-to-video */
export const MAX_MULTI_IMAGE_VIDEO_COUNT = 4;

/** Maximum subject images for multi-image-to-image */
export const MAX_SUBJECT_IMAGE_COUNT = 4;

/** Valid omni image aspect ratios (includes 'auto') */
export const VALID_OMNI_IMAGE_ASPECT_RATIOS = [
  '16:9',
  '9:16',
  '1:1',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '21:9',
  'auto',
] as const;

/** Valid multi-image-to-image models */
export const VALID_MULTI_IMAGE_TO_IMAGE_MODELS = ['kling-v2', 'kling-v2-1'] as const;

/** Camera control config value range [min, max] */
export const CAMERA_CONFIG_RANGE = { min: -10, max: 10 } as const;

/** Maximum number of non-zero camera config parameters */
export const MAX_CAMERA_CONFIG_NON_ZERO = 1;

// ============================================================================
// Error Codes
// ============================================================================

/** Error code categories */
export const ERROR_CODES = {
  // Success
  SUCCESS: 0,

  // Authentication errors (1000-1004)
  AUTH_FAILED: 1000,
  AUTH_INVALID_TOKEN: 1001,
  AUTH_TOKEN_EXPIRED: 1002,
  AUTH_MISSING_TOKEN: 1003,
  AUTH_INVALID_SIGNATURE: 1004,

  // Account/Rate limit errors (1100-1104)
  ACCOUNT_LIMIT: 1100,
  RATE_LIMIT: 1101,
  CONCURRENT_LIMIT: 1102,
  RESOURCE_UNAUTHORIZED: 1103,
  QUEUE_FULL: 1104,

  // Parameter errors (1200-1203)
  INVALID_PARAMS: 1200,
  MISSING_PARAMS: 1201,
  PARAM_OUT_OF_RANGE: 1202,
  INVALID_FORMAT: 1203,

  // Policy errors (1300-1304)
  CONTENT_POLICY: 1300,
  RATE_POLICY: 1301,
  USAGE_POLICY: 1302,

  // Server errors (5000-5001)
  INTERNAL_ERROR: 5000,
  SERVICE_UNAVAILABLE: 5001,
} as const;

// ============================================================================
// Vendor Error Table (2.0)
// ============================================================================

/**
 * The vendor's complete error table — 21 business codes plus success — transcribed
 * from `docs/api/kling-get-started-error-codes.md` (fetched 2026-09-20). Names are
 * derived from the vendor's *Explanation* column, not from the 1.x `ERROR_CODES` above,
 * whose names drifted (`1102` is "resource pack exhausted or expired", not a concurrency
 * limit; `1202` is "requested method is invalid", not a range error; `1104` does not
 * exist). `ERROR_CODES` is kept for the 1.x surface until the 2.0 removal commit
 * renames this table to `ERROR_CODES` (spec §3.1, 2a₀).
 *
 * `1003`/`1004` (`nbf`/`exp`) are JWT failures. They are in the table because the vendor
 * lists them, but an API-Key client cannot produce them.
 */
export const ERROR_CODES_V2 = {
  SUCCESS: 0,

  // 401 — Authentication failed
  AUTH_FAILED: 1000,
  AUTH_EMPTY: 1001,
  AUTH_INVALID: 1002,
  AUTH_NOT_YET_VALID: 1003, // JWT nbf — unreachable without AK/SK
  AUTH_EXPIRED: 1004, // JWT exp — unreachable without AK/SK

  // 429 / 403 — Account exception
  ACCOUNT_ABNORMAL: 1100,
  ACCOUNT_IN_ARREARS: 1101, // postpaid
  RESOURCE_PACK_EXHAUSTED: 1102, // prepaid: exhausted or expired — per product type
  RESOURCE_UNAUTHORIZED: 1103, // 403: no access to the requested API/model

  // 400 / 404 — Invalid request parameters
  INVALID_REQUEST_PARAMS: 1200,
  INVALID_PARAM_VALUE: 1201, // "refer to the message field"
  INVALID_METHOD: 1202, // 404
  RESOURCE_NOT_FOUND: 1203, // 404: e.g. the model

  // 400 / 429 — Trigger strategy
  POLICY_BLOCKED: 1300,
  CONTENT_SECURITY_POLICY: 1301,
  RATE_LIMIT_EXCEEDED: 1302, // 429
  CONCURRENCY_LIMIT_EXCEEDED: 1303, // 429: "parallel task over resource pack limit" — response has no `data`
  IP_WHITELIST_POLICY: 1304, // 429

  // 5xx — Internal error
  INTERNAL_ERROR: 5000, // 500
  SERVICE_UNAVAILABLE: 5001, // 503
  INTERNAL_TIMEOUT: 5002, // 504: "usually due to a backlog" — a create may already exist
} as const;

/** A vendor business error code (the numeric values of `ERROR_CODES_V2`). */
export type VendorErrorCode = (typeof ERROR_CODES_V2)[keyof typeof ERROR_CODES_V2];

/**
 * HTTP status the vendor documents for each business code. Used by the error
 * family to classify a response when the body parses but the status is missing
 * or contradictory (e.g. a CDN rewrote it).
 */
export const VENDOR_HTTP_STATUS: Readonly<Record<VendorErrorCode, number>> = {
  0: 200,
  1000: 401,
  1001: 401,
  1002: 401,
  1003: 401,
  1004: 401,
  1100: 429,
  1101: 429,
  1102: 429,
  1103: 403,
  1200: 400,
  1201: 400,
  1202: 404,
  1203: 404,
  1300: 400,
  1301: 400,
  1302: 429,
  1303: 429,
  1304: 429,
  5000: 500,
  5001: 503,
  5002: 504,
};

/**
 * Codes the vendor labels "try again later". This is the vendor's signal only —
 * it says nothing about whether a create was accepted (see `KlingAPIError.taskState`).
 */
export const TRANSIENT_ERROR_CODES: ReadonlySet<number> = new Set([
  ERROR_CODES_V2.RATE_LIMIT_EXCEEDED,
  ERROR_CODES_V2.CONCURRENCY_LIMIT_EXCEEDED,
  ERROR_CODES_V2.INTERNAL_ERROR,
  ERROR_CODES_V2.SERVICE_UNAVAILABLE,
  ERROR_CODES_V2.INTERNAL_TIMEOUT,
]);

/** HTTP statuses treated as transient when the body carries no business code. */
export const TRANSIENT_HTTP_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

/**
 * 429s that are NOT transient: the pack is exhausted (`1102`) or the caller's IP is
 * not whitelisted (`1304`). Retrying them only burns attempts (run #3 anxiety F7).
 */
export const PERMANENT_429_CODES: ReadonlySet<number> = new Set([
  ERROR_CODES_V2.RESOURCE_PACK_EXHAUSTED,
  ERROR_CODES_V2.IP_WHITELIST_POLICY,
]);

/**
 * Codes on which a *write* that got this response was definitely NOT enqueued —
 * the vendor rejected it before doing anything. Everything the server answers with a
 * 4xx business code falls here, including `1303` (the concurrency refusal).
 * Anything else a write receives — `5000`/`5002`, an unparseable body, a 5xx without a
 * code, a lost response — is `'may-exist'`.
 */
export const WRITE_NOT_CREATED_CODES: ReadonlySet<number> = new Set([
  ERROR_CODES_V2.AUTH_FAILED,
  ERROR_CODES_V2.AUTH_EMPTY,
  ERROR_CODES_V2.AUTH_INVALID,
  ERROR_CODES_V2.AUTH_NOT_YET_VALID,
  ERROR_CODES_V2.AUTH_EXPIRED,
  ERROR_CODES_V2.ACCOUNT_ABNORMAL,
  ERROR_CODES_V2.ACCOUNT_IN_ARREARS,
  ERROR_CODES_V2.RESOURCE_PACK_EXHAUSTED,
  ERROR_CODES_V2.RESOURCE_UNAUTHORIZED,
  ERROR_CODES_V2.INVALID_REQUEST_PARAMS,
  ERROR_CODES_V2.INVALID_PARAM_VALUE,
  ERROR_CODES_V2.INVALID_METHOD,
  ERROR_CODES_V2.RESOURCE_NOT_FOUND,
  ERROR_CODES_V2.POLICY_BLOCKED,
  ERROR_CODES_V2.CONTENT_SECURITY_POLICY,
  ERROR_CODES_V2.RATE_LIMIT_EXCEEDED,
  ERROR_CODES_V2.CONCURRENCY_LIMIT_EXCEEDED,
  ERROR_CODES_V2.IP_WHITELIST_POLICY,
]);

// ============================================================================
// 2.0 — output retention (spec D4, D14)
// ============================================================================

/**
 * How long the vendor keeps generated output URLs alive: every result field in
 * `docs/api` carries "generated results will be cleared after 30 days". The codecs
 * derive `Task.outputsExpireAt = updatedAt + OUTPUT_RETENTION_MS` on `succeeded`
 * tasks; the saver refuses past it unless forced. Vendor-stated, not measured.
 */
export const OUTPUT_RETENTION_MS = 30 * 86_400_000;

/**
 * Timestamps below this are read as SECONDS and multiplied by 1000 (spec Q12). Both
 * standards document Unix ms, and 1e11 ms is 1973 — no vendor task predates it — while
 * 1e11 s is the year 5138, so no ms value ever falls below the line.
 */
export const TIMESTAMP_SECONDS_CEILING = 1e11;
