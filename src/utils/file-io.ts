/**
 * File I/O Module
 *
 * Directory and file operations for saving media and metadata.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';

// ============================================================================
// Directory Management
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

// ============================================================================
// Filename Generation
// ============================================================================

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

// ============================================================================
// File Saving
// ============================================================================

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
