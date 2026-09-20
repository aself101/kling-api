> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Omni Video Generation

> Source: https://kling.ai/document-api/api/video/3-0-omni/video-omni
> Locale: en
> Current Tab: Omni Video Generation
> Sibling Tabs: Text to Video / Image to Video / Omni Video Generation / Motion Control / Element Management / Voice Management
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Create Task

### API Overview

- Method: `POST`
- Path: `/omni-video/kling-3.0-omni`
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
| `contents` | array | Yes | - | - | Reference input collection (prompts, images, Elements, videos, etc.) |
| `contents[].type` | string | Yes | - | `prompt`, `first_frame`, `last_frame`, `refer_image`, `feature_video`, `base_video`, `element` | Input type. Supports: prompt, reference images, reference videos, Element |
| `settings` | object | No | - | - | Output configuration-related parameters, such as resolution, duration, etc |
| `settings.multi_shot` | boolean | No | `true` | - | Whether to generate multi-shot video |
| `settings.audio` | string | No | `off` | `native`, `original`, `off` | Whether to generate audio for the video |
| `settings.resolution` | string | No | `720p` | `720p`, `1080p`, `4k` | The resolution of the generated video |
| `settings.aspect_ratio` | string | No | `16:9` | `16:9`, `9:16`, `1:1` | The aspect ratio (width:height) of the generated video frames |
| `settings.duration` | int | No | `5` | `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`, `15` | Video duration in seconds |
| `options` | object | No | - | - | General configurations, such as callback address, whether to include watermark, etc |
| `options.callback_url` | string | No | - | - | Callback URL for task result notifications. If configured, the server sends a notification when the task status changes |
| `options.external_task_id` | string | No | - | - | Custom task ID |
| `options.watermark_info` | object | No | - | - | Whether to also generate a watermarked result |

#### Request Body Field Notes

- `contents`: The reference format is as follows, with detailed parameter descriptions provided below:
- `contents`: ```json
  "contents": [
    {
      "type": "prompt",
      "text": "string"
    },
    {
      "type": "first_frame",
      "url": "string",
      "id": "string"
    },
    {
      "type": "last_frame",
      "url": "string",
      "id": "string"
    },
    {
      "type": "refer_image",
      "url": "string",
      "id": "string"
    },
    {
      "type": "feature_video",
      "url": "string",
      "id": "string"
    },
    {
      "type": "base_video",
      "url": "string",
      "id": "string"
    },
    {
      "type": "element",
      "element_id": "string",
      "id": "string"
    }
  ]
  ```
- `contents[].type`: `prompt`: prompt word input identifier.
  - `first_frame`: first-frame input identifier.
  - `last_frame`: last frame input identifier.
  - `refer_image`: element reference image input identifier.
  - `feature_video`: feature reference video input identifier.
  - `base_video`: base video input identifier.
  - `element`: element input identifier.
- `contents[].type.prompt`: Defined in JSON format, as follows:
- `contents[].type.prompt`: ```json
  {
    "type": "prompt", // Input type, fixed parameter value: prompt; required
    "text": "string" // The content of the text prompt should not exceed 3072 characters in length, and it is recommended not to exceed 2500 characters; required
  }
  ```
- `contents[].type.prompt`: The prompt can be templated to meet different video generation requirements:
- `contents[].type.prompt`: > **The Kling 3.0 Omni model can achieve various capabilities through prompt and other content.**
  >
  > 
  > 1. Multi-shot video format: "shot n, m, words; shot n, m, words;" (separated by standard semicolons), where:
  >
  > 
  >
  >     a. n: shot sequence number (1–6 shots supported)
  >
  > 
  >
  >     b. m: shot duration in seconds (each shot ≥ 1s; sum of all shot durations must equal the total video duration)
  >
  > 
  >
  >     c. words: shot prompt (max 512 characters)
  >
  > 
  > 2. Specify an image, an Element, a video in the format of @xxx, such as @image_1, @Zhang, @video_1.
  >
  > 
  > 3. Avoid Element names that are substrings of each other, such as @Zhang and @ZhangSan.
  >
  > 
  > 4. Avoid using Element names that overlap with content in the prompt. For example, do not use @gmail as an Element name if the prompt contains "My email address is xxx@gmail.com".
  >
  > 
  > 5. For more information, please refer to: [Kling VIDEO 3.0 Omni Model User Guide](https://kling.ai/quickstart/klingai-video-3-omni-model-user-guide).
- `contents[].type.first_frame / last_frame / refer_image`: Images can be used as reference images for scenes, styles, etc., and can also be used as the first or last frame to generate videos.
- `contents[].type.first_frame / last_frame / refer_image`: Defined in JSON format, as follows:
- `contents[].type.first_frame / last_frame / refer_image`: ```json
  {
    "type": "string", // First-frame, last-frame, or reference image identifier. Must match enum values: first_frame, last_frame, refer_image; required
    "url": "string", // The input content can be provided through URL or base64; Simply fill in the relevant information directly; required
    "id": "string" // input index ID, used to specify in prompt, the current parameters in the same task must not be duplicated; optional
  }
  ```
- `contents[].type.first_frame / last_frame / refer_image`: Image format: .jpg, .jpeg, .png.
- `contents[].type.first_frame / last_frame / refer_image`: The size of the image file cannot exceed 50MB.
- `contents[].type.first_frame / last_frame / refer_image`: The width and height dimensions of the image should not be less than 300px, and the aspect ratio of the image should be between 1:2.5 and 2.5:1.
- `contents[].type.first_frame / last_frame / refer_image`: Image quantity limits depend on the number and type of reference elements:
    - No reference video + only multi-image elements: the total number of reference images and multi-image elements must not exceed 7.
    - No reference video + both video role elements and multi-image elements: the total number of reference images and multi-image elements must not exceed 4.
    - With a reference video + only multi-image elements: the total number of reference images and multi-image elements must not exceed 4.
    - When there is a reference video, video role elements and reference images are not supported at the same time.
- `contents[].type.first_frame / last_frame / refer_image`: When an image is used as the first frame or last frame:
    - Only “first frame only” and “first frame + last frame” are supported. “Last frame only” is not supported yet.
- `contents[].type.feature_video / base_video`: Defined in JSON format, as follows:
- `contents[].type.feature_video / base_video`: ```json
  {
    "type": "string", // Video input identifier. Must match enum values: feature_video, base_video; required
    "url": "string", // input content can be provided through URLs; Simply fill in the relevant information directly; required
    "id": "string" // input index ID, used to specify in prompt, the current parameter cannot be duplicated in the same task; optional
  }
  ```
- `contents[].type.feature_video / base_video`: Video format: .mp4, .mov.
- `contents[].type.feature_video / base_video`: The video file size cannot exceed 200MB.
- `contents[].type.feature_video / base_video`: The video duration should be between 3 seconds (inclusive) and 15.5 seconds (inclusive).
- `contents[].type.feature_video / base_video`: The width and height dimensions of the video should be between 700px (inclusive) and 4553px (inclusive), with a total pixel area not exceeding 8294400. The aspect ratio of the video should be between 0.4 and 2.
- `contents[].type.feature_video / base_video`: The video frame rate is based on 24fps to 60fps (the frame rate for generating videos is 24fps).
- `contents[].type.feature_video / base_video`: Maximum 1 reference video. After adding a reference video, add at most one video character element.
- `contents[].type.feature_video / base_video`: When using a video as a feature reference video:
    - Supports multi-shot videos, in which case the multi_shot parameter can only be true.
    - Native audio generation is not supported and the audio parameter can only be off in this case.
- `contents[].type.feature_video / base_video`: When base video is used as a video to be edited:
    - It does not support defining the first or last frame of a video.
    - It does not support generating multi-shot videos.
    - It does not support generating native audio, that is, the audio parameter value cannot be native.
- `contents[].type.element`: Defined in JSON format, as follows:
- `contents[].type.element`: ```json
  {
    "type": "element", // Input type, fixed parameter value: element; required
    "element_id": "string", // The element ID, generated by the system, is returned by querying the element related API; required
    "id": "string" // input index ID, used to specify in prompt, the current parameter cannot be duplicated in the same task; required
  }
  ```
- `contents[].type.element`: Elements are divided into video-character Elements (customized from video) and multi-image Elements (customized from images). Their applicable scopes differ. Element count limits depend on Element type, reference image count, and whether a reference video is present.
- `contents[].type.element`: The upper limit of the number of element is related to the type of element, the number of reference pictures, the presence or absence of reference videos and other factors, among which:
    - When using the first frame or first and last frames to generate video, a maximum of 3 element are supported.
    - When there is no reference video+only multi-image element, the sum of the number of reference pictures and multi-image element shall not exceed 7.
    - When there is no reference video+only video character element, the number of video character element shall not exceed 3.
    - When there is no reference video+video character element and multi-image element, the number of video character element shall not exceed 3, and the sum of the number of reference pictures and multi-image element shall not exceed 4.
    - When there is a reference video+only multi-image element, the sum of the number of reference pictures and multi-image element shall not exceed 4.
    - When there is reference video+only video character element, the number of video character element shall not exceed 1.
    - When there is a reference video, video character element and multi-image element are not supported at the same time.
- `contents[].type.element`: For more information about the official element, please refer to the [Kling Element Library User Guide](https://kling.ai/quickstart/klingai-element-library-3-user-guide).
- `settings.multi_shot`: When set to false, multi-shot prompts will not produce multi-shot output.
- `settings.audio`: `native`: The generated video includes native audio matching the visuals.
  - `original`: The generated video retains the original sound of the reference video.
  - `off`: The generated video has no audio.
- `settings.resolution`: `720p`: Output video with a resolution of 720P.
  - `1080p`: Output video with a resolution of 1080P.
  - `4k`: Output video with a resolution of 4K.
- `settings.aspect_ratio`: When there is no first frame or reference video, the current parameter is required.
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
curl --location 'https://api-singapore.klingai.com/omni-video/kling-3.0-omni' \
--header 'Authorization: Bearer {apikey}' \
--header 'Content-Type: application/json' \
--data '{
    "contents": [
        {
            "type": "prompt",
            "text": "Change the color of the parrot’s feathers to match the reference image. Keep all other elements of the video unchanged."
        }
    ],
    "settings": {
        "resolution": "1080p",
        "duration": 5,
        "audio": "native",
        "multi_shot": false
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

## More Scenario Examples

### Only prompt

```cURL
curl --location 'https://api-singapore.klingai.com/omni-video/kling-3.0-omni' \
--header 'Authorization: Bearer {apikey}' \
--header 'Content-Type: application/json' \
--data '{
    "contents": [
        {
            "type": "prompt",
            "text": "Change the color of the parrot’s feathers to match the reference image. Keep all other elements of the video unchanged."
        }
    ],
    "settings": {
        "resolution": "1080p",
        "duration": 5,
        "audio": "native",
        "multi_shot": false
    },
    "options": {
        "callback_url": "https://xxx/callback",
        "external_task_id": ""
    }
}'
```

### First_frame & refer_image

```cURL
curl --location 'https://api-singapore.klingai.com/omni-video/kling-3.0-omni' \
--header 'Authorization: Bearer {apikey}' \
--header 'Content-Type: application/json' \
--data '{
    "contents": [
        {
            "type": "prompt",
            "text": "Change the color of the parrot’s feathers to match the reference image. Keep all other elements of the video unchanged."
        },
        {
            "type": "first_frame",
            "url": "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/image_7.1.png",
            "id": "image_1"
        },
        {
            "type": "refer_image",
            "url": "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/image_7.1.png",
            "id": "image_2"
        }
    ],
    "settings": {
        "resolution": "1080p",
        "duration": 5,
        "audio": "native",
        "multi_shot": false
    },
    "options": {
        "callback_url": "https://xxx/callback",
        "external_task_id": ""
    }
}'
```

### First_frame & last_frame & element

```cURL
curl --location 'https://api-singapore.klingai.com/omni-video/kling-3.0-omni' \
--header 'Authorization: Bearer {apikey}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "contents": [
        {
            "type": "prompt",
            "text": "Change the color of the parrot’s feathers to match the reference image. Keep all other elements of the video unchanged."
        },
        {
            "type": "first_frame",
            "url": "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/image_7.1.png",
            "id": "image_1"
        },
        {
            "type": "last_frame",
            "url": "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/image_7.1.png",
            "id": "image_2"
        },
        {
            "type": "element",
            "element_id": "162",
            "id": "element_1"
        },
        {
            "type": "element",
            "element_id": "163",
            "id": "element_2"
        }
    ],
    "settings": {
        "resolution": "1080p",
        "duration": 5,
        "audio": "native",
        "multi_shot": true
    },
    "options": {
        "callback_url": "https://xxx/callback",
        "external_task_id": ""
    }
}'
```

### feature_video

```cURL
curl --location 'https://api-singapore.klingai.com/omni-video/kling-3.0-omni' \
--header 'Authorization: Bearer {apikey}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "contents": [
        {
            "type": "prompt",
            "text": "Change the color of the parrot’s feathers to match the reference image. Keep all other elements of the video unchanged."
        },
        {
            "type": "feature_video",
            "url": "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/video_7.1.mp4",
            "id": "video_1"
        }
    ],
    "settings": {
        "resolution": "4k",
        "audio": "off",
        "multi_shot": true
    },
    "options": {
        "callback_url": "https://xxx/callback",
        "external_task_id": ""
    }
}'
```

### base_video

```cURL
curl --location 'https://api-singapore.klingai.com/omni-video/kling-3.0-omni' \
--header 'Authorization: Bearer {apikey}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "contents": [
        {
            "type": "prompt",
            "text": "Change the color of the parrot’s feathers to match the reference image. Keep all other elements of the video unchanged."
        },
        {
            "type": "base_video",
            "url": "https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-tob-release_note/video_7.1.mp4",
            "id": "video_1"
        }
    ],
    "settings": {
        "resolution": "1080p",
        "audio": "original",
        "multi_shot": false
    },
    "options": {
        "callback_url": "https://xxx/callback",
        "external_task_id": ""
    }
}'
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
