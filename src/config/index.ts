/**
 * Config barrel (spec §5): constants and the credential loader. The model registry
 * (`config/models.ts`) and the validators (`config/validators/*`) are imported directly by
 * the product modules, not re-exported here.
 */
export * from './constants.js';
export { loadApiKey, MISSING_API_KEY_MESSAGE, type ApiKeySource } from './loaders.js';
