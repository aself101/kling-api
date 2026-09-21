/**
 * Kling API Configuration Loaders
 *
 * Functions for loading API credentials and configuration from
 * environment variables and .env files.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import dotenv from 'dotenv';

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
 * `loadCredentials` performs for the 1.x AccessKey/SecretKey pair are a CLI concern and
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

/**
 * Load API credentials following priority chain:
 * 1. CLI flags (if provided)
 * 2. Environment variables
 * 3. Local .env file
 * 4. Global ~/.kling/.env file
 *
 * @param cliAccessKey - Access key from CLI flag
 * @param cliSecretKey - Secret key from CLI flag
 * @returns Object with accessKey and secretKey (may be undefined)
 */
export function loadCredentials(
  cliAccessKey?: string,
  cliSecretKey?: string
): { accessKey?: string; secretKey?: string } {
  // Priority 1: CLI flags
  if (cliAccessKey && cliSecretKey) {
    return { accessKey: cliAccessKey, secretKey: cliSecretKey };
  }

  // Priority 2: Environment variables
  if (process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY) {
    return {
      accessKey: process.env.KLING_ACCESS_KEY,
      secretKey: process.env.KLING_SECRET_KEY,
    };
  }

  // Priority 3: Local .env file
  const localEnvPath = join(process.cwd(), '.env');
  if (existsSync(localEnvPath)) {
    const localEnv = dotenv.parse(readFileSync(localEnvPath));
    if (localEnv.KLING_ACCESS_KEY && localEnv.KLING_SECRET_KEY) {
      return {
        accessKey: localEnv.KLING_ACCESS_KEY,
        secretKey: localEnv.KLING_SECRET_KEY,
      };
    }
  }

  // Priority 4: Global ~/.kling/.env file
  const globalEnvPath = join(homedir(), '.kling', '.env');
  if (existsSync(globalEnvPath)) {
    const globalEnv = dotenv.parse(readFileSync(globalEnvPath));
    if (globalEnv.KLING_ACCESS_KEY && globalEnv.KLING_SECRET_KEY) {
      return {
        accessKey: globalEnv.KLING_ACCESS_KEY,
        secretKey: globalEnv.KLING_SECRET_KEY,
      };
    }
  }

  // Return whatever we have from env (may be undefined)
  return {
    accessKey: process.env.KLING_ACCESS_KEY,
    secretKey: process.env.KLING_SECRET_KEY,
  };
}

// ============================================================================
// Configuration Loading
// ============================================================================

/**
 * Load optional configuration from environment
 *
 * @returns Configuration object with optional overrides
 */
/**
 * Parse an integer from environment variable with NaN validation
 *
 * @param value - String value to parse
 * @param multiplier - Multiplier to apply (e.g., 1000 for seconds to ms)
 * @returns Parsed number or undefined if invalid
 */
function parseEnvInt(value: string | undefined, multiplier = 1): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed * multiplier;
}

export function loadConfig(): {
  outputDir?: string;
  pollInterval?: number;
  timeout?: number;
} {
  return {
    outputDir: process.env.KLING_OUTPUT_DIR,
    pollInterval: parseEnvInt(process.env.KLING_POLL_INTERVAL, 1000),
    timeout: parseEnvInt(process.env.KLING_TIMEOUT, 1000),
  };
}
