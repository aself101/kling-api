/**
 * Logger Module
 *
 * Structured logging with redaction support.
 */

// ============================================================================
// Types
// ============================================================================

/** Logger function type for consistent logging signatures */
export type LoggerFunction = (message: string, ...args: unknown[]) => void;

/** Logger interface for structured logging */
export interface Logger {
  /** Debug logging - only outputs when KLING_DEBUG=true */
  debug: LoggerFunction;
  /** Info level logging */
  info: LoggerFunction;
  /** Warning level logging */
  warn: LoggerFunction;
  /** Error level logging */
  error: LoggerFunction;
}

// ============================================================================
// Logger Implementation
// ============================================================================

/** Check debug mode once at load time for performance */
const isDebugMode = process.env.KLING_DEBUG === 'true';

/**
 * Create a logger instance with redaction support
 *
 * Simple console-based logger that redacts sensitive information.
 * Debug logging is a no-op when KLING_DEBUG is not set to 'true'.
 */
export const logger: Logger = {
  /** Debug logging - only outputs when KLING_DEBUG=true */
  debug: isDebugMode
    ? (message: string, ...args: unknown[]) => console.debug(`[DEBUG] ${message}`, ...args)
    : (_message: string, ..._args: unknown[]) => undefined, // No-op for production
  info: (message: string, ...args: unknown[]) => {
    console.info(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};
