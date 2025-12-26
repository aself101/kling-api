/**
 * Kling API Client
 *
 * Main API wrapper class for Kling AI services including
 * video generation, image generation, and avatar creation.
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { join } from 'path';

import { KlingAuth } from './auth.js';
import {
  BASE_URL,
  DEFAULT_TIMEOUT,
  DEFAULT_POLL_INTERVAL,
  DEFAULT_POLL_TIMEOUT,
  ERROR_CODES,
  loadCredentials,
  validateTextToVideoParams,
  validateImageToVideoParams,
  validateImageGenParams,
  validateImageExpandParams,
  validateAvatarParams,
} from './config/index.js';
import {
  sanitizeError,
  isProduction,
  pollWithSpinner,
  downloadVideo,
  downloadImage,
  saveMetadata,
  ensureDirectory,
  generateFilename,
  imageToBase64,
  audioToBase64,
  logger,
  processMediaSource,
  copyOptionalParams,
  BACKOFF_BASE_MS,
} from './utils.js';
import type {
  KlingConfig,
  TextToVideoParams,
  ImageToVideoParams,
  ImageGenParams,
  ImageExpandParams,
  AvatarParams,
  TaskResponse,
  VideoTaskResult,
  ImageTaskResult,
  AccountInfoResponse,
  PollOptions,
} from './types.js';

// ============================================================================
// API Error Class
// ============================================================================

/** Custom error class for Kling API errors */
export class KlingAPIError extends Error {
  constructor(
    message: string,
    public code: number,
    public requestId?: string,
    public httpStatus?: number
  ) {
    super(message);
    this.name = 'KlingAPIError';
  }

  /** Check if error is retryable */
  isRetryable(): boolean {
    return (
      this.code === ERROR_CODES.SERVICE_UNAVAILABLE ||
      this.httpStatus === 502 ||
      this.httpStatus === 503 ||
      this.httpStatus === 504
    );
  }
}

// ============================================================================
// Main API Class
// ============================================================================

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
  private auth: KlingAuth;
  private client: AxiosInstance;
  private baseUrl: string;
  private debug: boolean;

  /**
   * Create a new KlingAPI instance
   *
   * @param config - API configuration
   * @throws Error if credentials are not provided
   */
  constructor(config: KlingConfig = {}) {
    // Load credentials with priority chain
    const credentials = loadCredentials(config.accessKey, config.secretKey);

    if (!credentials.accessKey || !credentials.secretKey) {
      throw new Error(
        'Kling API credentials not found. Provide accessKey and secretKey via:\n' +
          '1. Constructor parameters\n' +
          '2. Environment variables (KLING_ACCESS_KEY, KLING_SECRET_KEY)\n' +
          '3. Local .env file\n' +
          '4. Global ~/.kling/.env file'
      );
    }

    this.auth = new KlingAuth(credentials.accessKey, credentials.secretKey);
    this.baseUrl = config.baseUrl ?? BASE_URL;
    this.debug = config.debug ?? false;

    // Validate HTTPS
    if (!this.baseUrl.startsWith('https://')) {
      throw new Error('Base URL must use HTTPS protocol');
    }

    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth
    this.client.interceptors.request.use((requestConfig) => {
      // Ensure headers object exists (use plain object for compatibility)
      const headers = requestConfig.headers ?? {};
      headers.Authorization = this.auth.getAuthorizationHeader();
      requestConfig.headers = headers;
      return requestConfig;
    });

    if (this.debug) {
      logger.debug(`KlingAPI initialized with base URL: ${this.baseUrl}`);
      logger.debug(`Using access key: ${this.auth.getRedactedAccessKey()}`);
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Make an API request with error handling
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: Record<string, unknown>,
    retries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (this.debug) {
          logger.debug(`[${method}] ${endpoint} (attempt ${attempt}/${retries})`);
        }

        const response =
          method === 'GET'
            ? await this.client.get<T>(endpoint, { params: data })
            : await this.client.post<T>(endpoint, data);

        return response.data;
      } catch (error) {
        lastError = this.handleError(error);

        // Check if retryable
        if (lastError instanceof KlingAPIError && lastError.isRetryable() && attempt < retries) {
          const delay = Math.pow(2, attempt) * BACKOFF_BASE_MS; // Exponential backoff
          if (this.debug) {
            logger.debug(`Retrying in ${delay}ms...`);
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Handle and transform API errors
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{
        code: number;
        message: string;
        request_id?: string;
      }>;

      if (axiosError.response) {
        const { status, data } = axiosError.response;
        const code = data?.code || status;
        const message = data?.message || axiosError.message;
        const requestId = data?.request_id;

        // Sanitize error in production
        const finalMessage = isProduction() ? sanitizeError(message, false) : message;

        return new KlingAPIError(finalMessage, code, requestId, status);
      }

      if (axiosError.code === 'ECONNABORTED') {
        return new KlingAPIError('Request timeout', ERROR_CODES.SERVICE_UNAVAILABLE);
      }

      return new KlingAPIError(axiosError.message, ERROR_CODES.INTERNAL_ERROR);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
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

    return this.makeRequest<AccountInfoResponse>('GET', '/account/costs', params);
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

    return this.makeRequest<TaskResponse>('POST', '/v1/videos/text2video', payload);
  }

  /**
   * Query a text-to-video task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and video URLs
   */
  async queryTextToVideoTask(taskId: string): Promise<VideoTaskResult> {
    return this.makeRequest<VideoTaskResult>('GET', `/v1/videos/text2video/${taskId}`);
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

    return this.makeRequest<TaskResponse>('POST', '/v1/videos/image2video', payload);
  }

  /**
   * Query an image-to-video task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and video URLs
   */
  async queryImageToVideoTask(taskId: string): Promise<VideoTaskResult> {
    return this.makeRequest<VideoTaskResult>('GET', `/v1/videos/image2video/${taskId}`);
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

    return this.makeRequest<TaskResponse>('POST', '/v1/images/generations', payload);
  }

  /**
   * Query an image generation task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and image URLs
   */
  async queryImageGenTask(taskId: string): Promise<ImageTaskResult> {
    return this.makeRequest<ImageTaskResult>('GET', `/v1/images/generations/${taskId}`);
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
    validateImageExpandParams(params);

    const payload: Record<string, unknown> = {
      image: await processMediaSource(params.image, imageToBase64),
      up_expansion_ratio: params.up_expansion_ratio,
      down_expansion_ratio: params.down_expansion_ratio,
      left_expansion_ratio: params.left_expansion_ratio,
      right_expansion_ratio: params.right_expansion_ratio,
    };

    copyOptionalParams(params, payload, ['callback_url', 'external_task_id']);

    return this.makeRequest<TaskResponse>('POST', '/v1/images/expand', payload);
  }

  /**
   * Query an image expansion task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and image URLs
   */
  async queryImageExpandTask(taskId: string): Promise<ImageTaskResult> {
    return this.makeRequest<ImageTaskResult>('GET', `/v1/images/expand/${taskId}`);
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

    return this.makeRequest<TaskResponse>('POST', '/v1/avatar', payload);
  }

  /**
   * Query an avatar task status
   *
   * @param taskId - Task ID to query
   * @returns Task result with status and video URLs
   */
  async queryAvatarTask(taskId: string): Promise<VideoTaskResult> {
    return this.makeRequest<VideoTaskResult>('GET', `/v1/avatar/${taskId}`);
  }

  // ==========================================================================
  // Wait for Result Methods
  // ==========================================================================

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
  private async waitForTaskResult<T extends VideoTaskResult | ImageTaskResult>(
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
  async waitForVideoResult(
    taskId: string,
    queryFn: (id: string) => Promise<VideoTaskResult> = this.queryTextToVideoTask.bind(this),
    options: PollOptions = {}
  ): Promise<VideoTaskResult> {
    return this.waitForTaskResult(
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
  async waitForImageResult(
    taskId: string,
    queryFn: (id: string) => Promise<ImageTaskResult> = this.queryImageGenTask.bind(this),
    options: PollOptions = {}
  ): Promise<ImageTaskResult> {
    return this.waitForTaskResult(
      taskId,
      queryFn,
      options,
      'Generating image',
      'Image generation failed'
    );
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
  async saveImageResult(
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
    return this.auth.getValidToken();
  }

  /**
   * Force refresh the authentication token
   */
  refreshToken(): void {
    this.auth.refreshToken();
  }
}

export default KlingAPI;
