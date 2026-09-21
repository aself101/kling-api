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

export type KnownImageModel = 'kling-v3' | 'kling-v3-omni' | 'kling-image-o1' | 'kling-v2-1';
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

export interface ImageToVideoParams extends Omit<TextToVideoParams, 'aspectRatio'> {
  /** `contents[] { type: 'first_frame', url }` — URL or Base64 (D12). Required; the frame sets the aspect ratio. */
  firstFrame: MediaSource;
  /** 3.0 / 2.6 / 2.5-turbo only (3.0-turbo: first frame only); on 2.x, first+last ⇒ 1080p. */
  lastFrame?: MediaSource;
  /** 3.0 only, ≤ 3. `id` is the `@name` the prompt uses; auto-assigned `element_1`… when omitted. */
  elements?: { elementId: string; id?: string }[];
  /** 2.6 only, ≤ 2, requires `audio !== 'off'`. `id` is the `@name` the prompt uses; auto-assigned `voice_1`… */
  voices?: { voiceId: string; id?: string }[];
  /** Extra `contents[]` entries for content types the library does not model yet (D9). */
  extraContents?: Record<string, unknown>[];
}

/**
 * Which vendor element kind an `elementId` refers to. The vendor's omni count matrices
 * (App. B §2.5) are stated per kind, and the library cannot learn the kind from the id —
 * pass it to get the exact matrix checked; leave it out and only the kind-independent
 * envelopes (totals ≤ 7 without a reference video, ≤ 4 with one) apply. §6.1 did not
 * carry this field.
 */
export type ElementKind = 'video_character' | 'multi_image';

export interface OmniElementRef {
  elementId: string;
  /** The `@name` the prompt uses; auto-assigned `element_1`… when omitted. */
  id?: string;
  kind?: ElementKind;
}

export interface OmniVideoParams extends CommonOptions {
  /** Default `kling-3.0-omni` (§10.11 policy). `kling-o1` is the other omni model. */
  model?: VideoModel;
  prompt: string;
  /** Auto id `image_1`. */
  firstFrame?: MediaSource;
  /** Auto id `image_2` (or `image_1` without a first frame). Last-frame-only is unsupported. */
  lastFrame?: MediaSource;
  /** Auto ids continue the `image_n` sequence after the frames. */
  referImages?: { source: MediaSource; id?: string }[];
  /**
   * Reference video to take motion/shots from — URL only, `.mp4/.mov`, 3–15.5 s on
   * 3.0-omni / 3–10 s on O1, ≤ 200 MB. Duration and format are NOT checked client-side
   * (the library never fetches a URL to inspect it); the vendor returns an error code.
   * Forces `audio: 'off'` and `multiShot !== false`. Auto id `video_1`.
   */
  featureVideo?: { url: string; id?: string };
  /** Video to edit — URL only, same bounds as `featureVideo`; excludes frames and multi-shot; `audio` may not be `native`. Auto id `video_1`. */
  baseVideo?: { url: string; id?: string };
  elements?: OmniElementRef[];
  resolution?: Resolution;
  /** The vendor's field notes say required when there is no first frame and no reference video; its table and example disagree, so the library WARNS rather than throws. */
  aspectRatio?: AspectRatio;
  duration?: number;
  audio?: AudioMode;
  /** 3.0-omni only (O1 has no field). */
  multiShot?: boolean;
  extraContents?: Record<string, unknown>[];
}

export interface MotionControlParams extends CommonOptions {
  /** Default `kling-3.0` (the only current-generation motion-control model; 2.6 is the other). */
  model?: VideoModel;
  prompt?: string;
  /** Appearance reference (URL or Base64). */
  image: MediaSource;
  /**
   * Motion reference — URL only, `.mp4/.mov`, ≤ 100 MB, ≥ 3 s, ≤ 30 s with
   * `characterOrientation: 'video'` / ≤ 10 s with `'image'`. Not checked client-side.
   */
  video: string | { url: string };
  /** 3.0 only, at most one; the output then follows the reference video's orientation. */
  element?: { elementId: string; id?: string };
  characterOrientation: 'image' | 'video';
  audio?: 'original' | 'off';
  /** 720p | 1080p — no 4k on motion control. */
  resolution?: '720p' | '1080p';
  extraContents?: Record<string, unknown>[];
}

// ============================================================================
// Image (legacy standard) — spec §6.2; App. B §4.2
// ============================================================================

export type ImageAspectRatio = AspectRatio | '4:3' | '3:4' | '3:2' | '2:3' | '21:9';

export interface ImageGenerateParams extends CommonOptions {
  /** Default `kling-v3` (D7). `kling-v2-1` is the other value. */
  model?: ImageModel;
  prompt: string;
  negativePrompt?: string;
  /** Reference image (URL or Base64; ≤ 10 MB, ≥ 300 px, 1:2.5–2.5:1). */
  image?: MediaSource;
  /** `kling-v2-1` only. */
  imageReference?: 'subject' | 'face';
  /** [0, 1], vendor default 0.5. */
  imageFidelity?: number;
  /** [0, 1], vendor default 0.45; `kling-v2-1` only and "only takes effect when image_reference is subject". */
  humanFidelity?: number;
  elements?: { elementId: string }[];
  resolution?: '1k' | '2k';
  /** 1–9. */
  n?: number;
  aspectRatio?: ImageAspectRatio;
  /** Extra top-level body fields the library does not model yet (legacy bodies are flat). */
  extraSettings?: Record<string, unknown>;
}

export interface OmniImageParams extends CommonOptions {
  /** Default `kling-v3-omni` (§10.2 settled; the vendor's documented default is the older `kling-image-o1`). */
  model?: ImageModel;
  /** References images as `<<<image_1>>>` (O1 page) / `<<image_1>>` (3.0 Omni page) — the vendor's own notation differs between pages. */
  prompt: string;
  images?: MediaSource[];
  elements?: { elementId: string }[];
  resolution?: ImageResolution;
  resultType?: 'single' | 'series';
  /** 2–9 or `'auto'`; meaningful only with `resultType: 'series'`. */
  seriesAmount?: number | 'auto';
  /** 1–9; ignored by the vendor when `resultType` is `series`. */
  n?: number;
  aspectRatio?: ImageAspectRatio | 'auto';
  extraSettings?: Record<string, unknown>;
}

export interface MultiImageToImageParams extends CommonOptions {
  prompt?: string;
  /** The vendor's Request Example sends `negative_prompt` although its table omits it. */
  negativePrompt?: string;
  /** 1–4. */
  subjectImages: MediaSource[];
  sceneImage?: MediaSource;
  styleImage?: MediaSource;
  n?: number;
  aspectRatio?: ImageAspectRatio;
  extraSettings?: Record<string, unknown>;
}

export interface OutpaintParams extends CommonOptions {
  image: MediaSource;
  /** Each in [0, 2] as a multiple of the source height (up/down) or width (left/right); `(1+up+down)×(1+left+right) ≤ 3`. */
  up: number;
  down: number;
  left: number;
  right: number;
  prompt?: string;
  n?: number;
  extraSettings?: Record<string, unknown>;
}

export interface SubjectCompletionParams extends CommonOptions {
  frontalImage: MediaSource;
}
