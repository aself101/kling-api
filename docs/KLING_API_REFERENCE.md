# Kling AI API Reference

Complete API reference for the Kling AI video and image generation platform.

## Table of Contents

- [General Information](#general-information)
- [Authentication](#authentication)
- [Error Codes](#error-codes)
- [Concurrency Rules](#concurrency-rules)
- [Model Capabilities](#model-capabilities)
- [API Endpoints](#api-endpoints)
  - [Text to Video](#text-to-video)
  - [Image to Video](#image-to-video)
  - [Video Extension](#video-extension)
  - [Image Generation](#image-generation)
  - [Multi-Image to Image](#multi-image-to-image)
  - [Image Expansion](#image-expansion)
  - [Avatar (Lip Sync)](#avatar-lip-sync)
  - [Account Information](#account-information)
- [Common Patterns](#common-patterns)

---

## General Information

### Base URL

```
https://api-singapore.klingai.com
```

### Request/Response Format

- **Content-Type**: `application/json`
- **Response Format**: JSON

---

## Authentication

Kling API uses JWT (JSON Web Token) authentication following RFC 7519.

### Steps

1. **Obtain Credentials**: Get your `AccessKey` and `SecretKey` from the Kling AI platform
2. **Generate JWT Token**: Create a token using the HS256 algorithm
3. **Include in Request**: Add `Authorization: Bearer <token>` header

### JWT Token Structure

```javascript
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload
{
  "iss": "<access_key>",        // Your AccessKey
  "exp": <current_time + 1800>, // Expiration (30 min recommended)
  "nbf": <current_time - 5>     // Not before (5 sec buffer)
}
```

### Python Example

```python
import time
import jwt

def encode_jwt_token(access_key, secret_key):
    headers = {
        "alg": "HS256",
        "typ": "JWT"
    }
    payload = {
        "iss": access_key,
        "exp": int(time.time()) + 1800,  # Valid for 30 minutes
        "nbf": int(time.time()) - 5       # Effective 5 seconds ago
    }
    token = jwt.encode(payload, secret_key, headers=headers)
    return token

# Usage
authorization = encode_jwt_token(access_key, secret_key)
# Header: Authorization = "Bearer " + authorization
```

---

## Error Codes

| HTTP Status | Code | Category | Description | Solution |
|-------------|------|----------|-------------|----------|
| 200 | 0 | Success | Request successful | - |
| 401 | 1000 | Auth | Authentication failed | Check Authorization header |
| 401 | 1001 | Auth | Authorization is empty | Provide Authorization header |
| 401 | 1002 | Auth | Authorization is invalid | Check token format |
| 401 | 1003 | Auth | Token not yet valid | Wait for `nbf` time or regenerate |
| 401 | 1004 | Auth | Token has expired | Regenerate token |
| 429 | 1100 | Account | Account exception | Verify account configuration |
| 429 | 1101 | Account | Account in arrears | Recharge account balance |
| 429 | 1102 | Account | Resource pack depleted/expired | Purchase additional resources |
| 403 | 1103 | Account | Unauthorized access to resource | Verify account permissions |
| 400 | 1200 | Params | Invalid request parameters | Check parameter values |
| 400 | 1201 | Params | Invalid parameter key/value | Review specific field in message |
| 404 | 1202 | Params | Invalid request method | Use correct HTTP method |
| 404 | 1203 | Params | Resource does not exist | Check model name or endpoint |
| 400 | 1300 | Policy | Platform policy triggered | Review platform policies |
| 400 | 1301 | Policy | Content security violation | Modify input content |
| 429 | 1302 | Rate | Rate limit exceeded | Reduce request frequency |
| 429 | 1303 | Rate | Concurrency limit exceeded | Implement backoff retry |
| 429 | 1304 | Policy | IP whitelist triggered | Contact customer service |
| 500 | 5000 | Server | Internal server error | Retry later |
| 503 | 5001 | Server | Server temporarily unavailable | Retry later |

---

## Concurrency Rules

### What is Concurrency?

Concurrency is the maximum number of generation tasks an account can process in parallel, determined by your resource package.

### Core Rules

| Dimension | Rule |
|-----------|------|
| Application Scope | Applied per account, calculated independently per resource type (video/image/virtual try-on) |
| Occupancy Logic | Task occupies concurrency from "submitted" until completion (including failures) |
| Quota Calculation | Uses highest concurrency value among all active resource packages of same type |

### Special Notes

- **Video/Virtual Try-on**: Each task occupies **1 concurrency**
- **Image Generation**: Concurrency used = `n` value in request (e.g., n=9 occupies 9 slots)
- Query interfaces do **not** consume concurrency
- No QPS (queries per second) limit imposed

### Over-limit Error

```json
{
  "code": 1303,
  "message": "parallel task over resource pack limit",
  "request_id": "uuid"
}
```

**Recommended handling**:
1. **Backoff Retry**: Exponential backoff with initial delay >= 1 second
2. **Queue Management**: Control submission rate based on available concurrency

---

## Model Capabilities

### Video Models

#### Resolution & Frame Rate Summary

| Model | Mode | Resolution | Frame Rate |
|-------|------|------------|------------|
| kling-v1 | STD/PRO | 720p | 30fps |
| kling-v1-5 | STD | 720p | 30fps |
| kling-v1-5 | PRO | 1080p | 30fps |
| kling-v1-6 (Image2Video) | STD | 720p | 30fps |
| kling-v1-6 (Image2Video) | PRO | 1080p | 30fps |
| kling-v1-6 (Text2Video) | STD | 720p | 24fps |
| kling-v1-6 (Text2Video) | PRO | 1080p | 24fps |
| kling-v2-master | - | 720p | 24fps |
| kling-v2-1-master | - | 1080p | 24fps |
| kling-v2-5-turbo | STD/PRO | 1080p | 24fps |
| kling-v2-6 | PRO 5s/10s | 1080p | 24fps |

#### Feature Support by Model

| Feature | kling-v1 | kling-v1-5 | kling-v1-6 | kling-v2.x |
|---------|----------|------------|------------|------------|
| Text to Video | Yes | No | Yes | Yes (v2-master, v2-5-turbo, v2-6 PRO) |
| Image to Video | Yes | Yes | Yes | Yes |
| Start/End Frame | Yes (STD 5s) | Yes (PRO) | Yes (PRO) | Yes (PRO modes) |
| Motion Brush | Yes (STD 5s) | Yes (PRO 5s) | No | No |
| Camera Control | Yes (STD 5s) | Yes (PRO 5s, simple) | No | No |
| Video Extension | Yes | Yes | Yes | Yes |
| Video Effects (Hug/Kiss/Heart) | Yes | Yes | Yes | Yes |
| Multi-Image to Video | No | No | Yes | No |
| Voice Control | No | No | No | Yes (v2-6 PRO) |
| Motion Control | No | No | No | Yes (v2-6 STD other duration) |
| Sound Generation | No | No | No | Yes (v2-6+) |
| Lip Sync | Yes | Yes | Yes | Yes |
| Video to Audio | Yes | Yes | Yes | Yes |

### Image Models

#### Resolution Support

| Model | Text-to-Image | Image-to-Image | Resolution |
|-------|---------------|----------------|------------|
| kling-image-o1 | 1:1 to 21:9 (+ auto) | All ratios (+ auto) | - |
| kling-v1 | 1:1 to 9:16 (no 21:9) | Entire image | 1K |
| kling-v1-5 | All ratios incl. 21:9 | Subject, Face | 1K |
| kling-v2 | All ratios incl. 21:9 | Multi-image, Restyle | 1K/2K (text), 1K (img) |
| kling-v2-new | No | Restyle only | Same as input |
| kling-v2-1 | All ratios | Multi-image | 1K/2K (text), 1K (img) |

#### Supported Aspect Ratios

- **Standard**: 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3
- **Ultrawide**: 21:9 (not supported on kling-v1 text-to-image)
- **Auto**: Available on kling-image-o1 only

#### Additional Image Features

| Feature | Support | Description |
|---------|---------|-------------|
| Image Expansion | Yes | Expand content based on existing images |

---

## API Endpoints

### Text to Video

Generate videos from text prompts.

#### Create Task

```
POST /v1/videos/text2video
```

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| model_name | string | No | kling-v1 | Model: `kling-v1`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1-master`, `kling-v2-5-turbo`, `kling-v2-6` |
| prompt | string | **Yes** | - | Positive prompt (max 2500 chars) |
| negative_prompt | string | No | null | Negative prompt (max 2500 chars) |
| sound | string | No | off | Audio generation: `on`, `off` (v2.6+ only) |
| cfg_scale | float | No | 0.5 | Prompt relevance [0, 1]. Higher = stricter adherence. Not supported on v2.x |
| mode | string | No | std | Quality mode: `std` (standard), `pro` (professional) |
| aspect_ratio | string | No | 16:9 | Frame ratio: `16:9`, `9:16`, `1:1` |
| duration | string | No | 5 | Video length: `5`, `10` (seconds) |
| camera_control | object | No | null | Camera movement control |
| callback_url | string | No | null | Webhook URL for status updates |
| external_task_id | string | No | null | Custom task ID (must be unique per account) |

**Camera Control Object**

| Field | Type | Description |
|-------|------|-------------|
| type | string | Preset: `simple`, `down_back`, `forward_up`, `right_turn_forward`, `left_turn_forward` |
| config | object | Custom config (only when type=`simple`) |

**Camera Config Fields** (when type=`simple`, choose ONE non-zero):

| Field | Range | Description |
|-------|-------|-------------|
| horizontal | [-10, 10] | X-axis translation (negative=left, positive=right) |
| vertical | [-10, 10] | Y-axis translation (negative=down, positive=up) |
| pan | [-10, 10] | Rotation around X-axis |
| tilt | [-10, 10] | Rotation around Y-axis |
| roll | [-10, 10] | Rotation around Z-axis |
| zoom | [-10, 10] | Focal length change (negative=narrow, positive=wide) |

**Response**

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_status": "submitted",
    "task_info": {
      "external_task_id": "string"
    },
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

#### Query Task (Single)

```
GET /v1/videos/text2video/{id}
```

**Path Parameters**

| Field | Description |
|-------|-------------|
| id | Either `task_id` or `external_task_id` |

**Response**

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_status": "succeed",
    "task_status_msg": "string",
    "task_info": {
      "external_task_id": "string"
    },
    "created_at": 1722769557708,
    "updated_at": 1722769557708,
    "task_result": {
      "videos": [
        {
          "id": "string",
          "url": "https://...",
          "duration": "5"
        }
      ]
    }
  }
}
```

**Task Status Values**: `submitted`, `processing`, `succeed`, `failed`

#### Query Task List

```
GET /v1/videos/text2video?pageNum=1&pageSize=30
```

**Query Parameters**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| pageNum | int | 1 | Page number [1, 1000] |
| pageSize | int | 30 | Items per page [1, 500] |

---

### Image to Video

Generate videos from reference images.

#### Create Task

```
POST /v1/videos/image2video
```

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| model_name | string | No | kling-v1 | Model: `kling-v1`, `kling-v1-5`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1`, `kling-v2-1-master`, `kling-v2-5-turbo`, `kling-v2-6` |
| image | string | **Yes*** | null | Start frame image (Base64 or URL) |
| image_tail | string | No | null | End frame image (Base64 or URL) |
| prompt | string | No | null | Text prompt (max 2500 chars). Supports voice reference: `<<<voice_1>>>` |
| negative_prompt | string | No | null | Negative prompt (max 2500 chars) |
| voice_list | array | No | null | Voice references (max 2 voices) |
| sound | string | No | off | Audio generation: `on`, `off` (v2.6+ only) |
| cfg_scale | float | No | 0.5 | Prompt relevance [0, 1]. Not supported on v2.x |
| mode | string | No | std | Quality mode: `std`, `pro` |
| static_mask | string | No | null | Static brush mask (Base64 or URL) |
| dynamic_masks | array | No | null | Dynamic brush configurations (up to 6 groups) |
| camera_control | object | No | null | Camera movement control |
| aspect_ratio | string | No | 16:9 | Frame ratio |
| duration | string | No | 5 | Video length: `5`, `10` |
| callback_url | string | No | null | Webhook URL |
| external_task_id | string | No | null | Custom task ID |

*At least one of `image` or `image_tail` is required

**Image Requirements**:
- Formats: jpg, jpeg, png
- Max size: 10MB
- Min dimensions: 300px
- Aspect ratio: 1:2.5 to 2.5:1
- Base64: Raw encoded string (NO `data:image/png;base64,` prefix)

**Dynamic Masks Object**

```json
{
  "dynamic_masks": [
    {
      "mask": "base64_or_url",
      "trajectories": [
        [x1, y1],
        [x2, y2],
        ...
      ]
    }
  ]
}
```

- Trajectories: 2-77 coordinates for 5-second video
- Coordinate system: Origin at bottom-left of image

**Exclusivity Rules**:
- Cannot use `image` + `image_tail`, `dynamic_masks`/`static_mask`, and `camera_control` together

#### Query Task

```
GET /v1/videos/image2video/{id}
GET /v1/videos/image2video?pageNum=1&pageSize=30
```

---

### Video Extension

Extend duration of existing videos.

#### Create Task

```
POST /v1/videos/video-extend
```

**Important Notes**:
- Each extension adds 4-5 seconds
- Model and mode must match source video
- Total video duration cannot exceed 3 minutes
- Videos are cleared 30 days after generation

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| video_id | string | **Yes** | - | Source video ID (from text2video, image2video, or previous extension) |
| prompt | string | No | null | Text prompt (max 2500 chars) |
| negative_prompt | string | No | null | Negative prompt (max 2500 chars) |
| cfg_scale | float | No | 0.5 | Prompt relevance [0, 1] |
| callback_url | string | No | null | Webhook URL |

#### Query Task

```
GET /v1/videos/video-extend/{id}
GET /v1/videos/video-extend?pageNum=1&pageSize=30
```

---

### Image Generation

Generate images from text or reference images.

#### Create Task

```
POST /v1/images/generations
```

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| model_name | string | No | kling-v1 | Model: `kling-v1`, `kling-v1-5`, `kling-v2`, `kling-v2-new`, `kling-v2-1` |
| prompt | string | **Yes** | - | Text prompt (max 2500 chars) |
| negative_prompt | string | No | null | Negative prompt (max 2500 chars). Not supported in image-to-image mode |
| image | string | No | null | Reference image (Base64 or URL) |
| image_reference | string | No | null | Reference type: `subject` (character feature), `face` (appearance). Required for kling-v1-5 with image |
| image_fidelity | float | No | 0.5 | Reference intensity [0, 1] |
| human_fidelity | float | No | 0.45 | Face similarity [0, 1]. Only for `subject` reference |
| resolution | string | No | 1k | Output resolution: `1k`, `2k` |
| n | int | No | 1 | Number of images [1, 9] |
| aspect_ratio | string | No | 16:9 | Ratio: `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9` |
| callback_url | string | No | null | Webhook URL |
| external_task_id | string | No | null | Custom task ID |

**Image Requirements**:
- Same as Image to Video

#### Query Task

```
GET /v1/images/generations/{id}
GET /v1/images/generations?pageNum=1&pageSize=30
```

**Response** (task_result)

```json
{
  "task_result": {
    "images": [
      {
        "index": 0,
        "url": "https://..."
      }
    ]
  }
}
```

---

### Multi-Image to Image

Generate images using multiple reference images.

#### Create Task

```
POST /v1/images/multi-image-generations
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| model_name | string | No | Model: `kling-v2`, `kling-v2-1` |
| prompt | string | **Yes** | Text prompt (max 2500 chars) |
| images | array | **Yes** | Array of reference images (max varies by use case) |
| aspect_ratio | string | No | Output aspect ratio |
| n | int | No | Number of images [1, 9] |
| callback_url | string | No | Webhook URL |

#### Query Task

```
GET /v1/images/multi-image-generations/{id}
GET /v1/images/multi-image-generations?pageNum=1&pageSize=30
```

---

### Image Expansion

Expand/outpaint existing images.

#### Create Task

```
POST /v1/images/image-expansion
```

**Request Body**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | string | **Yes** | Source image (Base64 or URL) |
| prompt | string | No | Guide expansion direction |
| expansion_ratio | object | **Yes** | Expansion amounts per direction |
| aspect_ratio | string | No | Target aspect ratio |
| callback_url | string | No | Webhook URL |

**Expansion Ratio Object**

```json
{
  "expansion_ratio": {
    "top": 0.5,
    "bottom": 0.5,
    "left": 0.5,
    "right": 0.5
  }
}
```

#### Query Task

```
GET /v1/images/image-expansion/{id}
GET /v1/images/image-expansion?pageNum=1&pageSize=30
```

---

### Avatar (Lip Sync)

Generate talking avatar videos with lip synchronization.

#### Create Task

```
POST /v1/videos/avatar
```

**Request Body**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| image | string | **Yes** | - | Avatar reference image (Base64 or URL) |
| audio_id | string | Conditional | null | TTS-generated audio ID (2-300 seconds, within 30 days) |
| sound_file | string | Conditional | null | Audio file (Base64 or URL). Formats: mp3, wav, m4a, aac. Max 5MB, 2-300 seconds |
| prompt | string | No | null | Action/emotion/camera prompts (max 2500 chars) |
| mode | string | No | std | Quality: `std`, `pro` |
| callback_url | string | No | null | Webhook URL |

**Audio Rules**:
- Either `audio_id` OR `sound_file` required (not both, not neither)

#### Query Task

```
GET /v1/videos/avatar/{id}
GET /v1/videos/avatar?pageNum=1&pageSize=30
```

---

### Account Information

Query resource package status and usage.

#### Query Resource Packages

```
GET /account/costs?start_time={}&end_time={}
```

**Note**: Free to call, but limit QPS <= 1

**Query Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| start_time | int | **Yes** | Start timestamp (Unix ms) |
| end_time | int | **Yes** | End timestamp (Unix ms) |
| resource_pack_name | string | No | Filter by specific package |

**Response**

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "code": 0,
    "msg": "string",
    "resource_pack_subscribe_infos": [
      {
        "resource_pack_name": "Video Generation - 10,000 entries",
        "resource_pack_id": "uuid",
        "resource_pack_type": "decreasing_total",
        "total_quantity": 200.0,
        "remaining_quantity": 118.0,
        "purchase_time": 1726124664368,
        "effective_time": 1726124664368,
        "invalid_time": 1727366400000,
        "status": "online"
      }
    ]
  }
}
```

**Resource Pack Types**:
- `decreasing_total`: Decreasing total balance
- `constant_period`: Constant periodic allocation

**Status Values**:
- `toBeOnline`: Pending activation
- `online`: Active
- `expired`: Expired
- `runOut`: Depleted

**Note**: `remaining_quantity` updates with ~12 hour delay

---

## Common Patterns

### Standard Request Headers

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

### Standard Response Structure

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": { ... }
}
```

### Task Lifecycle

1. **Create Task** (POST) → Returns `task_id`, status: `submitted`
2. **Poll Status** (GET) → Status: `submitted` → `processing` → `succeed`/`failed`
3. **Get Results** → Available when status = `succeed`

### Image Input Format

For all endpoints accepting images:

```
// URL format
"image": "https://example.com/image.jpg"

// Base64 format (NO prefix!)
"image": "iVBORw0KGgoAAAANSUhEUgAAAAUA..."

// INCORRECT - do not include data URI prefix
"image": "data:image/png;base64,iVBORw0KGgo..."  // WRONG
```

### Polling Best Practices

1. Initial poll after 2-5 seconds
2. Exponential backoff: 2s → 4s → 8s → 16s (max 30s)
3. Use `callback_url` for production to avoid polling
4. Check `task_status_msg` on failure for error details

### Callback Webhook

When `callback_url` is provided, the server sends POST requests on status changes:

```json
{
  "task_id": "string",
  "task_status": "succeed",
  "task_result": { ... }
}
```

---

## Version History

- **v2.6**: Added sound generation, voice control, motion control
- **v2.5-turbo**: Fast generation mode
- **v2.1-master**: High quality 1080p master mode
- **v2**: Multi-image support, restyle feature
- **v1.6**: Multi-image to video, improved quality
- **v1.5**: Face/subject reference, end frame control
- **v1**: Original release

---

*Last updated: December 2024*
*Source: Official Kling AI API Documentation*
