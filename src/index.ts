/**
 * kling-api 2.0 public surface (spec §5, §6.4).
 *
 * Becomes `package.json#main` at the 2a₀ removal commit; until then the published entry
 * is still the 1.x `api.ts`. Everything a consumer may import is re-exported here — the
 * `./auth`, `./utils`, `./config`, `./types` subpaths are gone in 2.0.
 */

export { KlingClient, type ResolvedKlingConfig } from './client.js';
export {
  DEFAULT_RETRY,
  HttpCore,
  silentLogger,
  type HttpRequest,
  type HttpResult,
  type KlingConfig,
  type Logger,
  type RetryOptions,
  type VendorEnvelope,
} from './http/core.js';
export {
  KlingAPIError,
  KlingBatchError,
  KlingCodecError,
  KlingDownloadError,
  KlingError,
  KlingNetworkError,
  KlingNoOutputsError,
  KlingOutputsExpiredError,
  KlingPollTimeoutError,
  KlingResponseError,
  KlingTaskFailedError,
  KlingTaskNotFoundError,
  KlingTimeoutError,
  KlingValidationError,
  KlingWebhookError,
  type DownloadFailureReason,
  type RequestDescriptor,
  type RequestKind,
  type WebhookFailureReason,
} from './http/errors.js';
export type {
  AudioOutput,
  BillingEntry,
  ElementOutput,
  ImageOutput,
  LegacyProduct,
  NewStandardProduct,
  PageOptions,
  Product,
  RequestOptions,
  SaveOptions,
  Standard,
  Task,
  TaskHandle,
  TaskOutput,
  TaskState,
  TaskStatus,
  VideoOutput,
  VoiceOutput,
  WaitOptions,
} from './codecs/task.js';
export { BASE_URL, ERROR_CODES, VENDOR_HTTP_STATUS, type VendorErrorCode } from './config/constants.js';
export {
  IMAGE_MODELS,
  VIDEO_MODELS,
  type AspectRatio,
  type AudioMode,
  type ContentType,
  type ImageModel,
  type ImageModelCaps,
  type ImageResolution,
  type KnownImageModel,
  type KnownVideoModel,
  type Resolution,
  type VideoModel,
  type VideoModelCaps,
} from './config/models.js';
export { TasksApi, LEGACY_PRODUCT_PATHS, standardOf, type GetOptions, type ListOptions, type ProductType } from './products/tasks.js';
export type { CursorPage } from './codecs/new-standard.js';
export { poll, type PollOptions } from './handlers/poller.js';
export { MISSING_API_KEY_MESSAGE, loadApiKey, type ApiKeySource } from './config/loaders.js';
