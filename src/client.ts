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
  }
}
