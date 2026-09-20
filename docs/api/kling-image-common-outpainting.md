> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Outpainting

> Source: https://kling.ai/document-api/api/image/common/outpainting
> Locale: en
> Current Tab: Outpainting
> Sibling Tabs: AI Multi-Shot / Outpainting
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Create Task

### API Overview

- Method: `POST`
- Path: `/v1/images/editing/expand`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

Expand the image in any direction based on the original image.

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Request Body

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `image` | string | Yes | - | - | Reference Image |
| `up_expansion_ratio` | float | Yes | - | - | Expand upwards range; calculated based on multiples of the original image height |
| `down_expansion_ratio` | float | Yes | - | - | Expand downwards range; calculated based on multiples of the original image height |
| `left_expansion_ratio` | float | Yes | - | - | Expand leftwards range; calculated based on multiples of the original image width |
| `right_expansion_ratio` | float | Yes | - | - | Expand rightwards range; calculated based on multiples of the original image width |
| `prompt` | string | No | - | - | Positive text prompt |
| `n` | int | No | `1` | - | Number of generated images |
| `watermark_info` | object | No | - | - | Whether to generate watermarked results simultaneously |
| `callback_url` | string | No | - | - | The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes. |
| `external_task_id` | string | No | - | - | Customized Task ID |

#### Request Body Field Notes

- `image`: Supports image input as either Base64-encoded string or URL (ensure accessibility)
- `image`: Important: When using Base64, do NOT add any prefix like `data:image/png;base64,`. Submit only the raw Base64 string.
- `image`: Correct Base64 format:
  ```plaintext
  iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `image`: Incorrect Base64 format (with data: prefix):
  ```plaintext
  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `image`: Supported image formats: .jpg / .jpeg / .png
- `image`: Image file size must not exceed 10MB. Image dimensions must be at least 300px in width and height, aspect ratio: 1:2.5 ~ 2.5:1
- `up_expansion_ratio`: Value range: [0, 2]. The total area of the new image must not exceed 3 times that of the original image
- `up_expansion_ratio`: Example: If original height is 20 and value is 0.1, then:
    - The distance from the top edge of the original image to the top edge of the new image is 20 × 0.1 = 2, and the area within is the expansion range
- `down_expansion_ratio`: Value range: [0, 2]. The total area of the new image must not exceed 3 times that of the original image
- `down_expansion_ratio`: Example: If original height is 20 and value is 0.2, then:
    - The distance from the bottom edge of the original image to the bottom edge of the new image is 20 × 0.2 = 4, and the area within is the expansion range
- `left_expansion_ratio`: Value range: [0, 2]. The total area of the new image must not exceed 3 times that of the original image
- `left_expansion_ratio`: Example: If original width is 30 and value is 0.3, then:
    - The distance from the left edge of the original image to the left edge of the new image is 30 × 0.3 = 9, and the area within is the expansion range
- `right_expansion_ratio`: Value range: [0, 2]. The total area of the new image must not exceed 3 times that of the original image
- `right_expansion_ratio`: Example: If original width is 30 and value is 0.4, then:
    - The distance from the right edge of the original image to the right edge of the new image is 30 × 0.4 = 12, and the area within is the expansion range
- `prompt`: Cannot exceed 2500 characters
- `n`: Value range: [1, 9]
- `watermark_info`: Defined by the enabled parameter, format: 
  ```json
    "watermark_info": { "enabled": boolean } 
  ```
- `watermark_info`: true: generate watermarked result, false: do not generate
- `watermark_info`: Custom watermarks are not currently supported
- `callback_url`: For specific message schema, see [Callback Protocol](https://kling.ai/document-api/api/get-started/callbacks)
- `external_task_id`: Will not overwrite system-generated task ID, but supports querying task by this ID
- `external_task_id`: Must be unique within a single user account

### Request Example

```bash
curl --request POST \
  --url https://api-singapore.klingai.com/v1/images/editing/expand \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "up_expansion_ratio": 0.1495,
    "down_expansion_ratio": 0.1495,
    "left_expansion_ratio": 0.6547,
    "right_expansion_ratio": 0.6547,
    "prompt": "",
    "image": "https://p1-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/dog.png",
    "n": 2,
    "external_task_id": ""
  }'
```

### Response Example

```json
{
  "code": 0, // Error code; Specific definitions can be found in Error code
  "message": "string", // Error message
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data": {
    "task_id": "string", // Task ID, generated by the system
    "task_info": { // Task creation parameters
      "external_task_id": "string" // Customer-defined task ID
    },
    "task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed
    "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708 // Task update time, Unix timestamp, unit: ms
  }
}
```

## Example Code

```Python
import math

def calculate_expansion_ratios(width, height, area_multiplier, aspect_ratio):
    """
    Calculate top/bottom/left/right expansion ratios for image outpainting.

    Parameters:
    - width: Original image width
    - height: Original image height
    - area_multiplier: Multiplier for the outpainted area relative to original image
    - aspect_ratio: Width/height ratio for the outpainted area（width/height）

    Returns:
    - Formatted string with 4 decimal places, e.g."0.1495,0.1495,0.6547,0.6547"
    """
    # Calculate target total area
    target_area = area_multiplier * width * height

    # Calculate target height and width (maintaining aspect ratio)
    target_height = math.sqrt(target_area / aspect_ratio)
    target_width = target_height * aspect_ratio

    # Calculate expansion pixels
    expand_top = (target_height - height) / 2
    expand_bottom = expand_top
    expand_left = (target_width - width) / 2
    expand_right = expand_left

    # Calculate relative ratios
    top_ratio = expand_top / height
    bottom_ratio = expand_bottom / height
    left_ratio = expand_left / width
    right_ratio = expand_right / width

    # Format to 4 decimal places
    return f"{top_ratio:.4f},{bottom_ratio:.4f},{left_ratio:.4f},{right_ratio:.4f}"

# Example: Original 100x100, 3x area multiplier, 16:9 aspect ratio
print(calculate_expansion_ratios(100, 100, 3, 16/9))
# Output: "0.1495,0.1495,0.6547,0.6547"
```

---

## Query Task (Single)

### API Overview

- Method: `GET`
- Path: `/v1/images/editing/expand/{id}`
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
| `task_id` | string | Yes | - | - | The task ID generated by images. Request path parameter, directly fill the value in the request path. |
| `external_task_id` | string | No | - | - | Customized Task ID for audio generation |

#### Path Params Field Notes

- `external_task_id`: The external_task_id filled in when creating the task. You can choose to query by external_task_id or task_id
  - When creating a task, you can choose to query by external_task_id or task_id.

### Request Example

```bash
curl --request GET \
  --url https://api-singapore.klingai.com/v1/images/editing/expand/{id} \
  --header 'Authorization: Bearer <token>'
```

### Response Example

```json
{
  "code": 0, // Error code; Specific definitions can be found in Error code
  "message": "string", // Error message
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data": {
    "task_id": "string", // Task ID, generated by the system
    "task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed
    "task_status_msg": "string", // Task status message, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
    "task_info": { // Task creation parameters
      "external_task_id": "string" // Customer-defined task ID
    },
    "final_unit_deduction": "string", // Final unit deduction for the task
    "final_balance_deduction": { // Balance deduction information
      "quota": "string", // Balance deduction discount price
      "list_price": "string" // Balance deduction list price
    },
    "watermark_info": {
      "enabled": boolean
    },
    "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708, // Task update time, Unix timestamp, unit: ms
    "task_result": {
      "images": [
        {
          "index": 0, // Image index, 0-9
          "url": "string", // URL for generating images (To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
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
- Path: `/v1/images/editing/expand`
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
| `pageSize` | int | No | `30` | - | Data volume per page |

#### Query Params Field Notes

- `pageNum`: Value range: [1, 1000]
- `pageSize`: Value range: [1, 500]

### Request Example

```bash
curl --request GET \
  --url 'https://api-singapore.klingai.com/v1/images/editing/expand?pageNum=1&pageSize=30' \
  --header 'Authorization: Bearer <token>'
```

### Response Example

```json
{
  "code": 0, // Error code; Specific definitions can be found in Error code
  "message": "string", // Error message
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data": [
    {
      "task_id": "string", // Task ID, generated by the system
      "task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed
      "task_status_msg": "string", // Task status message, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
      "task_info": { // Task creation parameters
        "external_task_id": "string" // Customer-defined task ID
      },
      "final_unit_deduction": "string", // Final unit deduction for the task
      "final_balance_deduction": { // Balance deduction information
        "quota": "string", // Balance deduction discount price
        "list_price": "string" // Balance deduction list price
      },
      "watermark_info": {
        "enabled": boolean
      },
      "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
      "updated_at": 1722769557708, // Task update time, Unix timestamp, unit: ms
      "task_result": {
        "images": [
          {
            "index": 0, // Image index, 0-9
            "url": "string", // URL for generating images (To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
            "watermark_url": "string", // Watermarked image download URL, anti-hotlinking format
          }
        ]
      }
    }
  ]
}
```
