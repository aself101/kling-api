/**
 * Kling API Constants
 *
 * API configuration constants, size limits, and valid value arrays.
 */

import type {
  VideoAspectRatio,
  ImageAspectRatio,
  VideoMode,
  VideoDuration,
  ImageResolution,
  CameraType,
} from '../types.js';

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
