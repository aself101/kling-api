# Kling AI API Wrapper

[![npm version](https://img.shields.io/npm/v/kling-api.svg)](https://www.npmjs.com/package/kling-api)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/node/v/kling-api)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-314%20passing-brightgreen)](test/)
[![Coverage](https://img.shields.io/badge/coverage-89.9%25-brightgreen)](test/)

A TypeScript/Node.js wrapper for the [Kling AI API](https://docs.qingque.cn/d/home/eZQClXt3RYb4VTjqEfcGBIvEG) for video generation, image generation, image expansion, and avatar/talking head creation.

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

TypeScript support with exported types for all parameters and responses.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Authentication Setup](#authentication-setup)
- [TypeScript Support](#typescript-support)
- [API Methods](#api-methods)
  - [Text-to-Video](#text-to-video)
  - [Image-to-Video](#image-to-video)
  - [Image Generation](#image-generation)
  - [Image Expansion](#image-expansion)
  - [Avatar (Talking Head)](#avatar-talking-head)
  - [Account & Utilities](#account--utilities)
- [Models](#models)
- [Camera Control](#camera-control)
- [Examples](#examples)
- [Data Organization](#data-organization)
- [Security Features](#security-features)
- [Error Handling](#error-handling)
- [Troubleshooting](#troubleshooting)
- [Future Features](#future-features)

## Overview

The Kling AI API provides access to video and image generation models. This Node.js wrapper implements:

- **5 Feature Areas** - Text-to-video, image-to-video, image generation, image expansion, avatar creation
- **19+ Model Variants** - Multiple versions across all feature areas with different capabilities
- **JWT Authentication** - Automatic token generation with caching (30-minute expiry, 5-minute buffer)
- **Security** - API key redaction, error sanitization, HTTPS enforcement, SSRF protection
- **Parameter Validation** - Pre-flight validation catches invalid parameters before API calls
- **Auto-polling with Spinner** - Automatic result polling with animated progress indicator
- **Retry Logic** - Exponential backoff for transient errors (502, 503, 504)
- **Image/Audio Input Support** - Convert local files or URLs to base64 with validation
- **Organized Storage** - Structured directories with timestamped files and metadata
- **TypeScript** - Type definitions for all API methods, parameters, and responses
- **Testing** - 314 tests with 89.9% coverage

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
# Install from npm
npm install kling-api

# Or install locally in your project
npm install kling-api --save
```

**Requirements**: Node.js >= 18.0.0

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

## Future Features

The following Kling AI API features have type definitions but are not yet implemented in this wrapper. They will be added in future releases as the API stabilizes:

| Feature | Type | Description |
|---------|------|-------------|
| Video Extension | `ExtendVideoParams` | Extend existing generated videos |
| Multi-Image-to-Video | `MultiImageToVideoParams` | Generate video from multiple reference images |
| Omni Video | `OmniVideoParams` | Advanced video generation with template syntax |
| Omni Image | `OmniImageParams` | Advanced image generation with template syntax |
| Multi-Image-to-Image | `MultiImageToImageParams` | Transform multiple images together |

The type definitions are available for forward compatibility:

```typescript
import type { ExtendVideoParams, OmniVideoParams } from 'kling-api';
```

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
