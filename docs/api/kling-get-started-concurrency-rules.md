> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Concurrency Rules

> Source: https://kling.ai/document-api/api/get-started/concurrency-rules
> Locale: en
> Current Tab: Concurrency Rules
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## What Is Kling API Concurrency?

Kling API concurrency refers to **the maximum number of generation tasks an account can process simultaneously**. The upper limit is related to the account, model version, and resource package. A higher concurrency level allows you to submit more API generation requests simultaneously (each call to the task creation interface creates a new generation task).

> Notes
> - This limit only applies to the task creation interface; query interfaces do not consume concurrency.
> - This limitation concerns the number of concurrent tasks and is unrelated to Queries Per Second (QPS). The system does not impose any QPS limits.

## Core Rules

| Category | Rule Description                                                                                                                                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application Scope   | Independently calculated by account, model version, and resource package type (video/image) on a per account basis, with shared quotas for all API keys                                                                                         |
| Occupancy Logic     | A task occupies concurrency from entering the Submitted status until completion (including failures). Concurrency is released immediately after the task ends.                                                                                  |
| Quota Calculation   | The concurrency quota is determined by the highest concurrency value among all active resource packages of the same type. Example: If both a 5-concurrency and a 10-concurrency video package are active, the video concurrency capacity is 10. |

**Special Notes**

- Video / Virtual Try-on tasks: Each task consumes **1 concurrency slot**.
- Image generation tasks: The concurrency used equals the n value in the API request. (Example: n = 9 → consumes 9 concurrency)

## Over-Limit Error Mechanism

When the number of running tasks reaches the concurrency limit, submitting a request will return an error.

```JSON
{
	"code": 1303,
	"message": "parallel task over resource pack limit",
	"request_id": "9984d27b-a408-4073-ae28-17ca6a13622d" //uuid
}
```

## Recommended Approach

Since this error is triggered by system load (not by parameter issues), it is recommended to:

1. **Backoff Retry Strategy**: Use an exponential backoff algorithm to delay retries (recommended initial delay ≥ 1 second).
2. **Queue Management**: Control the submission rate through a task queue and dynamically adapt to available concurrency.
