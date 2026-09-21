/**
 * Public parameter types (spec §6.1–6.3) and the `MediaSource` union (D12). Types only.
 *
 * Not a file the §5 table names — it lists the params under §6 without a home. They
 * cannot live in `codecs/task.ts` (that module is the task model) and they are needed by
 * the codecs (build), the validators (rules) and the product modules (surface), so they
 * sit beside `task.ts` as a second types-only module with the same carve-out in the
 * import zones. `media/source.ts` (2c) imports `MediaSource` from here as a type.
 */
// ============================================================================
// Vocabulary (§6.1) — the leaf every other module builds on; `config/models.ts` keys its
// capability tables by these, so they live here, not there (codecs may not import models).
// ============================================================================

export type KnownVideoModel = 'kling-3.0-turbo' | 'kling-3.0' | 'kling-3.0-omni' | 'kling-o1' | 'kling-2.6' | 'kling-2.5-turbo';
/** Known ids autocomplete; an unknown id is passed through with shape-only validation (D9). */
export type VideoModel = KnownVideoModel | (string & {});
export type Resolution = '720p' | '1080p' | '4k';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type AudioMode = 'native' | 'original' | 'off';
/** `contents[].type` values across the new standard (App. B §2.13). */
export type ContentType =
  | 'prompt'
  | 'first_frame'
  | 'last_frame'
  | 'refer_image'
  | 'feature_video'
  | 'base_video'
  | 'element'
  | 'voice'
  | 'image'
  | 'video';

export type KnownImageModel = 'kling-v3' | 'kling-v3-omni' | 'kling-v2-1' | 'kling-v2' | 'kling-image-o1';
export type ImageModel = KnownImageModel | (string & {});
export type ImageResolution = '1k' | '2k' | '4k';

// ============================================================================
// Media input (D12)
// ============================================================================

/**
 * A bare string is an https URL or a Base64 string — NEVER a filesystem path. Pass
 * `{ path }` to read a local file. Video inputs accept `string | { url }` only: the Kling
 * API has no upload endpoint.
 */
export type MediaSource =
  | string
  | { url: string }
  | { base64: string; mimeType?: string }
  | { path: string }
  | Buffer
  | Uint8Array;

// ============================================================================
// Shared create options (App. B §2.0)
// ============================================================================

export interface CommonOptions {
  callbackUrl?: string;
  /**
   * `options.external_task_id`. Defaults to a library-generated UUID — the only recovery
   * key for a create whose response was lost (D10). `false` opts out (then
   * `TaskHandle.externalId` is undefined and `tasks.recover` cannot find the task).
   * §6.1 typed this `string`; `false` is the D10 opt-out.
   */
  externalTaskId?: string | false;
  /** `options.watermark_info.enabled`. */
  watermark?: boolean;
  signal?: AbortSignal;
  /**
   * Escape hatches for fields the library does not model yet (D9): merged into
   * `settings` / `options` AFTER validation. A key the library already models is
   * rejected — the hatch cannot silently override a validated field (run #3 A41).
   */
  extraSettings?: Record<string, unknown>;
  extraOptions?: Record<string, unknown>;
}

// ============================================================================
// Video (new standard)
// ============================================================================

export interface TextToVideoParams extends CommonOptions {
  /** Default `kling-3.0-turbo` (§10.11). */
  model?: VideoModel;
  prompt: string;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  /** Seconds — an integer from the model's set (3–15 on 3.0-era models, 5|10 on 2.x). */
  duration?: number;
  /** Only where the model has a `settings.audio` field; 3.0-turbo has none (audio is always on). */
  audio?: AudioMode;
  /** `settings.multi_shot`; only 3.0 and 3.0-omni carry the field. */
  multiShot?: boolean;
}
