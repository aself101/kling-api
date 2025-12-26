/**
 * File Saving Handlers
 *
 * Functions for downloading and saving generation results to disk.
 */

import { join } from 'path';

import {
  downloadVideo,
  downloadImage,
  saveMetadata,
  ensureDirectory,
  generateFilename,
} from '../utils.js';
import type {
  VideoTaskResult,
  ImageTaskResult,
} from '../types.js';

/**
 * Download and save video result to disk
 *
 * @param result - Video task result
 * @param outputDir - Output directory
 * @param prompt - Original prompt (for filename)
 * @returns Array of saved file paths
 */
export async function saveVideoResult(
  result: VideoTaskResult,
  outputDir: string,
  prompt?: string
): Promise<string[]> {
  if (!result.data.task_result?.videos?.length) {
    throw new Error('No videos in result');
  }

  ensureDirectory(outputDir);
  const savedPaths: string[] = [];

  for (const video of result.data.task_result.videos) {
    const filename = generateFilename(prompt ?? 'video', 'mp4');
    const filePath = join(outputDir, filename);

    await downloadVideo(video.url, filePath);

    // Save metadata
    saveMetadata(filePath, {
      task_id: result.data.task_id,
      video_id: video.id,
      duration: video.duration,
      url: video.url,
      created_at: result.data.created_at,
      prompt,
    });

    savedPaths.push(filePath);
  }

  return savedPaths;
}

/**
 * Download and save image result to disk
 *
 * @param result - Image task result
 * @param outputDir - Output directory
 * @param prompt - Original prompt (for filename)
 * @returns Array of saved file paths
 */
export async function saveImageResult(
  result: ImageTaskResult,
  outputDir: string,
  prompt?: string
): Promise<string[]> {
  if (!result.data.task_result?.images?.length) {
    throw new Error('No images in result');
  }

  ensureDirectory(outputDir);
  const savedPaths: string[] = [];

  for (const image of result.data.task_result.images) {
    // Determine extension from URL or default to png
    const ext = image.url.includes('.jpg') || image.url.includes('.jpeg') ? 'jpg' : 'png';
    const filename = generateFilename(prompt ?? 'image', ext);
    const filePath = join(outputDir, filename);

    await downloadImage(image.url, filePath);

    // Save metadata
    saveMetadata(filePath, {
      task_id: result.data.task_id,
      image_index: image.index,
      url: image.url,
      created_at: result.data.created_at,
      prompt,
    });

    savedPaths.push(filePath);
  }

  return savedPaths;
}
