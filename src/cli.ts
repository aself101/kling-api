#!/usr/bin/env node

/**
 * Kling AI CLI
 *
 * Command-line tool for generating videos and images using Kling AI API.
 * Supports text-to-video, image-to-video, video extension, and multi-image generation.
 *
 * Usage:
 *   kling video text2video --prompt "a cat playing piano"
 *   kling video image2video --image ./photo.jpg --prompt "make it come alive"
 *   kling video extend --video-id <id>
 *
 * Models:
 *   Text-to-Video: kling-v1, kling-v1-6, kling-v2-master, kling-v2-1-master, kling-v2-5-turbo, kling-v2-6
 *   Image-to-Video: kling-v1, kling-v1-5, kling-v1-6, kling-v2-master, kling-v2-1, kling-v2-1-master, kling-v2-5-turbo, kling-v2-6
 */

import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';

import { KlingAPI } from './api.js';
import {
  loadCredentials,
  loadConfig,
  validateTextToVideoParams,
  validateImageToVideoParams,
  validateExtendVideoParams,
  validateMultiImageToVideoParams,
  validateOmniVideoParams,
  validateImageGenParams,
  validateImageExpandParams,
  validateOmniImageParams,
  validateMultiImageToImageParams,
  validateAvatarParams,
  ValidationError,
  VALID_VIDEO_ASPECT_RATIOS,
  VALID_VIDEO_MODES,
  VALID_VIDEO_DURATIONS,
  VALID_CAMERA_TYPES,
  VALID_IMAGE_ASPECT_RATIOS,
  VALID_IMAGE_RESOLUTIONS,
  VALID_OMNI_IMAGE_ASPECT_RATIOS,
  VALID_MULTI_IMAGE_TO_IMAGE_MODELS,
} from './config/index.js';
import { ensureDirectory, generateFilename, saveMetadata, logger } from './utils/index.js';
import type {
  TextToVideoParams,
  ImageToVideoParams,
  ExtendVideoParams,
  MultiImageToVideoParams,
  OmniVideoParams,
  ImageGenParams,
  ImageExpandParams,
  OmniImageParams,
  MultiImageToImageParams,
  AvatarParams,
  VideoTaskResult,
  ImageTaskResult,
  CameraControl,
} from './types.js';

// Dynamically read version from package.json to prevent drift
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// In dev (src/), package.json is one level up; in dist/, it's also one level up
const pkgPath = join(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };

// ============================================================================
// Type Definitions
// ============================================================================

interface GlobalOptions {
  accessKey?: string;
  secretKey?: string;
  outputDir?: string;
  debug?: boolean;
  verbose?: boolean;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Union type for all video operation parameters
 * Used for metadata storage in saveVideoResultToDisk
 */
type VideoParams =
  | TextToVideoParams
  | ImageToVideoParams
  | ExtendVideoParams
  | MultiImageToVideoParams
  | OmniVideoParams;

interface Text2VideoOptions {
  prompt: string[];
  model: string;
  negativePrompt?: string;
  mode: string;
  aspectRatio: string;
  duration: string;
  cfgScale?: number;
  sound?: string;
  cameraType?: string;
  cameraHorizontal?: number;
  cameraVertical?: number;
  cameraPan?: number;
  cameraTilt?: number;
  cameraRoll?: number;
  cameraZoom?: number;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

interface Image2VideoOptions {
  image: string;
  prompt?: string[];
  model: string;
  negativePrompt?: string;
  mode: string;
  aspectRatio?: string;
  duration: string;
  imageTail?: string;
  cfgScale?: number;
  cameraType?: string;
  cameraHorizontal?: number;
  cameraVertical?: number;
  cameraPan?: number;
  cameraTilt?: number;
  cameraRoll?: number;
  cameraZoom?: number;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

interface ExtendOptions {
  videoId: string;
  prompt?: string;
  negativePrompt?: string;
  cfgScale?: number;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

interface MultiImageOptions {
  images: string[];
  prompt: string;
  model: string;
  negativePrompt?: string;
  mode: string;
  aspectRatio: string;
  duration: string;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

interface OmniVideoOptions {
  prompt: string;
  images?: string[];
  elements?: string[];
  model: string;
  aspectRatio: string;
  duration: string;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

// ============================================================================
// Image CLI Option Types
// ============================================================================

/**
 * Union type for all image operation parameters
 * Used for metadata storage in saveImageResultToDisk
 */
type ImageParams = ImageGenParams | ImageExpandParams | OmniImageParams | MultiImageToImageParams;

interface ImageGenerateOptions {
  prompt: string[];
  model: string;
  negativePrompt?: string;
  image?: string;
  imageReference?: string;
  imageFidelity?: number;
  humanFidelity?: number;
  resolution: string;
  aspectRatio: string;
  count: number;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

interface ImageExpandOptions {
  image: string;
  up: number;
  down: number;
  left: number;
  right: number;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

interface OmniImageOptions {
  prompt: string;
  images?: string[];
  elements?: string[];
  model: string;
  resolution: string;
  aspectRatio: string;
  count: number;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

interface MultiImageToImageOptions {
  subjectImages: string[];
  sceneImage?: string;
  styleImage?: string;
  prompt?: string;
  model: string;
  aspectRatio: string;
  count: number;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

interface AvatarCreateOptions {
  image: string;
  audioId?: string;
  audioFile?: string;
  prompt?: string;
  mode: string;
  wait?: boolean;
  noDownload?: boolean;
  callbackUrl?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the output directory from options or environment
 */
function getOutputDir(globalOptions: GlobalOptions): string {
  const config = loadConfig();
  return globalOptions.outputDir ?? config.outputDir ?? './datasets/kling';
}

/**
 * Output a message respecting --quiet flag
 */
function output(message: string, globalOptions: GlobalOptions): void {
  if (!globalOptions.quiet) {
    console.log(message);
  }
}

/**
 * Output verbose information (only when --verbose is set)
 */
function verbose(message: string, globalOptions: GlobalOptions): void {
  if (globalOptions.verbose && !globalOptions.quiet) {
    console.log(`[verbose] ${message}`);
  }
}

/**
 * Build camera control object from CLI options
 */
function buildCameraControl(
  options: Text2VideoOptions | Image2VideoOptions
): CameraControl | undefined {
  if (!options.cameraType) {
    return undefined;
  }

  const control: CameraControl = {
    type: options.cameraType as CameraControl['type'],
  };

  // Add config if any camera config options are set
  if (
    options.cameraHorizontal !== undefined ||
    options.cameraVertical !== undefined ||
    options.cameraPan !== undefined ||
    options.cameraTilt !== undefined ||
    options.cameraRoll !== undefined ||
    options.cameraZoom !== undefined
  ) {
    control.config = {
      horizontal: options.cameraHorizontal,
      vertical: options.cameraVertical,
      pan: options.cameraPan,
      tilt: options.cameraTilt,
      roll: options.cameraRoll,
      zoom: options.cameraZoom,
    };
  }

  return control;
}

/**
 * Save video result to disk
 */
async function saveVideoResultToDisk(
  api: KlingAPI,
  result: VideoTaskResult,
  prompt: string,
  model: string,
  params: VideoParams,
  globalOptions: GlobalOptions
): Promise<void> {
  const baseDir = getOutputDir(globalOptions);
  const modelDir = path.join(baseDir, model);

  ensureDirectory(modelDir);

  const videos = result.data.task_result?.videos ?? [];
  for (const video of videos) {
    const filename = generateFilename(prompt, 'mp4');
    const videoPath = path.join(modelDir, filename);

    // Save video using API method
    const savedPaths = await api.saveVideoResult(result, modelDir, prompt);
    if (savedPaths.length > 0) {
      logger.info(`Video saved: ${savedPaths[0]}`);
    }

    // Save metadata
    const metadataPath = videoPath.replace('.mp4', '_metadata.json');
    const metadata = {
      task_id: result.data.task_id,
      model,
      timestamp: new Date().toISOString(),
      parameters: params,
      result: {
        video_id: video.id,
        duration: video.duration,
        video_path: savedPaths[0] || videoPath,
      },
    };
    saveMetadata(metadataPath, metadata);
    logger.info(`Metadata saved: ${metadataPath}`);
  }
}

/**
 * Save image result to disk
 */
async function saveImageResultToDisk(
  api: KlingAPI,
  result: ImageTaskResult,
  prompt: string,
  model: string,
  params: ImageParams,
  globalOptions: GlobalOptions
): Promise<void> {
  const baseDir = getOutputDir(globalOptions);
  const modelDir = path.join(baseDir, model);

  ensureDirectory(modelDir);

  // Save images using API method
  const savedPaths = await api.saveImageResult(result, modelDir, prompt);
  for (const savedPath of savedPaths) {
    logger.info(`Image saved: ${savedPath}`);
  }

  // Save metadata for the batch
  const images = result.data.task_result?.images ?? [];
  if (images.length > 0) {
    const metadataFilename = generateFilename(prompt, 'json');
    const metadataPath = path.join(modelDir, metadataFilename.replace('.json', '_metadata.json'));
    const metadata = {
      task_id: result.data.task_id,
      model,
      timestamp: new Date().toISOString(),
      parameters: params,
      result: {
        image_count: images.length,
        image_paths: savedPaths,
      },
    };
    saveMetadata(metadataPath, metadata);
    logger.info(`Metadata saved: ${metadataPath}`);
  }
}

/**
 * Initialize API client from options
 */
function initializeApi(globalOptions: GlobalOptions): KlingAPI {
  const credentials = loadCredentials(globalOptions.accessKey, globalOptions.secretKey);

  if (!credentials.accessKey || !credentials.secretKey) {
    logger.error('API credentials not found.');
    logger.error('Provide credentials via:');
    logger.error('  1. CLI flags: --access-key and --secret-key');
    logger.error('  2. Environment variables: KLING_ACCESS_KEY and KLING_SECRET_KEY');
    logger.error('  3. Local .env file in current directory');
    logger.error('  4. Global ~/.kling/.env file');
    process.exit(1);
  }

  return new KlingAPI({
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
    debug: globalOptions.debug,
  });
}

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Handle text2video command
 */
async function handleText2Video(
  options: Text2VideoOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    const api = initializeApi(globalOptions);

    const prompts = options.prompt;
    if (!Array.isArray(prompts) || prompts.length === 0) {
      logger.error('Error: At least one prompt is required. Use -p or --prompt');
      process.exit(1);
    }

    const total = prompts.length;
    for (let index = 0; index < prompts.length; index++) {
      const prompt = prompts[index];
      const batchPrefix = total > 1 ? `[${index + 1}/${total}] ` : '';

      logger.info('='.repeat(60));
      logger.info(`${batchPrefix}Starting text-to-video generation`);
      logger.info(`Model: ${options.model}`);
      logger.info(`Prompt: "${prompt}"`);
      logger.info('='.repeat(60));

      // Build parameters
      const params: TextToVideoParams = {
        prompt,
        model_name: options.model as TextToVideoParams['model_name'],
        negative_prompt: options.negativePrompt,
        mode: options.mode as TextToVideoParams['mode'],
        aspect_ratio: options.aspectRatio as TextToVideoParams['aspect_ratio'],
        duration: options.duration as TextToVideoParams['duration'],
        cfg_scale: options.cfgScale,
        sound: options.sound as TextToVideoParams['sound'],
        camera_control: buildCameraControl(options),
        callback_url: options.callbackUrl,
      };

      // Validate parameters
      try {
        validateTextToVideoParams(params);
      } catch (error) {
        if (error instanceof ValidationError) {
          logger.error(`Parameter validation failed: ${error.message}`);
          process.exit(1);
        }
        throw error;
      }

      logger.info('Submitting generation request...');

      try {
        // Submit task
        const response = await api.textToVideo(params);
        const taskId = response.data.task_id;
        logger.info(`Task submitted: ${taskId}`);

        if (options.wait) {
          // Wait for result
          logger.info('Waiting for video generation...');
          const result = await api.waitForVideoResult(taskId, api.queryTextToVideoTask.bind(api));

          if (result.data.task_status === 'succeed') {
            logger.info('Video generation completed!');

            if (!options.noDownload) {
              await saveVideoResultToDisk(
                api,
                result,
                prompt,
                options.model,
                params,
                globalOptions
              );
            }
          } else {
            logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
          }
        } else {
          logger.info('Task submitted. Use --wait to automatically wait for completion.');
          logger.info(`Query status: kling video query --task-id ${taskId} --type text2video`);
        }

        logger.info('='.repeat(60));
        logger.info(`${batchPrefix}Done!`);
        logger.info('='.repeat(60));
      } catch (error) {
        const err = error as Error;
        logger.error(`${batchPrefix}Generation failed: ${err.message}`);
        throw error;
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle image2video command
 */
async function handleImage2Video(
  options: Image2VideoOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    // Validate input image exists
    if (!existsSync(options.image) && !options.image.startsWith('http')) {
      logger.error(`Error: Image file not found: ${options.image}`);
      process.exit(1);
    }

    const api = initializeApi(globalOptions);

    const prompt = options.prompt?.[0] ?? '';

    logger.info('='.repeat(60));
    logger.info('Starting image-to-video generation');
    logger.info(`Model: ${options.model}`);
    logger.info(`Image: ${options.image}`);
    if (prompt) {
      logger.info(`Prompt: "${prompt}"`);
    }
    logger.info('='.repeat(60));

    // Build parameters
    const params: ImageToVideoParams = {
      image: options.image,
      prompt: prompt || undefined,
      model_name: options.model as ImageToVideoParams['model_name'],
      negative_prompt: options.negativePrompt,
      mode: options.mode as ImageToVideoParams['mode'],
      duration: options.duration as ImageToVideoParams['duration'],
      cfg_scale: options.cfgScale,
      image_tail: options.imageTail,
      camera_control: buildCameraControl(options),
      callback_url: options.callbackUrl,
    };

    // Validate parameters
    try {
      validateImageToVideoParams(params);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Parameter validation failed: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    logger.info('Submitting generation request...');

    try {
      // Submit task
      const response = await api.imageToVideo(params);
      const taskId = response.data.task_id;
      logger.info(`Task submitted: ${taskId}`);

      if (options.wait) {
        // Wait for result
        logger.info('Waiting for video generation...');
        const result = await api.waitForVideoResult(taskId, api.queryImageToVideoTask.bind(api));

        if (result.data.task_status === 'succeed') {
          logger.info('Video generation completed!');

          if (!options.noDownload) {
            const promptText = prompt || path.basename(options.image, path.extname(options.image));
            await saveVideoResultToDisk(
              api,
              result,
              promptText,
              options.model,
              params,
              globalOptions
            );
          }
        } else {
          logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
        }
      } else {
        logger.info('Task submitted. Use --wait to automatically wait for completion.');
        logger.info(`Query status: kling video query --task-id ${taskId} --type image2video`);
      }

      logger.info('='.repeat(60));
      logger.info('Done!');
      logger.info('='.repeat(60));
    } catch (error) {
      const err = error as Error;
      logger.error(`Generation failed: ${err.message}`);
      throw error;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle extend command
 */
async function handleExtend(options: ExtendOptions, globalOptions: GlobalOptions): Promise<void> {
  try {
    const api = initializeApi(globalOptions);

    logger.info('='.repeat(60));
    logger.info('Starting video extension');
    logger.info(`Video ID: ${options.videoId}`);
    if (options.prompt) {
      logger.info(`Prompt: "${options.prompt}"`);
    }
    logger.info('='.repeat(60));

    // Build parameters
    const params: ExtendVideoParams = {
      video_id: options.videoId,
      prompt: options.prompt,
      negative_prompt: options.negativePrompt,
      cfg_scale: options.cfgScale,
      callback_url: options.callbackUrl,
    };

    // Validate parameters
    try {
      validateExtendVideoParams(params);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Parameter validation failed: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    logger.info('Submitting extension request...');

    try {
      // Submit task
      const response = await api.extendVideo(params);
      const taskId = response.data.task_id;
      logger.info(`Task submitted: ${taskId}`);

      if (options.wait) {
        // Wait for result
        logger.info('Waiting for video extension...');
        const result = await api.waitForVideoResult(taskId, api.queryExtendVideoTask.bind(api));

        if (result.data.task_status === 'succeed') {
          logger.info('Video extension completed!');

          if (!options.noDownload) {
            const promptText = options.prompt ?? `extended_${options.videoId}`;
            await saveVideoResultToDisk(
              api,
              result,
              promptText,
              'video-extend',
              params,
              globalOptions
            );
          }
        } else {
          logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
        }
      } else {
        logger.info('Task submitted. Use --wait to automatically wait for completion.');
        logger.info(`Query status: kling video query --task-id ${taskId} --type extend`);
      }

      logger.info('='.repeat(60));
      logger.info('Done!');
      logger.info('='.repeat(60));
    } catch (error) {
      const err = error as Error;
      logger.error(`Extension failed: ${err.message}`);
      throw error;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle multi-image command
 */
async function handleMultiImage(
  options: MultiImageOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    // Validate input images exist
    for (const img of options.images) {
      if (!existsSync(img) && !img.startsWith('http')) {
        logger.error(`Error: Image file not found: ${img}`);
        process.exit(1);
      }
    }

    const api = initializeApi(globalOptions);

    logger.info('='.repeat(60));
    logger.info('Starting multi-image-to-video generation');
    logger.info(`Model: ${options.model}`);
    logger.info(`Images: ${options.images.length}`);
    logger.info(`Prompt: "${options.prompt}"`);
    logger.info('='.repeat(60));

    // Build parameters
    const params: MultiImageToVideoParams = {
      image_list: options.images.map((image) => ({ image })),
      prompt: options.prompt,
      model_name: options.model as MultiImageToVideoParams['model_name'],
      negative_prompt: options.negativePrompt,
      mode: options.mode as MultiImageToVideoParams['mode'],
      aspect_ratio: options.aspectRatio as MultiImageToVideoParams['aspect_ratio'],
      duration: options.duration as MultiImageToVideoParams['duration'],
      callback_url: options.callbackUrl,
    };

    // Validate parameters
    try {
      validateMultiImageToVideoParams(params);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Parameter validation failed: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    logger.info('Submitting generation request...');

    try {
      // Submit task
      const response = await api.multiImageToVideo(params);
      const taskId = response.data.task_id;
      logger.info(`Task submitted: ${taskId}`);

      if (options.wait) {
        // Wait for result
        logger.info('Waiting for video generation...');
        const result = await api.waitForVideoResult(
          taskId,
          api.queryMultiImageToVideoTask.bind(api)
        );

        if (result.data.task_status === 'succeed') {
          logger.info('Video generation completed!');

          if (!options.noDownload) {
            await saveVideoResultToDisk(
              api,
              result,
              options.prompt,
              options.model,
              params,
              globalOptions
            );
          }
        } else {
          logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
        }
      } else {
        logger.info('Task submitted. Use --wait to automatically wait for completion.');
        logger.info(`Query status: kling video query --task-id ${taskId} --type multi-image`);
      }

      logger.info('='.repeat(60));
      logger.info('Done!');
      logger.info('='.repeat(60));
    } catch (error) {
      const err = error as Error;
      logger.error(`Generation failed: ${err.message}`);
      throw error;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle omni-video command
 */
async function handleOmniVideo(
  options: OmniVideoOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    const api = initializeApi(globalOptions);

    logger.info('='.repeat(60));
    logger.info('Starting omni-video generation');
    logger.info(`Model: ${options.model}`);
    logger.info(`Prompt: "${options.prompt}"`);
    if (options.images?.length) {
      logger.info(`Images: ${options.images.length}`);
    }
    if (options.elements?.length) {
      logger.info(`Elements: ${options.elements.length}`);
    }
    logger.info('='.repeat(60));

    // Build parameters
    const params: OmniVideoParams = {
      prompt: options.prompt,
      model_name: options.model as OmniVideoParams['model_name'],
      aspect_ratio: options.aspectRatio as OmniVideoParams['aspect_ratio'],
      duration: options.duration as OmniVideoParams['duration'],
      callback_url: options.callbackUrl,
    };

    // Add image_list if provided (first image as first_frame, last as end_frame if multiple)
    if (options.images?.length) {
      params.image_list = options.images.map((image_url, index) => ({
        image_url,
        type:
          index === 0
            ? ('first_frame' as const)
            : index === options.images!.length - 1
              ? ('end_frame' as const)
              : undefined,
      }));
    }

    // Add element_list if provided
    if (options.elements?.length) {
      params.element_list = options.elements.map((element_id) => ({
        element_id: parseInt(element_id, 10),
      }));
    }

    // Validate parameters
    try {
      validateOmniVideoParams(params);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Parameter validation failed: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    logger.info('Submitting generation request...');

    try {
      // Submit task
      const response = await api.omniVideo(params);
      const taskId = response.data.task_id;
      logger.info(`Task submitted: ${taskId}`);

      if (options.wait) {
        // Wait for result
        logger.info('Waiting for video generation...');
        const result = await api.waitForVideoResult(taskId, api.queryOmniVideoTask.bind(api));

        if (result.data.task_status === 'succeed') {
          logger.info('Video generation completed!');

          if (!options.noDownload) {
            await saveVideoResultToDisk(
              api,
              result,
              options.prompt,
              options.model,
              params,
              globalOptions
            );
          }
        } else {
          logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
        }
      } else {
        logger.info('Task submitted. Use --wait to automatically wait for completion.');
        logger.info(`Query status: kling video query --task-id ${taskId} --type omni`);
      }

      logger.info('='.repeat(60));
      logger.info('Done!');
      logger.info('='.repeat(60));
    } catch (error) {
      const err = error as Error;
      logger.error(`Generation failed: ${err.message}`);
      throw error;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// ============================================================================
// Image Command Handlers
// ============================================================================

/**
 * Handle image generate command
 */
async function handleImageGenerate(
  options: ImageGenerateOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    const api = initializeApi(globalOptions);

    const prompts = options.prompt;
    if (!Array.isArray(prompts) || prompts.length === 0) {
      logger.error('Error: At least one prompt is required. Use -p or --prompt');
      process.exit(1);
    }

    const total = prompts.length;
    for (let index = 0; index < prompts.length; index++) {
      const prompt = prompts[index];
      const batchPrefix = total > 1 ? `[${index + 1}/${total}] ` : '';

      logger.info('='.repeat(60));
      logger.info(`${batchPrefix}Starting image generation`);
      logger.info(`Model: ${options.model}`);
      logger.info(`Prompt: "${prompt}"`);
      logger.info(`Count: ${options.count}`);
      logger.info('='.repeat(60));

      // Build parameters
      const params: ImageGenParams = {
        prompt,
        model_name: options.model as ImageGenParams['model_name'],
        negative_prompt: options.negativePrompt,
        n: options.count,
        resolution: options.resolution as ImageGenParams['resolution'],
        aspect_ratio: options.aspectRatio as ImageGenParams['aspect_ratio'],
        callback_url: options.callbackUrl,
      };

      // Add optional image reference parameters
      if (options.image) {
        params.image = options.image;
      }
      if (options.imageReference) {
        params.image_reference = options.imageReference as ImageGenParams['image_reference'];
      }
      if (options.imageFidelity !== undefined) {
        params.image_fidelity = options.imageFidelity;
      }
      if (options.humanFidelity !== undefined) {
        params.human_fidelity = options.humanFidelity;
      }

      // Validate parameters
      try {
        validateImageGenParams(params);
      } catch (error) {
        if (error instanceof ValidationError) {
          logger.error(`Parameter validation failed: ${error.message}`);
          process.exit(1);
        }
        throw error;
      }

      logger.info('Submitting generation request...');

      try {
        // Submit task
        const response = await api.generateImage(params);
        const taskId = response.data.task_id;
        logger.info(`Task submitted: ${taskId}`);

        if (options.wait) {
          // Wait for result
          logger.info('Waiting for image generation...');
          const result = await api.waitForImageResult(taskId);

          if (result.data.task_status === 'succeed') {
            const imageCount = result.data.task_result?.images?.length ?? 0;
            logger.info(`Image generation completed! (${imageCount} images)`);

            if (!options.noDownload) {
              await saveImageResultToDisk(
                api,
                result,
                prompt,
                options.model,
                params,
                globalOptions
              );
            }
          } else {
            logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
          }
        } else {
          logger.info('Task submitted. Use --wait to automatically wait for completion.');
        }

        logger.info('='.repeat(60));
        logger.info(`${batchPrefix}Done!`);
        logger.info('='.repeat(60));
      } catch (error) {
        const err = error as Error;
        logger.error(`${batchPrefix}Generation failed: ${err.message}`);
        throw error;
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle image expand command
 */
async function handleImageExpand(
  options: ImageExpandOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    // Validate input image exists
    if (!existsSync(options.image) && !options.image.startsWith('http')) {
      logger.error(`Error: Image file not found: ${options.image}`);
      process.exit(1);
    }

    const api = initializeApi(globalOptions);

    logger.info('='.repeat(60));
    logger.info('Starting image expansion');
    logger.info(`Image: ${options.image}`);
    logger.info(
      `Expansion: up=${options.up}, down=${options.down}, left=${options.left}, right=${options.right}`
    );
    logger.info('='.repeat(60));

    // Build parameters
    const params: ImageExpandParams = {
      image: options.image,
      up_expansion_ratio: options.up,
      down_expansion_ratio: options.down,
      left_expansion_ratio: options.left,
      right_expansion_ratio: options.right,
      callback_url: options.callbackUrl,
    };

    // Validate parameters
    try {
      validateImageExpandParams(params);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Parameter validation failed: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    logger.info('Submitting expansion request...');

    try {
      // Submit task
      const response = await api.expandImage(params);
      const taskId = response.data.task_id;
      logger.info(`Task submitted: ${taskId}`);

      if (options.wait) {
        // Wait for result
        logger.info('Waiting for image expansion...');
        const result = await api.waitForImageResult(taskId, api.queryImageExpandTask.bind(api));

        if (result.data.task_status === 'succeed') {
          logger.info('Image expansion completed!');

          if (!options.noDownload) {
            const promptText =
              path.basename(options.image, path.extname(options.image)) + '_expanded';
            await saveImageResultToDisk(
              api,
              result,
              promptText,
              'image-expand',
              params,
              globalOptions
            );
          }
        } else {
          logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
        }
      } else {
        logger.info('Task submitted. Use --wait to automatically wait for completion.');
      }

      logger.info('='.repeat(60));
      logger.info('Done!');
      logger.info('='.repeat(60));
    } catch (error) {
      const err = error as Error;
      logger.error(`Expansion failed: ${err.message}`);
      throw error;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle omni-image command
 */
async function handleOmniImage(
  options: OmniImageOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    const api = initializeApi(globalOptions);

    logger.info('='.repeat(60));
    logger.info('Starting omni-image generation');
    logger.info(`Model: ${options.model}`);
    logger.info(`Prompt: "${options.prompt}"`);
    if (options.images?.length) {
      logger.info(`Images: ${options.images.length}`);
    }
    if (options.elements?.length) {
      logger.info(`Elements: ${options.elements.length}`);
    }
    logger.info('='.repeat(60));

    // Build parameters
    const params: OmniImageParams = {
      prompt: options.prompt,
      model_name: options.model as OmniImageParams['model_name'],
      n: options.count,
      resolution: options.resolution as OmniImageParams['resolution'],
      aspect_ratio: options.aspectRatio as OmniImageParams['aspect_ratio'],
      callback_url: options.callbackUrl,
    };

    // Add image_list if provided
    if (options.images?.length) {
      params.image_list = options.images.map((image) => ({ image }));
    }

    // Add element_list if provided
    if (options.elements?.length) {
      params.element_list = options.elements.map((element_id) => ({
        element_id: parseInt(element_id, 10),
      }));
    }

    // Validate parameters
    try {
      validateOmniImageParams(params);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Parameter validation failed: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    logger.info('Submitting generation request...');

    try {
      // Submit task
      const response = await api.omniImage(params);
      const taskId = response.data.task_id;
      logger.info(`Task submitted: ${taskId}`);

      if (options.wait) {
        // Wait for result
        logger.info('Waiting for image generation...');
        const result = await api.waitForImageResult(taskId, api.queryOmniImageTask.bind(api));

        if (result.data.task_status === 'succeed') {
          const imageCount = result.data.task_result?.images?.length ?? 0;
          logger.info(`Image generation completed! (${imageCount} images)`);

          if (!options.noDownload) {
            await saveImageResultToDisk(
              api,
              result,
              options.prompt,
              options.model,
              params,
              globalOptions
            );
          }
        } else {
          logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
        }
      } else {
        logger.info('Task submitted. Use --wait to automatically wait for completion.');
      }

      logger.info('='.repeat(60));
      logger.info('Done!');
      logger.info('='.repeat(60));
    } catch (error) {
      const err = error as Error;
      logger.error(`Generation failed: ${err.message}`);
      throw error;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle multi-image-to-image command
 */
async function handleMultiImageToImage(
  options: MultiImageToImageOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    // Validate input images exist
    for (const img of options.subjectImages) {
      if (!existsSync(img) && !img.startsWith('http')) {
        logger.error(`Error: Image file not found: ${img}`);
        process.exit(1);
      }
    }

    const api = initializeApi(globalOptions);

    logger.info('='.repeat(60));
    logger.info('Starting multi-image-to-image generation');
    logger.info(`Model: ${options.model}`);
    logger.info(`Subject images: ${options.subjectImages.length}`);
    if (options.prompt) {
      logger.info(`Prompt: "${options.prompt}"`);
    }
    logger.info('='.repeat(60));

    // Build parameters
    const params: MultiImageToImageParams = {
      subject_image_list: options.subjectImages.map((subject_image) => ({ subject_image })),
      prompt: options.prompt,
      model_name: options.model as MultiImageToImageParams['model_name'],
      n: options.count,
      aspect_ratio: options.aspectRatio as MultiImageToImageParams['aspect_ratio'],
      callback_url: options.callbackUrl,
    };

    // Add optional scene and style images
    if (options.sceneImage) {
      params.scene_image = options.sceneImage;
    }
    if (options.styleImage) {
      params.style_image = options.styleImage;
    }

    // Validate parameters
    try {
      validateMultiImageToImageParams(params);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Parameter validation failed: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    logger.info('Submitting generation request...');

    try {
      // Submit task
      const response = await api.multiImageToImage(params);
      const taskId = response.data.task_id;
      logger.info(`Task submitted: ${taskId}`);

      if (options.wait) {
        // Wait for result
        logger.info('Waiting for image generation...');
        const result = await api.waitForImageResult(
          taskId,
          api.queryMultiImageToImageTask.bind(api)
        );

        if (result.data.task_status === 'succeed') {
          const imageCount = result.data.task_result?.images?.length ?? 0;
          logger.info(`Image generation completed! (${imageCount} images)`);

          if (!options.noDownload) {
            const promptText = options.prompt ?? 'multi-image';
            await saveImageResultToDisk(
              api,
              result,
              promptText,
              options.model,
              params,
              globalOptions
            );
          }
        } else {
          logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
        }
      } else {
        logger.info('Task submitted. Use --wait to automatically wait for completion.');
      }

      logger.info('='.repeat(60));
      logger.info('Done!');
      logger.info('='.repeat(60));
    } catch (error) {
      const err = error as Error;
      logger.error(`Generation failed: ${err.message}`);
      throw error;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Display image usage examples
 */
function showImageExamples(): void {
  console.log(`
${'='.repeat(60)}
KLING AI - IMAGE COMMAND EXAMPLES
${'='.repeat(60)}

IMAGE GENERATION

1. Basic image generation
   $ kling image generate \\
       --prompt "a majestic lion in the savanna" \\
       --wait

2. Generate multiple images
   $ kling image generate \\
       --prompt "futuristic cityscape" \\
       --model kling-v2-1 \\
       --count 4 \\
       --resolution 2k \\
       --aspect-ratio 16:9 \\
       --wait

3. With image reference (style transfer)
   $ kling image generate \\
       --prompt "portrait in the same style" \\
       --model kling-v1-5 \\
       --image ./style-reference.jpg \\
       --image-reference subject \\
       --image-fidelity 0.8 \\
       --wait

4. With face reference
   $ kling image generate \\
       --prompt "professional headshot" \\
       --model kling-v1-5 \\
       --image ./face.jpg \\
       --image-reference face \\
       --human-fidelity 0.9 \\
       --wait

IMAGE EXPANSION (OUTPAINTING)

5. Expand image in all directions
   $ kling image expand \\
       --image ./photo.jpg \\
       --up 0.5 --down 0.5 \\
       --left 0.5 --right 0.5 \\
       --wait

6. Expand to landscape format
   $ kling image expand \\
       --image ./portrait.jpg \\
       --up 0 --down 0 \\
       --left 1 --right 1 \\
       --wait

OMNI IMAGE (ADVANCED)

7. Omni image with template syntax
   $ kling image omni \\
       --prompt "A portrait in the style of <<<image_1>>>" \\
       --images ./style-reference.jpg \\
       --count 4 \\
       --wait

MULTI-IMAGE-TO-IMAGE

8. Combine multiple subjects
   $ kling image multi \\
       --subject-images ./person1.jpg \\
       --subject-images ./person2.jpg \\
       --prompt "Two friends at a coffee shop" \\
       --scene-image ./cafe-background.jpg \\
       --wait

9. With style reference
   $ kling image multi \\
       --subject-images ./subject.jpg \\
       --style-image ./art-style.jpg \\
       --prompt "Artistic portrait" \\
       --model kling-v2-1 \\
       --wait

BATCH PROCESSING

10. Multiple prompts
    $ kling image generate \\
        --prompt "sunset over mountains" \\
        --prompt "sunrise over ocean" \\
        --prompt "night sky with stars" \\
        --count 2 \\
        --wait

${'='.repeat(60)}
`);
}

// ============================================================================
// Avatar Command Handlers
// ============================================================================

/**
 * Handle avatar create command
 */
async function handleAvatarCreate(
  options: AvatarCreateOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    // Validate input image exists
    if (!existsSync(options.image) && !options.image.startsWith('http')) {
      logger.error(`Error: Image file not found: ${options.image}`);
      process.exit(1);
    }

    // Validate audio source
    if (!options.audioId && !options.audioFile) {
      logger.error('Error: Either --audio-id or --audio-file is required');
      process.exit(1);
    }
    if (options.audioId && options.audioFile) {
      logger.error('Error: Cannot use both --audio-id and --audio-file');
      process.exit(1);
    }

    // Validate audio file exists if provided
    if (
      options.audioFile &&
      !existsSync(options.audioFile) &&
      !options.audioFile.startsWith('http')
    ) {
      logger.error(`Error: Audio file not found: ${options.audioFile}`);
      process.exit(1);
    }

    const api = initializeApi(globalOptions);

    logger.info('='.repeat(60));
    logger.info('Starting avatar (talking head) generation');
    logger.info(`Image: ${options.image}`);
    if (options.audioId) {
      logger.info(`Audio ID: ${options.audioId}`);
    } else {
      logger.info(`Audio file: ${options.audioFile}`);
    }
    if (options.prompt) {
      logger.info(`Prompt: "${options.prompt}"`);
    }
    logger.info(`Mode: ${options.mode}`);
    logger.info('='.repeat(60));

    // Build parameters
    const params: AvatarParams = {
      image: options.image,
      prompt: options.prompt,
      mode: options.mode as AvatarParams['mode'],
      callback_url: options.callbackUrl,
    };

    // Add audio source (mutually exclusive)
    if (options.audioId) {
      params.audio_id = options.audioId;
    } else if (options.audioFile) {
      params.sound_file = options.audioFile;
    }

    // Validate parameters
    try {
      validateAvatarParams(params);
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error(`Parameter validation failed: ${error.message}`);
        process.exit(1);
      }
      throw error;
    }

    logger.info('Submitting avatar generation request...');

    try {
      // Submit task
      const response = await api.createAvatar(params);
      const taskId = response.data.task_id;
      logger.info(`Task submitted: ${taskId}`);

      if (options.wait) {
        // Wait for result
        logger.info('Waiting for avatar generation...');
        const result = await api.waitForVideoResult(taskId, api.queryAvatarTask.bind(api));

        if (result.data.task_status === 'succeed') {
          logger.info('Avatar generation completed!');

          if (!options.noDownload) {
            const promptText =
              options.prompt ??
              path.basename(options.image, path.extname(options.image)) + '_avatar';
            await saveVideoResultToDisk(api, result, promptText, 'avatar', params, globalOptions);
          }
        } else {
          logger.error(`Task failed: ${result.data.task_status_msg ?? 'Unknown error'}`);
        }
      } else {
        logger.info('Task submitted. Use --wait to automatically wait for completion.');
      }

      logger.info('='.repeat(60));
      logger.info('Done!');
      logger.info('='.repeat(60));
    } catch (error) {
      const err = error as Error;
      logger.error(`Avatar generation failed: ${err.message}`);
      throw error;
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Display avatar usage examples
 */
function showAvatarExamples(): void {
  console.log(`
${'='.repeat(60)}
KLING AI - AVATAR COMMAND EXAMPLES
${'='.repeat(60)}

AVATAR / TALKING HEAD GENERATION

Create talking head videos from portrait images with synchronized audio.

1. Basic avatar with audio file
   $ kling avatar create \\
       --image ./portrait.jpg \\
       --audio-file ./speech.mp3 \\
       --wait

2. Avatar with pre-uploaded audio ID
   $ kling avatar create \\
       --image ./portrait.jpg \\
       --audio-id "uploaded-audio-id" \\
       --wait

3. Avatar with expression prompt
   $ kling avatar create \\
       --image ./portrait.jpg \\
       --audio-file ./narration.mp3 \\
       --prompt "happy, smiling expression" \\
       --wait

4. Pro mode for higher quality
   $ kling avatar create \\
       --image ./portrait.jpg \\
       --audio-file ./speech.wav \\
       --mode pro \\
       --wait

5. Using URL for image
   $ kling avatar create \\
       --image "https://example.com/portrait.jpg" \\
       --audio-file ./voice.mp3 \\
       --wait

AUDIO REQUIREMENTS
- Supported formats: MP3, WAV, M4A, AAC
- Max file size: 5MB
- Duration: 2-300 seconds

IMAGE REQUIREMENTS
- Portrait image with clear face
- Supported formats: JPG, PNG
- Min dimension: 300px

${'='.repeat(60)}
`);
}

// ============================================================================
// Account Command Handlers
// ============================================================================

interface AccountOptions {
  days?: number;
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format resource pack status with color indicator
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    online: '✓ Active',
    toBeOnline: '○ Pending',
    expired: '✗ Expired',
    runOut: '! Depleted',
  };
  return statusMap[status] ?? status;
}

/**
 * Handle account credits command
 */
async function handleAccountCredits(
  options: AccountOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    const api = initializeApi(globalOptions);

    const days = options.days ?? 30;
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    if (!globalOptions.quiet && !globalOptions.json) {
      logger.info('Fetching account credits...');
    }
    verbose(`Query period: ${days} days`, globalOptions);

    const response = await api.getAccountInfo(startTime, endTime);

    if (response.code !== 0) {
      logger.error(`API error: ${response.message}`);
      process.exit(1);
    }

    const packs = response.data.resource_pack_subscribe_infos;

    if (!packs || packs.length === 0) {
      if (globalOptions.json) {
        console.log(JSON.stringify({ packages: [], total: 0, remaining: 0 }, null, 2));
      } else {
        output('\nNo resource packages found.', globalOptions);
      }
      return;
    }

    // Calculate summary
    let totalCredits = 0;
    let remainingCredits = 0;
    let activePackages = 0;

    for (const pack of packs) {
      if (pack.status === 'online') {
        totalCredits += pack.total_quantity;
        remainingCredits += pack.remaining_quantity;
        activePackages++;
      }
    }

    // JSON output
    if (globalOptions.json) {
      const jsonOutput = {
        summary: {
          active_packages: activePackages,
          total_credits: totalCredits,
          remaining_credits: remainingCredits,
          used_credits: totalCredits - remainingCredits,
          usage_percent:
            totalCredits > 0 ? ((totalCredits - remainingCredits) / totalCredits) * 100 : 0,
        },
        packages: packs.map((pack) => ({
          name: pack.resource_pack_name,
          id: pack.resource_pack_id,
          status: pack.status,
          total: pack.total_quantity,
          remaining: pack.remaining_quantity,
          expires: new Date(pack.invalid_time).toISOString(),
        })),
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      return;
    }

    // Human-readable output
    output('\n' + '='.repeat(60), globalOptions);
    output('KLING AI - CREDIT BALANCE', globalOptions);
    output('='.repeat(60), globalOptions);

    output(`\nActive Packages: ${activePackages}`, globalOptions);
    output(`Total Credits:   ${totalCredits.toLocaleString()}`, globalOptions);
    output(`Remaining:       ${remainingCredits.toLocaleString()}`, globalOptions);
    output(`Used:            ${(totalCredits - remainingCredits).toLocaleString()}`, globalOptions);

    if (totalCredits > 0) {
      const usagePercent = (((totalCredits - remainingCredits) / totalCredits) * 100).toFixed(1);
      output(`Usage:           ${usagePercent}%`, globalOptions);
    }

    output('\n' + '-'.repeat(60), globalOptions);
    output('PACKAGES', globalOptions);
    output('-'.repeat(60), globalOptions);

    for (const pack of packs) {
      output(`\n${pack.resource_pack_name}`, globalOptions);
      output(`  Status:     ${formatStatus(pack.status)}`, globalOptions);
      output(
        `  Remaining:  ${pack.remaining_quantity.toLocaleString()} / ${pack.total_quantity.toLocaleString()}`,
        globalOptions
      );
      output(`  Expires:    ${formatDate(pack.invalid_time)}`, globalOptions);
      verbose(`  ID: ${pack.resource_pack_id}`, globalOptions);
      verbose(`  Type: ${pack.resource_pack_type}`, globalOptions);
    }

    output('\n' + '='.repeat(60), globalOptions);
    output('Note: Remaining credits may have up to 12-hour delay', globalOptions);
    output('='.repeat(60) + '\n', globalOptions);
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Handle account info command
 */
async function handleAccountInfo(
  options: AccountOptions,
  globalOptions: GlobalOptions
): Promise<void> {
  try {
    const api = initializeApi(globalOptions);

    const days = options.days ?? 90;
    const endTime = Date.now();
    const startTime = endTime - days * 24 * 60 * 60 * 1000;

    if (!globalOptions.quiet && !globalOptions.json) {
      logger.info('Fetching account information...');
    }
    verbose(`Query period: ${days} days`, globalOptions);

    const response = await api.getAccountInfo(startTime, endTime);

    if (response.code !== 0) {
      logger.error(`API error: ${response.message}`);
      process.exit(1);
    }

    const packs = response.data.resource_pack_subscribe_infos;

    // JSON output
    if (globalOptions.json) {
      const jsonOutput = {
        request_id: response.request_id,
        query_period: {
          start: new Date(startTime).toISOString(),
          end: new Date(endTime).toISOString(),
        },
        packages:
          packs?.map((pack) => ({
            name: pack.resource_pack_name,
            id: pack.resource_pack_id,
            type: pack.resource_pack_type,
            status: pack.status,
            total: pack.total_quantity,
            remaining: pack.remaining_quantity,
            used: pack.total_quantity - pack.remaining_quantity,
            purchased: new Date(pack.purchase_time).toISOString(),
            effective: new Date(pack.effective_time).toISOString(),
            expires: new Date(pack.invalid_time).toISOString(),
            days_left: Math.max(
              0,
              Math.ceil((pack.invalid_time - Date.now()) / (24 * 60 * 60 * 1000))
            ),
          })) ?? [],
      };
      console.log(JSON.stringify(jsonOutput, null, 2));
      return;
    }

    // Human-readable output
    output('\n' + '='.repeat(60), globalOptions);
    output('KLING AI - ACCOUNT INFORMATION', globalOptions);
    output('='.repeat(60), globalOptions);

    output(`\nRequest ID: ${response.request_id}`, globalOptions);
    output(`Query Period: ${formatDate(startTime)} - ${formatDate(endTime)}`, globalOptions);

    if (!packs || packs.length === 0) {
      output('\nNo resource packages found.', globalOptions);
      return;
    }

    output(`\nResource Packages: ${packs.length}`, globalOptions);

    for (const pack of packs) {
      output('\n' + '-'.repeat(60), globalOptions);
      output(`Package: ${pack.resource_pack_name}`, globalOptions);
      output('-'.repeat(60), globalOptions);
      output(`  ID:           ${pack.resource_pack_id}`, globalOptions);
      output(
        `  Type:         ${pack.resource_pack_type === 'decreasing_total' ? 'Consumable' : 'Periodic'}`,
        globalOptions
      );
      output(`  Status:       ${formatStatus(pack.status)}`, globalOptions);
      output(`  Total:        ${pack.total_quantity.toLocaleString()} credits`, globalOptions);
      output(`  Remaining:    ${pack.remaining_quantity.toLocaleString()} credits`, globalOptions);
      output(
        `  Used:         ${(pack.total_quantity - pack.remaining_quantity).toLocaleString()} credits`,
        globalOptions
      );
      output(`  Purchased:    ${formatDate(pack.purchase_time)}`, globalOptions);
      output(`  Effective:    ${formatDate(pack.effective_time)}`, globalOptions);
      output(`  Expires:      ${formatDate(pack.invalid_time)}`, globalOptions);

      // Calculate days until expiration
      const daysLeft = Math.ceil((pack.invalid_time - Date.now()) / (24 * 60 * 60 * 1000));
      if (pack.status === 'online' && daysLeft > 0) {
        output(`  Days Left:    ${daysLeft}`, globalOptions);
      }
    }

    output('\n' + '='.repeat(60) + '\n', globalOptions);
  } catch (error) {
    const err = error as Error;
    logger.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Display account usage examples
 */
function showAccountExamples(): void {
  console.log(`
${'='.repeat(60)}
KLING AI - ACCOUNT COMMAND EXAMPLES
${'='.repeat(60)}

CHECK CREDITS

1. Quick credit balance check
   $ kling account credits

2. Detailed account information
   $ kling account info

3. Check credits for last 7 days
   $ kling account credits --days 7

4. Extended history (90 days)
   $ kling account info --days 90

NOTES
- Remaining credits may have up to 12-hour delay
- Package types:
  - Consumable: Credits decrease with usage
  - Periodic: Fixed allocation per period

${'='.repeat(60)}
`);
}

/**
 * Display usage examples
 */
function showExamples(): void {
  console.log(`
${'='.repeat(60)}
KLING AI - USAGE EXAMPLES
${'='.repeat(60)}

TEXT-TO-VIDEO

1. Basic text-to-video
   $ kling video text2video \\
       --prompt "a cat playing piano" \\
       --wait

2. With model and options
   $ kling video text2video \\
       --prompt "cinematic landscape" \\
       --model kling-v2-master \\
       --aspect-ratio 16:9 \\
       --duration 10 \\
       --mode pro \\
       --wait

3. With sound (v2.6 only)
   $ kling video text2video \\
       --prompt "ocean waves crashing" \\
       --model kling-v2-6 \\
       --sound on \\
       --wait

4. With camera control (v1.6)
   $ kling video text2video \\
       --prompt "flying through clouds" \\
       --model kling-v1-6 \\
       --camera-type forward_up \\
       --wait

IMAGE-TO-VIDEO

5. Basic image-to-video
   $ kling video image2video \\
       --image ./photo.jpg \\
       --prompt "make it come alive" \\
       --wait

6. With end frame (pro mode)
   $ kling video image2video \\
       --image ./start.jpg \\
       --image-tail ./end.jpg \\
       --mode pro \\
       --wait

VIDEO EXTENSION

7. Extend existing video
   $ kling video extend \\
       --video-id abc123 \\
       --prompt "continue with more action" \\
       --wait

MULTI-IMAGE-TO-VIDEO

8. Create video from multiple images
   $ kling video multi-image \\
       --images ./img1.jpg \\
       --images ./img2.jpg \\
       --prompt "smooth transition between scenes" \\
       --wait

OMNI-VIDEO

9. Omni-video with template syntax
   $ kling video omni \\
       --prompt "A video featuring <<<image_1>>>" \\
       --images ./reference.jpg \\
       --wait

BATCH PROCESSING

10. Multiple prompts
    $ kling video text2video \\
        --prompt "a red car" \\
        --prompt "a blue car" \\
        --prompt "a green car" \\
        --wait

AUTHENTICATION

A. CLI flags (highest priority)
   $ kling video text2video \\
       --access-key YOUR_ACCESS_KEY \\
       --secret-key YOUR_SECRET_KEY \\
       --prompt "test"

B. Environment variables
   $ export KLING_ACCESS_KEY=YOUR_ACCESS_KEY
   $ export KLING_SECRET_KEY=YOUR_SECRET_KEY
   $ kling video text2video --prompt "test"

C. Local .env file
   $ echo "KLING_ACCESS_KEY=..." > .env
   $ echo "KLING_SECRET_KEY=..." >> .env
   $ kling video text2video --prompt "test"

D. Global config
   $ mkdir -p ~/.kling
   $ echo "KLING_ACCESS_KEY=..." > ~/.kling/.env
   $ echo "KLING_SECRET_KEY=..." >> ~/.kling/.env
   $ kling video text2video --prompt "test"

${'='.repeat(60)}
`);
}

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name('kling')
  .description('Kling AI video and image generation CLI')
  .version(pkg.version)
  .option('--access-key <key>', 'Kling API access key (overrides env var)')
  .option('--secret-key <key>', 'Kling API secret key (overrides env var)')
  .option('--output-dir <dir>', 'Output directory for generated files')
  .option('--debug', 'Enable debug logging')
  .option('-v, --verbose', 'Enable verbose output with detailed progress')
  .option('--json', 'Output results in JSON format')
  .option('-q, --quiet', 'Suppress non-essential output')
  .option('--examples', 'Show usage examples and exit');

// ============================================================================
// Video Command
// ============================================================================

const videoCmd = program.command('video').description('Video generation commands');

/**
 * Text-to-Video subcommand
 */
videoCmd
  .command('text2video')
  .alias('t2v')
  .description('Generate video from text prompt')
  .option('-p, --prompt <text...>', 'Text prompt(s) - can specify multiple', [])
  .option(
    '-m, --model <name>',
    `Model: ${Object.keys({ 'kling-v1': 1, 'kling-v1-6': 1, 'kling-v2-master': 1, 'kling-v2-1-master': 1, 'kling-v2-5-turbo': 1, 'kling-v2-6': 1 }).join(', ')}`,
    'kling-v1'
  )
  .option('-n, --negative-prompt <text>', 'Negative prompt')
  .option('--mode <mode>', `Generation mode: ${VALID_VIDEO_MODES.join(', ')}`, 'std')
  .option(
    '-a, --aspect-ratio <ratio>',
    `Aspect ratio: ${VALID_VIDEO_ASPECT_RATIOS.join(', ')}`,
    '16:9'
  )
  .option('-d, --duration <seconds>', `Duration: ${VALID_VIDEO_DURATIONS.join(', ')}`, '5')
  .option('--cfg-scale <number>', 'CFG scale (0-1, for v1.x only)', parseFloat)
  .option('--sound <on|off>', 'Enable sound generation (v2.6 only)')
  .option('--camera-type <type>', `Camera type: ${VALID_CAMERA_TYPES.join(', ')}`)
  .option('--camera-horizontal <number>', 'Camera horizontal movement (-10 to 10)', parseFloat)
  .option('--camera-vertical <number>', 'Camera vertical movement (-10 to 10)', parseFloat)
  .option('--camera-pan <number>', 'Camera pan (-10 to 10)', parseFloat)
  .option('--camera-tilt <number>', 'Camera tilt (-10 to 10)', parseFloat)
  .option('--camera-roll <number>', 'Camera roll (-10 to 10)', parseFloat)
  .option('--camera-zoom <number>', 'Camera zoom (-10 to 10)', parseFloat)
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: Text2VideoOptions, command: Command) => {
    await handleText2Video(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Image-to-Video subcommand
 */
videoCmd
  .command('image2video')
  .alias('i2v')
  .description('Generate video from image')
  .requiredOption('-i, --image <path>', 'Input image path or URL')
  .option('-p, --prompt <text...>', 'Text prompt(s)', [])
  .option('-m, --model <name>', 'Model name', 'kling-v1')
  .option('-n, --negative-prompt <text>', 'Negative prompt')
  .option('--mode <mode>', `Generation mode: ${VALID_VIDEO_MODES.join(', ')}`, 'std')
  .option('-d, --duration <seconds>', `Duration: ${VALID_VIDEO_DURATIONS.join(', ')}`, '5')
  .option('--image-tail <path>', 'End frame image (pro mode only)')
  .option('--cfg-scale <number>', 'CFG scale (0-1, for v1.x only)', parseFloat)
  .option('--camera-type <type>', `Camera type: ${VALID_CAMERA_TYPES.join(', ')}`)
  .option('--camera-horizontal <number>', 'Camera horizontal movement (-10 to 10)', parseFloat)
  .option('--camera-vertical <number>', 'Camera vertical movement (-10 to 10)', parseFloat)
  .option('--camera-pan <number>', 'Camera pan (-10 to 10)', parseFloat)
  .option('--camera-tilt <number>', 'Camera tilt (-10 to 10)', parseFloat)
  .option('--camera-roll <number>', 'Camera roll (-10 to 10)', parseFloat)
  .option('--camera-zoom <number>', 'Camera zoom (-10 to 10)', parseFloat)
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: Image2VideoOptions, command: Command) => {
    await handleImage2Video(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Extend video subcommand
 */
videoCmd
  .command('extend')
  .description('Extend an existing video')
  .requiredOption('--video-id <id>', 'Video ID to extend')
  .option('-p, --prompt <text>', 'Prompt for extension')
  .option('-n, --negative-prompt <text>', 'Negative prompt')
  .option('--cfg-scale <number>', 'CFG scale (0-1)', parseFloat)
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: ExtendOptions, command: Command) => {
    await handleExtend(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Multi-image-to-video subcommand
 */
videoCmd
  .command('multi-image')
  .alias('mi2v')
  .description('Generate video from multiple images')
  .requiredOption('--images <paths...>', 'Input image paths or URLs (2-4 images)')
  .requiredOption('-p, --prompt <text>', 'Text prompt')
  .option('-m, --model <name>', 'Model name', 'kling-v1-6')
  .option('-n, --negative-prompt <text>', 'Negative prompt')
  .option('--mode <mode>', `Generation mode: ${VALID_VIDEO_MODES.join(', ')}`, 'std')
  .option(
    '-a, --aspect-ratio <ratio>',
    `Aspect ratio: ${VALID_VIDEO_ASPECT_RATIOS.join(', ')}`,
    '16:9'
  )
  .option('-d, --duration <seconds>', `Duration: ${VALID_VIDEO_DURATIONS.join(', ')}`, '5')
  .option('--cfg-scale <number>', 'CFG scale (0-1)', parseFloat)
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: MultiImageOptions, command: Command) => {
    await handleMultiImage(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Omni-video subcommand
 */
videoCmd
  .command('omni')
  .description('Generate video using omni model with template syntax')
  .requiredOption(
    '-p, --prompt <text>',
    'Text prompt (use <<<image_1>>>, <<<element_1>>> for references)'
  )
  .option('--images <paths...>', 'Reference images')
  .option('--elements <ids...>', 'Element IDs')
  .option('-m, --model <name>', 'Model name', 'kling-video-o1')
  .option('-n, --negative-prompt <text>', 'Negative prompt')
  .option(
    '-a, --aspect-ratio <ratio>',
    `Aspect ratio: ${VALID_VIDEO_ASPECT_RATIOS.join(', ')}`,
    '16:9'
  )
  .option('-d, --duration <seconds>', `Duration: ${VALID_VIDEO_DURATIONS.join(', ')}`, '5')
  .option('--cfg-scale <number>', 'CFG scale (0-1)', parseFloat)
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: OmniVideoOptions, command: Command) => {
    await handleOmniVideo(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Examples subcommand
 */
videoCmd
  .command('examples')
  .description('Show video command examples')
  .action(() => {
    showExamples();
  });

// ============================================================================
// Image Command
// ============================================================================

const imageCmd = program.command('image').description('Image generation commands');

/**
 * Image generate subcommand
 */
imageCmd
  .command('generate')
  .alias('gen')
  .description('Generate images from text prompt')
  .option('-p, --prompt <text...>', 'Text prompt(s) - can specify multiple', [])
  .option(
    '-m, --model <name>',
    `Model: kling-v1, kling-v1-5, kling-v2, kling-v2-new, kling-v2-1`,
    'kling-v1'
  )
  .option('-n, --negative-prompt <text>', 'Negative prompt')
  .option('-i, --image <path>', 'Reference image for style transfer')
  .option('--image-reference <type>', 'Reference type: subject, face (requires --image)')
  .option(
    '--image-fidelity <number>',
    'Image fidelity 0-1 (requires --image-reference)',
    parseFloat
  )
  .option(
    '--human-fidelity <number>',
    'Human face fidelity 0-1 (requires --image-reference face)',
    parseFloat
  )
  .option('-r, --resolution <res>', `Resolution: ${VALID_IMAGE_RESOLUTIONS.join(', ')}`, '1k')
  .option(
    '-a, --aspect-ratio <ratio>',
    `Aspect ratio: ${VALID_IMAGE_ASPECT_RATIOS.join(', ')}`,
    '1:1'
  )
  .option('-c, --count <number>', 'Number of images to generate (1-9)', (val) => parseInt(val, 10), 1)
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: ImageGenerateOptions, command: Command) => {
    await handleImageGenerate(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Image expand subcommand
 */
imageCmd
  .command('expand')
  .description('Expand image boundaries (outpainting)')
  .requiredOption('-i, --image <path>', 'Input image path or URL')
  .option('--up <ratio>', 'Upward expansion ratio (0-2)', parseFloat, 0)
  .option('--down <ratio>', 'Downward expansion ratio (0-2)', parseFloat, 0)
  .option('--left <ratio>', 'Left expansion ratio (0-2)', parseFloat, 0)
  .option('--right <ratio>', 'Right expansion ratio (0-2)', parseFloat, 0)
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: ImageExpandOptions, command: Command) => {
    await handleImageExpand(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Omni image subcommand
 */
imageCmd
  .command('omni')
  .description('Generate images using omni model with template syntax')
  .requiredOption(
    '-p, --prompt <text>',
    'Text prompt (use <<<image_1>>>, <<<element_1>>> for references)'
  )
  .option('--images <paths...>', 'Reference images')
  .option('--elements <ids...>', 'Element IDs')
  .option('-m, --model <name>', 'Model name', 'kling-image-o1')
  .option('-r, --resolution <res>', `Resolution: ${VALID_IMAGE_RESOLUTIONS.join(', ')}`, '1k')
  .option(
    '-a, --aspect-ratio <ratio>',
    `Aspect ratio: ${[...VALID_OMNI_IMAGE_ASPECT_RATIOS].join(', ')}`,
    '1:1'
  )
  .option('-c, --count <number>', 'Number of images to generate (1-9)', (val) => parseInt(val, 10), 1)
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: OmniImageOptions, command: Command) => {
    await handleOmniImage(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Multi-image-to-image subcommand
 */
imageCmd
  .command('multi')
  .alias('mi2i')
  .description('Generate images from multiple subject images')
  .requiredOption('--subject-images <paths...>', 'Subject image paths (1-4 images)')
  .option('--scene-image <path>', 'Scene/background reference image')
  .option('--style-image <path>', 'Style reference image')
  .option('-p, --prompt <text>', 'Text prompt')
  .option(
    '-m, --model <name>',
    `Model: ${[...VALID_MULTI_IMAGE_TO_IMAGE_MODELS].join(', ')}`,
    'kling-v2'
  )
  .option(
    '-a, --aspect-ratio <ratio>',
    `Aspect ratio: ${VALID_IMAGE_ASPECT_RATIOS.join(', ')}`,
    '1:1'
  )
  .option('-c, --count <number>', 'Number of images to generate (1-9)', (val) => parseInt(val, 10), 1)
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: MultiImageToImageOptions, command: Command) => {
    await handleMultiImageToImage(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Image examples subcommand
 */
imageCmd
  .command('examples')
  .description('Show image command examples')
  .action(() => {
    showImageExamples();
  });

// ============================================================================
// Avatar Command
// ============================================================================

const avatarCmd = program
  .command('avatar')
  .description('Avatar (talking head) generation commands');

/**
 * Avatar create subcommand
 */
avatarCmd
  .command('create')
  .description('Create talking head video from portrait image with audio')
  .requiredOption('-i, --image <path>', 'Portrait image path or URL')
  .option('--audio-id <id>', 'Pre-uploaded audio ID (mutually exclusive with --audio-file)')
  .option('--audio-file <path>', 'Audio file path or URL (mutually exclusive with --audio-id)')
  .option('-p, --prompt <text>', 'Expression/mood guidance prompt')
  .option('--mode <mode>', `Generation mode: ${VALID_VIDEO_MODES.join(', ')}`, 'std')
  .option('-w, --wait', 'Wait for generation to complete')
  .option('--no-download', 'Do not download the result')
  .option('--callback-url <url>', 'Callback URL for completion notification')
  .action(async (options: AvatarCreateOptions, command: Command) => {
    await handleAvatarCreate(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Avatar examples subcommand
 */
avatarCmd
  .command('examples')
  .description('Show avatar command examples')
  .action(() => {
    showAvatarExamples();
  });

// ============================================================================
// Account Command
// ============================================================================

const accountCmd = program.command('account').description('Account and credit management commands');

/**
 * Account credits subcommand
 */
accountCmd
  .command('credits')
  .description('Show credit balance summary')
  .option('-d, --days <number>', 'Query period in days', (val) => parseInt(val, 10), 30)
  .action(async (options: AccountOptions, command: Command) => {
    await handleAccountCredits(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Account info subcommand
 */
accountCmd
  .command('info')
  .description('Show detailed account information')
  .option('-d, --days <number>', 'Query period in days', (val) => parseInt(val, 10), 90)
  .action(async (options: AccountOptions, command: Command) => {
    await handleAccountInfo(options, command.optsWithGlobals() as GlobalOptions);
  });

/**
 * Account examples subcommand
 */
accountCmd
  .command('examples')
  .description('Show account command examples')
  .action(() => {
    showAccountExamples();
  });

// ============================================================================
// Main
// ============================================================================

// Handle examples flag before parsing
if (process.argv.includes('--examples')) {
  showExamples();
  process.exit(0);
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
