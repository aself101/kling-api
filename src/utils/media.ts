/**
 * Media Module
 *
 * Image and audio processing, validation, and base64 conversion.
 */

import { existsSync, readFileSync } from 'fs';
import { extname } from 'path';
import axios from 'axios';

import {
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_AUDIO_FORMATS,
  MAX_IMAGE_SIZE,
  MAX_AUDIO_SIZE,
} from '../config/index.js';

import { MEDIA_DOWNLOAD_TIMEOUT, MAX_REDIRECTS } from './constants.js';
import { validateUrl } from './security.js';

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
// Image Handling
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
    validateUrl(source);
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
// Audio Handling
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
    validateUrl(source);
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
// Payload Utilities
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
