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
