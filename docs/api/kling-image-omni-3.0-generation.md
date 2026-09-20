> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Image Generation

> Source: https://kling.ai/document-api/api/image/3-0-omni/image-generation
> Locale: en
> Current Tab: Image Generation
> Sibling Tabs: Image Generation / Omni Image Generation / Element Management
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Create Task

### API Overview

- Method: `POST`
- Path: `/v1/images/generations`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

> Please note that in order to maintain naming consistency, the original model field has been changed to model_name, so in the future, please use this field to specify the version of the model that needs to be called.
>
> At the same time, we keep the behavior forward-compatible. If you continue to use the original model field, it will not have any impact on the interface call, there will not be any exception, which is equivalent to the default behavior when model_name is empty (i.e., call the V1 model).

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Request Body

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `model_name` | string | No | `kling-v3` | `kling-v2-1`, `kling-v3` | Model Name |
| `prompt` | string | Yes | - | - | Positive text prompt |
| `negative_prompt` | string | No | - | - | Negative text prompt |
| `image` | string | No | - | - | Reference Image |
| `image_reference` | string | No | - | `subject`, `face` | Image reference type |
| `image_fidelity` | float | No | `0.5` | - | Face reference intensity for user-uploaded images during generation |
| `human_fidelity` | float | No | `0.45` | - | Facial reference intensity, refers to the similarity of the facial features of the person in the reference image |
| `element_list` | array | No | - | - | Reference element list based on element library ID |
| `element_list[].element_id` | long | Yes | - | - | Element ID |
| `resolution` | string | No | `1k` | `1k`, `2k` | Image generation resolution |
| `n` | int | No | `1` | - | Number of generated images |
| `aspect_ratio` | string | No | `16:9` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9` | Aspect ratio of the generated images (width:height) |
| `watermark_info` | object | No | - | - | Whether to generate watermarked results simultaneously |
| `callback_url` | string | No | - | - | The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes. |
| `external_task_id` | string | No | - | - | Customized Task ID |

#### Request Body Field Notes

- `prompt`: Cannot exceed 2500 characters
- `negative_prompt`: Cannot exceed 2500 characters
- `negative_prompt`: Note: In the Image-to-Image scenario (when the "image" field is not empty), negative prompts are not supported.
- `image`: Support inputting image Base64 encoding or image URL (ensure accessibility)
- `image`: Base64 Encoding Note:
   Please note, if you use the Base64 method, make sure all image data parameters you pass are in Base64 encoding format. When using Base64, do NOT add any prefix like `data:image/png;base64,`. Only provide the Base64-encoded string.
  
  Correct:
  ```plaintext
  iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
  
  Incorrect:
  ```plaintext
  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `image`: Supported image formats: .jpg / .jpeg / .png
- `image`: File size: ≤10MB, dimensions: min 300px, aspect ratio: 1:2.5 ~ 2.5:1
- `image`: Required when image_reference parameter is not empty
- `image_reference`: `subject`: character feature reference, `face`: character appearance reference
- `image_reference`: When using `face`, the uploaded image must contain only one face
- `image_fidelity`: Value range: [0, 1], The larger the value, the stronger the reference intensity
- `image_fidelity`: > Only kling-v2-1 supports this parameter
- `human_fidelity`: Only takes effect when the image_reference parameter is subject
- `human_fidelity`: Value range: [0, 1], The larger the value, the stronger the reference intensity
- `human_fidelity`: > Only kling-v2-1 supports this parameter
- `element_list`: Load with key:value format as follows:
  ```json
  "element_list":[
    { "element_id": long },
    { "element_id": long }
  ]
  ```
- `element_list`: The amount of reference element is related to the amount of reference image, the sum of the amount of reference element and the amount of reference image shall not exceed 10.
- `resolution`: `1k`: 1K standard, `2k`: 2K high-res
- `resolution`: > Different model versions support varying ranges. For details, refer to the [Capability Map](https://kling.ai/document-api/guides/capability-map/image)
- `n`: Value range: [1, 9]
- `aspect_ratio`: > Different model versions support varying ranges. For details, refer to the [Capability Map](https://kling.ai/document-api/guides/capability-map/image)
- `watermark_info`: Defined by the enabled parameter, format: 
  ```json
    "watermark_info": { "enabled": boolean } 
  ```
- `watermark_info`: true: generate watermarked result, false: do not generate
- `watermark_info`: Custom watermarks are not currently supported
- `callback_url`: For specific message schema, see [Callback Protocol](https://kling.ai/document-api/api/get-started/callbacks)
- `external_task_id`: Will not overwrite system-generated task ID, but supports querying task by this ID
- `external_task_id`: Please note that the customized task ID must be unique within a single user account.

### Request Example

```bash
curl --request POST \
  --url https://api-singapore.klingai.com/v1/images/generations \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "model_name": "kling-v2-1",
    "prompt": "Generate a Pixar-style puppy",
    "negative_prompt": "",
    "image": "https://p1-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/dog.png",
    "n": 2,
    "external_task_id": "",
    "callback_url": ""
}'
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
    "task_info": { // Task creation parameters
      "external_task_id": "string" // Customer-defined task ID
    },
    "created_at": 1722769557708, // Task creation time, Unix timestamp, ms
    "updated_at": 1722769557708 // Task update time, Unix timestamp, ms
  }
}
```

---

## Query Task (Single)

### API Overview

- Method: `GET`
- Path: `/v1/images/generations/{id}`
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
| `task_id` | string | Yes | - | - | The task ID for image generation. Request path parameter, directly fill the value in the request path. |
| `external_task_id` | string | No | - | - | Customized Task ID for audio generation |

#### Path Params Field Notes

- `external_task_id`: The external_task_id filled in when creating the task. You can choose to query by external_task_id or task_id
  - When creating a task, you can choose to query by external_task_id or task_id.

### Request Example

```bash
curl --request GET \
  --url https://api-singapore.klingai.com/v1/images/generations/{id} \
  --header 'Authorization: Bearer <token>'
```

### Response Example

```json
{
  "code": 0, // Error codes; Specific definitions can be found in Error codes
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data": {
    "task_id": "string", // Task ID, generated by the system
    "task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed
    "task_status_msg": "string", // Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
    "final_unit_deduction": "string", // The deduction units of task
    "final_balance_deduction": { // Balance deduction information
      "quota": "string", // Balance deduction discount price
      "list_price": "string" // Balance deduction list price
    },
    "watermark_info": {
      "enabled": boolean
    },
    "task_info": { // Task creation parameters
      "external_task_id": "string" // Customer-defined task ID
    },
    "created_at": 1722769557708, // Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708, // Task update time, Unix timestamp, unit ms
    "task_result": {
      "images": [
        {
          "index": 0, // Image Number, 0-9
          "url": "string", // URL for generating images, such as: https://h1.inkwai.com/bs2/upload-ylab-stunt/1fa0ac67d8ce6cd55b50d68b967b3a59.png(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
          "watermark_url": "string" // Watermarked image download URL, anti-leech format
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
- Path: `/v1/images/generations`
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
  --url 'https://api-singapore.klingai.com/v1/images/generations?pageNum=1&pageSize=30' \
  --header 'Authorization: Bearer <token>'
```

### Response Example

```json
{
  "code": 0, // Error codes; Specific definitions can be found in Error codes
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data": [
    {
      "task_id": "string", // Task ID, generated by the system
      "task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed
      "task_status_msg": "string", // Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
      "final_unit_deduction": "string", // The deduction units of task
      "final_balance_deduction": { // Balance deduction information
        "quota": "string", // Balance deduction discount price
        "list_price": "string" // Balance deduction list price
      },
      "watermark_info": {
        "enabled": boolean
      },
      "task_info": { // Task creation parameters
        "external_task_id": "string" // Customer-defined task ID
      },
      "created_at": 1722769557708, // Task creation time, Unix timestamp, unit ms
      "updated_at": 1722769557708, // Task update time, Unix timestamp, unit ms
      "task_result": {
        "images": [
          {
            "index": 0, // Image Number, 0-9
            "url": "string", // URL for generating images, such as: https://h1.inkwai.com/bs2/upload-ylab-stunt/1fa0ac67d8ce6cd55b50d68b967b3a59.png(To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
            "watermark_url": "string" // Watermarked image download URL, anti-leech format
          }
        ]
      }
    }
  ]
}
```
