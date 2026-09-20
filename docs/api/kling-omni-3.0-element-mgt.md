> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Element Management

> Source: https://kling.ai/document-api/api/video/3-0-omni/elements
> Locale: en
> Current Tab: Element Management
> Sibling Tabs: Text to Video / Image to Video / Omni Video Generation / Motion Control / Element Management / Voice Management
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Create Element

### API Overview

- Method: `POST`
- Path: `/v1/general/advanced-custom-elements`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

> The service related to creating entities has been upgraded to a brand new version. If you need to browse the old version, please proceed to:[Kling AI (OLD VERSION) ELEMENTS API Specification](https://ksurl.cn/QYFWJef0)

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Request Body

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `element_name` | string | Yes | - | - | Element Name |
| `element_description` | string | Yes | - | - | Element Description |
| `reference_type` | string | Yes | - | `video_refer`, `image_refer` | Reference Method |
| `element_image_list` | object | No | `None` | - | The main reference image allows for the setting of the element and its details through multiple images. |
| `element_video_list` | object | No | `None` | - | The element is referenced by the video, and its details can be set through the video. |
| `element_voice_id` | string | No | `None` | - | The voice ID of element can be bound to existing tone colors in the tone library |
| `tag_list` | array | No | `None` | - | Configure tags for the subject, one subject can configure multiple tags. |
| `callback_url` | string | No | - | - | The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes. |
| `external_task_id` | string | No | - | - | Customized Task ID. Users can provide a customized task ID, which will not overwrite the system-generated task ID but can be used for task queries. Please note that the customized task ID must be unique within a single user account. |

#### Request Body Field Notes

- `element_name`: Must not exceed 20 characters.
- `element_description`: Must not exceed 100 characters.
- `reference_type`: video_refer: Video Character Elements, at this time, the subject's appearance will be defined with reference to element_video_list.
- `reference_type`: image_refer: Multi-Image Elements, whose appearance will be defined with reference to the element_image_list.
- `reference_type`: The scope of availability differs between entities customized through videos and those customized through images. Please refer to the capability map and parameter specifications for details.
- `element_image_list`: Include front reference images and reference images from other angles or close-ups: at least one frontal reference image (frontal_image), and 1 to 3 additional reference images (image_url) that differ from the front.
- `element_image_list`: Load with key:value format as follows:
- `element_image_list`: ```json
  "element_image_list": {
  "frontal_image": "image_url_0", 
  "refer_images": [{ "image_url": "image_url_1" }, ...] 
  }
  ```
- `element_image_list`: Supports inputting image Base64 encoding or image URL (ensure accessibility).
- `element_image_list`: Supported image formats: .jpg / .jpeg / .png. Image file size cannot exceed 10MB, dimensions not less than 300px, aspect ratio between 1:2.5 ~ 2.5:1.
- `element_image_list`: When reference_type is image_refer, this parameter is required.
- `element_video_list`: Audio videos can be uploaded. If the audio video contains human voice, it will trigger voice customization (customization + inclusion in voice library + binding with the element).
- `element_video_list`: Currently, only realistic-style humanoid figures can be customized through video.
- `element_video_list`: Required when referencing videos; invalid when referencing images.
- `element_video_list`: Structure: element_video_list: { refer_videos: [{ video_url: "video_url_1" }] }. Only .mp4/.mov formats. Duration 3s–8s, 1080P, aspect ratio 16:9 or 9:16. At most 1 video, size not exceeding 200MB. video_url must not be empty.
- `element_video_list`: ```json
  "element_video_list": {
  "refer_videos": [{ "video_url": "video_url_1" }, ...] 
  }
  ```
- `element_video_list`: Video-customized elements are only supported for kling-video-o3 and later models.
- `element_voice_id`: When the current parameter is empty, the current entity is not bound to a tone color.
- `element_voice_id`: When binding voices to multi-image elements, only character image elements or humanoid image elements are supported
- `element_voice_id`: The ID can be obtained through the voice-related API. For details, see [Voice Guide](https://kling.ai/document-api/api/video/3-0-omni/voice-customization)
- `tag_list`: Structure: tag_list: [{ tag_id: "o_101" }, { tag_id: "o_102" }, ...]. Tag ID and name: o_101 Hottest, o_102 Character, o_103 Animal, o_104 Item, o_105 Costume, o_106 Scene, o_107 Effect, o_108 Others.
- `tag_list`: ```json
  "tag_list": [ { "tag_id": "o_101" }, { "tag_id": "o_102" } ]
  ```
- `tag_list`: Tag and tag_id correspondence:
   | tag_id | tag_name |
   | ------- | -------- |
   | o_101   | Hottest     |
   | o_102   | Character |
   | o_103   | Animal     |
   | o_104   | Item     |
   | o_105   | Costume     |
   | o_106   | Scene     |
   | o_107   | Effect     |
   | o_108   | Others     |
- `callback_url`: For the specific message schema, see [Callback Protocol](https://kling.ai/document-api/api/get-started/callbacks)

### Response Example

```json
{
  "code": 0, //Error codes; specific definitions see Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system, for tracking and troubleshooting
  "data": {
    "task_id": "string", //Task ID, generated by the system
    "task_info": { //Task creation parameters
      "external_task_id": "string" //Customer-defined task ID
    },
    "task_status": "string", //Task status: submitted, processing, succeed, failed
    "created_at": 1722769557708, //Task creation time, Unix timestamp, ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, ms
  }
}
```

## Invocation Examples

### Create Multi-Image Elements

```Bash
curl --location 'https://xxx/v1/general/advanced-custom-elements/' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json\' \
--data '{
    "element_name": "xxx",
    "element_description": "xxx",
    "reference_type": "image_refer",
    "element_image_list": {
      "frontal_image": "xxx",
      "refer_images": [
        {"image_url": "xxx"},
        {"image_url": "xxx"}
      ]
    },
    "element_voice_id": string,
    "callback_url": "xxx",
    "external_task_id": "",
     "tag_list": [
        {
            "tag_id": "xxx"
        }
    ]
  }'
```

### Create Video Character Elements

```Bash
curl --location 'https://xxx/v1/general/advanced-custom-elements/' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json\' \
--data '{
    "element_name": "xxx",
    "element_description": "xxx",
    "reference_type": "video_refer",
    "element_video_list": {
        "refer_videos": [
            {
                "video_url": "xxx"
            }
        ]
    },
    "element_voice_id": string,
    "callback_url": "xxx",
    "external_task_id": "",
    "tag_list": [
        {
            "tag_id": "xxx"
        }
    ]
}'
```

---

## Query Custom Element (Single)

### API Overview

- Method: `GET`
- Path: `/v1/general/advanced-custom-elements/{id}`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

> The service related to creating entities has been upgraded to a brand new version. If you need to browse the old version, please proceed to:[Kling AI (OLD VERSION) ELEMENTS API Specification](https://ksurl.cn/QYFWJef0)

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Path Params

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `task_id` | string | Yes | - | - | The task ID of the element creation task. Request path parameter, directly fill the value in the request path. |
| `external_task_id` | string | No | - | - | Customized Task ID for audio generation |

#### Path Params Field Notes

- `external_task_id`: The external_task_id filled in when creating the task. You can choose to query by external_task_id or task_id
  - When creating a task, you can choose to query by external_task_id or task_id.

### Response Example

```json
{
  "code": 0, //Error codes; specific definitions see Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system
  "data": {
    "task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status: submitted, processing, succeed, failed
    "task_status_msg": "string", //Task status message, failure reason when failed
    "task_info": { //Task creation parameters
      "external_task_id": "string" //Customer-defined task ID
    },
    "task_result": {
      "elements": [
        {
          "element_id": 0,
          "element_name": "string",
          "element_description": "string",
          "reference_type": "video_refer",
          "element_image_list": {},
          "element_video_list": {},
          "element_voice_info": {
            "voice_id": "string", //Custom voice ID; globally unique
            "voice_name": "string", //Custom voice name
            "trial_url": "string", //Trial audio download URL
            "owned_by": "kling" //Voice source, kling is official, number is creator ID
          },
          "tag_list": [],
          "owned_by": "kling", //Element source, kling is official element library
          "status": "succeed" //Element status: succeed when normal, deleted when removed
        }
      ]
    },
    "final_unit_deduction": "string", //Final unit deduction for the task
    "final_balance_deduction": { // Balance deduction information
      "quota": "string", // Balance deduction discount price
      "list_price": "string" // Balance deduction list price
    },
    "created_at": 1722769557708, //Task creation time, Unix timestamp, ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, ms
  }
}
```

---

## Query Custom Element (List)

### API Overview

- Method: `GET`
- Path: `/v1/general/advanced-custom-elements`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

> The service related to creating entities has been upgraded to a brand new version. If you need to browse the old version, please proceed to:[Kling AI (OLD VERSION) ELEMENTS API Specification](https://ksurl.cn/QYFWJef0)

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

### Response Example

```json
{
  "code": 0, //Error codes; specific definitions see Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system
  "data": [
    {
      "task_id": "string", //Task ID, generated by the system
      "task_status": "string", //Task status: submitted, processing, succeed, failed
      "task_status_msg": "string", //Task status message
      "task_info": { "external_task_id": "string" }, //Task creation parameters
      "task_result": {
        "elements": [
          {
            "element_id": 0,
            "element_name": "string",
            "element_description": "string",
            "reference_type": "video_refer",
            "element_image_list": {},
            "element_video_list": {},
            "element_voice_info": {},
            "tag_list": [],
            "owned_by": "kling", //Element source
            "status": "succeed" //Element status: succeed, deleted
          }
        ]
      },
      "final_unit_deduction": "string", //Final unit deduction
      "final_balance_deduction": { // Balance deduction information
        "quota": "string", // Balance deduction discount price
        "list_price": "string" // Balance deduction list price
      },
      "created_at": 1722769557708, //Task creation time, Unix timestamp, ms
      "updated_at": 1722769557708 //Task update time, Unix timestamp, ms
    }
  ]
}
```

---

## Query Presets Element (List)

### API Overview

- Method: `GET`
- Path: `/v1/general/advanced-presets-elements`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

> The service related to creating entities has been upgraded to a brand new version. If you need to browse the old version, please proceed to:[Kling AI (OLD VERSION) ELEMENTS API Specification](https://ksurl.cn/QYFWJef0)

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

### Response Example

```json
{
  "code": 0, //Error codes; specific definitions see Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system
  "data": [
    {
      "task_id": "string", //Task ID, generated by the system
      "task_status": "string", //Task status: submitted, processing, succeed, failed
      "task_status_msg": "string", //Task status message
      "task_info": { "external_task_id": "string" }, //Task creation parameters
      "task_result": {
        "elements": [
          {
            "element_id": 0,
            "element_name": "string",
            "element_description": "string",
            "reference_type": "video_refer",
            "element_image_list": {},
            "element_video_list": {},
            "element_voice_info": {},
            "tag_list": [],
            "owned_by": "kling", //Element source
            "status": "succeed" //Element status: succeed, deleted
          }
        ]
      },
      "created_at": 1722769557708, //Task creation time, Unix timestamp, ms
      "updated_at": 1722769557708 //Task update time, Unix timestamp, ms
    }
  ]
}
```

---

## Delete Custom Element

### API Overview

- Method: `POST`
- Path: `/v1/general/delete-advanced-elements`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

> The services related to the delete custom element have been directly upgraded, eliminating the need to browse other documents

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Request Body

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `element_id` | string | Yes | - | - | The ID of the element to be deleted; only supports deleting custom elements. |

### Response Example

```json
{
  "code": 0, //Error codes; specific definitions see Error codes
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system
  "data": {
    "task_id": "string", //Task ID, generated by the system
    "task_status": "string" //Task status: submitted, processing, succeed, failed
  }
}
```
