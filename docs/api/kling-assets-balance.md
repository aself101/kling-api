> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Balance Deduction Detail

> Source: https://kling.ai/document-api/api/assets/billing-deduction/balance
> Locale: en
> Current Tab: Balance Deduction Detail
> Sibling Tabs: Balance Deduction Detail / Unit Deduction Detail
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Balance Deduction Detail

### API Overview

- Method: `POST`
- Path: `/account/billing/balance`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data exchange format |
| `Authorization` | string | Yes | - | - | Authentication info. See API Authentication. |

### Request Body

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `start_time` | long | No | - | - | Start time for task creation filtering. |
| `end_time` | long | No | - | - | End time for task creation filtering. |
| `limit` | int | No | `500` | - | Query the number of tasks. |
| `filters` | array | No | - | - | Query task filtering dimensions, such as API Key Name. |
| `filters[].key` | string | Yes | - | `api_key_name` | Query task filtering dimensions, supporting: API Key Name. |
| `filters[].values` | array | Yes | - | - | Query criteria to be filtered. |
| `cursor` | string | No | - | - | Cursor for fetching additional results. |

#### Request Body Field Notes

- `start_time`: Unix timestamp, in milliseconds.
  - The start time must be earlier than the end time.
  - The current parameter is mutually exclusive with the cursor parameter:
    - Required when cursor is empty.
    - When the cursor parameter is not empty, the current parameter is invalid.
- `end_time`: Unix timestamp, in milliseconds.
  - The end time must be later than the start time.
  - The current parameter is mutually exclusive with the cursor parameter:
    - Required when cursor is empty.
    - When the cursor parameter is not empty, the current parameter is invalid.
- `limit`: Maximum: 500. If the number of filtered results is less than 500, exact numbers will be displayed.
  - The current parameter is mutually exclusive with the cursor parameter:
    - When the cursor parameter is not empty, the current parameter is invalid.
- `filters`: Same-type filters use OR logic (union); different-type filters use AND logic (intersection).
  - Set query conditions through key&value, with the following reference format and detailed parameter descriptions in the following text:
- `filters`: ```JSON
  "filters": [
    {
      "key": "api_key_name",
      "values": [
        "string"
      ]
    }
  ]
  ```
- `filters`: The current parameter is mutually exclusive with the cursor parameter:
    - When the cursor parameter is not empty, the current parameter is invalid.
- `filters[].key`: api_key_name (API Key Name)
  - api_key_name: The name of the API Key.
  - When setting multiple filtering criteria for different dimensions, the intersection of the filtering results is taken.
- `filters[].values`: You can specify multiple values for the values parameter to apply multiple query conditions, and the filtered results will return the union of all matches.
- `cursor`: The value comes from the next_cursor field of the previous response.
- `cursor`: When cursor is provided, it overrides all other parameters (start_time, end_time, filters, limit).

### Request Example

```bash
curl --location --request POST 'https://api-singapore.klingai.com/account/billing/balance' \
--header 'Authorization: Bearer xxx' \
--header 'Content-Type: application/json; charset=utf-8' \
--data-raw '{
  "start_time": 1741284003293,
  "end_time": 1792219793736,
  "cursor": "",
  "limit": 50,
  "filters": [
    {
      "key": "api_key_name",
      "values": []
    }
  ]
}'
```

### Response Example

```json
{
  "code": 0, // Error code. See Error Codes for details.
  "message": "string", // Error message
  "request_id": "769a8903-3804-4e70-a0a3-aa021402292c", // System-generated request ID for tracking and troubleshooting
  "data": {
    "result": {
      "detail": [
        {
          "task_id": "string", // System-generated task ID
          "api_key_name": "string", // API Key Name
          "product_function": "string", // Task function, e.g. Image to Video
          "model_name": "string", // Model version used for the task
          "resolution": "string", // Resolution of generated results. Enum values: 720p, 1080p, 4k (Legacy: mode parameter mapped as 720p=std, 1080p=pro)
          "duration": "5.04", // Video duration in seconds (only applicable to video generation tasks)
          "refer_video_input": true, // Whether a reference video was used. Boolean: true, false (the current parameters are only effective for generating video task related details)
          "video_sound": "native", // Whether the generated video contains sound. Enum values: native, original, off. native = audio generated to match visuals; original = retains reference video's original audio; off = no audio (only applicable to video generation tasks)
          "voice_control": false, // Whether a designated voice was used. Boolean: true, false (only applicable to video generation tasks)
          "deduction_time": "1779549455861", // Balance deduction time (Unix timestamp in milliseconds)
          "cash_type": "string", // Balance type. If the consumption is the official quota, the parameter value is balance. If the consumption is the test quota, the parameter value is test_balance
          "balance_before_deduction": 13037.3, // Balance before deduction
          "deduction_amount": 5.0, // Balance deduction amount
          "balance_after_deduction": 13032.3, // Balance after deduction
          "list_price": 5.0, // List price (before discount)
          "currency": "string" // Balance currency, enum values: CNY, USD
        }
      ],
      "count": 20 // Number of results in this response
    },
    "next_cursor": "string", // Cursor for fetching additional results.
    "has_more": true // Whether more results are available. Boolean.
  }
}
```
