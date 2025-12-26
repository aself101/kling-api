/**
 * Polling Module
 *
 * Async polling with spinner UI for long-running operations.
 */

import ora, { type Ora } from 'ora';

// ============================================================================
// Types
// ============================================================================

/** Polling options */
export interface PollOptions {
  /** Polling interval in milliseconds */
  interval?: number;
  /** Maximum wait time in milliseconds */
  timeout?: number;
  /** Show spinner UI */
  showSpinner?: boolean;
  /** Spinner text prefix */
  spinnerText?: string;
}

// ============================================================================
// Polling Implementation
// ============================================================================

/**
 * Poll for a result with spinner UI
 *
 * @param checkFn - Function that returns the current status
 * @param isComplete - Function to check if polling should stop
 * @param options - Polling options
 * @returns The final result
 */
export async function pollWithSpinner<T>(
  checkFn: () => Promise<T>,
  isComplete: (result: T) => boolean,
  options: PollOptions = {}
): Promise<T> {
  const interval = options.interval ?? 3000;
  const timeout = options.timeout ?? 600000;
  const showSpinner = options.showSpinner !== false;
  const spinnerText = options.spinnerText ?? 'Processing';

  let spinner: Ora | null = null;
  const startTime = Date.now();

  if (showSpinner) {
    spinner = ora({
      text: `${spinnerText}...`,
      spinner: 'dots',
    }).start();
  }

  try {
    while (true) {
      const elapsed = Date.now() - startTime;

      if (elapsed >= timeout) {
        throw new Error(`Polling timeout after ${timeout / 1000} seconds`);
      }

      const result = await checkFn();

      if (isComplete(result)) {
        if (spinner) {
          spinner.succeed(`${spinnerText} completed in ${formatDuration(elapsed)}`);
        }
        return result;
      }

      // Update spinner text with elapsed time
      if (spinner) {
        const remaining = Math.max(0, timeout - elapsed);
        spinner.text = `${spinnerText}... (${formatDuration(elapsed)} elapsed, ~${formatDuration(remaining)} remaining)`;
      }

      // Wait before next poll
      await sleep(interval);
    }
  } catch (error) {
    if (spinner) {
      spinner.fail(`${spinnerText} failed`);
    }
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format duration in human-readable format
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "1m 30s")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}
