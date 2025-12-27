# Kling AI API Wrapper

[![npm version](https://img.shields.io/npm/v/kling-api.svg)](https://www.npmjs.com/package/kling-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/node/v/kling-api)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-534%20passing-brightgreen)](test/)
[![Coverage](https://img.shields.io/badge/coverage-95.29%25-brightgreen)](test/)

A TypeScript SDK and CLI tool for the [Kling AI API](https://docs.qingque.cn/d/home/eZQClXt3RYb4VTjqEfcGBIvEG) for video generation, image generation, image expansion, and avatar/talking head creation.

This service follows the data-collection architecture pattern with JWT authentication, organized data storage, automatic polling, retry logic with exponential backoff, and parameter validation.

## Quick Start

### Programmatic Usage

```typescript
import { KlingAPI } from 'kling-api';

const api = new KlingAPI({
  accessKey: 'your-access-key',
  secretKey: 'your-secret-key'
});

// Generate a video from text
const task = await api.textToVideo({
  prompt: 'A cat playing piano in a cozy room',
  model_name: 'kling-v2-master',
  duration: '5'
});

// Wait for result with auto-polling
const result = await api.waitForVideoResult(task.data.task_id);
console.log('Video URL:', result.data.task_result.videos[0].url);
```

### CLI Usage

```bash
# Install globally
npm install -g kling-api

# Generate a video from text
kling video text2video --prompt "A cat playing piano" --model kling-v2-master --wait

# Generate from image
kling video image2video --image ./photo.jpg --prompt "Make it come alive" --wait

# See all commands
kling --help
```

TypeScript support with exported types for all parameters and responses.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [Authentication Setup](#authentication-setup)
- [TypeScript Support](#typescript-support)
- [API Methods](#api-methods)
  - [Text-to-Video](#text-to-video)
  - [Image-to-Video](#image-to-video)
  - [Image Generation](#image-generation)
  - [Image Expansion](#image-expansion)
  - [Avatar (Talking Head)](#avatar-talking-head)
  - [Account & Utilities](#account--utilities)
- [Advanced Features](#advanced-features)
  - [Video Extension](#video-extension)
  - [Multi-Image-to-Video](#multi-image-to-video)
  - [Omni Video](#omni-video)
  - [Omni Image](#omni-image)
  - [Multi-Image-to-Image](#multi-image-to-image)
- [Models](#models)
- [Camera Control](#camera-control)
- [Examples](#examples)
- [Data Organization](#data-organization)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [API Reference](#api-reference)

## API Reference

For detailed Kling AI API documentation including all endpoints, parameters, error codes, and model capabilities, see the comprehensive API reference:

**[Kling API Reference](docs/KLING_API_REFERENCE.md)**

The reference covers:
- JWT authentication details and examples
- Complete error code reference (20+ codes with solutions)
- Model capability matrices for video and image generation
- All API endpoints with request/response schemas
- Concurrency rules and rate limiting
- Image input format requirements

## Overview

The Kling AI API provides access to video and image generation models. This Node.js wrapper implements:

- **10 Feature Areas** - Text-to-video, image-to-video, image generation, image expansion, avatar creation, plus advanced features: video extension, multi-image-to-video, omni video, omni image, multi-image-to-image
- **19+ Model Variants** - Multiple versions across all feature areas with different capabilities
- **JWT Authentication** - Automatic token generation with caching (30-minute expiry, 5-minute buffer)
- **Security** - API key redaction, error sanitization, HTTPS enforcement, SSRF protection
- **Parameter Validation** - Pre-flight validation catches invalid parameters before API calls
- **Auto-polling with Spinner** - Automatic result polling with animated progress indicator
- **Retry Logic** - Exponential backoff for transient errors (502, 503, 504)
- **Image/Audio Input Support** - Convert local files or URLs to base64 with validation
- **Organized Storage** - Structured directories with timestamped files and metadata
- **TypeScript** - Type definitions for all API methods, parameters, and responses
- **Testing** - 534 tests with 95.29% coverage

## Features

### Video Generation
- **Text-to-Video**: Generate videos from text prompts (5-10 second clips)
- **Image-to-Video**: Animate still images with motion
- **Camera Control**: Preset movements or fine-grained camera configuration
- **Sound Generation**: Audio synthesis for v2.6+ models

### Image Generation
- **Text-to-Image**: Generate images from prompts (up to 9 images per request)
- **Image Reference**: Use subject/face references for style transfer
- **Multiple Resolutions**: 1K and 2K output options
- **Flexible Aspect Ratios**: 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9

### Image Expansion
- **Outpainting**: Expand images in any direction (up, down, left, right)
- **Flexible Ratios**: 0-2x expansion per direction (max 3x total area)

### Avatar/Talking Head
- **Lip Sync**: Generate talking head videos from portrait images
- **Audio Support**: Use audio files or pre-uploaded audio IDs

## Installation

```bash
# Install as a dependency in your project
npm install kling-api

# Or install globally for CLI usage
npm install -g kling-api
```

**Requirements**: Node.js >= 18.0.0

## CLI Usage

The `kling` CLI provides a command-line interface for video generation, image generation, avatar creation, and account management.

### Global Options

```bash
kling [options] [command]

Options:
  -V, --version       Output version number
  --access-key <key>  Kling API access key (overrides env var)
  --secret-key <key>  Kling API secret key (overrides env var)
  --output-dir <dir>  Output directory for generated files
  --debug             Enable debug logging
  --examples          Show usage examples
  -h, --help          Display help
```

### Video Commands

#### Text-to-Video

```bash
kling video text2video [options]
# Alias: kling video t2v

Options:
  -p, --prompt <text...>        Text prompt(s) - can specify multiple
  -m, --model <name>            Model: kling-v1, kling-v1-6, kling-v2-master,
                                kling-v2-1-master, kling-v2-5-turbo, kling-v2-6
  -n, --negative-prompt <text>  Negative prompt
  --mode <mode>                 Generation mode: std, pro (default: std)
  -a, --aspect-ratio <ratio>    Aspect ratio: 16:9, 9:16, 1:1
  -d, --duration <seconds>      Duration: 5, 10
  --sound <on|off>              Enable sound generation (v2.6 only)
  --camera-type <type>          Camera preset (v1.6 only)
  --camera-horizontal <n>       Camera horizontal movement (-10 to 10)
  --camera-vertical <n>         Camera vertical movement (-10 to 10)
  --camera-pan <n>              Camera pan (-10 to 10)
  --camera-tilt <n>             Camera tilt (-10 to 10)
  --camera-roll <n>             Camera roll (-10 to 10)
  --camera-zoom <n>             Camera zoom (-10 to 10)
  -w, --wait                    Wait for generation to complete
  --no-download                 Do not download the result
```

**Examples:**

```bash
# Basic text-to-video
kling video t2v --prompt "a cat playing piano" --wait

# With model and options
kling video t2v \
  --prompt "cinematic landscape" \
  --model kling-v2-master \
  --aspect-ratio 16:9 \
  --duration 10 \
  --mode pro \
  --wait

# With sound (v2.6 only)
kling video t2v \
  --prompt "ocean waves crashing" \
  --model kling-v2-6 \
  --sound on \
  --wait

# With camera control (v1.6)
kling video t2v \
  --prompt "flying through clouds" \
  --model kling-v1-6 \
  --camera-type forward_up \
  --wait
```

#### Image-to-Video

```bash
kling video image2video [options]
# Alias: kling video i2v

Options:
  -i, --image <path>            Input image path or URL
  -p, --prompt <text...>        Text prompt(s)
  -m, --model <name>            Model name
  -n, --negative-prompt <text>  Negative prompt
  --mode <mode>                 Generation mode: std, pro
  -d, --duration <seconds>      Duration: 5, 10
  --image-tail <path>           End frame image (pro mode only)
  --camera-*                    Camera control options (same as text2video)
  -w, --wait                    Wait for generation to complete
```

**Examples:**

```bash
# Basic image-to-video
kling video i2v --image ./photo.jpg --prompt "make it come alive" --wait

# With end frame (pro mode)
kling video i2v \
  --image ./start.jpg \
  --image-tail ./end.jpg \
  --mode pro \
  --wait
```

#### Video Extension

```bash
kling video extend [options]

Options:
  --video-id <id>               Video ID to extend
  -p, --prompt <text>           Prompt for extension
  -n, --negative-prompt <text>  Negative prompt
  --cfg-scale <number>          CFG scale (0-1)
  -w, --wait                    Wait for generation to complete
```

**Example:**

```bash
kling video extend --video-id abc123 --prompt "continue with more action" --wait
```

#### Multi-Image-to-Video

```bash
kling video multi-image [options]
# Alias: kling video mi2v

Options:
  --images <paths...>           Input image paths (2-4 images)
  -p, --prompt <text>           Text prompt
  -m, --model <name>            Model name (default: kling-v1-6)
  --mode <mode>                 Generation mode: std, pro
  -a, --aspect-ratio <ratio>    Aspect ratio
  -d, --duration <seconds>      Duration: 5, 10
  -w, --wait                    Wait for generation to complete
```

**Example:**

```bash
kling video mi2v \
  --images ./img1.jpg --images ./img2.jpg \
  --prompt "smooth transition between scenes" \
  --wait
```

#### Omni Video

```bash
kling video omni [options]

Options:
  -p, --prompt <text>           Prompt with template syntax
                                (use <<<image_1>>>, <<<element_1>>> for refs)
  --images <paths...>           Reference images
  --elements <ids...>           Element IDs
  -m, --model <name>            Model (default: kling-video-o1)
  -a, --aspect-ratio <ratio>    Aspect ratio
  -d, --duration <seconds>      Duration: 5, 10
  -w, --wait                    Wait for generation to complete
```

**Example:**

```bash
kling video omni \
  --prompt "A video featuring <<<image_1>>>" \
  --images ./reference.jpg \
  --wait
```

### CLI Authentication

Credentials can be provided in priority order:

```bash
# 1. CLI flags (highest priority)
kling video t2v --access-key YOUR_KEY --secret-key YOUR_SECRET --prompt "test"

# 2. Environment variables
export KLING_ACCESS_KEY=your_access_key
export KLING_SECRET_KEY=your_secret_key
kling video t2v --prompt "test"

# 3. Local .env file
echo "KLING_ACCESS_KEY=..." > .env
echo "KLING_SECRET_KEY=..." >> .env

# 4. Global config
mkdir -p ~/.kling
echo "KLING_ACCESS_KEY=..." > ~/.kling/.env
echo "KLING_SECRET_KEY=..." >> ~/.kling/.env
```

### Batch Processing

Process multiple prompts in a single command:

```bash
kling video t2v \
  --prompt "a red car" \
  --prompt "a blue car" \
  --prompt "a green car" \
  --wait
```

### View Examples

```bash
# Show all CLI examples
kling --examples

# Show video command examples
kling video examples

# Show image command examples
kling image examples

# Show avatar command examples
kling avatar examples

# Show account command examples
kling account examples
```

### Image Commands

#### Generate Images

Generate images from text prompts with optional reference images.

```bash
kling image generate [options]
# Alias: kling image gen

Options:
  -p, --prompt <text...>        Text prompt(s) - can specify multiple
  -m, --model <name>            Model: kling-v1, kling-v1-5, kling-v2,
                                kling-v2-new, kling-v2-1 (default: kling-v1)
  -n, --negative-prompt <text>  Negative prompt
  -i, --image <path>            Reference image for style transfer
  --image-reference <type>      Reference type: subject, face (requires --image)
  --image-fidelity <number>     Image fidelity 0-1 (requires --image-reference)
  --human-fidelity <number>     Human face fidelity 0-1 (requires face reference)
  -r, --resolution <res>        Resolution: 1k, 2k (default: 1k)
  -a, --aspect-ratio <ratio>    Aspect ratio: 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9
  -c, --count <number>          Number of images to generate (1-9, default: 1)
  -w, --wait                    Wait for generation to complete
  --no-download                 Do not download the result
```

**Examples:**

```bash
# Basic image generation
kling image gen --prompt "a majestic lion in the savanna" --wait

# With reference image (style transfer)
kling image gen \
  --prompt "portrait in the same style" \
  --image ./reference.jpg \
  --image-reference subject \
  --image-fidelity 0.8 \
  --wait

# Multiple high-res images
kling image gen \
  --prompt "futuristic cityscape" \
  --count 4 \
  --resolution 2k \
  --aspect-ratio 21:9 \
  --wait
```

#### Expand Images (Outpainting)

Expand image boundaries in any direction.

```bash
kling image expand [options]

Options:
  -i, --image <path>    Input image path or URL
  --up <ratio>          Upward expansion ratio (0-2)
  --down <ratio>        Downward expansion ratio (0-2)
  --left <ratio>        Left expansion ratio (0-2)
  --right <ratio>       Right expansion ratio (0-2)
  -w, --wait            Wait for generation to complete
  --no-download         Do not download the result
```

Note: Total expanded area cannot exceed 3x the original size.

**Examples:**

```bash
# Expand to landscape
kling image expand \
  --image ./portrait.jpg \
  --left 1 \
  --right 1 \
  --wait

# Expand upward
kling image expand \
  --image ./photo.jpg \
  --up 0.5 \
  --wait
```

#### Omni Image

Generate images using the Omni model with template syntax for multi-modal inputs.

```bash
kling image omni [options]

Options:
  -p, --prompt <text>         Prompt with template syntax (use <<<image_1>>>)
  --images <paths...>         Reference images
  --elements <ids...>         Element IDs
  -m, --model <name>          Model (default: kling-image-o1)
  -r, --resolution <res>      Resolution: 1k, 2k
  -a, --aspect-ratio <ratio>  Aspect ratio (includes 'auto')
  -c, --count <number>        Number of images (1-9)
  -w, --wait                  Wait for generation to complete
```

**Examples:**

```bash
kling image omni \
  --prompt "A portrait in the style of <<<image_1>>>" \
  --images ./art-reference.jpg \
  --count 4 \
  --wait
```

#### Multi-Image-to-Image

Combine multiple subject images with optional scene and style references.

```bash
kling image multi [options]
# Alias: kling image mi2i

Options:
  --subject-images <paths...>  Subject images (1-4 images, required)
  --scene-image <path>         Scene/background reference image
  --style-image <path>         Style reference image
  -p, --prompt <text>          Generation prompt
  -m, --model <name>           Model: kling-v2, kling-v2-1 (default: kling-v2)
  -a, --aspect-ratio <ratio>   Output aspect ratio
  -c, --count <number>         Number of images (1-9)
  -w, --wait                   Wait for generation to complete
```

**Examples:**

```bash
kling image multi \
  --subject-images ./person1.jpg ./person2.jpg \
  --scene-image ./background.jpg \
  --prompt "The subjects meeting in this scene" \
  --count 4 \
  --wait
```

### Avatar Commands

Create talking head videos from portrait images with audio.

```bash
kling avatar create [options]

Options:
  -i, --image <path>    Portrait image path or URL
  --audio-id <id>       Pre-uploaded audio ID (mutually exclusive with --audio-file)
  --audio-file <path>   Audio file path or URL (mutually exclusive with --audio-id)
  -p, --prompt <text>   Expression/mood guidance prompt
  --mode <mode>         Generation mode: std, pro (default: std)
  -w, --wait            Wait for generation to complete
  --no-download         Do not download the result
```

Note: Provide either `--audio-id` OR `--audio-file`, not both.

**Examples:**

```bash
# With audio file
kling avatar create \
  --image ./portrait.jpg \
  --audio-file ./speech.mp3 \
  --prompt "Professional, confident expression" \
  --mode pro \
  --wait

# With pre-uploaded audio ID
kling avatar create \
  --image ./portrait.jpg \
  --audio-id audio_12345 \
  --wait
```

### Account Commands

#### Check Credits

Display credit balance summary.

```bash
kling account credits [options]

Options:
  -d, --days <number>  Query period in days (default: 30)
```

**Examples:**

```bash
# Show current credit balance (last 30 days)
kling account credits

# Check usage for specific period
kling account credits --days 7
```

#### Account Info

Display detailed account information including all resource packs.

```bash
kling account info [options]

Options:
  -d, --days <number>  Query period in days (default: 90)
```

**Examples:**

```bash
# Show all account info
kling account info

# Show info for shorter period
kling account info --days 30
```

## Authentication Setup

### 1. Get Your API Credentials

1. Visit the [Kling AI Developer Platform](https://klingai.com/global/dev/model-api)
2. Create an account or sign in
3. Generate your Access Key and Secret Key from the dashboard

### 2. Configure Your Credentials

You can provide credentials in multiple ways (listed in priority order):

#### Option A: Constructor Parameters (Highest Priority)

```typescript
const api = new KlingAPI({
  accessKey: 'your-access-key',
  secretKey: 'your-secret-key'
});
```

#### Option B: Environment Variables

```bash
# Add to your ~/.bashrc, ~/.zshrc, or equivalent
export KLING_ACCESS_KEY=your_access_key_here
export KLING_SECRET_KEY=your_secret_key_here
```

#### Option C: Local .env File (Project-Specific)

```bash
# In your project directory
echo "KLING_ACCESS_KEY=your_access_key_here" > .env
echo "KLING_SECRET_KEY=your_secret_key_here" >> .env
```

#### Option D: Global Config

```bash
# Create config directory
mkdir -p ~/.kling

# Add your credentials
echo "KLING_ACCESS_KEY=your_access_key_here" > ~/.kling/.env
echo "KLING_SECRET_KEY=your_secret_key_here" >> ~/.kling/.env
```

**Security Note:** Never commit `.env` files or expose your credentials publicly.

## TypeScript Support

This package is written in TypeScript and includes type definitions.

### Exported Types

```typescript
import {
  KlingAPI,
  KlingAPIError,
  // Parameter types
  TextToVideoParams,
  ImageToVideoParams,
  ImageGenParams,
  ImageExpandParams,
  AvatarParams,
  // Advanced feature parameter types
  ExtendVideoParams,
  MultiImageToVideoParams,
  OmniVideoParams,
  OmniImageParams,
  MultiImageToImageParams,
  // Response types
  TaskResponse,
  VideoTaskResult,
  ImageTaskResult,
  // Utility types
  CameraControl,
  CameraConfig,
  VideoMode,
  VideoDuration,
  VideoAspectRatio,
  ImageAspectRatio,
  OmniImageAspectRatio,
} from 'kling-api';
```

### Submodule Exports

For advanced use cases, you can import specific modules directly:

```typescript
// Authentication module
import { KlingAuth, decodeToken, isTokenExpired } from 'kling-api/auth';

// Configuration and validation
import {
  loadCredentials,
  loadConfig,
  validateTextToVideoParams,
  validateImageToVideoParams,
  ValidationError,
  BASE_URL,
  TEXT_TO_VIDEO_MODELS,
} from 'kling-api/config';

// Utility functions
import {
  imageToBase64,
  audioToBase64,
  downloadVideo,
  downloadImage,
  validateUrl,
  pollWithSpinner,
  logger,
} from 'kling-api/utils';

// Type definitions only
import type {
  TextToVideoParams,
  VideoTaskResult,
  CameraConfig,
} from 'kling-api/types';
```

### Type-Safe Parameters

```typescript
// TypeScript will catch invalid parameters at compile time
const task = await api.textToVideo({
  prompt: 'A beautiful landscape',
  model_name: 'kling-v2-master',  // Autocomplete available
  mode: 'pro',                     // 'std' | 'pro'
  duration: '5',                   // '5' | '10'
  aspect_ratio: '16:9',            // '16:9' | '9:16' | '1:1'
});
```

## API Methods

### Text-to-Video

Generate videos from text prompts.

```typescript
// Create a text-to-video task
const task = await api.textToVideo({
  prompt: 'A serene mountain landscape at sunset',
  model_name: 'kling-v2-master',  // Optional, default: 'kling-v1'
  negative_prompt: 'blurry, low quality',
  mode: 'pro',                     // 'std' or 'pro'
  duration: '5',                   // '5' or '10' seconds
  aspect_ratio: '16:9',            // '16:9', '9:16', '1:1'
  camera_control: {                // Optional camera movement
    type: 'simple',
    config: { zoom: 5 }
  }
});

// Query task status
const status = await api.queryTextToVideoTask(task.data.task_id);

// Wait for completion with auto-polling
const result = await api.waitForVideoResult(task.data.task_id);

// Save video to disk
const paths = await api.saveVideoResult(result, './output', 'mountain sunset');
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Text description (max 2500 chars) |
| `model_name` | TextToVideoModel | No | Model version (default: 'kling-v1') |
| `negative_prompt` | string | No | What to avoid (max 2500 chars) |
| `sound` | 'on' \| 'off' | No | Generate audio (v2.6+ only) |
| `cfg_scale` | number | No | CFG scale 0-1 (v1 models only) |
| `mode` | 'std' \| 'pro' | No | Quality mode |
| `camera_control` | CameraControl | No | Camera movement settings |
| `aspect_ratio` | VideoAspectRatio | No | Output aspect ratio |
| `duration` | '5' \| '10' | No | Video length in seconds |
| `callback_url` | string | No | Webhook for status updates |

### Image-to-Video

Animate still images with motion.

```typescript
// Using a local file
const task = await api.imageToVideo({
  image: './photo.jpg',           // Local path or URL
  prompt: 'The flowers gently sway in the wind',
  model_name: 'kling-v1-6',
  mode: 'pro',
  duration: '5'
});

// Using start and end frames (pro mode)
const task = await api.imageToVideo({
  image: './start.jpg',
  image_tail: './end.jpg',        // End frame for interpolation
  prompt: 'Smooth transition',
  model_name: 'kling-v2-1',
  mode: 'pro'
});

// Wait for result
const result = await api.waitForVideoResult(
  task.data.task_id,
  api.queryImageToVideoTask.bind(api)
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | string | Yes | Start frame (file path or URL) |
| `image_tail` | string | No | End frame for interpolation (pro mode) |
| `prompt` | string | No | Motion description |
| `model_name` | ImageToVideoModel | No | Model version |
| `negative_prompt` | string | No | What to avoid |
| `voice_list` | VoiceReference[] | No | Voice references (v2.6+ only) |
| `dynamic_masks` | DynamicMask[] | No | Motion control masks |
| `static_mask` | string | No | Static region mask |
| `camera_control` | CameraControl | No | Camera movement |
| `mode` | 'std' \| 'pro' | No | Quality mode |
| `duration` | '5' \| '10' | No | Video length |

### Image Generation

Generate images from text prompts.

```typescript
// Basic image generation
const task = await api.generateImage({
  prompt: 'A majestic lion in the savanna',
  model_name: 'kling-v1-5',
  n: 4,                           // Generate 4 images
  aspect_ratio: '16:9',
  resolution: '2k'
});

// With image reference
const task = await api.generateImage({
  prompt: 'Portrait in the same style',
  model_name: 'kling-v1-5',
  image: './reference.jpg',
  image_reference: 'subject',     // 'subject' or 'face'
  image_fidelity: 0.8             // 0-1, how closely to follow reference
});

// Wait for result
const result = await api.waitForImageResult(task.data.task_id);

// Save images to disk
const paths = await api.saveImageResult(result, './output', 'lion');
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Image description (max 2500 chars) |
| `model_name` | ImageGenModel | No | Model version |
| `negative_prompt` | string | No | What to avoid |
| `image` | string | No | Reference image (required with image_reference) |
| `image_reference` | 'subject' \| 'face' | No | Reference type (v1.5+ only) |
| `image_fidelity` | number | No | Reference strength 0-1 |
| `human_fidelity` | number | No | Face preservation 0-1 |
| `n` | number | No | Number of images 1-9 |
| `aspect_ratio` | ImageAspectRatio | No | Output aspect ratio |
| `resolution` | '1k' \| '2k' | No | Output resolution |

### Image Expansion

Expand images beyond their original boundaries (outpainting).

```typescript
const task = await api.expandImage({
  image: './photo.jpg',
  up_expansion_ratio: 0.5,        // 0-2 (expand 50% upward)
  down_expansion_ratio: 0.5,
  left_expansion_ratio: 0.3,
  right_expansion_ratio: 0.3
});

// Wait for result
const result = await api.waitForImageResult(
  task.data.task_id,
  api.queryImageExpandTask.bind(api)
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | string | Yes | Image to expand |
| `up_expansion_ratio` | number | Yes | Upward expansion 0-2 |
| `down_expansion_ratio` | number | Yes | Downward expansion 0-2 |
| `left_expansion_ratio` | number | Yes | Left expansion 0-2 |
| `right_expansion_ratio` | number | Yes | Right expansion 0-2 |

**Note:** Total expanded area cannot exceed 3x the original size.

### Avatar (Talking Head)

Create talking head videos from portrait images with audio.

```typescript
// Using audio file
const task = await api.createAvatar({
  image: './portrait.jpg',
  sound_file: './speech.mp3',     // Local audio file
  mode: 'pro'
});

// Using pre-uploaded audio ID
const task = await api.createAvatar({
  image: './portrait.jpg',
  audio_id: 'uploaded-audio-id',
  prompt: 'Happy expression',
  mode: 'std'
});

// Wait for result
const result = await api.waitForVideoResult(
  task.data.task_id,
  api.queryAvatarTask.bind(api)
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | string | Yes | Portrait image |
| `audio_id` | string | One required | Pre-uploaded audio ID |
| `sound_file` | string | One required | Audio file path or URL |
| `prompt` | string | No | Expression/mood guidance |
| `mode` | 'std' \| 'pro' | No | Quality mode |

**Note:** Provide either `audio_id` OR `sound_file`, not both.

### Account & Utilities

Check account information, credits, and API health.

```typescript
// Get account information and resource packs
const now = Date.now();
const accountInfo = await api.getAccountInfo(
  now - 86400000,  // startTime: 24 hours ago
  now              // endTime: now
);
console.log('Resource packs:', accountInfo.data.resource_pack_subscribe_infos);

// Check API health (returns true if reachable)
const isHealthy = await api.healthCheck();
if (!isHealthy) {
  throw new Error('Kling API is not reachable');
}

// Token management (for debugging)
const token = api.getToken();      // Get current JWT token
api.refreshToken();                // Force token refresh
```

**Methods:**

| Method | Returns | Description |
|--------|---------|-------------|
| `getAccountInfo(startTime, endTime)` | `AccountInfoResponse` | Get resource pack subscription info |
| `healthCheck()` | `boolean` | Check if API is reachable |
| `getToken()` | `string \| null` | Get current JWT token (debugging) |
| `refreshToken()` | `void` | Force JWT token refresh |

## Advanced Features

Advanced features for sophisticated video and image generation workflows.

### Video Extension

Extend existing generated videos with additional content.

```typescript
// Extend a previously generated video
const task = await api.extendVideo({
  video_id: 'original-video-id',     // From text-to-video or image-to-video
  prompt: 'Continue with the camera zooming out',
  cfg_scale: 0.5                      // 0-1, prompt relevance
});

// Query task status
const status = await api.queryExtendVideoTask(task.data.task_id);

// Wait for completion
const result = await api.waitForVideoResult(
  task.data.task_id,
  api.queryExtendVideoTask.bind(api)
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `video_id` | string | Yes | Video ID from previous generation |
| `prompt` | string | No | Extension prompt (max 2500 chars) |
| `negative_prompt` | string | No | What to avoid (max 2500 chars) |
| `cfg_scale` | number | No | CFG scale 0-1 (default: 0.5) |
| `callback_url` | string | No | Webhook URL |

### Multi-Image-to-Video

Generate videos from multiple reference images with smooth transitions.

```typescript
const task = await api.multiImageToVideo({
  image_list: [
    { image: './scene1.jpg' },
    { image: './scene2.jpg' },
    { image: './scene3.jpg' }
  ],
  prompt: 'Smooth cinematic transition between scenes',
  model_name: 'kling-v1-6',
  mode: 'pro',
  duration: '5',
  aspect_ratio: '16:9'
});

// Wait for result
const result = await api.waitForVideoResult(
  task.data.task_id,
  api.queryMultiImageToVideoTask.bind(api)
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image_list` | MultiImageVideoItem[] | Yes | 1-4 reference images |
| `prompt` | string | Yes | Motion/transition description |
| `model_name` | 'kling-v1-6' | No | Model (only kling-v1-6 supported) |
| `negative_prompt` | string | No | What to avoid |
| `mode` | 'std' \| 'pro' | No | Quality mode |
| `aspect_ratio` | VideoAspectRatio | No | Output aspect ratio |
| `duration` | '5' \| '10' | No | Video length |

### Omni Video

Advanced video generation with flexible multi-modal inputs using template syntax.

```typescript
// Using first/end frame control
const task = await api.omniVideo({
  prompt: 'A cat walking through <<<image_1>>> and ending at <<<image_2>>>',
  image_list: [
    { image_url: './start.jpg', type: 'first_frame' },
    { image_url: './end.jpg', type: 'end_frame' }
  ],
  model_name: 'kling-video-o1',
  duration: '5',
  aspect_ratio: '16:9'
});

// Wait for result
const result = await api.waitForVideoResult(
  task.data.task_id,
  api.queryOmniVideoTask.bind(api)
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Prompt with template syntax (max 2500 chars) |
| `model_name` | OmniVideoModel | No | Model (default: kling-video-o1) |
| `image_list` | OmniVideoImageItem[] | No | Images with optional frame type |
| `video_list` | OmniVideoListItem[] | No | Reference videos |
| `element_list` | OmniElementListItem[] | No | Element references by ID |
| `aspect_ratio` | VideoAspectRatio | No | Output aspect ratio |
| `duration` | '5' \| '10' | No | Video length |

**Template Syntax:** Use `<<<image_1>>>`, `<<<video_1>>>`, `<<<element_1>>>` to reference items from their respective lists.

### Omni Image

Advanced image generation with multi-modal inputs and template syntax.

```typescript
// Using image reference in prompt
const task = await api.omniImage({
  prompt: 'A portrait in the style of <<<image_1>>> featuring a mountain landscape',
  image_list: [
    { image: './style-reference.jpg' }
  ],
  model_name: 'kling-image-o1',
  n: 4,
  resolution: '2k',
  aspect_ratio: '16:9'
});

// Wait for result
const result = await api.waitForImageResult(
  task.data.task_id,
  api.queryOmniImageTask.bind(api)
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | Prompt with template syntax (max 2500 chars) |
| `model_name` | OmniImageModel | No | Model (default: kling-image-o1) |
| `image_list` | OmniImageListItem[] | No | Reference images |
| `element_list` | OmniElementListItem[] | No | Element references by ID |
| `n` | number | No | Number of images (1-9) |
| `resolution` | '1k' \| '2k' | No | Output resolution |
| `aspect_ratio` | OmniImageAspectRatio | No | Aspect ratio (includes 'auto') |

### Multi-Image-to-Image

Combine multiple subject images with optional scene and style references.

```typescript
const task = await api.multiImageToImage({
  subject_image_list: [
    { subject_image: './subject1.jpg' },
    { subject_image: './subject2.jpg' }
  ],
  scene_image: './background.jpg',
  style_image: './art-style.jpg',
  prompt: 'The subjects meeting in this scene with artistic style',
  model_name: 'kling-v2-1',
  n: 4,
  aspect_ratio: '16:9'
});

// Wait for result
const result = await api.waitForImageResult(
  task.data.task_id,
  api.queryMultiImageToImageTask.bind(api)
);
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `subject_image_list` | SubjectImageItem[] | Yes | 1-4 subject images |
| `prompt` | string | No | Generation prompt (max 2500 chars) |
| `model_name` | 'kling-v2' \| 'kling-v2-1' | No | Model version |
| `scene_image` | string | No | Scene/background reference |
| `style_image` | string | No | Style reference image |
| `n` | number | No | Number of images (1-9) |
| `aspect_ratio` | ImageAspectRatio | No | Output aspect ratio |

**Note:** Subject images should be pre-cropped to focus on the subject.

## Models

### Text-to-Video Models

| Model | CFG Scale | Sound | Camera Control | Description |
|-------|-----------|-------|----------------|-------------|
| `kling-v1` | Yes | No | No | Base model |
| `kling-v1-6` | Yes | No | Yes | Camera control support |
| `kling-v2-master` | No | No | No | V2 master quality |
| `kling-v2-1-master` | No | No | No | V2.1 master quality |
| `kling-v2-5-turbo` | No | No | No | Fast generation |
| `kling-v2-6` | No | Yes | No | Sound generation support |

### Image-to-Video Models

| Model | CFG Scale | Image Tail | Voice | Dynamic Masks | Camera |
|-------|-----------|------------|-------|---------------|--------|
| `kling-v1` | Yes | No | No | No | No |
| `kling-v1-5` | Yes | Yes (pro) | No | Yes | Yes |
| `kling-v1-6` | Yes | Yes | No | Yes | Yes |
| `kling-v2-master` | No | No | No | No | No |
| `kling-v2-1` | No | Yes (pro) | No | No | No |
| `kling-v2-1-master` | No | No | No | No | No |
| `kling-v2-5-turbo` | No | Yes (pro) | No | No | No |
| `kling-v2-6` | No | Yes | Yes | No | No |

### Image Generation Models

| Model | Image Reference | Max Images |
|-------|-----------------|------------|
| `kling-v1` | No | 9 |
| `kling-v1-5` | Yes | 9 |
| `kling-v2` | No | 9 |
| `kling-v2-new` | No | 9 |
| `kling-v2-1` | No | 9 |

## Camera Control

Camera control is available for supported models (`kling-v1-6` for text-to-video, `kling-v1-5` and `kling-v1-6` for image-to-video).

### Preset Movements

```typescript
const task = await api.textToVideo({
  prompt: 'A beautiful landscape',
  model_name: 'kling-v1-6',
  camera_control: {
    type: 'down_back'  // Preset camera movement
  }
});
```

**Available presets:**
- `simple` - No preset, use config for fine control
- `down_back` - Move down and back
- `forward_up` - Move forward and up
- `right_turn_forward` - Turn right while moving forward
- `left_turn_forward` - Turn left while moving forward

### Fine-Grained Control

```typescript
const task = await api.textToVideo({
  prompt: 'A beautiful landscape',
  model_name: 'kling-v1-6',
  camera_control: {
    type: 'simple',
    config: {
      horizontal: 5,   // -10 to 10: Pan left/right
      vertical: 0,     // -10 to 10: Move up/down
      pan: 0,          // -10 to 10: Rotate left/right
      tilt: 0,         // -10 to 10: Tilt up/down
      roll: 0,         // -10 to 10: Roll camera
      zoom: 3          // -10 to 10: Zoom in/out
    }
  }
});
```

**Note:** Only one non-zero config parameter is allowed per request.

## Examples

### Example 1: Text-to-Video Workflow

```typescript
import { KlingAPI } from 'kling-api';

const api = new KlingAPI();

async function generateVideo() {
  // Create task
  const task = await api.textToVideo({
    prompt: 'A serene lake surrounded by mountains at golden hour',
    model_name: 'kling-v2-master',
    mode: 'pro',
    duration: '5',
    aspect_ratio: '16:9'
  });

  console.log('Task created:', task.data.task_id);

  // Wait for completion with spinner
  const result = await api.waitForVideoResult(task.data.task_id, undefined, {
    showSpinner: true,
    timeout: 300000  // 5 minutes
  });

  // Save to disk
  const paths = await api.saveVideoResult(result, './videos', 'lake sunset');
  console.log('Saved to:', paths);
}

generateVideo().catch(console.error);
```

### Example 2: Image-to-Video with Camera Control

```typescript
const task = await api.imageToVideo({
  image: './landscape.jpg',
  prompt: 'Gentle camera push forward through the scene',
  model_name: 'kling-v1-6',
  mode: 'pro',
  camera_control: {
    type: 'simple',
    config: { zoom: 5 }
  }
});
```

### Example 3: Batch Image Generation

```typescript
const task = await api.generateImage({
  prompt: 'A futuristic cityscape at night with neon lights',
  model_name: 'kling-v2-1',
  n: 9,
  aspect_ratio: '21:9',
  resolution: '2k'
});

const result = await api.waitForImageResult(task.data.task_id);

// result.data.task_result.images is an array of 9 images
for (const image of result.data.task_result.images) {
  console.log(`Image ${image.index}: ${image.url}`);
}
```

### Example 4: Avatar with Custom Audio

```typescript
const task = await api.createAvatar({
  image: './portrait.jpg',
  sound_file: './narration.mp3',
  prompt: 'Professional, confident expression',
  mode: 'pro'
});

const result = await api.waitForVideoResult(
  task.data.task_id,
  api.queryAvatarTask.bind(api)
);
```

### Example 5: Image Expansion

```typescript
// Expand a portrait to landscape format
const task = await api.expandImage({
  image: './portrait.jpg',
  up_expansion_ratio: 0,
  down_expansion_ratio: 0,
  left_expansion_ratio: 1,    // Double width on left
  right_expansion_ratio: 1    // Double width on right
});
```

## Data Organization

Generated media and metadata are organized by feature and model:

```
datasets/
└── kling/
    ├── text-to-video/
    │   ├── 2025-01-13_14-30-22_mountain_landscape.mp4
    │   ├── 2025-01-13_14-30-22_mountain_landscape_metadata.json
    │   └── ...
    ├── image-to-video/
    │   └── ...
    ├── images/
    │   └── ...
    ├── image-expand/
    │   └── ...
    └── avatar/
        └── ...
```

**Metadata Format:**

```json
{
  "task_id": "abc123",
  "video_id": "vid456",
  "duration": 5,
  "url": "https://...",
  "created_at": 1705156222,
  "prompt": "A serene mountain landscape"
}
```

## Security Features

### API Key Protection
- **Redacted Logging**: Credentials show only last 4 characters in logs
- **JWT Caching**: Tokens cached with 5-minute expiry buffer
- **Secure Storage**: Supports environment variables and .env files

### Request Security
- **HTTPS Enforcement**: All requests must use HTTPS
- **SSRF Protection**: Validates and blocks internal/private URLs
- **Magic Byte Validation**: Verifies actual file types, not just extensions
- **File Size Limits**: 50MB maximum for downloads

### Error Sanitization
- **Production Mode**: Generic error messages (`NODE_ENV=production`)
- **Development Mode**: Detailed errors for debugging

## Error Handling

### KlingAPIError

All API errors are wrapped in `KlingAPIError` with useful properties:

```typescript
try {
  await api.textToVideo({ prompt: '' });
} catch (error) {
  if (error instanceof KlingAPIError) {
    console.log('Error code:', error.code);
    console.log('HTTP status:', error.httpStatus);
    console.log('Request ID:', error.requestId);
    console.log('Retryable:', error.isRetryable());
  }
}
```

### Automatic Retries

Transient errors (502, 503, 504) are automatically retried with exponential backoff:
- Retry 1: 2 seconds delay
- Retry 2: 4 seconds delay
- Retry 3: 8 seconds delay

### Validation Errors

Parameter validation happens before API calls to save credits:

```typescript
try {
  await api.textToVideo({
    prompt: 'x'.repeat(3000)  // Exceeds 2500 char limit
  });
} catch (error) {
  // ValidationError: prompt: Prompt cannot exceed 2500 characters
}
```

## Troubleshooting

### Credentials Not Found

```
Error: Kling API credentials not found. Provide accessKey and secretKey via:
1. Constructor parameters
2. Environment variables (KLING_ACCESS_KEY, KLING_SECRET_KEY)
3. Local .env file
4. Global ~/.kling/.env file
```

**Solution:** Configure your credentials using one of the methods above.

### Authentication Failed

```
Error: Authentication failed (401)
```

**Solution:**
1. Verify your Access Key and Secret Key are correct
2. Check your account is active at the Kling AI Developer Platform
3. Regenerate credentials if needed

### Task Timeout

```
Error: Polling timeout exceeded
```

**Solution:**
- Increase timeout: `{ timeout: 600000 }` (10 minutes)
- Video generation can take 2-5 minutes depending on length and mode

### Camera Control Not Supported

```
Error: camera_control is not supported by kling-v1
```

**Solution:** Use a model that supports camera control:
- Text-to-video: `kling-v1-6`
- Image-to-video: `kling-v1-5` or `kling-v1-6`

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build TypeScript
npm run build
```

## Related Packages

This package is part of the img-gen ecosystem:

- [`bfl-api`](https://github.com/aself101/bfl-api) - Black Forest Labs FLUX models
- [`stability-ai-api`](https://github.com/aself101/stability-ai-api) - Stability AI Stable Diffusion
- [`ideogram-api`](https://github.com/aself101/ideogram-api) - Ideogram image generation
- [`google-genai-api`](https://github.com/aself101/google-genai-api) - Google Imagen

## License

MIT License - see [LICENSE](../LICENSE) for details.

---

**Disclaimer:** This project is an independent community wrapper and is not affiliated with Kling AI or Kuaishou Technology.
