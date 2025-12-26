/**
 * Avatar Operations
 *
 * Functions for avatar (talking head) generation.
 */

import type { KlingHttpClient } from '../client/http-client.js';
import { validateAvatarParams } from '../config/index.js';
import {
  imageToBase64,
  audioToBase64,
  processMediaSource,
  copyOptionalParams,
} from '../utils/index.js';
import type {
  AvatarParams,
  TaskResponse,
  VideoTaskResult,
} from '../types.js';

/**
 * Create an avatar (talking head) generation task
 *
 * @param client - HTTP client instance
 * @param params - Avatar parameters
 * @returns Task response with task ID
 */
export async function createAvatar(
  client: KlingHttpClient,
  params: AvatarParams
): Promise<TaskResponse> {
  validateAvatarParams(params);

  const payload: Record<string, unknown> = {
    image: await processMediaSource(params.image, imageToBase64),
  };

  // Add audio source (mutually exclusive)
  if (params.audio_id) {
    payload.audio_id = params.audio_id;
  } else if (params.sound_file) {
    payload.sound_file = await processMediaSource(params.sound_file, audioToBase64);
  }

  copyOptionalParams(params, payload, ['prompt', 'mode', 'callback_url', 'external_task_id']);

  return client.request<TaskResponse>('POST', '/v1/avatar', payload);
}

/**
 * Query an avatar task status
 *
 * @param client - HTTP client instance
 * @param taskId - Task ID to query
 * @returns Task result with status and video URLs
 */
export async function queryAvatarTask(
  client: KlingHttpClient,
  taskId: string
): Promise<VideoTaskResult> {
  return client.request<VideoTaskResult>('GET', `/v1/avatar/${taskId}`);
}
