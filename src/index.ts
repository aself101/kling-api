/**
 * kling-api public surface — `package.json#main` / the `"."` export.
 *
 * Everything a consumer may import is re-exported here; there are no subpath exports.
 * The product classes (`VideoApi`, `ImageApi`, …) are reachable as `client.video` etc. and
 * exported for typing; the lower-level pieces (`HttpCore`, `fetchToBuffer`,
 * `resolveMediaSource`, `assertSafeUrl`, the routing tables) are exported for consumers
 * who compose their own flows — see the README's "Advanced exports" section.
 */

export { KlingClient, type ResolvedKlingConfig } from './client.js';
export {
  DEFAULT_RETRY,
  HttpCore,
  silentLogger,
  type HttpCoreInternals,
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
  KlingSaveError,
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
export { DEFAULT_IMAGE_MODEL, DEFAULT_MOTION_CONTROL_MODEL, DEFAULT_OMNI_IMAGE_MODEL, DEFAULT_OMNI_VIDEO_MODEL, DEFAULT_VIDEO_MODEL, MULTI_IMAGE_MODEL, IMAGE_MODELS, VIDEO_MODELS, type ImageModelCaps, type VideoModelCaps } from './config/models.js';
export type {
  AspectRatio,
  AudioMode,
  CommonOptions,
  ContentType,
  ImageModel,
  ImageResolution,
  KnownImageModel,
  KnownVideoModel,
  MediaSource,
  Resolution,
  AvatarCreateParams,
  ElementCreateParams,
  ElementDeleteOptions,
  ElementKind,
  ElementTag,
  ImageAspectRatio,
  ImageGenerateParams,
  ImageToVideoParams,
  MultiImageToImageParams,
  OmniImageParams,
  OutpaintParams,
  SubjectCompletionParams,
  MotionControlParams,
  OmniElementRef,
  OmniVideoParams,
  TextToVideoParams,
  TtsParams,
  VideoModel,
  VoiceCreateParams,
} from './codecs/params.js';
export { TasksApi, LEGACY_PRODUCT_PATHS, standardOf, type GetOptions, type ListOptions, type ProductType } from './products/tasks.js';
export type { MalformedRecord, TaskPage } from './codecs/shared.js';
export type { CursorPage, NewStandardBody } from './codecs/new-standard.js';
export type { LegacyBody } from './codecs/legacy.js';
export { MODELED_LEGACY_FIELDS } from './config/constants.js';
export { VideoApi } from './products/video.js';
export { ImageApi } from './products/image.js';
export { AudioApi, AvatarApi, ElementsApi, VoicesApi, RESOURCE_PATHS, type DeleteResult } from './products/resources.js';
export { AccountApi, type LedgerOptions, type PackageLedgerOptions, type UsageOptions } from './products/account.js';
export type { CashDeductionEntry, DeductionEntry, LedgerPage, ResourcePackage, UnitDeductionEntry } from './codecs/account.js';
export { parseCallback, verifyWebhookSignature, sign as signWebhook, type ParseCallbackOptions, type ParsedCallback, type VerifyWebhookSignatureInput } from './webhooks.js';
export { createTimeoutMs, recordOf, redactMedia, type ProductApiConfig } from './products/shared.js';
export { MediaBudget, resolveMediaSource, sniffAudio, sniffImage, type ImageInfo, type MediaKind, type ResolvedMedia, type ResolveOptions } from './media/source.js';
export { fetchToBuffer, fetchToFile, type FetchToBufferOptions, type FetchedResource, type StreamedResource } from './media/download.js';
export { save, extensionFor, defaultDownloadTimeoutMs } from './handlers/saver.js';
export { assertSafeUrl, isPublicAddress, UnsafeUrlError, type AssertSafeUrlOptions, type LookupFn, type UrlRejection } from './utils/security.js';
export { MODELED_OPTIONS, MODELED_SETTINGS } from './config/constants.js';
export { poll, type PollOptions } from './handlers/poller.js';
export { MISSING_API_KEY_MESSAGE, loadApiKey, type ApiKeySource } from './config/loaders.js';
