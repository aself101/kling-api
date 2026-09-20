> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Image Generation

> Source: https://kling.ai/document-api/api/image/o1/image-generation
> Locale: en
> Current Tab: Image Generation
> Sibling Tabs: Image Generation / Element Management
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Create Task

### API Overview

- Method: `POST`
- Path: `/v1/images/omni-image`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Request Body

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `model_name` | string | No | `kling-image-o1` | `kling-image-o1`, `kling-v3-omni` | Model Name |
| `prompt` | string | Yes | - | - | Text prompt words, which can include positive and negative descriptions |
| `image_list` | array | No | - | - | Reference Image List |
| `image_list[].image` | string | Yes | - | - | Image URL or Base64 string |
| `element_list` | array | No | - | - | Reference Element List based on element ID configuration |
| `element_list[].element_id` | long | Yes | - | - | Element ID from element library |
| `resolution` | string | No | `1k` | `1k`, `2k`, `4k` | Image generation resolution |
| `result_type` | string | No | `single` | `single`, `series` | Control whether to generate a single image or a series of images |
| `n` | int | No | `1` | - | Number of generated images |
| `series_amount` | int | No | `4` | `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `auto` | Number of images in a generated image series |
| `aspect_ratio` | string | No | `auto` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9`, `auto` | Aspect ratio of the generated images (width:height) |
| `watermark_info` | object | No | - | - | Whether to generate watermarked results simultaneously |
| `callback_url` | string | No | - | - | The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes |
| `external_task_id` | string | No | - | - | Customized Task ID |

#### Request Body Field Notes

- `prompt`: The prompt words can be templated to meet different image generation needs
- `prompt`: Must not exceed 2,500 characters
- `prompt`: Specify an image in the format of <<<>>>, such as <<<image_1>>>
- `prompt`: The scope of abilities can be found in the user manual: [KLING Omni Model User Guide](https://kling.ai/quickstart/klingai-image-o1-user-guide)
- `image_list`: Load with key:value format as follows:
  ```json
  "image_list":[
    { "image":"image_url" }
  ]
  ```
- `image_list`: Supports inputting image Base64 encoding or image URL (ensure accessibility)
- `image_list`: Supported image formats: .jpg / .jpeg / .png
- `image_list`: Image file size must not exceed 10MB. Image dimensions must be at least 300px. Aspect ratio must be between 1:2.5 and 2.5:1
- `image_list`: The sum of reference elements and reference images must not exceed 10
- `image_list`: The value of image_url parameter must not be empty
- `element_list`: Load with key:value format as follows:
  ```json
  "element_list":[
    { "element_id": 829836802793406551 }
  ]
  ```
- `element_list`: The sum of reference elements and reference images must not exceed 10
- `element_list`: > The support range for different model versionsvaries. For details, see [Capability Map](https://kling.ai/document-api/guides/capability-map/image)
- `resolution`: 1k: 1K standard definition
- `resolution`: 2k: 2K high-res
- `resolution`: 4k: 4K high-res
- `resolution`: > The support range for different model versionsvaries. For details, see [Capability Map](https://kling.ai/document-api/guides/capability-map/image)
- `result_type`: > The support range for different model versionsvaries. For details, see [Capability Map](https://kling.ai/document-api/guides/capability-map/image)
- `n`: Value range: [1, 9]
- `n`: When result_type is series, this parameter is invalid
- `series_amount`: `auto` intelligently selects the number of images generated based on the input content
- `series_amount`: When using `auto`, it will consume concurrency corresponding to the actual generated quantity
- `series_amount`: When result_type is `single`, this parameter is invalid
- `series_amount`: > The support range varies for different model versions. For more details, please refer to the current document's [2-0 Capability Map](https://kling.ai/document-api/guides/capability-map/image)
- `aspect_ratio`: `auto` is to intelligently aspect ratio of the generated image based on incoming content.
- `aspect_ratio`: > The support range for different model versionsvaries. For details, see [Capability Map](https://kling.ai/document-api/guides/capability-map/image)
- `watermark_info`: Defined by the enabled parameter, format: 
  ```json
    "watermark_info": { "enabled": boolean } 
  ```
- `watermark_info`: true: generate watermarked result, false: do not generate
- `watermark_info`: Custom watermarks are not currently supported
- `callback_url`: For the specific message schema, see [Callback Protocol](https://kling.ai/document-api/api/get-started/callbacks)
- `external_task_id`: User-defined task ID. It will not override the system-generated task ID, but supports querying tasks by this ID
- `external_task_id`: Please note that it must be unique for each user

### Request Example

```bash
curl --request POST \
  --url https://api-singapore.klingai.com/v1/images/omni-image \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model_name": "kling-image-o1",
    "prompt": "Merge all the people in the images into the <<<object_1>>> image",
    "element_list": [
        {
            "element_id": 829836802793406551
        }
    ],
    "image_list": [
        {
            "image": "https://v1-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/multi-4.png"
        },
        {
            "image": "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/video_effects/1.png"
        },
        {
            "image": "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/video_effects/4.png"
        }
    ],
    "resolution": "2k",
    "n": 1,
    "aspect_ratio": "3:2"
  }'
```

### Response Example

```json
{
  "code": 0, // Error code; Specific definitions can be found in Error codes
  "message": "string", // Error message
  "request_id": "string", // Request ID, system-generated, used for tracking requests and troubleshooting
  "data": {
    "task_id": "string", // Task ID, system-generated
    "task_info": { //Task creation parameters
      "external_task_id": "string" //User-defined task ID
    },
    "task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed
    "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit: ms
  }
}
```

## Invocation Examples

### Image Generation with Element

```Bash
curl --location 'https://xxx/v1/images/generations' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json' \
--data '{
    "model_name": "kling-v3-omni",
    "prompt": "Generate a recommended cover for each subject <<element_1>> based on the style of the reference image <<image_1>>",
    "element_list": [
      {
        "element_id": 160
      },
      {
        "element_id": 161
      }
    ],
    "image_list": [
      {
        "image": "xxx"
      },
      {
        "image": "xxx"
      }
    ],
    "resolution": "2k",
    "result_type": "series",
    "series_amount": 2,
    "aspect_ratio": "auto",
    "external_task_id": "",
    "callback_url": ""
  }'
```

---

## Query Task (Single)

### API Overview

- Method: `GET`
- Path: `/v1/images/omni-image/{id}`
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
  --url https://api-singapore.klingai.com/v1/images/omni-image/{id} \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json'
```

### Response Example

```json
{
  "code": 0, // Error codes; specific definitions see Error codes
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system, for tracking and troubleshooting
  "data": {
    "task_id": "string", // Task ID, generated by the system
    "task_status": "string", // Task status: submitted, processing, succeed, failed
    "task_status_msg": "string", // Task status message, failure reason when task fails
    "task_info": { //Task creation parameters
      "external_task_id": "string" //Customer-defined task ID
    },
    "task_result": {
      "result_type": "single",
      "images": [
        {
          "index": 0, // Image number
          "url": "string", // URL for generated image, anti-hotlinking format (Generated images/videos will be cleared after 30 days. Please save promptly.)
          "watermark_url": "string" // Watermarked image download URL, anti-hotlinking format
        }
      ],
      "series_images": [
        {
          "index": 0, // Series-image sequence number
          "url": "string", // URL for generated image, anti-hotlinking format
          "watermark_url": "string" // Watermarked image download URL
        }
      ]
    },
    "watermark_info": { "enabled": boolean },
    "final_unit_deduction": "string", // Final unit deduction for the task
    "final_balance_deduction": { // Balance deduction information
      "quota": "string", // Balance deduction discount price
      "list_price": "string" // Balance deduction list price
    },
    "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit: ms
  }
}
```

---

## Query Task (List)

### API Overview

- Method: `GET`
- Path: `/v1/images/omni-image`
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
  --url 'https://api-singapore.klingai.com/v1/images/omni-image?pageNum=1&pageSize=30' \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json'
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
      "task_status": "string", // Task status: submitted, processing, succeed, failed
      "task_status_msg": "string", // Task status message
      "task_info": { //Task creation parameters
        "external_task_id": "string" //Customer-defined task ID
      },
      "final_unit_deduction": "string", // Final unit deduction for the task
      "final_balance_deduction": { // Balance deduction information
        "quota": "string", // Balance deduction discount price
        "list_price": "string" // Balance deduction list price
      },
      "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
      "updated_at": 1722769557708, // Task update time, Unix timestamp, unit: ms
      "watermark_info": { "enabled": boolean },
      "task_result": {
        "result_type": "single",
        "images": [
          {
            "index": 0, // Image number
            "url": "string", // URL for generated image, anti-hotlinking format (Generated images/videos will be cleared after 30 days. Please save promptly.)
            "watermark_url": "string" // Watermarked image download URL
          }
        ],
        "series_images": [
          {
            "index": 0, // Series-image sequence number
            "url": "string", // URL for generated image, anti-hotlinking format
            "watermark_url": "string" // Watermarked image download URL
          }
        ]
      }
    }
  ]
}
```
