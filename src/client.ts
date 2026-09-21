/**
 * KlingClient — the 2.0 entry point (spec §5).
 *
 * This is the 1a₂ skeleton: configuration resolution and the HTTP core. Product
 * namespaces (`video`, `image`, `tasks`, `elements`, `voices`, `avatar`, `audio`,
 * `account`) attach in Phases 2a₁ onward. It lives beside the 1.x `api.ts` until the
 * 2a₀ removal commit switches `package.json#main` to `index.ts`.
 */

import { MISSING_API_KEY_MESSAGE, loadApiKey, type ApiKeySource } from './config/loaders.js';
import { HttpCore, type HttpCoreInternals, type KlingConfig, type Logger, silentLogger } from './http/core.js';
import { KlingValidationError } from './http/errors.js';
import { TasksApi } from './products/tasks.js';
import { VideoApi } from './products/video.js';
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
    this.video = new VideoApi(this.http, {
      logger: this.config.logger,
      unknownModels: this.config.unknownModels,
      capabilityValidation: this.config.capabilityValidation,
    });
  }

  /**
   * Save a task's outputs to `dir` (spec D14) through the client's `fetch` and timeout —
   * so a proxied client downloads through its proxy. Returns the paths written.
   */
  save(task: Task, dir: string, options: SaveOptions = {}): Promise<string[]> {
    return saveTask(task, dir, { fetch: this.http.fetchImpl, timeoutMs: this.config.timeout, ...options });
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
