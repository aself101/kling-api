/**
 * Downloads Module
 *
 * Video and image download functions with security validation.
 */

import axios from 'axios';

import {
  MAX_VIDEO_SIZE,
  VIDEO_DOWNLOAD_TIMEOUT,
  MEDIA_DOWNLOAD_TIMEOUT,
  MAX_REDIRECTS,
} from './constants.js';
import { validateUrl } from './security.js';
import { saveFile } from './file-io.js';
import { validateImageBuffer } from './media.js';

import { MAX_IMAGE_SIZE } from '../config/index.js';

// ============================================================================
// Video Downloads
// ============================================================================

/**
 * Download a video from URL and save to file
 *
 * @param url - Video URL
 * @param outputPath - Path to save the video
 * @returns Full path to saved video
 */
export async function downloadVideo(url: string, outputPath: string): Promise<string> {
  validateUrl(url);

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

// ============================================================================
// Image Downloads
// ============================================================================

/**
 * Download an image from URL and save to file
 *
 * @param url - Image URL
 * @param outputPath - Path to save the image
 * @returns Full path to saved image
 */
export async function downloadImage(url: string, outputPath: string): Promise<string> {
  validateUrl(url);

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
