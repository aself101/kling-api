/**
 * Image Operations
 *
 * Functions for image generation, expansion, and multi-image transformations.
 */

import type { KlingHttpClient } from '../client/http-client.js';
import {
  validateImageGenParams,
  validateImageExpandParams,
  validateOmniImageParams,
  validateMultiImageToImageParams,
} from '../config/index.js';
import {
  imageToBase64,
  processMediaSource,
  copyOptionalParams,
} from '../utils.js';
import type {
  ImageGenParams,
  ImageExpandParams,
  OmniImageParams,
  MultiImageToImageParams,
  TaskResponse,
  ImageTaskResult,
} from '../types.js';

// ==========================================================================
// Image Generation
// ==========================================================================

/**
 * Create an image generation task
 *
 * @param client - HTTP client instance
 * @param params - Generation parameters
 * @returns Task response with task ID
 */
export async function generateImage(
  client: KlingHttpClient,
  params: ImageGenParams
): Promise<TaskResponse> {
  validateImageGenParams(params);

  const payload: Record<string, unknown> = {
    model_name: params.model_name ?? 'kling-v1',
    prompt: params.prompt,
  };

  // Handle image separately as it needs processing
  if (params.image) {
    payload.image = await processMediaSource(params.image, imageToBase64);
  }

  copyOptionalParams(params, payload, [
    'negative_prompt',
    'image_reference',
    'image_fidelity',
    'human_fidelity',
    'resolution',
    'n',
    'aspect_ratio',
    'callback_url',
    'external_task_id',
  ]);

  return client.request<TaskResponse>('POST', '/v1/images/generations', payload);
}

/**
 * Query an image generation task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and image URLs
 */
export async function queryImageGenTask(
  client: KlingHttpClient,
  taskId: string
): Promise<ImageTaskResult> {
  return client.request<ImageTaskResult>('GET', `/v1/images/generations/${taskId}`);
}

// ==========================================================================
// Image Expansion
// ==========================================================================

/**
 * Create an image expansion task
 *
 * @param client - HTTP client instance
 * @param params - Expansion parameters
 * @returns Task response with task ID
 */
export async function expandImage(
  client: KlingHttpClient,
  params: ImageExpandParams
): Promise<TaskResponse> {
  validateImageExpandParams(params);

  const payload: Record<string, unknown> = {
    image: await processMediaSource(params.image, imageToBase64),
    up_expansion_ratio: params.up_expansion_ratio,
    down_expansion_ratio: params.down_expansion_ratio,
    left_expansion_ratio: params.left_expansion_ratio,
    right_expansion_ratio: params.right_expansion_ratio,
  };

  copyOptionalParams(params, payload, ['callback_url', 'external_task_id']);

  return client.request<TaskResponse>('POST', '/v1/images/expand', payload);
}

/**
 * Query an image expansion task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and image URLs
 */
export async function queryImageExpandTask(
  client: KlingHttpClient,
  taskId: string
): Promise<ImageTaskResult> {
  return client.request<ImageTaskResult>('GET', `/v1/images/expand/${taskId}`);
}

// ==========================================================================
// Omni Image
// ==========================================================================

/**
 * Generate images using the Omni model with multi-modal inputs
 *
 * @param client - HTTP client instance
 * @param params - Generation parameters
 * @returns Task response with task ID
 *
 * @remarks
 * Use template syntax in prompts to reference inputs:
 * - <<<image_1>>> for images from image_list
 */
export async function omniImage(
  client: KlingHttpClient,
  params: OmniImageParams
): Promise<TaskResponse> {
  validateOmniImageParams(params);

  const payload: Record<string, unknown> = {
    model_name: params.model_name ?? 'kling-image-o1',
    prompt: params.prompt,
  };

  // Process image_list if present
  if (params.image_list && params.image_list.length > 0) {
    const processedImages = await Promise.all(
      params.image_list.map(async (item) => ({
        image: await processMediaSource(item.image, imageToBase64),
      }))
    );
    payload.image_list = processedImages;
  }

  // Copy element_list as-is (they use IDs)
  if (params.element_list) {
    payload.element_list = params.element_list;
  }

  copyOptionalParams(params, payload, [
    'resolution',
    'n',
    'aspect_ratio',
    'callback_url',
    'external_task_id',
  ]);

  return client.request<TaskResponse>('POST', '/v1/images/omni-image', payload);
}

/**
 * Query an omni image task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and image URLs
 */
export async function queryOmniImageTask(
  client: KlingHttpClient,
  taskId: string
): Promise<ImageTaskResult> {
  return client.request<ImageTaskResult>('GET', `/v1/images/omni-image/${taskId}`);
}

// ==========================================================================
// Multi-Image-to-Image
// ==========================================================================

/**
 * Generate images from multiple subject images with optional scene and style
 *
 * @param client - HTTP client instance
 * @param params - Generation parameters
 * @returns Task response with task ID
 *
 * @remarks
 * Supports 1-4 subject images. Subject images should be pre-cropped.
 * Scene and style images are optional references.
 */
export async function multiImageToImage(
  client: KlingHttpClient,
  params: MultiImageToImageParams
): Promise<TaskResponse> {
  validateMultiImageToImageParams(params);

  // Process subject images in parallel
  const processedSubjects = await Promise.all(
    params.subject_image_list.map(async (item) => ({
      subject_image: await processMediaSource(item.subject_image, imageToBase64),
    }))
  );

  const payload: Record<string, unknown> = {
    model_name: params.model_name ?? 'kling-v2',
    subject_image_list: processedSubjects,
  };

  // Process optional scene_image
  if (params.scene_image) {
    payload.scene_image = await processMediaSource(params.scene_image, imageToBase64);
  }

  // Process optional style_image
  if (params.style_image) {
    payload.style_image = await processMediaSource(params.style_image, imageToBase64);
  }

  copyOptionalParams(params, payload, [
    'prompt',
    'n',
    'aspect_ratio',
    'callback_url',
    'external_task_id',
  ]);

  return client.request<TaskResponse>('POST', '/v1/images/multi-image2image', payload);
}

/**
 * Query a multi-image-to-image task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and image URLs
 */
export async function queryMultiImageToImageTask(
  client: KlingHttpClient,
  taskId: string
): Promise<ImageTaskResult> {
  return client.request<ImageTaskResult>('GET', `/v1/images/multi-image2image/${taskId}`);
}
