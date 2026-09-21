/**
 * Normalized task model (spec D4, D5).
 *
 * Types only — this module imports nothing from `src/` so both codecs, the error
 * family, and every product module can depend on it without cycles (spec §5).
 *
 * The vendor runs two API design standards at once (spec §2.1): the NEW standard
 * (video: `data.id`, `data.status` = `succeeded`, `outputs[]`) and the LEGACY standard
 * (image and resources: `data.task_id`, `data.task_status` = `succeed`,
 * `task_result.{videos,images,…}[]`). The codecs in this directory translate both into
 * the single `Task` shape below; nothing outside `src/codecs/` reads a vendor-spelled
 * field (spec D3).
 */

// ============================================================================
// Vocabulary
// ============================================================================

/** Terminal spelling is `succeeded`; the legacy codec maps `succeed` onto it. */
export type TaskStatus = 'submitted' | 'processing' | 'succeeded' | 'failed';

/** Which vendor API design standard a task belongs to — always known, since it is the codec that parsed it. */
export type Standard = 'new' | 'legacy';

/**
 * The product (create endpoint) a task came from. Known for tasks created through
 * this library and for product-scoped queries; ABSENT for results of the unified
 * `/tasks` query, whose envelope carries no product field (spec D4).
 */
export type Product =
  // new standard — path-per-model video endpoints
  | 'text-to-video'
  | 'image-to-video'
  | 'omni-video'
  | 'motion-control'
  // legacy standard — /v1/ image endpoints
  | 'image-generation'
  | 'omni-image'
  | 'multi-image-to-image'
  | 'outpainting'
  | 'subject-completion'
  // legacy standard — /v1/ resources
  | 'avatar'
  | 'element'
  | 'voice';

export type NewStandardProduct = Extract<
  Product,
  'text-to-video' | 'image-to-video' | 'omni-video' | 'motion-control'
>;

export type LegacyProduct = Exclude<Product, NewStandardProduct>;

// ============================================================================
// Task
// ============================================================================

export interface Task {
  id: string;
  /** Which codec parsed this task. Drives query routing (spec D5). */
  standard: Standard;
  /** Absent for `/tasks` results — the vendor envelope has no product field. */
  product?: Product;
  status: TaskStatus;
  /** Legacy `task_status_msg` / new `data.message` — the failure reason when `failed`. */
  message?: string;
  /** The caller's or library-generated `external_task_id`, when the vendor echoed it. */
  externalId?: string;
  /** Unix ms. Both standards document ms; a value below 1e11 is treated as seconds and normalised with a warning (spec Q12). */
  createdAt?: number;
  /** Unix ms. */
  updatedAt?: number;
  /**
   * `updatedAt + 30 days` when `status === 'succeeded'` — the vendor clears every output
   * URL "after 30 days". Derived, not vendor-supplied: `save()` refuses past it unless
   * `force` is set (spec D14).
   */
  outputsExpireAt?: number;
  /** Empty until `succeeded`. A `succeeded` task with no outputs is terminal-and-empty. */
  outputs: TaskOutput[];
  /** New standard only; legacy deductions are mapped when present. */
  billing?: BillingEntry[];
  /** The vendor envelope, untouched — the escape hatch for the first major (spec §10.6). */
  raw: unknown;
}

// ============================================================================
// Outputs
// ============================================================================

export type TaskOutput = VideoOutput | ImageOutput | AudioOutput | ElementOutput | VoiceOutput;

export interface VideoOutput {
  type: 'video';
  id: string;
  url: string;
  watermarkUrl?: string;
  /** Seconds. The new standard sends this as a string; the codec parses it. */
  durationSeconds?: number;
}

export interface ImageOutput {
  type: 'image';
  url: string;
  watermarkUrl?: string;
  /** Legacy `images[].index`. */
  index?: number;
  /** New-standard `group_id` (grouped images) / legacy omni-image series / ai-multi-shot `index`. */
  groupId?: string;
}

export interface AudioOutput {
  type: 'audio';
  id: string;
  /** Legacy `url` / `url_mp3`; new `mp3_url`. */
  mp3Url?: string;
  wavUrl?: string;
  mp3DurationSeconds?: number;
  wavDurationSeconds?: number;
}

export interface ElementOutput {
  type: 'element';
  id: string;
  name: string;
  description?: string;
  elementType?: 'video_character_elements' | 'multi_image_elements';
  /** Legacy `succeed` → `succeeded`. */
  status: 'succeeded' | 'deleted';
  /** Element payloads differ materially between the two standards; the vendor shape is preserved here. */
  raw: unknown;
}

export interface VoiceOutput {
  type: 'voice';
  id: string;
  name: string;
  /** Preview / trial URL. */
  url?: string;
  /** `"kling"` for the official library, otherwise the creator's id. */
  ownedBy?: string;
  status: 'succeeded' | 'deleted';
}

// ============================================================================
// Billing
// ============================================================================

export interface BillingEntry {
  chargeType: 'cash' | 'unit';
  /** Cash only. */
  cashType?: 'balance' | 'test_balance';
  /** Decimal string exactly as the vendor sends it. */
  amount: string;
  /** Cash only — the vendor writes "CNY/USD". */
  currency?: string;
  /** Unit only. */
  packageType?: 'video' | 'image' | 'audio';
  /** Cash only. */
  listPrice?: string;
}

// ============================================================================
// Handles and options
// ============================================================================

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface WaitOptions extends RequestOptions {
  /** Poll interval. Default 3 000 ms. */
  intervalMs?: number;
  /** Overall deadline. Default 900 000 ms (15 min). */
  deadlineMs?: number;
}

export interface PageOptions extends RequestOptions {
  /** 1–1000. */
  pageNum?: number;
  /** 1–500 (voices: 1–1000). */
  pageSize?: number;
}

export interface SaveOptions extends RequestOptions {
  /** Also save the watermarked variants (`watermarkUrl`). Default false. */
  includeWatermark?: boolean;
  /** Download through this fetch (proxies, tests). `client.save` passes the client's. */
  fetch?: typeof fetch;
  /** Per-download deadline. Default 60 s. */
  timeoutMs?: number;
  /** Bypass the derived `outputsExpireAt` check (spec D14). */
  force?: boolean;
  /** The handle's redacted request record, written to the sidecar (D4). */
  request?: Record<string, unknown>;
  /** Byte cap per download. Default 500 MiB. */
  maxBytes?: number;
  /** DNS seam for the per-hop SSRF check (tests). */
  lookup?: (hostname: string) => Promise<{ address: string; family: number }[]>;
  /** Clock seam for the expiry check (tests). */
  now?: () => number;
}

/**
 * Returned from every create. The interface lives here; the implementation
 * (`createHandle`) lives in `products/tasks.ts`, which owns the product → path routing
 * table — codecs import no HTTP (spec D5).
 */
export interface TaskHandle {
  id: string;
  /**
   * Always set unless the caller passed `externalTaskId: false` — the library
   * generates a UUID otherwise, because it is the only recovery key for a create whose
   * response was lost (spec D10). TTS has none.
   */
  externalId?: string;
  standard: Standard;
  product: Product;
  /** The normalized params the create was built from, media fields redacted to `{ kind, bytes, sha256 }`. */
  request: Record<string, unknown>;
  get(options?: RequestOptions): Promise<Task>;
  /** Resolves on `succeeded`; throws `KlingTaskFailedError` on `failed`, `KlingPollTimeoutError` on deadline. */
  wait(options?: WaitOptions): Promise<Task>;
}

// ============================================================================
// Write-outcome classification (spec D10)
// ============================================================================

/**
 * What the library can say about the vendor-side state of a task after a write failed.
 *
 * - `'not-created'` — the vendor rejected the request before enqueueing (any 4xx
 *   business code, including `1303`; a pre-request network failure). Safe to re-submit.
 * - `'may-exist'` — the request may have been accepted: `5000`/`5002`, HTTP 502/503/504,
 *   an unparseable response, a timeout, a post-request network error. Recover by
 *   external id before re-submitting.
 * - `'n/a'` — the request was a read.
 *
 * This is the field the README teaches consumers to key their re-submit decision on.
 * `isTransient()` is the vendor's "try later" signal and says nothing about task state
 * (run #3 A35/F11).
 */
export type TaskState = 'not-created' | 'may-exist' | 'n/a';
