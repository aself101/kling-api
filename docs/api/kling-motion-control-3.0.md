> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Motion Control 3.0

> Source: https://kling.ai/document-api/api/video/motion-control
> Locale: en
> Current Tab: Motion Control 3.0
> Sibling Tabs: Motion Control 3.0 / Motion Control 2.6
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Create Task

### API Overview

- Method: `POST`
- Path: `/motion-control/kling-3.0`
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
| `contents` | array | Yes | - | - | Reference input collection (prompt, appearance reference image, motion reference video, Element) |
| `contents[].type` | string | Yes | - | `prompt`, `image`, `video`, `element` | Input type. Supports: prompt, appearance reference image, motion reference video, Element |
| `settings` | object | No | - | - | Output configuration related parameters, such as facial orientation, clarity, duration, etc |
| `settings.character_orientation` | string | Yes | - | `image`, `video` | Character orientation in the generated video. Choose to match the image or the video |
| `settings.audio` | string | No | `original` | `original`, `off` | Whether to generate audio for the video |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p` | The resolution of the generated video |
| `options` | object | No | - | - | General configurations, such as callback address, whether to include watermark, etc |
| `options.callback_url` | string | No | - | - | Callback URL for task result notifications. If configured, the server sends a notification when the task status changes |
| `options.external_task_id` | string | No | - | - | Custom task ID |
| `options.watermark_info` | object | No | - | - | Whether to also generate a watermarked result |

#### Request Body Field Notes

- `contents`: The reference format is as follows, and the parameter description is detailed in the following text:
- `contents`: ```json
  "contents": [
    {
      "type": "prompt",
      "text": "string"
    },
    {
      "type": "image",
      "url": "string"
    },
    {
      "type": "video",
      "url": "string"
    },
    {
      "type": "element",
      "element_id": "string",
      "id": "string"
    }
  ]
  ```
- `contents[].type`: `prompt`: Prompt identifier.
  - `image`: Appearance reference image identifier.
  - `video`: Motion reference video identifier.
  - `element`: Element identifier.
- `contents[].type.prompt`: You can add elements to the screen and achieve motion effects through prompt. Please refer to the ["Motion Control" user guide](https://kling.ai/quickstart/motion-control-user-guide) for details.
- `contents[].type.prompt`: Defined in JSON format, as follows:
- `contents[].type.prompt`: ```json
  {
    "type": "prompt", // input type, fixed parameter value: prompt; required
    "text": "string" // Text prompt, which can include positive and negative descriptions, with content not exceeding 2500 characters; required
  }
  ```
- `contents[].type.image`: Image requirements:
    - Character proportions should match the reference video as closely as possible. Avoid driving a half-body character with full-body motion.
    - The character's upper body or full body and head must be clearly visible, unobstructed.
    - Avoid extreme orientations (e.g., upside down, lying flat). The character must not occupy too small a proportion of the frame.
    - Supports realistic and stylized characters (humans, humanoid animals, some pure animals, characters with humanoid body proportions).
- `contents[].type.image`: Defined in JSON format, as follows:
- `contents[].type.image`: ```json
  {
    "type": "image", // Reference image input identifier, fixed parameter value: image; required
    "url": "string", // The content of the input can be provided via URL or Base64; simply fill in the relevant information; required
  }
  ```
- `contents[].type.image`: Image format support: .jpg, .jpeg, .png
- `contents[].type.image`: The size of the image file cannot exceed 50MB
- `contents[].type.image`: The width and height of the image must be no less than 300px, and the aspect ratio of the image should fall within the range of 1:2.5 to 2.5:1
- `contents[].type.video`: The video content must meet the following requirements:
    - The character's upper body or full body must be clearly visible, including all limbs and the head. Avoid occlusion.
    - It is recommended to upload a motion video with one person. If there are two or more people, the motion of the character occupying the largest proportion of the frame will be used for generation.
    - Real-person motion is recommended. Some stylized characters or humanoids with acceptable limb proportions may also be supported.
    - The motion video should be a continuous single take, with the character always appearing in the frame. Avoid cuts, camera movement, etc.; otherwise, the video may be trimmed.
    - Avoid overly fast motions. Relatively smooth and stable motions usually produce better results.
- `contents[].type.video`: If the motion is difficult or fast, there is a certain probability that the generated result will be shorter than the uploaded video, because the model can only extract the valid motion duration for generation. Generation is possible as long as at least 3 seconds of usable continuous motion can be extracted. Deduction is calculated based on the output video duration.
- `contents[].type.video`: The system will validate the video content. If there is an issue, information such as an error code will be returned.
- `contents[].type.video`: Defined in JSON format, as follows:
- `contents[].type.video`: ```json
  {
    "type": "string", // Input type, fixed value: video; Required.
    "url": "string" // Material URL; Required.
  }
  ```
- `contents[].type.video`: The minimum video duration is 3 seconds. The maximum duration depends on character_orientation:
    - When the character orientation is consistent with the character in the video, the video can be up to 30 seconds long.
    - When the character orientation is consistent with the character in the image, the video can be up to 10 seconds long.
- `contents[].type.video`: Supported video formats: .mp4 / .mov.
- `contents[].type.video`: The video file size must not exceed 100 MB.
- `contents[].type.video`: The video width and height must be between 340 px inclusive and 3850 px inclusive.
- `contents[].type.element`: Defined in JSON format, as follows:
- `contents[].type.element`: ```json
  {
    "type": "element", // Input type, fixed value: element; Required.
    "element_id": "string", // Element ID, system-generated, returned by the Element API; Required.
    "id": "string" // Input index ID, used to reference in prompt; must be unique within the task; Required.
  }
  ```
- `contents[].type.element`: When using an Element, the generated video always follows the character orientation from the reference video.
- `contents[].type.element`: At most 1 element can be specified.
- `settings.character_orientation`: `image`: Matches the character orientation in the reference image. Reference video duration must not exceed 10s.
  - `video`: Matches the character orientation in the reference video. Reference video duration must not exceed 30s.
  - When using an Element, the generated video always follows the character orientation from the reference video.
- `settings.audio`: `original`: The generated video retains the original sound of the reference video.
  - `off`: The generated video has no audio.
- `settings.resolution`: `720p`: Output video with a resolution of 720P.
  - `1080p`: Output video with a resolution of 1080P.
- `options`: ```json
  "options": {
    "callback_url": "https://example.com/cb", // Callback URL for task result notifications. If set, the server sends a callback when the task status changes. See "Callback Protocol" for the message schema.
    "external_task_id": "string", // Custom task ID, which can be used for querying and will not overwrite the system-generated task ID, must be unique within the scope of the account.
    "watermark_info": {
      "enabled": false // Whether to include a watermarked result. true = include watermark, false = no watermark. Default: false.
    }
  }
  ```
- `options.callback_url`: See [Callback Protocol](https://kling.ai/document-api/api/get-started/callbacks) for the message schema.
- `options.external_task_id`: Users can provide a Custom task ID, which does not overwrite the system-generated task ID. It can be used to query task status.
- `options.external_task_id`: Please note that the Custom task ID must be unique within a single user account.
- `options.watermark_info`: Controlled by the enabled parameter, the specific object format is as follows:
- `options.watermark_info`: ```json
  "watermark_info": {
    "enabled": boolean // true includes watermark; false excludes watermark
  }
  ```
- `options.watermark_info`: Custom watermark is not supported at this time.

### Request Example

```bash
curl --location 'https://api-singapore.klingai.com/motion-control/kling-3.0' \
--header 'Authorization: Bearer {apikey}' \
--header 'Content-Type: application/json' \
--data '{
    "contents": [
        {
            "type": "prompt",
            "text": "The girl is wearing a loose gray T-shirt and denim shorts"
        },
        {
            "type": "image",
            "url": "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/35d77e27300cf5e8995704cd858d759c.png"
        },
        {
            "type": "video",
            "url": "https://v4-kling.kechuangai.com/kcdn/cdn-kcdn112452/kling-qa-test/dance_10s.mp4"
        }
    ],
    "settings": {
        "character_orientation": "video",
        "resolution": "1080p",
        "audio": "original"
    },
    "options": {
        "callback_url": "https://xxx/callback",
        "external_task_id": ""
    }
}'
```

### Response Example

```json
{
  "code": 0, // Error code. See Error Codes for details
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system
  "data": {
    "id": "string", // The task ID generated by the system
    "status": "string", // Task status, Enum values: submitted, processing, succeeded, failed
    "create_time": 1781080778802, // Task creation time, Unix timestamp, unit ms
    "update_time": 1781080794151, // Task update time, Unix timestamp, unit ms
    "external_id": "string" // The custom task ID for this task (if any)
  }
}
```

---

## Query Task (By task ID)

### API Overview

- Method: `GET`
- Path: `/tasks`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

> Note: The API currently supports querying async tasks only

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Query Params

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `task_ids` | string | No | - | - | The task ID defined by the system that needs to be queried |
| `external_task_ids` | string | No | - | - | The custom task ID that needs to be queried |

#### Query Params Field Notes

- `task_ids`: Request path parameter, fill the value directly in the request path
- `task_ids`: When querying a task, you can choose between two query methods: task_ids and external_task_ids, but you cannot use them simultaneously
- `task_ids`: Support batch queries, separated by ","
- `external_task_ids`: Request path parameter, fill the value directly in the request path
- `external_task_ids`: When querying a task, you can choose between two query methods: task_ids and external_task_ids, but you cannot use them simultaneously
- `external_task_ids`: Support batch queries, separated by ","

### Request Example

```bash
curl --location 'https://api-singapore.klingai.com/tasks?external_task_ids=123' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer {apikey}'
```

### Response Example

```json
{
  "code": 0, // Error code. See Error Codes for details
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data": [
    {
      "id": "893605946402811985", // The task ID being queried
      "status": "string", // Task status, Enum values: submitted, processing, succeeded, failed
      "message": "string", // Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
      "create_time": 1781080778802, // Task creation time, Unix timestamp, unit ms
      "update_time": 1781080794151, // Task update time, Unix timestamp, unit ms
      "external_id": "string", // The custom task ID for this task (if any)
      "outputs": [
        {
          "type": "video", // When the generated result is "video", the return value and related fields will vary depending on the type of generated content; List values for each content type: image, video, audio, element, voice
          "id": "string", // Video ID, generated by the system
          "url": "string", // URL for generating result, hotlink protection format(To ensure information security, generated results will be cleared after 30 days. Please make sure to save them promptly.)
          "watermark_url": "string", // URL for generating result with watermark, hotlink protection format
          "duration": "string" // The duration of the generated video, in seconds
        },
        {
          "type": "image", // When the generated result is "image", the return value and related fields will vary depending on the type of generated content; List values for each content type: image, video, audio, element, voice
          "url": "string", // URL for generating result, hotlink protection format(To ensure information security, generated results will be cleared after 30 days. Please make sure to save them promptly.)
          "watermark_url": "string", // Image download URL with watermark, anti-theft link format
          "group_id": "string" // Only appears when generating grouped images, used to mark grouping relationships
        },
        {
          "type": "audio", // When the generated result is "audio", the return value and related fields will vary depending on the type of generated content; List values for each content type: image, video, audio, element, voice
          "id": "string", // Audio ID, generated by the system
          "mp3_url": "string", // URL for generating result, MP3 & hotlink protection format(To ensure information security, generated results will be cleared after 30 days. Please make sure to save them promptly.)
          "wav_url": "string", // URL for generating result, WAV & hotlink protection format(To ensure information security, generated results will be cleared after 30 days. Please make sure to save them promptly.)
          "mp3_duration": "string", // The duration of the generated MP3 format audio, in seconds
          "wav_duration": "string" // The duration of the generated WAV format audio, in seconds
        },
        {
          "type": "voice", // When the generated result is "voice", the return value and related fields will vary depending on the type of generated content; List values for each content type: image, video, audio, element, voice
          "id": "string", // Audio ID, generated by the system
          "name": "string", // Audio name
          "url": "string", // Material download link
          "owned_by": "string", // Voice source, kling is the official voice library, and the number is the creator ID
          "status": "succeeded" // The status of the element can be divided into normal status and deleted status. The enumeration values are: succeeded, deleted
        },
        {
          "type": "element", // When the generated result is "element", the return value and related fields will be different for different generated content types; List values for each content type: image, video, audio, element, voice
          "id": "string", // Element ID, generated by the system
          "name": "string", // Element name
          "description": "string", // Element description
          "element_type": "string", // Element type, divided into video character element and multi-image element, enumeration values are: video_character_elements and multi_image_elements
          "references": [ // Related materials of element
            {
              "type": "image", // When returning 'image' materials, the enumeration values for each content type are: image, video, voice
              "role": "string", // Image reference material attributes are divided into frontal reference images and other reference images, with enumeration values of frontal and reference, respectively
              "url": "string" // Material download link
            },
            {
              "type": "video", // When returning "video" materials, the enumeration values for each content type are: image, video, voice
              "role": "refer", // Video reference material attribute, fixed value: refer
              "url": "string" // Material download link
            },
            {
              "type": "voice", // When "voice" material is returned, enumeration values of each content type: image, video, voice
              "role": "refer", // Voice reference material attribute, fixed value: refer
              "url": "string", // Material download link
              "id": "string", // Voice ID
              "name": "string", // Voice name
              "owned_by": "string" // Voice source. kling means official voice library; numbers are creator IDs
            }
          ],
          "owned_by": "string", // Element source. kling means official voice library; numbers are creator IDs
          "status": "string", // The status of the element can be divided into normal status and deleted status. The enumeration values are: succeeded, deleted
          "tags": [ // Element label related information
            {
              "id": 1, // Tag ID
              "name": "string", // Tag name
              "description": "string" // Tag description
            }
          ]
        }
      ],
      "billing": [
        {
          "charge_type": "string", // Consumption account type: If the consumption is of balance, the parameter value is "cash"; if it is of resource package, the parameter value is "unit"
          "cash_type": "string", // Balance type, only exists in the consumption limit scenario (charge_type=cash). If the consumption is the official quota, the parameter value is balance. If the consumption is the test quota, the parameter value is test_balance
          "amount": "string", // Deduction amount; In the balance deduction situation (charge_type=cash), it represents the discount price deducted from the balance, and in the resource package deduction situation (charge_type=unit), it represents the deduction amount of units; decimal system
          "currency": "string", // Consumption unit, which only exists in the consumption balance scenario (charge_type=cash), with a fixed parameter value of CNY/USD
          "package_type": "string", // Consumable resource bundle type, which only exists in the consumable resource bundle scenario (charge_type=unit), with fixed enumeration values: video, image, audio
          "list_price": "string" // Balance deduction list price only exists in the consumption limit scenario (charge_type=cash)
        }
      ]
    }
  ]
}
```

---

## Query Task (By Cursor)

### API Overview

- Method: `POST`
- Path: `/tasks`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

> Note: The API currently supports querying async tasks only

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Request Body

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `start_time` | string | No | `end_time - 30 days` | - | Start time for task creation filtering |
| `end_time` | string | No | `current time` | - | End time for task creation filtering |
| `cursor` | string | No | - | - | Continuation cursor, i.e. query starting point |
| `limit` | int | No | `100` | - | Query the number of tasks |
| `filters` | array | No | - | - | Query task filtering criteria, such as task status and function type |
| `filters[].key` | string | No | - | `status`, `product_type` | Filtering dimensions, currently supporting filtering based on task status and other conditions |
| `filters[].values` | array | No | - | - | Filter value |

#### Request Body Field Notes

- `start_time`: Unix timestamp, in milliseconds
- `start_time`: The default value is end_time - 30 days
- `start_time`: Start time must be earlier than end time
- `end_time`: The default value is current time
- `end_time`: Unix timestamp, in milliseconds
- `end_time`: End time must be later than start time
- `cursor`: Use the next_cursor returned by the previous query
- `cursor`: When cursor is not empty, start_time and end_time are ignored
- `limit`: Maximum value: 500
- `filters`: Load with key/value format:
  ```json
  "filters": [
    {
      "key": "status", // Filter dimension by task status, fixed value: status
      "values": ["succeeded"]
    },
    {
      "key": "product_type", // Filter dimension by function type, fixed value: product_type
      "values": ["video"]
    }
  ]
  ```
- `filters[].key`: status: filter by task status
  - product_type: filter by function type
- `filters[].values`: status: submitted, processing, succeeded, failed
- `filters[].values`: product_type: video, image, try_on

### Request Example

```bash
curl --location 'https://api-singapore.klingai.com/tasks' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer {apikey}' \
  --data '{
    "start_time": "1781193600000",
    "end_time": "1781516352968",
    "cursor": "",
    "limit": 500,
    "filters": [
      {
        "key": "status",
        "values": ["succeeded"]
      },
      {
        "key": "product_type",
        "values": ["video"]
      }
    ]
  }'
```

### Response Example

```json
{
  "code": 0, // Error code. See Error Codes for details
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system
  "data": {
    "result": [
      {
        "id": "string", // The task ID being queried
        "status": "string", // Task status, Enum values: submitted, processing, succeeded, failed
        "message": "string", // Task status information, displaying the failure reason when the task fails
        "create_time": 1781080778802, // Task creation time, Unix timestamp, unit ms
        "update_time": 1781080794151, // Task update time, Unix timestamp, unit ms
        "external_id": "string", // The custom task ID for this task (if any)
        "outputs": [
        {
          "type": "video", // When the generated result is "video", the return value and related fields will vary depending on the type of generated content; List values for each content type: image, video, audio, element, voice
          "id": "string", // Video ID, generated by the system
          "url": "string", // URL for generating result, hotlink protection format(To ensure information security, generated results will be cleared after 30 days. Please make sure to save them promptly.)
          "watermark_url": "string", // URL for generating result with watermark, hotlink protection format
          "duration": "string" // The duration of the generated video, in seconds
        },
        {
          "type": "image", // When the generated result is "image", the return value and related fields will vary depending on the type of generated content; List values for each content type: image, video, audio, element, voice
          "url": "string", // URL for generating result, hotlink protection format(To ensure information security, generated results will be cleared after 30 days. Please make sure to save them promptly.)
          "watermark_url": "string", // Image download URL with watermark, anti-theft link format
          "group_id": "string" // Only appears when generating grouped images, used to mark grouping relationships
        },
        {
          "type": "audio", // When the generated result is "audio", the return value and related fields will vary depending on the type of generated content; List values for each content type: image, video, audio, element, voice
          "id": "string", // Audio ID, generated by the system
          "mp3_url": "string", // URL for generating result, MP3 & hotlink protection format(To ensure information security, generated results will be cleared after 30 days. Please make sure to save them promptly.)
          "wav_url": "string", // URL for generating result, WAV & hotlink protection format(To ensure information security, generated results will be cleared after 30 days. Please make sure to save them promptly.)
          "mp3_duration": "string", // The duration of the generated MP3 format audio, in seconds
          "wav_duration": "string" // The duration of the generated WAV format audio, in seconds
        },
        {
          "type": "voice", // When the generated result is "voice", the return value and related fields will vary depending on the type of generated content; List values for each content type: image, video, audio, element, voice
          "id": "string", // Audio ID, generated by the system
          "name": "string", // Audio name
          "url": "string", // Material download link
          "owned_by": "string", // Voice source, kling is the official voice library, and the number is the creator ID
          "status": "succeeded" // The status of the element can be divided into normal status and deleted status. The enumeration values are: succeeded, deleted
        },
        {
          "type": "element", // When the generated result is "element", the return value and related fields will be different for different generated content types; List values for each content type: image, video, audio, element, voice
          "id": "string", // Element ID, generated by the system
          "name": "string", // Element name
          "description": "string", // Element description
          "element_type": "string", // Element type, divided into video character element and multi-image element, enumeration values are: video_character_elements and multi_image_elements
          "references": [ // Related materials of element
            {
              "type": "image", // When returning 'image' materials, the enumeration values for each content type are: image, video, voice
              "role": "string", // Image reference material attributes are divided into frontal reference images and other reference images, with enumeration values of frontal and reference, respectively
              "url": "string" // Material download link
            },
            {
              "type": "video", // When returning "video" materials, the enumeration values for each content type are: image, video, voice
              "role": "refer", // Video reference material attribute, fixed value: refer
              "url": "string" // Material download link
            },
            {
              "type": "voice", // When "voice" material is returned, enumeration values of each content type: image, video, voice
              "role": "refer", // Voice reference material attribute, fixed value: refer
              "url": "string", // Material download link
              "id": "string", // Voice ID
              "name": "string", // Voice name
              "owned_by": "string" // Voice source. kling means official voice library; numbers are creator IDs
            }
          ],
          "owned_by": "string", // Element source. kling means official voice library; numbers are creator IDs
          "status": "string", // The status of the element can be divided into normal status and deleted status. The enumeration values are: succeeded, deleted
          "tags": [ // Element label related information
            {
              "id": 1, // Tag ID
              "name": "string", // Tag name
              "description": "string" // Tag description
            }
          ]
        }
      ],
        "billing": [
          {
            "charge_type": "string", // Consumption account type: cash for balance, unit for resource package
            "cash_type": "string", // Balance type, only exists in the consumption limit scenario (charge_type=cash). If the consumption is the official quota, the parameter value is balance. If the consumption is the test quota, the parameter value is test_balance
            "amount": "string", // Deduction amount; In the balance deduction situation (charge_type=cash), it represents the discount price deducted from the balance, and in the resource package deduction situation (charge_type=unit), it represents the deduction amount of units; decimal system
            "currency": "string", // Consumption unit, which only exists in the consumption balance scenario (charge_type=cash), with a fixed parameter value of CNY/USD
            "package_type": "string", // Consumable resource bundle type, which only exists in the consumable resource bundle scenario (charge_type=unit), with fixed enumeration values: video, image, audio
            "list_price": "string" // Balance deduction list price only exists in the consumption limit scenario (charge_type=cash)
          }
        ]
      }
    ],
    "count": 1, // Number of query results
    "next_cursor": "string", // Cursor for querying subsequent results
    "has_more": true // Whether there are more results based on cursor information
  }
}
```
