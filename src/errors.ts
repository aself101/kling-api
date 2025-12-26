/**
 * Kling API Error Classes
 *
 * Custom error types for Kling API error handling
 */

import { ERROR_CODES } from './config/index.js';

/**
 * Custom error class for Kling API errors
 *
 * Provides structured error information including API error codes,
 * request IDs for debugging, and HTTP status codes.
 */
export class KlingAPIError extends Error {
  constructor(
    message: string,
    public code: number,
    public requestId?: string,
    public httpStatus?: number
  ) {
    super(message);
    this.name = 'KlingAPIError';
  }

  /**
   * Check if error is retryable (transient errors)
   *
   * @returns true if the error is a transient server error that may succeed on retry
   */
  isRetryable(): boolean {
    return (
      this.code === ERROR_CODES.SERVICE_UNAVAILABLE ||
      this.httpStatus === 502 ||
      this.httpStatus === 503 ||
      this.httpStatus === 504
    );
  }
}
