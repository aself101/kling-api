/**
 * Credential loading (spec D2).
 *
 * The library half only: an explicit key or `process.env.KLING_API_KEY`. The `.env`
 * chain (`./.env`, `~/.kling/.env`) is a CLI concern and returns in `src/cli/` at 6a₁;
 * the 1.x `loadCredentials`/`loadConfig` that read them were removed at 2a₀.
 */

// ============================================================================
// Credential Loading
// ============================================================================

/** Where `loadApiKey` found the key — surfaced in errors and `--debug` output, never the key itself. */
export type ApiKeySource = 'explicit' | 'env';

/**
 * Resolve the 2.0 credential: a static API Key (spec D2).
 *
 * The library reads exactly two sources — an explicit value (constructor option or CLI
 * flag) and `process.env.KLING_API_KEY`. The `./.env` / `~/.kling/.env` lookups that
 * 1.x `loadCredentials` performed for the AccessKey/SecretKey pair are a CLI concern and
 * live in `src/cli/` from Phase 6a₁; a library that reads the caller's home directory is
 * a surprise for a server consumer (run #1 A8).
 *
 * Whitespace is trimmed; an empty string counts as absent.
 *
 * @param explicit - Key passed by the caller; wins when non-empty
 * @returns The key and where it came from, or `undefined` when neither source has one
 */
export function loadApiKey(explicit?: string): { apiKey: string; source: ApiKeySource } | undefined {
  const fromArg = explicit?.trim();
  if (fromArg) return { apiKey: fromArg, source: 'explicit' };
  const fromEnv = process.env.KLING_API_KEY?.trim();
  if (fromEnv) return { apiKey: fromEnv, source: 'env' };
  return undefined;
}

/**
 * The message thrown when no API Key can be found. Names every source the library
 * consults and where to mint a key; never echoes any value.
 */
export const MISSING_API_KEY_MESSAGE =
  'Kling API Key not found. Pass { apiKey } to the client, or set KLING_API_KEY in the environment ' +
  '(the CLI also reads ./.env and ~/.kling/.env). Create a key at https://kling.ai/dev/api-key. ' +
  'AccessKey/SecretKey (JWT) credentials are not accepted by the current Kling API.';
