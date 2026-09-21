/**
 * KlingClient — the entry point.
 *
 * Resolves configuration (API Key from the option or `KLING_API_KEY`; defaults for timeout,
 * retry, validation policy), builds one `HttpCore`, and exposes the product namespaces
 * (`video`, `image`, `tasks`, `elements`, `voices`, `avatar`, `audio`, `account`) plus
 * `save()` and `healthCheck()`. One client = one credential = one transport.
 */

import { MISSING_API_KEY_MESSAGE, loadApiKey, type ApiKeySource } from './config/loaders.js';
import {
  HttpCore,
  type HttpCoreInternals,
  type KlingConfig,
  type Logger,
  silentLogger,
} from './http/core.js';
import { KlingValidationError } from './http/errors.js';
import { TasksApi } from './products/tasks.js';
import { VideoApi } from './products/video.js';
import { ImageApi } from './products/image.js';
import { AudioApi, AvatarApi, ElementsApi, VoicesApi } from './products/resources.js';
import { AccountApi } from './products/account.js';
import { save as saveTask } from './handlers/saver.js';
import type { SaveOptions, Task } from './codecs/task.js';

export interface ResolvedKlingConfig {
  baseUrl: string;
  timeout: number;
  unknownModels: NonNullable<KlingConfig['unknownModels']>;
  capabilityValidation: NonNullable<KlingConfig['capabilityValidation']>;
  logger: Logger;
  /** Where the key came from — for `--debug` output; the key itself is never exposed. */
  apiKeySource: ApiKeySource;
}

/** The entry point: one credential, one transport, every product namespace. `new KlingClient({ apiKey })` or `new KlingClient()` with `KLING_API_KEY` set. */
export class KlingClient {
  /**
   * The transport. Internal: product namespaces call it; consumers should not.
   * The 1c smoke script reaches it as `client['http']` with a comment saying so.
   * @internal
   */
  readonly http: HttpCore;
  readonly config: ResolvedKlingConfig;
  /** Product-neutral task queries and handles (spec D5): `get`, `list`, `getByProduct`, `listByProduct`, `recover`, `handle`. */
  readonly tasks: TasksApi;
  /** Video generation on the new API standard (spec D6): `textToVideo`, `imageToVideo` (2a₃), `omni` / `motionControl` (2b). */
  readonly video: VideoApi;
  /** Image generation on the legacy standard (spec D7): `generate`, `omni`, `multiImageToImage`, `outpaint`, `subjectCompletion`. */
  readonly image: ImageApi;
  /** Element library (spec D8): `create`, `get`, `list`, `presets`, `delete(id, { kind })`. */
  readonly elements: ElementsApi;
  /** Voice library (spec D8): `create`, `get`, `list`, `presets`, `delete`. */
  readonly voices: VoicesApi;
  /** Avatar (talking-head) video from an image and a sound (spec D8). */
  readonly avatar: AvatarApi;
  /** Text-to-speech — synchronous, returns `audio` outputs (spec D8). */
  readonly audio: AudioApi;
  /** Resource packages and deduction ledgers (App. C §6): `usage`, `balanceLedger`, `packageLedger`. */
  readonly account: AccountApi;

  constructor(config: KlingConfig = {}, internals: HttpCoreInternals = {}) {
    const key = loadApiKey(config.apiKey);
    if (!key) throw new KlingValidationError('apiKey', MISSING_API_KEY_MESSAGE);

    this.http = new HttpCore(
      {
        apiKey: key.apiKey,
        baseUrl: config.baseUrl,
        timeout: config.timeout,
        retry: config.retry,
        fetch: config.fetch,
        logger: config.logger,
      },
      internals
    );
    this.config = {
      baseUrl: this.http.baseUrl,
      timeout: this.http.timeout,
      unknownModels: config.unknownModels ?? 'passthrough',
      capabilityValidation: config.capabilityValidation ?? 'error',
      logger: config.logger ?? silentLogger,
      apiKeySource: key.source,
    };
    this.tasks = new TasksApi(this.http, this.config.logger);
    const productConfig = {
      logger: this.config.logger,
      unknownModels: this.config.unknownModels,
      capabilityValidation: this.config.capabilityValidation,
    };
    this.video = new VideoApi(this.http, productConfig);
    this.image = new ImageApi(this.http, productConfig);
    this.elements = new ElementsApi(this.http, productConfig);
    this.voices = new VoicesApi(this.http, productConfig);
    this.avatar = new AvatarApi(this.http, productConfig);
    this.audio = new AudioApi(this.http, productConfig);
    this.account = new AccountApi(this.http, productConfig);
  }

  /**
   * Save a task's outputs to `dir` (spec D14) through the client's `fetch` — so a proxied
   * client downloads through its proxy. Returns the paths written.
   */
  save(task: Task, dir: string, options: SaveOptions = {}): Promise<string[]> {
    // Only the fetch is forwarded. The download deadline is the saver's per-type default
    // (120 s video / 60 s image+audio) unless the caller passes `timeoutMs` — the API `timeout`
    // is sized for JSON round trips, not for a 40 MB clip (ship run #5, code-auditor).
    // `??` not spread: a caller spreading their own bag with `fetch: undefined` must not drop the
    // proxied fetch (same shape as the retry-defaults bug; ship run #5, anxiety-reader F5).
    return saveTask(task, dir, { ...options, fetch: options.fetch ?? this.http.fetchImpl });
  }

  /**
   * Cheapest authenticated round trip: `GET /tasks?task_ids=0` (free, new standard).
   * `true` when it returns a vendor envelope with `code 0`; `false` on ANY throw — an
   * auth failure, a network failure, a timeout. It answers "can this client reach and
   * authenticate against the API right now", nothing finer; inspect the error from
   * `tasks.get` when you need the reason.
   */
  async healthCheck(options: { signal?: AbortSignal } = {}): Promise<boolean> {
    try {
      await this.tasks.get(['0'], options);
      return true;
    } catch {
      return false;
    }
  }
}
