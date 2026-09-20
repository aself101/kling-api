> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Multi-Image to Image

> Source: https://kling.ai/document-api/api/image/2-1/multi-image-to-image
> Locale: en
> Current Tab: Multi-Image to Image
> Sibling Tabs: Text to Image/Image to Image / Multi-Image to Image
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Create Task

### API Overview

- Method: `POST`
- Path: `/v1/images/multi-image2image`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

Generate images based on multiple reference images (subject, scene, style).

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Request Body

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `model_name` | string | No | `kling-v2-1` | `kling-v2-1` | Model Name |
| `prompt` | string | No | - | - | Positive text prompt |
| `subject_image_list` | array | Yes | - | - | Subject Reference Images |
| `subject_image_list[].subject_image` | string | Yes | - | - | Subject image URL or Base64 string |
| `scene_image` | string | No | - | - | Scene Reference Image |
| `style_image` | string | No | - | - | Style Reference Image |
| `n` | int | No | `1` | - | Number of generated images |
| `aspect_ratio` | string | No | `16:9` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9` | Aspect ratio of the generated images (width:height) |
| `watermark_info` | object | No | - | - | Whether to generate watermarked results simultaneously |
| `callback_url` | string | No | - | - | The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes |
| `external_task_id` | string | No | - | - | Customized Task ID |

#### Request Body Field Notes

- `prompt`: Cannot exceed 2500 characters
- `subject_image_list`: Support up to 4 images, at least 1 image, using key:value format as follows:
  ```json
  "subject_image_list":[
    { "subject_image":"image_url" },
    { "subject_image":"image_url" },
    { "subject_image":"image_url" },
    { "subject_image":"image_url" }
  ]
  ```
- `subject_image_list`: The API does not perform cropping, please upload images with subjects already cropped
- `subject_image_list`: Supports image input as either Base64-encoded string or URL (ensure the URL is publicly accessible)
- `subject_image_list`: Important: When using Base64, do NOT add any prefix like `data:image/png;base64,`. Submit only the raw Base64 string.
- `subject_image_list`: **Correct Base64 format:**
  ```plaintext
  iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `subject_image_list`: Incorrect Base64 format (with data: prefix):
  ```plaintext
  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `subject_image_list`: Supported image formats: .jpg / .jpeg / .png
- `subject_image_list`: Image file size must not exceed 10MB. Image dimensions must be at least 300px in width and height. Aspect ratio must be between 1:2.5 and 2.5:1
- `scene_image`: Supports image input as either Base64-encoded string or URL (ensure the URL is publicly accessible)
- `scene_image`: Important: When using Base64, do NOT add any prefix like `data:image/png;base64,`. Submit only the raw Base64 string.
- `scene_image`: Correct Base64 format:
  ```plaintext
  iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `scene_image`: Incorrect Base64 format (with data: prefix):
  ```plaintext
  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `scene_image`: Supported image formats: .jpg / .jpeg / .png
- `scene_image`: Image file size must not exceed 10MB. Image dimensions must be at least 300px in width and height. Aspect ratio must be between 1:2.5 and 2.5:1
- `style_image`: Supports image input as either Base64-encoded string or URL (ensure the URL is publicly accessible)
- `style_image`: Important: When using Base64, do NOT add any prefix like `data:image/png;base64,`. Submit only the raw Base64 string.
- `style_image`: Correct Base64 format:
  ```plaintext
  iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `style_image`: Incorrect Base64 format (with data: prefix):
  ```plaintext
  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `style_image`: Supported image formats: .jpg / .jpeg / .png
- `style_image`: Image file size must not exceed 10MB. Image dimensions must be at least 300px in width and height. Aspect ratio must be between 1:2.5 and 2.5:1
- `n`: Value range: [1, 9]
- `aspect_ratio`: > The support range for different model versions varies. For details, see [Capability Map](https://kling.ai/document-api/guides/capability-map/image)
- `watermark_info`: Defined by the enabled parameter, format: 
  ```json
    "watermark_info": { "enabled": boolean } 
  ```
- `watermark_info`: true: generate watermarked result, false: do not generate
- `watermark_info`: Custom watermarks are not currently supported
- `callback_url`: The specific message schema of the notification can be found in [Callback Protocol](https://kling.ai/document-api/api/get-started/callbacks)
- `external_task_id`: User-defined task ID. It will not override the system-generated task ID, but supports querying tasks by this ID
- `external_task_id`: Please note that it must be unique for each user

### Request Example

```bash
curl --request POST \
  --url https://api-singapore.klingai.com/v1/images/multi-image2image \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model_name": "kling-v2-1",
    "prompt": "Wearing a flowing red dress on the grassland, in Ghibli style.",
    "negative_prompt": "",
    "subject_image_list": [
      { "subject_image": "https://v1-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/multi-1.png" },
      { "subject_image": "https://v1-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/multi-2.png" }
    ],
    "scene_image": "https://v1-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/background.jpeg",
    "style_image": "https://v1-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/16x9_jipuli.png",
    "n": 2,
    "aspect_ratio": "9:16"
  }'
```

### Response Example

```json
{
  "code": 0, // Error code; Specific definitions can be found in "Error Code"
  "message": "string", // Error message
  "request_id": "string", // Request ID, generated by the system, used for tracking requests and troubleshooting
  "data": {
    "task_id": "string", // Task ID, generated by the system
    "task_info": { //Task creation parameters
      "external_task_id": "string" //User-defined task ID
    },
    "task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed
    "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit: ms
  }
}
```

---

## Query Task (Single)

### API Overview

- Method: `GET`
- Path: `/v1/images/multi-image2image/{id}`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Path Params

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `task_id` | string | Yes | - | - | The task ID for image generation. Request path parameter, directly fill the value in the request path. Query by external_task_id or task_id. |
| `external_task_id` | string | No | - | - | Customized Task ID for audio generation |

#### Path Params Field Notes

- `external_task_id`: The external_task_id filled in when creating the task. You can choose to query by external_task_id or task_id
  - When creating a task, you can choose to query by external_task_id or task_id.

### Request Example

```bash
curl --request GET \
  --url https://api-singapore.klingai.com/v1/images/multi-image2image/{id} \
  --header 'Authorization: Bearer <token>'
```

### Response Example

```json
{
  "code": 0, // Error codes; specific definitions see Error codes
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system
  "data": {
    "task_id": "string", // Task ID, generated by the system
    "task_info": { //Task creation parameters
      "external_task_id": "string" //Customer-defined task ID
    },
    "task_status": "string", // Task status: submitted, processing, succeed, failed
    "task_status_msg": "string", // Task status message, failure reason when task fails
    "final_unit_deduction": "string", // Final unit deduction for the task
    "final_balance_deduction": { // Balance deduction information
      "quota": "string", // Balance deduction discount price
      "list_price": "string" // Balance deduction list price
    },
    "watermark_info": { "enabled": boolean },
    "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708, // Task update time, Unix timestamp, unit: ms
    "task_result": {
      "images": [
        {
          "index": 0, // Image number, 0-9
          "url": "string", // URL for generated image (Generated images/videos will be cleared after 30 days. Please save promptly.)
          "watermark_url": "string" // Watermarked image download URL, anti-hotlinking format
        }
      ]
    }
  }
}
```

---

## Query Task (List)

### API Overview

- Method: `GET`
- Path: `/v1/images/multi-image2image`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Query Params

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `pageNum` | int | No | `1` | - | Page number |
| `pageSize` | int | No | `30` | - | Number of items per page |

#### Query Params Field Notes

- `pageNum`: Value range: [1, 1000]
- `pageSize`: Value range: [1, 500]

### Request Example

```bash
curl --request GET \
  --url 'https://api-singapore.klingai.com/v1/images/multi-image2image?pageNum=1&pageSize=30' \
  --header 'Authorization: Bearer <token>'
```

### Response Example

```json
{
  "code": 0, // Error codes; specific definitions see Error codes
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system
  "data": [
    {
      "task_id": "string", // Task ID, generated by the system
      "task_info": { //Task creation parameters
        "external_task_id": "string" //Customer-defined task ID
      },
      "task_status": "string", // Task status: submitted, processing, succeed, failed
      "task_status_msg": "string", // Task status message
      "final_unit_deduction": "string", // Final unit deduction for the task
      "final_balance_deduction": { // Balance deduction information
        "quota": "string", // Balance deduction discount price
        "list_price": "string" // Balance deduction list price
      },
      "watermark_info": { "enabled": true },
      "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
      "updated_at": 1722769557708, // Task update time, Unix timestamp, unit: ms
      "task_result": {
        "images": [
          {
            "index": 0, // Image number, 0-9
            "url": "string", // URL for generated image (Generated images/videos will be cleared after 30 days. Please save promptly.)
            "watermark_url": "string" // Watermarked image download URL, anti-hotlinking format
          }
        ]
      }
    }
  ]
}
```
