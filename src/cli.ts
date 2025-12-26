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
  ValidationError,
  VALID_VIDEO_ASPECT_RATIOS,
  VALID_VIDEO_MODES,
  VALID_VIDEO_DURATIONS,
  VALID_CAMERA_TYPES,
} from './config/index.js';
import {
  ensureDirectory,
  generateFilename,
  saveMetadata,
  logger,
} from './utils.js';
import type {
  TextToVideoParams,
  ImageToVideoParams,
  ExtendVideoParams,
  MultiImageToVideoParams,
  OmniVideoParams,
  VideoTaskResult,
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
 * Build camera control object from CLI options
 */
function buildCameraControl(options: Text2VideoOptions | Image2VideoOptions): CameraControl | undefined {
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
async function handleText2Video(options: Text2VideoOptions, globalOptions: GlobalOptions): Promise<void> {
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
          const result = await api.waitForVideoResult(
            taskId,
            api.queryTextToVideoTask.bind(api)
          );

          if (result.data.task_status === 'succeed') {
            logger.info('Video generation completed!');

            if (!options.noDownload) {
              await saveVideoResultToDisk(api, result, prompt, options.model, params, globalOptions);
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
async function handleImage2Video(options: Image2VideoOptions, globalOptions: GlobalOptions): Promise<void> {
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
        const result = await api.waitForVideoResult(
          taskId,
          api.queryImageToVideoTask.bind(api)
        );

        if (result.data.task_status === 'succeed') {
          logger.info('Video generation completed!');

          if (!options.noDownload) {
            const promptText = prompt || path.basename(options.image, path.extname(options.image));
            await saveVideoResultToDisk(api, result, promptText, options.model, params, globalOptions);
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
        const result = await api.waitForVideoResult(
          taskId,
          api.queryExtendVideoTask.bind(api)
        );

        if (result.data.task_status === 'succeed') {
          logger.info('Video extension completed!');

          if (!options.noDownload) {
            const promptText = options.prompt ?? `extended_${options.videoId}`;
            await saveVideoResultToDisk(api, result, promptText, 'video-extend', params, globalOptions);
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
async function handleMultiImage(options: MultiImageOptions, globalOptions: GlobalOptions): Promise<void> {
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
      image_list: options.images.map(image => ({ image })),
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
            await saveVideoResultToDisk(api, result, options.prompt, options.model, params, globalOptions);
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
async function handleOmniVideo(options: OmniVideoOptions, globalOptions: GlobalOptions): Promise<void> {
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
        type: index === 0 ? 'first_frame' as const : (index === options.images!.length - 1 ? 'end_frame' as const : undefined),
      }));
    }

    // Add element_list if provided
    if (options.elements?.length) {
      params.element_list = options.elements.map(element_id => ({
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
        const result = await api.waitForVideoResult(
          taskId,
          api.queryOmniVideoTask.bind(api)
        );

        if (result.data.task_status === 'succeed') {
          logger.info('Video generation completed!');

          if (!options.noDownload) {
            await saveVideoResultToDisk(api, result, options.prompt, options.model, params, globalOptions);
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
  .option('--examples', 'Show usage examples and exit');

// ============================================================================
// Video Command
// ============================================================================

const videoCmd = program
  .command('video')
  .description('Video generation commands');

/**
 * Text-to-Video subcommand
 */
videoCmd
  .command('text2video')
  .alias('t2v')
  .description('Generate video from text prompt')
  .option('-p, --prompt <text...>', 'Text prompt(s) - can specify multiple', [])
  .option('-m, --model <name>', `Model: ${Object.keys({ 'kling-v1': 1, 'kling-v1-6': 1, 'kling-v2-master': 1, 'kling-v2-1-master': 1, 'kling-v2-5-turbo': 1, 'kling-v2-6': 1 }).join(', ')}`, 'kling-v1')
  .option('-n, --negative-prompt <text>', 'Negative prompt')
  .option('--mode <mode>', `Generation mode: ${VALID_VIDEO_MODES.join(', ')}`, 'std')
  .option('-a, --aspect-ratio <ratio>', `Aspect ratio: ${VALID_VIDEO_ASPECT_RATIOS.join(', ')}`, '16:9')
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
  .option('-a, --aspect-ratio <ratio>', `Aspect ratio: ${VALID_VIDEO_ASPECT_RATIOS.join(', ')}`, '16:9')
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
  .requiredOption('-p, --prompt <text>', 'Text prompt (use <<<image_1>>>, <<<element_1>>> for references)')
  .option('--images <paths...>', 'Reference images')
  .option('--elements <ids...>', 'Element IDs')
  .option('-m, --model <name>', 'Model name', 'kling-video-o1')
  .option('-n, --negative-prompt <text>', 'Negative prompt')
  .option('-a, --aspect-ratio <ratio>', `Aspect ratio: ${VALID_VIDEO_ASPECT_RATIOS.join(', ')}`, '16:9')
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
