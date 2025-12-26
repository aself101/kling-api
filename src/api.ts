/**
 * Kling API Client
 *
 * Main API wrapper class for Kling AI services including
 * video generation, image generation, and avatar creation.
 *
 * This façade delegates to specialized operation modules while
 * maintaining a unified interface for consumers.
 */

import { KlingHttpClient } from './client/http-client.js';
import * as videoOps from './operations/video.js';
import * as imageOps from './operations/image.js';
import * as avatarOps from './operations/avatar.js';
import * as resultHandlers from './handlers/result-poller.js';
import * as fileHandlers from './handlers/file-saver.js';
import type {
  KlingConfig,
  TextToVideoParams,
  ImageToVideoParams,
  ImageGenParams,
  ImageExpandParams,
  AvatarParams,
  ExtendVideoParams,
  MultiImageToVideoParams,
  OmniVideoParams,
  OmniImageParams,
  MultiImageToImageParams,
  TaskResponse,
  VideoTaskResult,
  ImageTaskResult,
  AccountInfoResponse,
  PollOptions,
} from './types.js';

// Re-export error class for consumers
export { KlingAPIError } from './errors.js';

/**
 * Kling API Client
 *
 * Provides methods to interact with all Kling AI services.
 *
 * @example
 * ```typescript
 * const api = new KlingAPI({
 *   accessKey: 'your-access-key',
 *   secretKey: 'your-secret-key'
 * });
 *
 * // Generate a video from text
 * const task = await api.textToVideo({
 *   prompt: 'A cat playing piano',
 *   model_name: 'kling-v2-master',
 *   duration: '5'
 * });
 *
 * // Wait for result
 * const result = await api.waitForVideoResult(task.data.task_id);
 * ```
 */
export class KlingAPI {
  /** @internal HTTP client exposed for testing only */
  private httpClient: KlingHttpClient;

  /** @internal Axios client exposed for testing only (use httpClient.client to access) */
  get client(): import('axios').AxiosInstance {
    return this.httpClient.client;
  }

  /**
   * Create a new KlingAPI instance
   *
   * @param config - API configuration
   * @throws Error if credentials are not provided
   */
  constructor(config: KlingConfig = {}) {
    this.httpClient = new KlingHttpClient(config);
  }

  // ==========================================================================
  // Account Methods
  // ==========================================================================

  /**
   * Get account information and credit balance
   *
   * @param startTime - Start time for query (Unix timestamp in ms)
   * @param endTime - End time for query (Unix timestamp in ms)
   * @param resourcePackName - Optional specific resource pack to query
   * @returns Account information with resource packages
   */
  async getAccountInfo(
    startTime: number,
    endTime: number,
    resourcePackName?: string
  ): Promise<AccountInfoResponse> {
    const params: Record<string, unknown> = {
      start_time: startTime,
      end_time: endTime,
    };

    if (resourcePackName) {
      params.resource_pack_name = resourcePackName;
    }

    return this.httpClient.request<AccountInfoResponse>('GET', '/account/costs', params);
  }

  // ==========================================================================
  // Text-to-Video Methods
  // ==========================================================================

  /**
   * Create a text-to-video generation task
   *
   * @param params - Generation parameters
   * @returns Task response with task ID
   */
  async textToVideo(params: TextToVideoParams): Promise<TaskResponse> {
    return videoOps.textToVideo(this.httpClient, params);
  }

  /**
   * Query a text-to-video task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and video URLs
   */
  async queryTextToVideoTask(taskId: string): Promise<VideoTaskResult> {
    return videoOps.queryTextToVideoTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Image-to-Video Methods
  // ==========================================================================

  /**
   * Create an image-to-video generation task
   *
   * @param params - Generation parameters
   * @returns Task response with task ID
   */
  async imageToVideo(params: ImageToVideoParams): Promise<TaskResponse> {
    return videoOps.imageToVideo(this.httpClient, params);
  }

  /**
   * Query an image-to-video task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and video URLs
   */
  async queryImageToVideoTask(taskId: string): Promise<VideoTaskResult> {
    return videoOps.queryImageToVideoTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Image Generation Methods
  // ==========================================================================

  /**
   * Create an image generation task
   *
   * @param params - Generation parameters
   * @returns Task response with task ID
   */
  async generateImage(params: ImageGenParams): Promise<TaskResponse> {
    return imageOps.generateImage(this.httpClient, params);
  }

  /**
   * Query an image generation task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and image URLs
   */
  async queryImageGenTask(taskId: string): Promise<ImageTaskResult> {
    return imageOps.queryImageGenTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Image Expansion Methods
  // ==========================================================================

  /**
   * Create an image expansion task
   *
   * @param params - Expansion parameters
   * @returns Task response with task ID
   */
  async expandImage(params: ImageExpandParams): Promise<TaskResponse> {
    return imageOps.expandImage(this.httpClient, params);
  }

  /**
   * Query an image expansion task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and image URLs
   */
  async queryImageExpandTask(taskId: string): Promise<ImageTaskResult> {
    return imageOps.queryImageExpandTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Avatar Methods
  // ==========================================================================

  /**
   * Create an avatar (talking head) generation task
   *
   * @param params - Avatar parameters
   * @returns Task response with task ID
   */
  async createAvatar(params: AvatarParams): Promise<TaskResponse> {
    return avatarOps.createAvatar(this.httpClient, params);
  }

  /**
   * Query an avatar task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and video URLs
   */
  async queryAvatarTask(taskId: string): Promise<VideoTaskResult> {
    return avatarOps.queryAvatarTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Video Extension Methods
  // ==========================================================================

  /**
   * Extend an existing video by appending new content
   *
   * @param params - Extension parameters
   * @returns Task response with task ID
   *
   * @remarks
   * The source video must be under 3 minutes and within 30 days of generation.
   * Videos are cleared 30 days after generation.
   */
  async extendVideo(params: ExtendVideoParams): Promise<TaskResponse> {
    return videoOps.extendVideo(this.httpClient, params);
  }

  /**
   * Query a video extension task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and video URLs
   */
  async queryExtendVideoTask(taskId: string): Promise<VideoTaskResult> {
    return videoOps.queryExtendVideoTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Multi-Image-to-Video Methods
  // ==========================================================================

  /**
   * Generate a video from multiple reference images
   *
   * @param params - Generation parameters
   * @returns Task response with task ID
   *
   * @remarks
   * Supports up to 4 images. The model interpolates between images
   * to create smooth video transitions.
   */
  async multiImageToVideo(params: MultiImageToVideoParams): Promise<TaskResponse> {
    return videoOps.multiImageToVideo(this.httpClient, params);
  }

  /**
   * Query a multi-image-to-video task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and video URLs
   */
  async queryMultiImageToVideoTask(taskId: string): Promise<VideoTaskResult> {
    return videoOps.queryMultiImageToVideoTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Omni Video Methods
  // ==========================================================================

  /**
   * Generate a video using the Omni model with multi-modal inputs
   *
   * @param params - Generation parameters
   * @returns Task response with task ID
   *
   * @remarks
   * Use template syntax in prompts to reference inputs:
   * - <<<image_1>>> for images from image_list
   * - <<<video_1>>> for videos from video_list
   * - <<<element_1>>> for elements from element_list
   */
  async omniVideo(params: OmniVideoParams): Promise<TaskResponse> {
    return videoOps.omniVideo(this.httpClient, params);
  }

  /**
   * Query an omni video task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and video URLs
   */
  async queryOmniVideoTask(taskId: string): Promise<VideoTaskResult> {
    return videoOps.queryOmniVideoTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Omni Image Methods
  // ==========================================================================

  /**
   * Generate images using the Omni model with multi-modal inputs
   *
   * @param params - Generation parameters
   * @returns Task response with task ID
   *
   * @remarks
   * Use template syntax in prompts to reference inputs:
   * - <<<image_1>>> for images from image_list
   */
  async omniImage(params: OmniImageParams): Promise<TaskResponse> {
    return imageOps.omniImage(this.httpClient, params);
  }

  /**
   * Query an omni image task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and image URLs
   */
  async queryOmniImageTask(taskId: string): Promise<ImageTaskResult> {
    return imageOps.queryOmniImageTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Multi-Image-to-Image Methods
  // ==========================================================================

  /**
   * Generate images from multiple subject images with optional scene and style
   *
   * @param params - Generation parameters
   * @returns Task response with task ID
   *
   * @remarks
   * Supports 1-4 subject images. Subject images should be pre-cropped.
   * Scene and style images are optional references.
   */
  async multiImageToImage(params: MultiImageToImageParams): Promise<TaskResponse> {
    return imageOps.multiImageToImage(this.httpClient, params);
  }

  /**
   * Query a multi-image-to-image task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and image URLs
   */
  async queryMultiImageToImageTask(taskId: string): Promise<ImageTaskResult> {
    return imageOps.queryMultiImageToImageTask(this.httpClient, taskId);
  }

  // ==========================================================================
  // Wait for Result Methods
  // ==========================================================================

  /**
   * Wait for a video generation task to complete
   *
   * @param taskId - Task ID to wait for
   * @param queryFn - Function to query task status
   * @param options - Polling options
   * @returns Completed task result
   */
  async waitForVideoResult(
    taskId: string,
    queryFn: (id: string) => Promise<VideoTaskResult> = this.queryTextToVideoTask.bind(this),
    options: PollOptions = {}
  ): Promise<VideoTaskResult> {
    return resultHandlers.waitForVideoResult(taskId, queryFn, options);
  }

  /**
   * Wait for an image generation task to complete
   *
   * @param taskId - Task ID to wait for
   * @param queryFn - Function to query task status
   * @param options - Polling options
   * @returns Completed task result
   */
  async waitForImageResult(
    taskId: string,
    queryFn: (id: string) => Promise<ImageTaskResult> = this.queryImageGenTask.bind(this),
    options: PollOptions = {}
  ): Promise<ImageTaskResult> {
    return resultHandlers.waitForImageResult(taskId, queryFn, options);
  }

  // ==========================================================================
  // Download and Save Methods
  // ==========================================================================

  /**
   * Download and save video result to disk
   *
   * @param result - Video task result
   * @param outputDir - Output directory
   * @param prompt - Original prompt (for filename)
   * @returns Array of saved file paths
   */
  async saveVideoResult(
    result: VideoTaskResult,
    outputDir: string,
    prompt?: string
  ): Promise<string[]> {
    return fileHandlers.saveVideoResult(result, outputDir, prompt);
  }

  /**
   * Download and save image result to disk
   *
   * @param result - Image task result
   * @param outputDir - Output directory
   * @param prompt - Original prompt (for filename)
   * @returns Array of saved file paths
   */
  async saveImageResult(
    result: ImageTaskResult,
    outputDir: string,
    prompt?: string
  ): Promise<string[]> {
    return fileHandlers.saveImageResult(result, outputDir, prompt);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Check if the API is reachable
   *
   * @returns True if API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Use account endpoint as health check (it's free to call)
      const now = Date.now();
      await this.getAccountInfo(now - 3600000, now);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current authentication token (for debugging)
   *
   * @returns Current JWT token
   */
  getToken(): string {
    return this.httpClient.getToken();
  }

  /**
   * Force refresh the authentication token
   */
  refreshToken(): void {
    this.httpClient.refreshToken();
  }
}

export default KlingAPI;
