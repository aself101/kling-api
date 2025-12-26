/**
 * Kling API TypeScript Types
 * Comprehensive type definitions for all API endpoints
 */

// ============================================================================
// Enums and Constants
// ============================================================================

/** Video generation modes */
export type VideoMode = 'std' | 'pro';

/** Video durations in seconds */
export type VideoDuration = '5' | '10';

/** Video aspect ratios */
export type VideoAspectRatio = '16:9' | '9:16' | '1:1';

/** Image aspect ratios (more options than video) */
export type ImageAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';

/** Image resolution options */
export type ImageResolution = '1k' | '2k';

/** Image reference types */
export type ImageReferenceType = 'subject' | 'face';

/** Sound generation toggle */
export type SoundOption = 'on' | 'off';

/** Camera movement preset types */
export type CameraType =
  | 'simple'
  | 'down_back'
  | 'forward_up'
  | 'right_turn_forward'
  | 'left_turn_forward';

/** Task status values */
export type TaskStatus = 'submitted' | 'processing' | 'succeed' | 'failed';

/** Text-to-video model names */
export type TextToVideoModel =
  | 'kling-v1'
  | 'kling-v1-6'
  | 'kling-v2-master'
  | 'kling-v2-1-master'
  | 'kling-v2-5-turbo'
  | 'kling-v2-6';

/** Image-to-video model names */
export type ImageToVideoModel =
  | 'kling-v1'
  | 'kling-v1-5'
  | 'kling-v1-6'
  | 'kling-v2-master'
  | 'kling-v2-1'
  | 'kling-v2-1-master'
  | 'kling-v2-5-turbo'
  | 'kling-v2-6';

/** Image generation model names */
export type ImageGenModel = 'kling-v1' | 'kling-v1-5' | 'kling-v2' | 'kling-v2-new' | 'kling-v2-1';

/** Omni video model */
export type OmniVideoModel = 'kling-video-o1';

/** Omni image model */
export type OmniImageModel = 'kling-image-o1';

// ============================================================================
// Camera Control Types
// ============================================================================

/** Camera configuration for fine-grained control */
export interface CameraConfig {
  /** Horizontal movement (-10 to 10) */
  horizontal?: number;
  /** Vertical movement (-10 to 10) */
  vertical?: number;
  /** Pan rotation (-10 to 10) */
  pan?: number;
  /** Tilt rotation (-10 to 10) */
  tilt?: number;
  /** Roll rotation (-10 to 10) */
  roll?: number;
  /** Zoom control (-10 to 10) */
  zoom?: number;
  /** Allow dynamic property access for validation */
  [key: string]: number | undefined;
}

/** Camera control settings for video generation */
export interface CameraControl {
  /** Preset camera movement type */
  type?: CameraType;
  /** Fine-grained camera configuration (for type='simple') */
  config?: CameraConfig;
}

// ============================================================================
// Voice and Audio Types
// ============================================================================

/** Voice reference for video generation */
export interface VoiceReference {
  /** Voice ID from custom voice API */
  voice_id: string;
}

// ============================================================================
// Text-to-Video Types
// ============================================================================

/** Parameters for text-to-video generation */
export interface TextToVideoParams {
  /** Model version (default: kling-v1) */
  model_name?: TextToVideoModel;
  /** Positive text prompt (required, max 2500 chars) */
  prompt: string;
  /** Negative text prompt (max 2500 chars) */
  negative_prompt?: string;
  /** Generate sound with video (v2.6+ only) */
  sound?: SoundOption;
  /** CFG scale 0-1 (not supported by v2.x models) */
  cfg_scale?: number;
  /** Generation mode */
  mode?: VideoMode;
  /** Camera movement settings */
  camera_control?: CameraControl;
  /** Video aspect ratio */
  aspect_ratio?: VideoAspectRatio;
  /** Video duration in seconds */
  duration?: VideoDuration;
  /** Webhook URL for status notifications */
  callback_url?: string;
  /** Custom task ID (must be unique per account) */
  external_task_id?: string;
}

// ============================================================================
// Image-to-Video Types
// ============================================================================

/** Dynamic mask region for motion control */
export interface DynamicMask {
  /** Mask image (base64 or URL) */
  mask: string;
  /** Trajectory points */
  trajectories: { x: number; y: number }[];
}

/** Parameters for image-to-video generation */
export interface ImageToVideoParams {
  /** Model version (default: kling-v1) */
  model_name?: ImageToVideoModel;
  /** Start frame image (base64 or URL, required) */
  image: string;
  /** End frame image (base64 or URL, pro mode only) */
  image_tail?: string;
  /** Positive text prompt (max 2500 chars) */
  prompt?: string;
  /** Negative text prompt (max 2500 chars) */
  negative_prompt?: string;
  /** Voice references for v2.6+ (max 2) */
  voice_list?: VoiceReference[];
  /** Dynamic mask regions for motion control */
  dynamic_masks?: DynamicMask[];
  /** Static mask for unchanged regions */
  static_mask?: string;
  /** CFG scale 0-1 (not supported by v2.x models) */
  cfg_scale?: number;
  /** Generation mode */
  mode?: VideoMode;
  /** Camera movement settings (cannot combine with masks) */
  camera_control?: CameraControl;
  /** Video aspect ratio */
  aspect_ratio?: VideoAspectRatio;
  /** Video duration in seconds */
  duration?: VideoDuration;
  /** Webhook URL for status notifications */
  callback_url?: string;
  /** Custom task ID */
  external_task_id?: string;
}

// ============================================================================
// Video Extension Types
// ============================================================================

/**
 * Parameters for extending existing videos
 *
 * @remarks
 * API method not yet implemented. Planned for future release.
 * See: https://docs.qingque.cn/d/home/eZQClXt3RYb4VTjqEfcGBIvEG
 */
export interface ExtendVideoParams {
  /** Task ID of the video to extend */
  task_id: string;
  /** Prompt for the extension */
  prompt?: string;
  /** Webhook URL for status notifications */
  callback_url?: string;
  /** Custom task ID */
  external_task_id?: string;
}

// ============================================================================
// Multi-Image-to-Video Types
// ============================================================================

/**
 * Parameters for multi-image video generation
 *
 * @remarks
 * API method not yet implemented. Planned for future release.
 */
export interface MultiImageToVideoParams {
  /** Model version */
  model_name?: ImageToVideoModel;
  /** Reference images (base64 or URLs) */
  images: string[];
  /** Positive text prompt */
  prompt?: string;
  /** Negative text prompt */
  negative_prompt?: string;
  /** Generation mode */
  mode?: VideoMode;
  /** Video aspect ratio */
  aspect_ratio?: VideoAspectRatio;
  /** Video duration in seconds */
  duration?: VideoDuration;
  /** Webhook URL */
  callback_url?: string;
  /** Custom task ID */
  external_task_id?: string;
}

// ============================================================================
// Image Generation Types
// ============================================================================

/** Parameters for image generation */
export interface ImageGenParams {
  /** Model version (default: kling-v1) */
  model_name?: ImageGenModel;
  /** Positive text prompt (required, max 2500 chars) */
  prompt: string;
  /** Negative text prompt (max 2500 chars) */
  negative_prompt?: string;
  /** Reference image (base64 or URL) */
  image?: string;
  /** Reference type (subject or face) */
  image_reference?: ImageReferenceType;
  /** Image fidelity 0-1 (default: 0.5) */
  image_fidelity?: number;
  /** Face similarity 0-1 (default: 0.45, face reference only) */
  human_fidelity?: number;
  /** Output resolution */
  resolution?: ImageResolution;
  /** Number of images to generate (1-9) */
  n?: number;
  /** Image aspect ratio */
  aspect_ratio?: ImageAspectRatio;
  /** Webhook URL */
  callback_url?: string;
  /** Custom task ID */
  external_task_id?: string;
}

// ============================================================================
// Image Expansion Types
// ============================================================================

/** Parameters for image expansion/outpainting */
export interface ImageExpandParams {
  /** Source image (base64 or URL, required) */
  image: string;
  /** Upward expansion ratio 0-2 */
  up_expansion_ratio: number;
  /** Downward expansion ratio 0-2 */
  down_expansion_ratio: number;
  /** Leftward expansion ratio 0-2 */
  left_expansion_ratio: number;
  /** Rightward expansion ratio 0-2 */
  right_expansion_ratio: number;
  /** Webhook URL */
  callback_url?: string;
  /** Custom task ID */
  external_task_id?: string;
}

// ============================================================================
// Avatar Types
// ============================================================================

/** Parameters for avatar/talking head generation */
export interface AvatarParams {
  /** Portrait image (base64 or URL, required) */
  image: string;
  /** TTS audio ID (mutually exclusive with sound_file) */
  audio_id?: string;
  /** Audio file (base64 or URL, mutually exclusive with audio_id) */
  sound_file?: string;
  /** Prompt for actions, emotions, camera movements */
  prompt?: string;
  /** Generation mode */
  mode?: VideoMode;
  /** Webhook URL */
  callback_url?: string;
  /** Custom task ID */
  external_task_id?: string;
}

// ============================================================================
// Omni Model Types
// ============================================================================

/** Image list item for Omni models */
export interface OmniImageListItem {
  /** Image (base64 or URL) */
  image: string;
  /** Image type for video: first_frame, end_frame, or reference */
  type?: 'first_frame' | 'end_frame' | 'reference';
}

/** Video list item for Omni video */
export interface OmniVideoListItem {
  /** Video ID or URL */
  video: string;
}

/** Element list item for Omni models */
export interface OmniElementListItem {
  /** Element image (base64 or URL) */
  image: string;
}

/**
 * Parameters for Omni video generation
 *
 * @remarks
 * API method not yet implemented. Planned for future release.
 */
export interface OmniVideoParams {
  /** Model (default: kling-video-o1) */
  model_name?: OmniVideoModel;
  /** Prompt with template syntax (<<<element_1>>>, <<<image_1>>>, <<<video_1>>>) */
  prompt: string;
  /** Reference images */
  image_list?: OmniImageListItem[];
  /** Reference videos */
  video_list?: OmniVideoListItem[];
  /** Element references */
  element_list?: OmniElementListItem[];
  /** Video aspect ratio */
  aspect_ratio?: VideoAspectRatio;
  /** Video duration */
  duration?: VideoDuration;
  /** Webhook URL */
  callback_url?: string;
  /** Custom task ID */
  external_task_id?: string;
}

/**
 * Parameters for Omni image generation
 *
 * @remarks
 * API method not yet implemented. Planned for future release.
 */
export interface OmniImageParams {
  /** Model (default: kling-image-o1) */
  model_name?: OmniImageModel;
  /** Prompt with template syntax (<<<image_1>>>) */
  prompt: string;
  /** Reference images */
  image_list?: OmniImageListItem[];
  /** Number of images to generate (1-9) */
  n?: number;
  /** Image aspect ratio */
  aspect_ratio?: ImageAspectRatio;
  /** Webhook URL */
  callback_url?: string;
  /** Custom task ID */
  external_task_id?: string;
}

// ============================================================================
// Multi-Image-to-Image Types
// ============================================================================

/**
 * Parameters for multi-image-to-image transformation
 *
 * @remarks
 * API method not yet implemented. Planned for future release.
 */
export interface MultiImageToImageParams {
  /** Source images */
  images: string[];
  /** Transformation prompt */
  prompt: string;
  /** Negative prompt */
  negative_prompt?: string;
  /** Number of output images (1-9) */
  n?: number;
  /** Output aspect ratio */
  aspect_ratio?: ImageAspectRatio;
  /** Webhook URL */
  callback_url?: string;
  /** Custom task ID */
  external_task_id?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/** Task creation response */
export interface TaskResponse {
  /** Error code (0 = success) */
  readonly code: number;
  /** Error message */
  readonly message: string;
  /** Request ID for tracking */
  readonly request_id: string;
  /** Task data */
  readonly data: {
    /** System-generated task ID */
    readonly task_id: string;
    /** Task status */
    readonly task_status: TaskStatus;
    /** Task creation parameters */
    readonly task_info?: {
      readonly external_task_id?: string;
    };
    /** Creation timestamp (Unix ms) */
    readonly created_at: number;
    /** Last update timestamp (Unix ms) */
    readonly updated_at: number;
  };
}

/** Generated video result */
export interface VideoResult {
  /** Unique video ID */
  readonly id: string;
  /** Video download URL */
  readonly url: string;
  /** Video duration in seconds */
  readonly duration: string;
}

/** Generated image result */
export interface ImageResult {
  /** Image index */
  readonly index: number;
  /** Image download URL */
  readonly url: string;
}

/** Task query response for video */
export interface VideoTaskResult {
  /** Error code (0 = success) */
  readonly code: number;
  /** Error message */
  readonly message: string;
  /** Request ID */
  readonly request_id: string;
  /** Task data */
  readonly data: {
    /** Task ID */
    readonly task_id: string;
    /** Task status */
    readonly task_status: TaskStatus;
    /** Failure reason (if failed) */
    readonly task_status_msg?: string;
    /** Task parameters */
    readonly task_info?: {
      readonly external_task_id?: string;
    };
    /** Creation timestamp */
    readonly created_at: number;
    /** Update timestamp */
    readonly updated_at: number;
    /** Generation results (when succeed) */
    readonly task_result?: {
      readonly videos: readonly VideoResult[];
    };
  };
}

/** Task query response for images */
export interface ImageTaskResult {
  /** Error code (0 = success) */
  readonly code: number;
  /** Error message */
  readonly message: string;
  /** Request ID */
  readonly request_id: string;
  /** Task data */
  readonly data: {
    /** Task ID */
    readonly task_id: string;
    /** Task status */
    readonly task_status: TaskStatus;
    /** Failure reason (if failed) */
    readonly task_status_msg?: string;
    /** Task parameters */
    readonly task_info?: {
      readonly external_task_id?: string;
    };
    /** Creation timestamp */
    readonly created_at: number;
    /** Update timestamp */
    readonly updated_at: number;
    /** Generation results (when succeed) */
    readonly task_result?: {
      readonly images: readonly ImageResult[];
    };
  };
}

// ============================================================================
// Account Types
// ============================================================================

/** Resource package status */
export type ResourcePackStatus = 'toBeOnline' | 'online' | 'expired' | 'runOut';

/** Resource package type */
export type ResourcePackType = 'decreasing_total' | 'constant_period';

/** Resource package information */
export interface ResourcePack {
  /** Package name */
  readonly resource_pack_name: string;
  /** Package ID */
  readonly resource_pack_id: string;
  /** Package type */
  readonly resource_pack_type: ResourcePackType;
  /** Total quantity */
  readonly total_quantity: number;
  /** Remaining quantity (12-hour delay) */
  readonly remaining_quantity: number;
  /** Purchase timestamp (Unix ms) */
  readonly purchase_time: number;
  /** Effective timestamp (Unix ms) */
  readonly effective_time: number;
  /** Expiration timestamp (Unix ms) */
  readonly invalid_time: number;
  /** Package status */
  readonly status: ResourcePackStatus;
}

/** Account information response */
export interface AccountInfoResponse {
  /** Error code (0 = success) */
  readonly code: number;
  /** Error message */
  readonly message: string;
  /** Request ID */
  readonly request_id: string;
  /** Account data */
  readonly data: {
    /** Inner error code */
    readonly code: number;
    /** Inner message */
    readonly msg: string;
    /** Resource packages */
    readonly resource_pack_subscribe_infos: readonly ResourcePack[];
  };
}

// ============================================================================
// Error Types
// ============================================================================

/** API error response */
export interface ErrorResponse {
  /** Error code */
  readonly code: number;
  /** Error message */
  readonly message: string;
  /** Request ID */
  readonly request_id: string;
}

// Re-export ERROR_CODES from config for backward compatibility
export { ERROR_CODES } from './config/constants.js';

// ============================================================================
// Polling Types
// ============================================================================

/** Options for polling task status */
export interface PollOptions {
  /** Polling interval in milliseconds (default: 3000) */
  interval?: number;
  /** Maximum wait time in milliseconds (default: 600000 = 10 min) */
  timeout?: number;
  /** Show spinner UI (default: true) */
  showSpinner?: boolean;
  /** Spinner text prefix */
  spinnerText?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/** API configuration options */
export interface KlingConfig {
  /** Access key (from env or parameter) */
  accessKey?: string;
  /** Secret key (from env or parameter) */
  secretKey?: string;
  /** Base API URL (default: https://api-singapore.klingai.com) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}
