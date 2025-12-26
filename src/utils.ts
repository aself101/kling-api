/**
 * Kling API Utilities Module
 *
 * Helper functions for file I/O, image/audio handling, security,
 * and polling with spinner UI.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, extname } from 'path';
import { URL } from 'url';
import axios from 'axios';
import ora, { type Ora } from 'ora';

import {
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_AUDIO_FORMATS,
  MAX_IMAGE_SIZE,
  MAX_AUDIO_SIZE,
} from './config/index.js';

// ============================================================================
// Constants
// ============================================================================

/** Exponential backoff base multiplier in milliseconds */
export const BACKOFF_BASE_MS = 1000;

/** Maximum video file size (500MB) */
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

/** Video download timeout in milliseconds (2 minutes) */
export const VIDEO_DOWNLOAD_TIMEOUT = 120000;

/** Image/audio download timeout in milliseconds (1 minute) */
export const MEDIA_DOWNLOAD_TIMEOUT = 60000;

/** Maximum number of redirects allowed */
export const MAX_REDIRECTS = 5;

/** Private IP ranges for SSRF protection */
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^localhost$/i,
  /^metadata\.google\.internal$/i,
];

/** Cloud metadata endpoints to block */
const BLOCKED_HOSTS = ['169.254.169.254', 'metadata.google.internal', 'metadata.aws'];

// ============================================================================
// URL Helpers
// ============================================================================

/**
 * Check if a source string is an HTTP or HTTPS URL
 *
 * @param source - String to check
 * @returns True if the source starts with http:// or https://
 */
export function isHttpUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

// ============================================================================
// File I/O Functions
// ============================================================================

/**
 * Ensure a directory exists, creating it if necessary
 *
 * @param dirPath - Directory path to ensure
 */
export function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Generate a timestamped filename from a prompt
 *
 * @param prompt - The prompt text to include in filename
 * @param extension - File extension (without dot)
 * @returns Sanitized filename with timestamp
 */
export function generateFilename(prompt: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitized = sanitizePromptForFilename(prompt);
  return `${timestamp}_${sanitized}.${extension}`;
}

/**
 * Sanitize a prompt for use in a filename
 *
 * @param prompt - The prompt text
 * @param maxLength - Maximum length (default: 50)
 * @returns Sanitized string safe for filenames
 */
export function sanitizePromptForFilename(prompt: string, maxLength = 50): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, maxLength)
    .replace(/_+$/, '');
}

/**
 * Save binary data to a file
 *
 * @param filePath - Full path to save the file
 * @param data - Binary data (Buffer)
 */
export function saveFile(filePath: string, data: Buffer): void {
  ensureDirectory(dirname(filePath));
  writeFileSync(filePath, data);
}

/**
 * Save metadata JSON alongside a media file
 *
 * @param mediaPath - Path to the media file
 * @param metadata - Metadata object to save
 */
export function saveMetadata(mediaPath: string, metadata: Record<string, unknown>): void {
  const metadataPath = mediaPath.replace(/\.[^.]+$/, '.json');
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

// ============================================================================
// Payload Building Utilities
// ============================================================================

/**
 * Copy optional parameters from source to target object
 *
 * Only copies properties that are defined (not undefined).
 * Handles both truthy checks and explicit undefined checks.
 *
 * @param source - Source object with optional parameters
 * @param target - Target payload object
 * @param keys - Array of keys to copy if present
 */
export function copyOptionalParams<T>(
  source: T,
  target: Record<string, unknown>,
  keys: (keyof T)[]
): void {
  for (const key of keys) {
    if (source[key] !== undefined) {
      target[key as string] = source[key];
    }
  }
}

// ============================================================================
// Media Source Processing
// ============================================================================

/** Media converter function type */
export type MediaConverter = (source: string) => Promise<string>;

/**
 * Process a media source (URL or file path) for API submission
 *
 * If the source is a URL, returns it as-is for the API to fetch.
 * If the source is a local file, converts it to base64 using the provided converter.
 *
 * @param source - URL or local file path
 * @param converter - Function to convert local files to base64 (imageToBase64 or audioToBase64)
 * @returns URL string or base64-encoded data
 */
export async function processMediaSource(
  source: string,
  converter: MediaConverter
): Promise<string> {
  // URLs are passed through directly - the API will fetch them
  if (isHttpUrl(source)) {
    return source;
  }

  // Local file - convert to base64
  if (existsSync(source)) {
    return converter(source);
  }

  // Not a URL and doesn't exist as a file - might be base64 or other format
  // Let the caller handle validation
  return source;
}

// ============================================================================
// Image Handling Functions
// ============================================================================

/**
 * Convert an image (file path or URL) to base64 string
 *
 * @param source - Local file path or URL
 * @returns Base64-encoded image string (without data: prefix)
 */
export async function imageToBase64(source: string): Promise<string> {
  // Check if URL
  if (isHttpUrl(source)) {
    await validateUrl(source);
    const response = await axios.get(source, {
      responseType: 'arraybuffer',
      timeout: MEDIA_DOWNLOAD_TIMEOUT,
      maxContentLength: MAX_IMAGE_SIZE,
      maxRedirects: MAX_REDIRECTS,
    });
    const buffer = Buffer.from(response.data);
    validateImageBuffer(buffer);
    return buffer.toString('base64');
  }

  // Local file
  if (!existsSync(source)) {
    throw new Error(`Image file not found: ${source}`);
  }

  const buffer = readFileSync(source);

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error(`Image file exceeds maximum size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
  }

  validateImageBuffer(buffer);
  return buffer.toString('base64');
}

/**
 * Validate an image buffer by checking magic bytes
 *
 * @param buffer - Image buffer to validate
 * @throws Error if not a valid image format
 */
export function validateImageBuffer(buffer: Buffer): void {
  if (buffer.length < 4) {
    throw new Error('Invalid image: file too small');
  }

  // Check magic bytes for supported formats
  const isPng =
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

  if (!isPng && !isJpeg) {
    throw new Error('Invalid image format. Supported formats: jpg, jpeg, png');
  }
}

/**
 * Validate image file extension
 *
 * @param filePath - Path to the image file
 * @throws Error if extension is not supported
 */
export function validateImageExtension(filePath: string): void {
  const ext = extname(filePath).toLowerCase().replace('.', '');
  if (!SUPPORTED_IMAGE_FORMATS.includes(ext)) {
    throw new Error(
      `Unsupported image format: ${ext}. Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`
    );
  }
}

// ============================================================================
// Audio Handling Functions
// ============================================================================

/**
 * Convert an audio file (path or URL) to base64 string
 *
 * @param source - Local file path or URL
 * @returns Base64-encoded audio string (without data: prefix)
 */
export async function audioToBase64(source: string): Promise<string> {
  // Check if URL
  if (isHttpUrl(source)) {
    await validateUrl(source);
    const response = await axios.get(source, {
      responseType: 'arraybuffer',
      timeout: MEDIA_DOWNLOAD_TIMEOUT,
      maxContentLength: MAX_AUDIO_SIZE,
      maxRedirects: MAX_REDIRECTS,
    });
    const buffer = Buffer.from(response.data);
    return buffer.toString('base64');
  }

  // Local file
  if (!existsSync(source)) {
    throw new Error(`Audio file not found: ${source}`);
  }

  const buffer = readFileSync(source);

  if (buffer.length > MAX_AUDIO_SIZE) {
    throw new Error(`Audio file exceeds maximum size of ${MAX_AUDIO_SIZE / 1024 / 1024}MB`);
  }

  return buffer.toString('base64');
}

/**
 * Validate audio file extension
 *
 * @param filePath - Path to the audio file
 * @throws Error if extension is not supported
 */
export function validateAudioExtension(filePath: string): void {
  const ext = extname(filePath).toLowerCase().replace('.', '');
  if (!SUPPORTED_AUDIO_FORMATS.includes(ext)) {
    throw new Error(
      `Unsupported audio format: ${ext}. Supported formats: ${SUPPORTED_AUDIO_FORMATS.join(', ')}`
    );
  }
}

// ============================================================================
// Video Download Functions
// ============================================================================

/**
 * Download a video from URL and save to file
 *
 * @param url - Video URL
 * @param outputPath - Path to save the video
 * @returns Full path to saved video
 */
export async function downloadVideo(url: string, outputPath: string): Promise<string> {
  await validateUrl(url);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: VIDEO_DOWNLOAD_TIMEOUT,
    maxContentLength: MAX_VIDEO_SIZE,
    maxRedirects: MAX_REDIRECTS,
  });

  const buffer = Buffer.from(response.data);
  saveFile(outputPath, buffer);

  return outputPath;
}

/**
 * Download an image from URL and save to file
 *
 * @param url - Image URL
 * @param outputPath - Path to save the image
 * @returns Full path to saved image
 */
export async function downloadImage(url: string, outputPath: string): Promise<string> {
  await validateUrl(url);

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: MEDIA_DOWNLOAD_TIMEOUT,
    maxContentLength: MAX_IMAGE_SIZE,
    maxRedirects: MAX_REDIRECTS,
  });

  const buffer = Buffer.from(response.data);
  validateImageBuffer(buffer);
  saveFile(outputPath, buffer);

  return outputPath;
}

// ============================================================================
// Security Functions
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
  if (
    message.includes('Invalid') ||
    message.includes('required') ||
    message.includes('must be')
  ) {
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

// ============================================================================
// Polling Functions
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

// ============================================================================
// Logging Helpers
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
