/**
 * Security Module
 *
 * URL validation, SSRF protection, and error sanitization.
 */

import { URL } from 'url';

import { PRIVATE_IP_PATTERNS, BLOCKED_HOSTS } from './constants.js';

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate a URL for security (SSRF protection)
 *
 * Blocks:
 * - Private IP ranges (10.x, 192.168.x, 172.16-31.x, etc.)
 * - Localhost (127.0.0.1, ::1, localhost)
 * - Cloud metadata endpoints
 * - IPv4-mapped IPv6 addresses
 * - Non-HTTPS URLs
 *
 * @param urlString - URL to validate
 * @throws Error if URL is not allowed
 */
export function validateUrl(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(
      'Invalid URL format. Expected a valid HTTPS URL (e.g., https://example.com/image.jpg)'
    );
  }

  // Enforce HTTPS
  if (url.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  const hostname = url.hostname.toLowerCase();

  // Check blocked hosts
  if (BLOCKED_HOSTS.includes(hostname)) {
    throw new Error('Access to this host is not allowed');
  }

  // Check for IPv4-mapped IPv6 addresses (e.g., [::ffff:127.0.0.1])
  if (hostname.includes('::ffff:')) {
    throw new Error('IPv4-mapped IPv6 addresses are not allowed');
  }

  // Check private IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error('Access to private/local addresses is not allowed');
    }
  }
}

// ============================================================================
// Key Redaction
// ============================================================================

/**
 * Redact an API key for safe logging
 *
 * Shows only the last 4 characters.
 *
 * @param key - API key to redact
 * @returns Redacted key string
 */
export function redactKey(key: string): string {
  if (!key || key.length <= 4) {
    return '****';
  }
  return `***${key.slice(-4)}`;
}

// ============================================================================
// Error Sanitization
// ============================================================================

/**
 * Sanitize error messages for production
 *
 * In production mode, returns generic error messages
 * to prevent information disclosure.
 *
 * @param error - Error object or message
 * @param isDevelopment - Whether running in development mode
 * @returns Sanitized error message
 */
export function sanitizeError(error: unknown, isDevelopment = false): string {
  if (isDevelopment) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // Production: return generic message unless it's a safe validation error
  const message = error instanceof Error ? error.message : String(error);

  // Allow certain safe error types through (validation messages)
  if (message.includes('Invalid') || message.includes('required') || message.includes('must be')) {
    return message;
  }

  return 'An error occurred while processing your request';
}

/**
 * Check if running in production mode
 *
 * @returns True if NODE_ENV is 'production'
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
