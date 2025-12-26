/**
 * Result Polling Handlers
 *
 * Functions for waiting on task completion with polling.
 */

import { KlingAPIError } from '../errors.js';
import {
  DEFAULT_POLL_INTERVAL,
  DEFAULT_POLL_TIMEOUT,
  ERROR_CODES,
} from '../config/index.js';
import { pollWithSpinner } from '../utils.js';
import type {
  VideoTaskResult,
  ImageTaskResult,
  PollOptions,
} from '../types.js';

/**
 * Generic method to wait for any task to complete
 *
 * @param taskId - Task ID to wait for
 * @param queryFn - Function to query task status
 * @param options - Polling options
 * @param defaultSpinnerText - Default spinner text
 * @param defaultErrorMsg - Default error message for failed tasks
 * @returns Completed task result
 */
async function waitForTaskResult<T extends VideoTaskResult | ImageTaskResult>(
  taskId: string,
  queryFn: (id: string) => Promise<T>,
  options: PollOptions,
  defaultSpinnerText: string,
  defaultErrorMsg: string
): Promise<T> {
  const result = await pollWithSpinner<T>(
    () => queryFn(taskId),
    (result) => result.data.task_status === 'succeed' || result.data.task_status === 'failed',
    {
      interval: options.interval ?? DEFAULT_POLL_INTERVAL,
      timeout: options.timeout ?? DEFAULT_POLL_TIMEOUT,
      showSpinner: options.showSpinner,
      spinnerText: options.spinnerText ?? defaultSpinnerText,
    }
  );

  if (result.data.task_status === 'failed') {
    throw new KlingAPIError(
      result.data.task_status_msg ?? defaultErrorMsg,
      ERROR_CODES.INTERNAL_ERROR,
      result.request_id
    );
  }

  return result;
}

/**
 * Wait for a video generation task to complete
 *
 * @param taskId - Task ID to wait for
 * @param queryFn - Function to query task status
 * @param options - Polling options
 * @returns Completed task result
 */
export async function waitForVideoResult(
  taskId: string,
  queryFn: (id: string) => Promise<VideoTaskResult>,
  options: PollOptions = {}
): Promise<VideoTaskResult> {
  return waitForTaskResult(
    taskId,
    queryFn,
    options,
    'Generating video',
    'Video generation failed'
  );
}

/**
 * Wait for an image generation task to complete
 *
 * @param taskId - Task ID to wait for
 * @param queryFn - Function to query task status
 * @param options - Polling options
 * @returns Completed task result
 */
export async function waitForImageResult(
  taskId: string,
  queryFn: (id: string) => Promise<ImageTaskResult>,
  options: PollOptions = {}
): Promise<ImageTaskResult> {
  return waitForTaskResult(
    taskId,
    queryFn,
    options,
    'Generating image',
    'Image generation failed'
  );
}
