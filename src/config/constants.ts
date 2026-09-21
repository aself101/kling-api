/**
 * Constants (spec §5 `config/constants.ts`): base URL, defaults, the vendor error table
 * and its derived classification sets, output retention.
 *
 * The 1.x `VALID_*` arrays, validation ranges and hand-written error table were removed
 * at 2a₀; 2.0's per-model capability tables live in `config/models.ts` (2a₁) and its
 * limits in `config/validators/*` (2a₂/3a).
 */

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
// Vendor Error Table (2.0)
// ============================================================================

/**
 * The vendor's complete error table — 21 business codes plus success — transcribed
 * from `docs/api/kling-get-started-error-codes.md` (fetched 2026-09-20). Names are
 * derived from the vendor's *Explanation* column, not from the 1.x table this replaced,
 * whose names had drifted (`1102` is "resource pack exhausted or expired", not a
 * concurrency limit; `1202` is "requested method is invalid", not a range error; `1104`
 * does not exist). Shipped as `ERROR_CODES_V2` beside the 1.x table during Phase 1 and
 * renamed here at 2a₀ when that table was deleted (spec §3.1).
 *
 * `1003`/`1004` (`nbf`/`exp`) are JWT failures. They are in the table because the vendor
 * lists them, but an API-Key client cannot produce them.
 */
export const ERROR_CODES = {
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

/** A vendor business error code (the numeric values of `ERROR_CODES`). */
export type VendorErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

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
  ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ERROR_CODES.CONCURRENCY_LIMIT_EXCEEDED,
  ERROR_CODES.INTERNAL_ERROR,
  ERROR_CODES.SERVICE_UNAVAILABLE,
  ERROR_CODES.INTERNAL_TIMEOUT,
]);

/** HTTP statuses treated as transient when the body carries no business code. */
export const TRANSIENT_HTTP_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

/**
 * 429s that are NOT transient: the pack is exhausted (`1102`) or the caller's IP is
 * not whitelisted (`1304`). Retrying them only burns attempts (run #3 anxiety F7).
 */
export const PERMANENT_429_CODES: ReadonlySet<number> = new Set([
  ERROR_CODES.RESOURCE_PACK_EXHAUSTED,
  ERROR_CODES.IP_WHITELIST_POLICY,
]);

/**
 * Codes on which a *write* that got this response was definitely NOT enqueued —
 * the vendor rejected it before doing anything. Everything the server answers with a
 * 4xx business code falls here, including `1303` (the concurrency refusal).
 * Anything else a write receives — `5000`/`5002`, an unparseable body, a 5xx without a
 * code, a lost response — is `'may-exist'`.
 */
export const WRITE_NOT_CREATED_CODES: ReadonlySet<number> = new Set([
  ERROR_CODES.AUTH_FAILED,
  ERROR_CODES.AUTH_EMPTY,
  ERROR_CODES.AUTH_INVALID,
  ERROR_CODES.AUTH_NOT_YET_VALID,
  ERROR_CODES.AUTH_EXPIRED,
  ERROR_CODES.ACCOUNT_ABNORMAL,
  ERROR_CODES.ACCOUNT_IN_ARREARS,
  ERROR_CODES.RESOURCE_PACK_EXHAUSTED,
  ERROR_CODES.RESOURCE_UNAUTHORIZED,
  ERROR_CODES.INVALID_REQUEST_PARAMS,
  ERROR_CODES.INVALID_PARAM_VALUE,
  ERROR_CODES.INVALID_METHOD,
  ERROR_CODES.RESOURCE_NOT_FOUND,
  ERROR_CODES.POLICY_BLOCKED,
  ERROR_CODES.CONTENT_SECURITY_POLICY,
  ERROR_CODES.RATE_LIMIT_EXCEEDED,
  ERROR_CODES.CONCURRENCY_LIMIT_EXCEEDED,
  ERROR_CODES.IP_WHITELIST_POLICY,
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

// ============================================================================
// 2.0 — new-standard field names the library models (spec D9, run #3 A41)
// ============================================================================

/** `settings` keys the builders write. An `extraSettings` key among these is rejected — the hatch cannot override a validated field. */
export const MODELED_SETTINGS: ReadonlySet<string> = new Set(['resolution', 'aspect_ratio', 'duration', 'audio', 'multi_shot', 'character_orientation']);
/** `options` keys the builders write (App. B §2.0). */
export const MODELED_OPTIONS: ReadonlySet<string> = new Set(['callback_url', 'external_task_id', 'watermark_info']);
/** Top-level keys the legacy (flat-body) image builders write; `extraSettings` may not carry one (run #3 A41). */
export const MODELED_LEGACY_FIELDS: ReadonlySet<string> = new Set([
  'model_name', 'prompt', 'negative_prompt', 'image', 'image_reference', 'image_fidelity', 'human_fidelity', 'element_list', 'image_list',
  'resolution', 'result_type', 'series_amount', 'n', 'aspect_ratio', 'subject_image_list', 'scene_image', 'style_image',
  'up_expansion_ratio', 'down_expansion_ratio', 'left_expansion_ratio', 'right_expansion_ratio', 'element_frontal_image',
  'watermark_info', 'callback_url', 'external_task_id',
]);

// ============================================================================
// 2.0 — inline media caps (spec D12, run #2 A22, run #3 A45)
// ============================================================================

/**
 * Decoded bytes an inline (Base64) image may carry, per API standard. DECIMAL megabytes
 * so a passing file is under the vendor's limit whichever unit it means. Legacy `/v1/`
 * image endpoints document "10MB" (`kling-image-2.1-generation.md:77`); the new standard
 * documents 50 MB for URLs and nothing for inline, so 20 MB is the library's own line —
 * a 50 MB Base64 body would be ~67 MB of JSON against an unpublished edge limit.
 */
export const INLINE_MEDIA_CAP_BYTES: Readonly<Record<'legacy' | 'new', number>> = { legacy: 10_000_000, new: 20_000_000 };

/** Encoded Base64 characters across every inline input of ONE request (≈ 30 MB of files). */
export const INLINE_MEDIA_AGGREGATE_CAP_BYTES = 40_000_000;

/** Vendor image rules stated on every video/image page: `.jpg/.jpeg/.png`, ≥ 300 px per side, aspect within 1:2.5 – 2.5:1. */
export const SUPPORTED_IMAGE_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png'];
export const MIN_IMAGE_DIMENSION_PX = 300;
export const MAX_IMAGE_ASPECT = 2.5;
/** Audio inputs (voice creation, avatar): `kling-omni-3.0-voice-mgt.md`, `kling-avatar.md`. */
export const SUPPORTED_AUDIO_EXTENSIONS: readonly string[] = ['mp3', 'wav', 'm4a', 'aac'];
