/**
 * Config barrel (spec §5). Constants and the 2.0 credential loader only; the 1.x
 * `loadCredentials`/`loadConfig`, model tables and validators were removed at 2a₀ —
 * `config/models.ts` and `config/validators/*` are re-created by 2a₁/2a₂/3a.
 */
export * from './constants.js';
export { loadApiKey, MISSING_API_KEY_MESSAGE, type ApiKeySource } from './loaders.js';
