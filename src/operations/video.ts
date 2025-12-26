/**
 * Video Operations
 *
 * Functions for video generation, extension, and multi-image video creation.
 */

import type { KlingHttpClient } from '../client/http-client.js';
import {
  validateTextToVideoParams,
  validateImageToVideoParams,
  validateExtendVideoParams,
  validateMultiImageToVideoParams,
  validateOmniVideoParams,
} from '../config/index.js';
import {
  imageToBase64,
  processMediaSource,
  copyOptionalParams,
} from '../utils/index.js';
import type {
  TextToVideoParams,
  ImageToVideoParams,
  ExtendVideoParams,
  MultiImageToVideoParams,
  OmniVideoParams,
  TaskResponse,
  VideoTaskResult,
} from '../types.js';

// ==========================================================================
// Text-to-Video
// ==========================================================================

/**
 * Create a text-to-video generation task
 *
 * @param client - HTTP client instance
 * @param params - Generation parameters
 * @returns Task response with task ID
 */
export async function textToVideo(
  client: KlingHttpClient,
  params: TextToVideoParams
): Promise<TaskResponse> {
  validateTextToVideoParams(params);

  const payload: Record<string, unknown> = {
    model_name: params.model_name ?? 'kling-v1',
    prompt: params.prompt,
  };

  copyOptionalParams(params, payload, [
    'negative_prompt',
    'sound',
    'cfg_scale',
    'mode',
    'camera_control',
    'aspect_ratio',
    'duration',
    'callback_url',
    'external_task_id',
  ]);

  return client.request<TaskResponse>('POST', '/v1/videos/text2video', payload);
}

/**
 * Query a text-to-video task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and video URLs
 */
export async function queryTextToVideoTask(
  client: KlingHttpClient,
  taskId: string
): Promise<VideoTaskResult> {
  return client.request<VideoTaskResult>('GET', `/v1/videos/text2video/${taskId}`);
}

// ==========================================================================
// Image-to-Video
// ==========================================================================

/**
 * Create an image-to-video generation task
 *
 * @param client - HTTP client instance
 * @param params - Generation parameters
 * @returns Task response with task ID
 */
export async function imageToVideo(
  client: KlingHttpClient,
  params: ImageToVideoParams
): Promise<TaskResponse> {
  validateImageToVideoParams(params);

  // Parallelize image processing when both are present
  const [processedImage, processedImageTail] = await Promise.all([
    processMediaSource(params.image, imageToBase64),
    params.image_tail
      ? processMediaSource(params.image_tail, imageToBase64)
      : Promise.resolve(undefined),
  ]);

  const payload: Record<string, unknown> = {
    model_name: params.model_name ?? 'kling-v1',
    image: processedImage,
  };

  if (processedImageTail) {
    payload.image_tail = processedImageTail;
  }

  copyOptionalParams(params, payload, [
    'prompt',
    'negative_prompt',
    'voice_list',
    'dynamic_masks',
    'static_mask',
    'cfg_scale',
    'mode',
    'camera_control',
    'aspect_ratio',
    'duration',
    'callback_url',
    'external_task_id',
  ]);

  return client.request<TaskResponse>('POST', '/v1/videos/image2video', payload);
}

/**
 * Query an image-to-video task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and video URLs
 */
export async function queryImageToVideoTask(
  client: KlingHttpClient,
  taskId: string
): Promise<VideoTaskResult> {
  return client.request<VideoTaskResult>('GET', `/v1/videos/image2video/${taskId}`);
}

// ==========================================================================
// Video Extension
// ==========================================================================

/**
 * Extend an existing video by appending new content
 *
 * @param client - HTTP client instance
 * @param params - Extension parameters
 * @returns Task response with task ID
 *
 * @remarks
 * The source video must be under 3 minutes and within 30 days of generation.
 * Videos are cleared 30 days after generation.
 */
export async function extendVideo(
  client: KlingHttpClient,
  params: ExtendVideoParams
): Promise<TaskResponse> {
  validateExtendVideoParams(params);

  const payload: Record<string, unknown> = {
    video_id: params.video_id,
  };

  copyOptionalParams(params, payload, ['prompt', 'negative_prompt', 'cfg_scale', 'callback_url']);

  return client.request<TaskResponse>('POST', '/v1/videos/video-extend', payload);
}

/**
 * Query a video extension task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and video URLs
 */
export async function queryExtendVideoTask(
  client: KlingHttpClient,
  taskId: string
): Promise<VideoTaskResult> {
  return client.request<VideoTaskResult>('GET', `/v1/videos/video-extend/${taskId}`);
}

// ==========================================================================
// Multi-Image-to-Video
// ==========================================================================

/**
 * Generate a video from multiple reference images
 *
 * @param client - HTTP client instance
 * @param params - Generation parameters
 * @returns Task response with task ID
 *
 * @remarks
 * Supports up to 4 images. The model interpolates between images
 * to create smooth video transitions.
 */
export async function multiImageToVideo(
  client: KlingHttpClient,
  params: MultiImageToVideoParams
): Promise<TaskResponse> {
  validateMultiImageToVideoParams(params);

  // Process all images in parallel
  const processedImages = await Promise.all(
    params.image_list.map(async (item) => ({
      image: await processMediaSource(item.image, imageToBase64),
    }))
  );

  const payload: Record<string, unknown> = {
    model_name: params.model_name ?? 'kling-v1-6',
    image_list: processedImages,
    prompt: params.prompt,
  };

  copyOptionalParams(params, payload, [
    'negative_prompt',
    'mode',
    'aspect_ratio',
    'duration',
    'callback_url',
    'external_task_id',
  ]);

  return client.request<TaskResponse>('POST', '/v1/videos/multi-image2video', payload);
}

/**
 * Query a multi-image-to-video task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and video URLs
 */
export async function queryMultiImageToVideoTask(
  client: KlingHttpClient,
  taskId: string
): Promise<VideoTaskResult> {
  return client.request<VideoTaskResult>('GET', `/v1/videos/multi-image2video/${taskId}`);
}

// ==========================================================================
// Omni Video
// ==========================================================================

/**
 * Generate a video using the Omni model with multi-modal inputs
 *
 * @param client - HTTP client instance
 * @param params - Generation parameters
 * @returns Task response with task ID
 *
 * @remarks
 * Use template syntax in prompts to reference inputs:
 * - <<<image_1>>> for images from image_list
 * - <<<video_1>>> for videos from video_list
 * - <<<element_1>>> for elements from element_list
 */
export async function omniVideo(
  client: KlingHttpClient,
  params: OmniVideoParams
): Promise<TaskResponse> {
  validateOmniVideoParams(params);

  const payload: Record<string, unknown> = {
    model_name: params.model_name ?? 'kling-video-o1',
    prompt: params.prompt,
  };

  // Process image_list if present
  if (params.image_list && params.image_list.length > 0) {
    const processedImages = await Promise.all(
      params.image_list.map(async (item) => ({
        image_url: await processMediaSource(item.image_url, imageToBase64),
        ...(item.type && { type: item.type }),
      }))
    );
    payload.image_list = processedImages;
  }

  // Copy video_list and element_list as-is (they use IDs/URLs)
  if (params.video_list) {
    payload.video_list = params.video_list;
  }
  if (params.element_list) {
    payload.element_list = params.element_list;
  }

  copyOptionalParams(params, payload, [
    'aspect_ratio',
    'duration',
    'callback_url',
    'external_task_id',
  ]);

  return client.request<TaskResponse>('POST', '/v1/videos/omni-video', payload);
}

/**
 * Query an omni video task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and video URLs
 */
export async function queryOmniVideoTask(
  client: KlingHttpClient,
  taskId: string
): Promise<VideoTaskResult> {
  return client.request<VideoTaskResult>('GET', `/v1/videos/omni-video/${taskId}`);
}
