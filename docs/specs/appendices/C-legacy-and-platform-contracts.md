# Kling AI — Platform-Level and LEGACY `/v1/` Resource Contracts

Extracted 2026-09-20 from `/Users/aself/uluops/misc/npm-packages/kling-api/docs/api/`. Read-only pass over 24 files (9 platform, 15 legacy resources). All quotes are verbatim from the files; paraphrase is marked as such. Every "none / only / all" claim below carries the grep that discharges it.

Files read (platform): `kling-get-started-authentication.md`, `kling-get-started-error-codes.md`, `kling-get-started-concurrency-rules.md`, `kling-get-started-callbacks.md`, `kling-get-started-kling-skills.md`, `kling-updates-api.md`, `kling-assets-balance.md`, `kling-assets-package.md`, `kling-assets-account-usage.md`.

Files read (legacy resources): `kling-avatar.md`, `kling-text-to-speech.md`, `kling-lip-sync.md`, `kling-face-recog.md`, `kling-img-recog.md`, `kling-multi-element-video-editing.md`, `kling-text-to-audio.md`, `kling-video-to-audio.md`, `kling-o1-element-mgt.md`, `kling-omni-3.0-element-mgt.md`, `kling-image-o1-elements.md`, `kling-image-omni-3.0-elements.md`, `kling-2.6-voice-mgt.md`, `kling-omni-3.0-voice-mgt.md`, `kling-effects-video-effects.md`.

Sibling duplicates noted but not primary: `kling-auth.md`, `kling-callback-protocol.md`, `kling-error-codes.md`, `kling-concurrency.md` are byte-identical to their `kling-get-started-*` counterparts except for a leading BOM and the `> Current Tab:` header line (`diff` run 2026-09-20; only lines 1 and 9/10 differ in each pair). They introduce no conflicting content.

---

## 1. AUTHENTICATION

Source: `kling-get-started-authentication.md`.

### Base URL

```
https://api-singapore.klingai.com
```

Old-domain note, verbatim:

> **Notice**: The API endpoint has been changed from https://api.klingai.com to **https://api-singapore.klingai.com**. This API is suitable for users whose servers are located outside of China.

### API Key mechanism

Section heading, verbatim: `### API Key (for all models)`

> API Key authentication must be used to call Kling AI API. The sensitivity of this key is high, and leakage can lead to the theft of call limits. Therefore, it is recommended to configure the API Key to be used in the environment variable.

Steps 1-4 are console UI (create key, shown once). Header format (Step 5):

> Add the **API Key** to the **Request Header** as an **Authorization** field.
> - Format: **Authorization = "Bearer XXX"**, where XXX is the **API Key** obtained in Step 1 (Note: include a space between "Bearer" and the key.)

### AccessKey / SecretKey (JWT) mechanism

Section heading, verbatim (this is also the sentence that distinguishes new vs legacy):

> ### Access Key / Secret Key (API only applicable to legacy version design standards) (How to distinguish between new and legacy API design standards? The model version information located in the path is the new version, while the value set as the model_name parameter is the legacy version.)

Mechanism:

> - Step-1：Obtain **AccessKey** + **SecretKey**
> - Step-2：For each API request, you need to generate an API Token using the following encryption method; put Authorization = Bearer \<API Token\> in the Request Header
>     - Encryption Method：Follow JWT（Json Web Token, RFC 7519）standard
>     - A JWT consists of three parts: Header, Payload, and Signature.

JWT parameters, from the Python sample (Java sample is equivalent):

| Part | Value |
|---|---|
| Header `alg` | `HS256` |
| Header `typ` | `JWT` |
| Signing key | the SecretKey (`jwt.encode(payload, sk, headers=headers)`; Java: `Algorithm.HMAC256(sk)`) |
| Claim `iss` | the AccessKey (`"iss": ak`; Java `.withIssuer(ak)`) |
| Claim `exp` | `int(time.time()) + 1800` — comment: `The valid time, in this example, represents the current time+1800s(30min)` |
| Claim `nbf` | `int(time.time()) - 5` — comment: `The time when it starts to take effect, in this example, represents the current time -5s` |

Step 3:

> Use the API Token generated in Step 2 to construct the Authorization header and include it in the request header.
> - Format: Authorization: Bearer XXX, where XXX is the API Token generated in Step 2.
> - Note: There should be a space between Bearer and XXX.

### Which standard each applies to

- API Key: the heading says `(for all models)` and the body says it `must be used to call Kling AI API` — no restriction to either standard.
- AK/SK JWT: the heading says `API only applicable to legacy version design standards`.

### Can an API Key be used on legacy `/v1/` endpoints?

The authentication page does not say "API Key works on `/v1/`" in those words, but it is not silent either — three pieces of evidence, all in-repo:

1. The heading `### API Key (for all models)` and the sentence `API Key authentication must be used to call Kling AI API` are unqualified.
2. Every one of the 15 legacy resource docs lists `- Auth: \`Authorization: Bearer <API_KEY>\`` on every endpoint. Grep: `/usr/bin/grep -c "Authorization: Bearer <API_KEY>" <15 legacy files>` → avatar 3, tts 1, lip-sync 3, face-recog 1, img-recog 1, multi-elements 8, text-to-audio 3, video-to-audio 3, each element-mgt doc 5, each voice-mgt doc 5, effects 3; zero files with 0 hits (2026-09-20). Their curl samples all use `Authorization: Bearer <token>`, which is ambiguous between the two.
3. `kling-updates-api.md` 06/17/2026, "General | New Authentication Method Released": `Authentication can now be completed using only an API Key, reducing integration complexity` / `Fully compatible with existing models and can be used alongside AK/SK authentication`.

Conversely, whether JWT works on **new**-standard endpoints: the auth page's heading restricts AK/SK to legacy, and the 06/17/2026 Kling 3.0 Turbo entry says `The new API supports authentication via API Key only. Please migrate as soon as possible`.

Reading: API Key is documented as universal; AK/SK JWT is documented as legacy-only. The auth page itself never uses the strings `/v1`, `legacy` (other than the heading), or `model_name` (other than the heading) — grep `-i "legacy\|/v1\|model_name" kling-get-started-authentication.md` hits only line 36, the heading.

Note also `kling-get-started-kling-skills.md` (Skill page, "Last updated: 2026/04/01"): `Unable to access through API Key temporarily, expected to support within June` — this refers to the third-party Skill's credential binding, not the HTTP API, and is dated before the 06/17/2026 API Key release.

---

## 2. ERROR CODES

Source: `kling-get-started-error-codes.md`. Table verbatim (column headers as in the file).

| HTTP Status Code | Service Code | Definition of Service Code | Explanation of Service Code | Suggested Solutions |
| ---------- | ------ | ------------ | --------------------------------- | ----------------------------------------------- |
| 200 | 0 | Request successful | - | - |
| 401 | 1000 | Authentication failed | Authentication failed | Check if the Authorization is correct |
| 401 | 1001 | Authentication failed | Authorization is empty | Fill in the correct Authorization in the Request Header |
| 401 | 1002 | Authentication failed | Authorization is invalid | Fill in the correct Authorization in the Request Header |
| 401 | 1003 | Authentication failed | Authorization is not yet valid | Check the start effective time of the token, wait for it to take effect or reissue |
| 401 | 1004 | Authentication failed | Authorization has expired | Check the validity period of the token and reissue it |
| 429 | 1100 | Account exception | Abnormal account status | Verifying account configuration information |
| 429 | 1101 | Account exception | Account in arrears (postpaid scenario) | Recharge the account to ensure sufficient balance |
| 429 | 1102 | Account exception | Resource pack exhausted or expired (prepaid scenario) | Purchase additional resource packages, or activate the post-payment service (if available) |
| 403 | 1103 | Account exception | Unauthorized access to requested resource, such as API/model | Verifying account permissions |
| 400 | 1200 | Invalid request parameters | Invalid request parameters | Check whether the request parameters are correct |
| 400 | 1201 | Invalid request parameters | Invalid parameters, such as an incorrect key or invalid value | Refer to the specific information in the message field of the returned body and modify the request parameters |
| 404 | 1202 | Invalid request parameters | The requested method is invalid | Review the API documentation and use the correct request method |
| 404 | 1203 | Invalid request parameters | The requested resource does not exist, such as the model | Refer to the specific information in the message field and modify the request parameters |
| 400 | 1300 | Trigger strategy | Request blocked by platform policy | Check if any platform policies have been triggered |
| 400 | 1301 | Trigger strategy | Trigger the platform's content security policy | Check the input content, modify it, and resend the request |
| 429 | 1302 | Trigger strategy | Too many requests; rate limit exceeded | Reduce the request frequency, try again later, or contact customer service to increase the limit |
| 429 | 1303 | Trigger strategy | Concurrency or QPS exceeds the prepaid resource package limit | Reduce the request frequency, try again later, or contact customer service to increase the limit |
| 429 | 1304 | Trigger strategy | Trigger the platform's IP whitelist policy | Contact customer service |
| 500 | 5000 | Internal error | Server internal error | Try again later, or contact customer service |
| 503 | 5001 | Internal error | Server temporarily unavailable, usually due to maintenance | Try again later, or contact customer service |
| 504 | 5002 | Internal error | Server internal timeout, usually due to a backlog | Try again later, or contact customer service |

Observations: codes 1003/1004 (`not yet valid` / `has expired`) are JWT `nbf`/`exp` failures — they only make sense under the AK/SK path. The response envelope everywhere is `{ code, message, request_id, data }`; the concurrency page's sample error body is `{ "code": 1303, "message": "parallel task over resource pack limit", "request_id": "..." }` with no `data`.

---

## 3. CONCURRENCY RULES

Source: `kling-get-started-concurrency-rules.md`. Verbatim.

> Kling API concurrency refers to **the maximum number of generation tasks an account can process simultaneously**. The upper limit is related to the account, model version, and resource package. A higher concurrency level allows you to submit more API generation requests simultaneously (each call to the task creation interface creates a new generation task).

> Notes
> - This limit only applies to the task creation interface; query interfaces do not consume concurrency.
> - This limitation concerns the number of concurrent tasks and is unrelated to Queries Per Second (QPS). The system does not impose any QPS limits.

Core Rules table:

| Category | Rule Description |
|---|---|
| Application Scope | Independently calculated by account, model version, and resource package type (video/image) on a per account basis, with shared quotas for all API keys |
| Occupancy Logic | A task occupies concurrency from entering the Submitted status until completion (including failures). Concurrency is released immediately after the task ends. |
| Quota Calculation | The concurrency quota is determined by the highest concurrency value among all active resource packages of the same type. Example: If both a 5-concurrency and a 10-concurrency video package are active, the video concurrency capacity is 10. |

> **Special Notes**
> - Video / Virtual Try-on tasks: Each task consumes **1 concurrency slot**.
> - Image generation tasks: The concurrency used equals the n value in the API request. (Example: n = 9 → consumes 9 concurrency)

Over-limit error:

```JSON
{
	"code": 1303,
	"message": "parallel task over resource pack limit",
	"request_id": "9984d27b-a408-4073-ae28-17ca6a13622d" //uuid
}
```

> Since this error is triggered by system load (not by parameter issues), it is recommended to:
> 1. **Backoff Retry Strategy**: Use an exponential backoff algorithm to delay retries (recommended initial delay ≥ 1 second).
> 2. **Queue Management**: Control the submission rate through a task queue and dynamically adapt to available concurrency.

Tensions: "The system does not impose any QPS limits" vs error code 1302 (`Too many requests; rate limit exceeded`), 1303's own definition (`Concurrency or QPS exceeds…`), and `/account/costs` (`Please note to control the request rate (QPS<=1)`). Also `series_amount: auto` (updates 04/27/2026) — `it will occupy a concurrency amount corresponding to the actual generated quantity`.

---

## 4. CALLBACKS

Source: `kling-get-started-callbacks.md`.

Scope statement:

> As for the Async task（image generation / video generation / virtual try-on），if you actively set the `callback_url` when you Create Task, the server will actively notify you when the task status changes, and the protocol is as follows:

Two payload shapes are documented.

### 4a. New Callback Function

> Applicable to APIs based on new design standards (How to distinguish between new and legacy API design standards? The model version information located in the path is the new version, while the value set as the model_name parameter is the legacy version.)

Field paths (types from the sample; comments are the doc's):

| Path | Type | Doc comment |
|---|---|---|
| `id` | string | The task ID being queried |
| `status` | string | Task status, Enum values: submitted, processing, succeeded, failed |
| `message` | string | Task status information, displaying the failure reason when the task fails |
| `create_time` | number (ms) | Task creation time, Unix timestamp, unit ms |
| `update_time` | number (ms) | Task update time, Unix timestamp, unit ms |
| `external_id` | string | The custom task ID for this task (if any) |
| `outputs` | array | discriminated by `outputs[].type`; `List values for each content type: image, video, audio, element, voice` |
| `outputs[].type = "video"`: `id` string, `url` string, `watermark_url` string, `duration` string (seconds) | | |
| `outputs[].type = "image"`: `url` string, `watermark_url` string, `group_id` string (`Only appears when generating group images`) | | |
| `outputs[].type = "audio"`: `id` string, `mp3_url` string, `wav_url` string, `mp3_duration` string, `wav_duration` string | | |
| `outputs[].type = "voice"`: `id` string, `name` string, `url` string (preview), `owned_by` string (`kling is the official voice library, and the number is the creator ID`), `status` string (`succeeded, deleted`) | | |
| `outputs[].type = "element"`: `id` string, `name` string, `description` string, `element_type` string (`video_character_elements and multi_image_elements`), `materials[]`, `owned_by` string, `status` string (`succeeded, deleted`), `tags[]` | | |
| `outputs[].materials[]` (element only): `type` string (`image, video, voice`), `role` string (image: `frontal` / `refer`; video: fixed `refer`; voice: fixed `refer`), `url` string; voice materials additionally `id`, `name`, `owned_by` | | |
| `outputs[].tags[]` (element only): `id` int, `name` string, `description` string | | |
| `billing` | array | Task consumption information |
| `billing[].charge_type` | string | `"cash"` if balance, `"unit"` if resource package |
| `billing[].cash_type` | string | only when `charge_type=cash`: `balance` (official quota) or `test_balance` (test quota) |
| `billing[].amount` | string | deduction amount (discount price for cash; units for unit); `decimal system` |
| `billing[].currency` | string | only when cash; `fixed parameter value of CNY/USD` |
| `billing[].package_type` | string | only when unit; `fixed enumeration values: video, image, audio` |
| `billing[].list_price` | string | only when cash |

Note: `outputs[].type = "image"` has no `id` field in the sample, unlike video/audio/voice/element.

### 4b. Legacy Callback Function

> Applicable to Kling 3.0 Omni and earlier models.

| Path | Type | Doc comment |
|---|---|---|
| `task_id` | string | Task ID, generated by the system |
| `task_status` | string | Task status, Enum values: submitted, processing, succeed, failed |
| `task_status_msg` | string | failure reason when the task fails |
| `created_at` | number (ms) | Unix timestamp, unit ms |
| `updated_at` | number (ms) | Unix timestamp, unit ms |
| `final_unit_deduction` | string | The deduction units of task |
| `final_balance_deduction` | object | Balance deduction information |
| `final_balance_deduction.quota` | string | Balance deduction discount price |
| `final_balance_deduction.list_price` | string | Balance deduction list price |
| `task_info` | object | Task creation parameters |
| `task_info.parent_video` | object | `id` string, `url` string, `duration` string (`Total duration of the video before continuation, in s`) |
| `task_info.external_task_id` | string | Customer-defined task ID |
| `task_result` | object | |
| `task_result.images[]` | array | `index` int (`Image Number`), `url` string |
| `task_result.videos[]` | array | `id` string, `url` string, `duration` string |

Per-product `task_result` variants: **only `images[]` and `videos[]` are documented in the legacy callback.** The legacy resource docs' *query* responses show additional shapes that the callback page does not enumerate — `task_result.audios[]` (TTS, text-to-audio, video-to-audio), `task_result.elements[]` (element mgmt), `task_result.voices[]` (voice mgmt), and `videos[].watermark_url` / `videos[].session_id` (avatar, lip-sync, multi-elements, effects). Whether these ride in the legacy callback is not stated. Grep `-n "audios\|elements\|voices" kling-get-started-callbacks.md` → zero hits for `audios`/`voices`/`elements` as `task_result` keys (the only `elements`/`voice` hits are inside the new-style `outputs[]`).

### 4c. Retry / timeout semantics

**Not documented.** `grep -n -i "retry\|retries\|timeout\|time out" kling-get-started-callbacks.md` → zero hits (2026-09-20); same for the sibling `kling-callback-protocol.md`. The only related statement is in Test Callback: `A successful verification should return HTTP 200.` and the Java samples' comment `return an HTTP 4xx response` on failure. No delivery-retry count, backoff, or delivery timeout is stated anywhere in the assigned files.

### 4d. Signing / verification (Webhook Signature)

> **Webhook Signature** is a callback signature verification mechanism provided by the Kling API. It allows you verify callback requests using your Webhook Secret. When **Webhook Signature is enabled**, each callback request includes signature-related headers for verification.

> **Webhook Secret** is **independent** from API Key.
> **Webhook Signature** does not change the existing callback flow. It only **adds signature-related headers** to callback requests.

Prerequisites: `You have configured options.callback_url when creating an API request.` and `Your server provides an HTTPS endpoint to receive callback requests.` (Note the `options.callback_url` path is the **new**-standard body shape; legacy bodies use top-level `callback_url`.)

Headers added when enabled:

| Header | Description |
|---|---|
| `webhook-id` | Unique identifier of the callback request. |
| `webhook-timestamp` | Unix timestamp (in seconds) when the callback request was generated. Verify that the timestamp is within ±5 minutes of your server time to prevent replay attacks. |
| `webhook-signature` | Signature generated from the request payload. Use your Webhook Secret to verify that the request was sent by Kling and has not been modified. |

> Webhook request headers are case-insensitive. … The Kling platform will **not include** these headers in callback requests if no Webhook Secret has been created.

Manual verification algorithm (verbatim steps):

> 1. Retrieve the following values from the request: `webhook-id`, `webhook-timestamp`, the raw request body (`rawBody`)
> 2. Construct the signed content by concatenating the values with a period (.): `{webhook-id}.{webhook-timestamp}.{rawBody}`
> 3. Generate the signature using the Webhook Secret and encode the result with Base64：`Base64(HMAC-SHA256(key, signed_content))`
>     Where: `key = Base64Decode(the secret value after removing the whsec_ prefix)`
> 4. **Compare** the generated signature with each signature value in the `webhook-signature` header **(excluding the `v1,` prefix)**. Use **constant-time comparison** to prevent timing attacks. Verification succeeds if any signature matches.
> 5. Verify that the difference between `webhook-timestamp` and the local server time **does not exceed 5 minutes**.

This is the Standard Webhooks scheme; the doc recommends `pip install standardwebhooks` / `com.standardwebhooks.Webhook`.

Signature header format: `version,signature`; multiple signatures space-separated during rotation:

```text
webhook-signature: v1,K5oZfzeVuQvI4x1jrjAgMlkpJDoe1JhVmAbjR6eKeTM= v1,7qGhfzeVuQvI4x1jrjAgMlkpJDoe1JhVmAbjR6eKeTM=
```

Rotation: Standard Rotation — `Both the old and new Webhook Secrets can be used to verify webhook signatures during the **7-day grace period**` and the old one `will automatically **expire after 7 days**`. Emergency Rotation — `the previous Webhook Secret is invalidated immediately`. Delete All — `Your callback requests will **no longer include signature headers**.`

Test Callback: `**Rate limit**: You can send only one test callback request **every 6 seconds**.` Test body is new-style: `{"id": "...", "status": "submitted", "outputs": [], "message": "", "create_time": ..., "update_time": ...}` — `status` `Fixed to "submitted" for test callbacks`.

Test vector (verbatim):

```text
Secret:            whsec_dGVzdHNlY3JldHRlc3RzZWNyZXR0ZXN0c2VjcmV0MTI=
Webhook-ID:        9876543210
Webhook-Timestamp: 1781080794
Raw Body:          {"id":"1234567890","status":"succeeded","message":"","create_time":1781080778802,"update_time":1781080794151}
Expected Signature: v1,UsKlJP00XoQyOn410NM9xv34sP+Gl0jnOO9Lcpr7NJ4=
```

FAQ: deleting all secrets does not affect task submission/execution; in-flight tasks still get a callback, unsigned.

---

## 5. UPDATES LOG — DEPRECATIONS AND MODEL VERSIONS

Source: `kling-updates-api.md` (entries span 09/19/2024 → 09/15/2026; dates are MM/DD/YYYY as in the file).

### 5a. Every entry matching discontinue / deprecat / offline / legacy / retire / sunset / migration / "new version" / "API design"

Grep `-n -i "discontinu\|deprecat\|offline\|legacy\|retire\|sunset\|migrat\|new version\|api design\|new api\|old version" kling-updates-api.md`, then read in context. Exact text:

| Date | Entry | Exact text |
|---|---|---|
| 07/15/2026 | General \| Feature Upgrade: More video models support the new API (same as Kling 3.0 Turbo API) | `- The new API features a simpler structure and lower parameter coupling, and supports batch queries by task ID and cursor-based pagination.` / `- Models added in this update: Kling 3.0, Kling 3.0 Omni, Kling 3.0 Motion Control, Kling 2.6, Kling 2.6 Motion Control, Kling 2.5 Turbo.` / `- The legacy API will continue to be available with no current plans for deprecation.` / `- Support exporting Markdown documents and quick integration with programming tools.` |
| 07/03/2026 | Video Generation \| Video Effects \| New Feature | `- Notice: magic_match_tree will be discontinued on July 3rd, 2026` |
| 06/17/2026 | Video Generation \| Kling 3.0 Turbo Officially Released | `- Parameter optimization reduces parameter conflicts, making integration easier` / `- The new API supports authentication via API Key only. Please migrate as soon as possible` |
| 06/17/2026 | General \| New Authentication Method Released | `- Authentication can now be completed using only an API Key, reducing integration complexity` / `- Fully compatible with existing models and can be used alongside AK/SK authentication` |
| 02/25/2026 | General \| The elements features have been fully upgraded | `- Upgrade the creation element to an asynchronous service to fulfill more element-related functions.` / `- The new element service adopts a brand-new API (advanced-custom-elements). The existing API can still be used normally, but the elements library is relatively independent and cannot perform cross-API queries.` |
| 12/22/2025 | Video Generation \| Motion Control Launched | `- Based on the new API path, both reference images and reference videos need to be uploaded simultaneously.` |
| 12/18/2025 | Video Generation \| Video Effects \| New Feature | `- Notice:kiss,fight,hug,thumbs_up,tiger_hug,pet_lion, 3d_cartoon_1 will be discontinued on January 30, 2026` |
| 12/15/2025 | Video Generation \| Omni-Video model launched | `- New API, multiple feature can be achieved through prompt words alone.` |
| 12/15/2025 | Image Generation \| Omni-Image model launched | `- New API, multiple feature can be achieved through prompt words alone.` |
| 12/11/2025 | Video Generation \| Video Effects \| New Feature | `- Notice:celebration and c4d_cartoon will be discontinued on December 30, 2025` |
| 06/30/2025 | Lip-Sync \| New version new capabilities | `- Supports increasing the maximum video duration from 10 seconds to 60 seconds` / `- Generating videos takes as little as 2 minutes` / `- No need to modify the code` |
| 02/14/2025 (also repeated under 01/07/2025, 12/09/2024, 11/15/2024) | Image Generation \| The "model" field has been changed to "model_name" | `Please note that in order to maintain naming consistency, the original model field has been changed to model_name, so in the future, please use this field to specify the version of the model that needs to be called.` / `- At the same time, we keep the behavior forward-compatible, if you continue to use the original model field, it will not have any impact on the interface call, there will not be any exception, which is equivalent to the default behavior when model_name is empty (i.e., call the V1 model).` |
| 09/15/2026 | [Virtual Try-On] Version 3.0 Officially Released | `- This upgrade is compatible with existing users. V1/V1.5 model parameters have been adapted on the engineering side, allowing users to seamlessly switch to the 3.0 pipeline.` (Try-On only; not a model_name deprecation.) |

The **only** explicit discontinuations in the entire log are video-effect scene names: `celebration`, `c4d_cartoon` (12/30/2025); `kiss`, `fight`, `hug`, `thumbs_up`, `tiger_hug`, `pet_lion`, `3d_cartoon_1` (01/30/2026); `magic_match_tree` (07/03/2026). The string `deprecat` appears exactly once (07/15/2026, `no current plans for deprecation`). The strings `offline`, `retire`, `sunset` do not appear (grep 2026-09-20).

### 5b. Every entry announcing a new model version

| Date | Model / version | Exact text (head) |
|---|---|---|
| 09/15/2026 | Virtual Try-On 3.0 | `**[Virtual Try-On] Version 3.0 Officially Released**` |
| 06/17/2026 | Kling 3.0 Turbo | `**Video Generation \| Kling 3.0 Turbo Officially Released**` — `Supports both text-to-video and image-to-video generation in 720P and 1080P`; billing `0.8 units … per second for 720P … 1.0 unit … per second for 1080P` |
| 06/17/2026 | 3.0 Omni (feature) | `**Video Generation \| Feature Upgrade: 3.0 Omni Now Supports Reference Videos up to 15 Seconds and 4K Generation**` |
| 05/07/2026 | `kling-v3-omni`, `kling-v3` (feature) | `Supported model ranges: \`kling-v3-omni\`, \`kling-v3\`` |
| 04/23/2026 | `kling-v3-omni`, `kling-v3` (4K) | `Omni-Video: The \`kling-v3-omni\` model supports all functions except for "reference video"` / `Text-to-Video: \`kling-v3\` model` / `Image-to-Video: \`kling-v3\` model` |
| 03/04/2026 | V3.0 Motion Control | `**Video Generation \| V3.0 Motion Control Launched**` — `Add model_name parameter to distinguish model versions, default \`kling-v2-6\`` |
| 02/25/2026 | 3.0 Omni and V3 (video); 3.0 Omni and V3 (image) | `**Video Generation \| 3.0 Omni and V3 model launched**` / `**Image Generation \| 3.0 Omni and V3 model launched**` |
| 12/22/2025 | Motion Control (initial) | `**Video Generation \| Motion Control Launched**` — `Based on the new API path` |
| 12/16/2025 | V2.6 upgraded | `**Video Generation \| V2.6 model upgraded**` — `By using prompt and voice_list, a specified voice can be used` |
| 12/15/2025 | V2.6 | `**Video Generation \| V2.6 model launched**` — `Supports Text-To-Video and Image-To-Video.` / `Control whether to include audio … through the sound parameter.` |
| 12/15/2025 | Omni-Video (`kling-video-o1`) | `**Video Generation \| Omni-Video model launched**` — `New API, multiple feature can be achieved through prompt words alone.` |
| 12/15/2025 | Omni-Image (`kling-image-o1`) | `**Image Generation \| Omni-Image model launched**` — `New API …` |
| 11/19/2025 | Multi-Image to Image V2.1 | `**Multi-Image to Image \| Support V2.1 model**` — `Deduct 16 units when generate an image` |
| 11/17/2025 | V2.5-Turbo PRO first/last frame | `**Image-To-Video \| V2.5-Turbo PRO supports First/Last Frame**` |
| 11/11/2025 | V2.5-Turbo STD | `**Video Generation \| V2.5-Turbo supports STD Mode**` |
| 10/20/2025 | V2.5-turbo | `**Video Generation \| Text-To-Video and Image-To-Video support V2.5-turbo**` — `Support PRO mode, generate 5-second video with as low as 2.5 units` |
| 08/15/2025 | `kling-v2-new` (image) | `**Image Generation \| Model Update: New V2.0 Image-to-Image supports nearly 300 styles**` — `Parameter example: "model_name": "kling-v2-new"` |
| 08/12/2025 | V1.6 T2V PRO | `**Video Generation \| Feature Update: T2V V1.6 supports PRO**` |
| 07/30/2025 | `kling-v2-1` (image) | `**Image Generation \| Support V2.1 model**` — `Update image-to-image kling-v2-1 model`; `**Multi-Image to Image \| Newly launched**` — `Only support kling-v2-1 model` |
| 06/19/2025 | `kling-v2-1`, `kling-v2-1-master` (video) | `**Video Generation \| Support V2.1 model**` — `Update image2video kling-v2-1 model, supports STD mode and PRO mode` / `Update image2video kling-v2-1-master model` / `Update text2video kling-v2-1-master model` |
| 05/13/2025 | `kling-v2` (image), `kling-v2-master` (video) | `**Image Generation \| Support V2.0 model**` — `Support kling-v2 text-to-image`; `**Video Generation \| Support V2.0 Master model**` — `Support kling-v2-master text-to-video and image-to-video` / `Kling-v2-master currently does not support mode parameter` |
| 03/25/2025 | Image V1.5 features | `**Image Generation \| V1.5 model supports character feature reference and character appearance reference**` |
| 03/12/2025 | Image V1.5 | `**Image Generation \| Support V1.5 models**` |
| 01/07/2025 | V1.6 | `**Video Generation \| V1.6 Model Officially Launched**` — `Supports text-to-video STD mode, image-to-video STD mode, and image-to-video PRO mode` |
| 12/30/2024 | Try-On V1.5 | `**Virtual Try-On \| New V1.5 model**` |
| 12/09/2024 | Video V1.5 Std | `**Video Generation \| Video V1.5 Std Model Now Open for Video Generation: Image-to-Video Functionality Enabled, Text-to-Video Unsupported**` |
| 11/15/2024 | Video V1.5 Pro | `**Video Generation \| Video V1.5 Pro Model Now Open for Video Generation: Image-to-Video Functionality Enabled, Text-to-Video Unsupported**` |
| 09/19/2024 | `kolors-virtual-try-on` | `Officially supporting the "**AI Virtual Try-on**" related API (**kolors-virtual-try-on**).` |

### 5c. Per-model discontinuation / supersession — the specific list requested

| model_name | Introduced (log) | Discontinued / superseded per the log |
|---|---|---|
| `kling-v1` | Pre-log baseline; referenced as `the default behavior when model_name is empty (i.e., call the V1 model)` (11/15/2024, 12/09/2024, 01/07/2025, 02/14/2025) | **Log does not say.** No discontinuation entry. |
| `kling-v1-5` | 11/15/2024 (Pro I2V), 12/09/2024 (Std I2V), 03/12/2025 (image V1.5; video features), 03/31/2025 (extension) | **Log does not say.** The only V1.5 retirement-adjacent text is Try-On 09/15/2026 (`V1/V1.5 model parameters have been adapted … seamlessly switch to the 3.0 pipeline`), which concerns `kolors-virtual-try-on`, not video/image `kling-v1-5`. |
| `kling-v1-6` | 01/07/2025; 03/12/2025, 03/31/2025, 08/12/2025 feature adds | **Log does not say.** |
| `kling-v2-master` | 05/13/2025 | **Log does not say.** |
| `kling-v2-1` | 06/19/2025 (video I2V), 07/30/2025 (image), 09/05/2025 (start/end frame), 11/19/2025 (multi-image) | **Log does not say.** |
| `kling-v2-1-master` | 06/19/2025 | **Log does not say.** |
| `kling-v2` | 05/13/2025 (text-to-image) | **Log does not say.** |
| `kling-v2-new` | 08/15/2025 (image-to-image) | **Log does not say.** |
| `kling-video-o1` | 12/15/2025 (`Omni-Video model launched — New API`); 03/11/2026 behavior notes | **Log does not say.** Still listed as supported in `kling-get-started-kling-skills.md` (`kling-v3 / kling-v2-6 / kling-v3-omni / kling-video-o1`). 02/25/2026 launched `3.0 Omni and V3` which functionally supersedes it, but the log makes no supersession statement. |
| `kling-image-o1` | 12/15/2025 (`Omni-Image model launched — New API`) | **Log does not say.** Still listed in the Skill page (`kling-v3 / kling-v3-omni / kling-image-o1`). |

Summary: **the log records no discontinuation or supersession for any `kling-*` model_name.** The single forward-looking policy statement is 07/15/2026: `The legacy API will continue to be available with no current plans for deprecation.`

### 5d. When the path-per-model / API-Key design was introduced

Piecing the log together (the log never uses the phrase "API design standard"; that phrase appears only on the auth and callback pages):

- **12/15/2025** — Omni-Video and Omni-Image: first entries described as `New API`.
- **12/22/2025** — Motion Control: `Based on the new API path` — first use of "new API path".
- **02/25/2026** — Element service: `brand-new API (advanced-custom-elements)`; and 3.0 Omni / V3 launched (video + image).
- **06/17/2026** — Kling 3.0 Turbo: `The new API supports authentication via API Key only. Please migrate as soon as possible`; same day `General | New Authentication Method Released` — the API-Key-only auth mechanism.
- **07/15/2026** — `More video models support the new API (same as Kling 3.0 Turbo API)`: Kling 3.0, 3.0 Omni, 3.0 Motion Control, 2.6, 2.6 Motion Control, 2.5 Turbo added; `batch queries by task ID and cursor-based pagination` (i.e. the unified `/tasks` query); legacy API stays.

So: the "new API" surface began 12/15/2025 (Omni models), the API-Key auth arrived 06/17/2026 with 3.0 Turbo as the first model documented as API-Key-only, and the design was generalized to older models on 07/15/2026. The log does not state a date on which `model_name`-in-body was formally designated "legacy"; that label appears only on the auth/callback pages, undated.

---

## 6. ASSETS / BILLING ENDPOINTS

All three: `Auth: Authorization: Bearer <API_KEY>`, `Content-Type: application/json`, host `https://api-singapore.klingai.com`. None of the three is under `/v1/`.

### 6a. Balance Deduction Detail — `POST /account/billing/balance`

Source: `kling-assets-balance.md`.

Request body:

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `start_time` | long | No | - | - | Start time for task creation filtering. |
| `end_time` | long | No | - | - | End time for task creation filtering. |
| `limit` | int | No | `500` | - | Query the number of tasks. |
| `filters` | array | No | - | - | Query task filtering dimensions, such as API Key Name. |
| `filters[].key` | string | Yes | - | `api_key_name` | Query task filtering dimensions, supporting: API Key Name. |
| `filters[].values` | array | Yes | - | - | Query criteria to be filtered. |
| `cursor` | string | No | - | - | Cursor for fetching additional results. |

Constraints (verbatim): `start_time`/`end_time` are `Unix timestamp, in milliseconds`; `Required when cursor is empty.` / `When the cursor parameter is not empty, the current parameter is invalid.`; `limit`: `Maximum: 500`; `filters`: `Same-type filters use OR logic (union); different-type filters use AND logic (intersection).`; `cursor`: `The value comes from the next_cursor field of the previous response.` / `When cursor is provided, it overrides all other parameters (start_time, end_time, filters, limit).` Note the table marks `start_time`/`end_time` `Required: No` while the notes say `Required when cursor is empty` — conditional requirement.

Response (`data` object):

```
data.result.detail[]:
  task_id string; api_key_name string; product_function string ("e.g. Image to Video");
  model_name string ("Model version used for the task");
  resolution string — "Enum values: 720p, 1080p, 4k (Legacy: mode parameter mapped as 720p=std, 1080p=pro)";
  duration string ("5.04", video only); refer_video_input boolean; video_sound string — "native, original, off";
  voice_control boolean; deduction_time string (ms timestamp as string, e.g. "1779549455861");
  cash_type string — "balance" | "test_balance";
  balance_before_deduction number; deduction_amount number; balance_after_deduction number;
  list_price number; currency string — "CNY, USD"
data.result.count int
data.next_cursor string
data.has_more boolean
```

### 6b. Unit Deduction Detail — `POST /account/billing/package`

Source: `kling-assets-package.md`. Same body as 6a except `filters[].key` enum: `api_key_name`, `product_type`, `package_name`, `package_id`. Notes: `product_type … Enum values: video, image, try-on`; `The package_name parameter and package_id parameter are mutually exclusive and cannot be set as filtering conditions at the same time.`

Response `data.result.detail[]` adds `package_id string`, `product_type string ("video, image, try-on")`, and replaces the cash fields with `unit_before_deduction number`, `deduction_amount number ("Points deduction amount")`, `unit_after_deduction number`; `deduction_time` comment: `Units deduction time, Unix timestamp, unit ms time`. Other fields (`task_id`, `api_key_name`, `product_function`, `model_name`, `resolution`, `duration`, `refer_video_input`, `video_sound`, `voice_control`) identical to 6a. `count`, `next_cursor`, `has_more` identical.

### 6c. Account Usage — `GET /account/costs`

Source: `kling-assets-account-usage.md`. Heading: `## Query Resource Package List and Remaining Quantity under the Account`.

> Note: This API is free to call and allows you to query the list and balance of resource packages under your account. Please note to control the request rate (QPS<=1)

Query params:

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `start_time` | int | Yes | - | - | Query start time, Unix timestamp, unit: ms |
| `end_time` | int | Yes | - | - | Query end time, Unix timestamp, unit: ms |
| `resource_pack_name` | string | No | - | - | Resource package name, used to precisely specify a resource package to query |

Response (`data`): **double-wrapped** — `data.code int`, `data.msg string` (note `msg`, not `message`), `data.resource_pack_subscribe_infos[]`:

```
resource_pack_name string; resource_pack_id string;
resource_pack_type string — "decreasing_total" | "constant_period";
total_quantity number; remaining_quantity number ("remaining quantity statistics have a 12h delay");
purchase_time, effective_time, invalid_time: int ms;
status string — "toBeOnline" | "online" | "expired" | "runOut"
```

### 6d. Does `/account/costs` still appear anywhere?

Yes — it is the current, documented path for Account Usage, not a retired one. Directory-wide grep `grep -rn "account/costs" .` (2026-09-20) → exactly two hits, both in `kling-assets-account-usage.md` (line 20 `- Path: \`/account/costs\``, line 47 the curl). The updates log's 10/30/2024 entry (`Added the "Query Resource Package List and Remaining Quantity" interface … See "Section VI: Account Information Query"`) is this endpoint's origin; the two `/account/billing/*` endpoints were added 07/06/2026 (`Supports Exporting Deduction Details through API`). All three coexist; nothing marks `/account/costs` legacy.

---

## 7. LEGACY RESOURCE ENDPOINTS

Common to all 15 files: every endpoint lists `Auth: Authorization: Bearer <API_KEY>`; every doc's request/response envelope is `{ code, message, request_id, data }`; timestamps `created_at`/`updated_at` are `Unix timestamp, unit ms`; all list endpoints use `pageNum` (`[1, 1000]`, default 1) and `pageSize` (default 30; range `[1, 500]` everywhere **except** the two voice-mgt docs, which say `[1, 1000]`).

**`model_name` does not appear in any of the 15 legacy resource docs.** `grep -n "model_name" <15 files>` → zero hits (2026-09-20); control: the same grep on `kling-image-2.1-generation.md` → 4 hits. So these endpoints are "legacy" by path shape (`/v1/...`) and body-callback shape (`task_id`/`task_status`), not by carrying a `model_name` selector. The only model-selection field in this set is `mode` (`std`/`pro`) on avatar and multi-elements.

### 7.1 Avatar — `kling-avatar.md`

**Create Task** — `POST /v1/videos/avatar/image2video`

| Field | Type | Required | Default | Enum | Key constraints |
|---|---|---:|---|---|---|
| `image` | string | Yes | - | - | Base64 (raw, no `data:` prefix) or URL; `.jpg / .jpeg / .png`; `≤ 10MB, dimensions ≥ 300px, aspect ratio between 1:2.5 ~ 2.5:1` |
| `audio_id` | string | No | - | - | `Audio ID Generated via TTS API`; `Only supports audio generated within the last 30 days, duration between 2-300 seconds`; `Either audio_id or sound_file must be provided (mutually exclusive)` |
| `sound_file` | string | No | - | - | Base64 or URL; `.mp3/.wav/.m4a/.aac, max 5MB`; `Duration must be between 2-300 seconds` |
| `prompt` | string | No | - | - | `Can be used to define avatar actions, emotions, and camera movements`; `2500 characters maximum` |
| `mode` | string | No | `std` | `std`, `pro` | |
| `watermark_info` | object | No | - | - | `{ "enabled": boolean }`; `Custom watermarks are not currently supported` |
| `callback_url` | string | No | - | - | |
| `external_task_id` | string | No | - | - | `Must be unique within a single user account` |

Response `data`: `task_id`, `task_status` (`submitted, processing, succeed, failed`), `task_info.external_task_id`, `created_at`, `updated_at`.

**Query Task (Single)** — `GET /v1/videos/avatar/image2video/{id}` — path param is `task_id` or `external_task_id` (`Choose either`). Response `data` adds `task_status_msg`, `task_result.videos[] { id, url, watermark_url, duration }`, `watermark_info.enabled`, `final_unit_deduction`, `final_balance_deduction { quota, list_price }`.

**Query Task (List)** — `GET /v1/videos/avatar/image2video?pageNum&pageSize` — `data` is an array of the Single shape.

### 7.2 TTS — `kling-text-to-speech.md`

**Create Task** — `POST /v1/audio/tts` — the only section; **no query endpoints are documented** and the response is synchronous (carries `task_result` immediately).

| Field | Type | Required | Default | Enum | Key constraints |
|---|---|---:|---|---|---|
| `text` | string | Yes | - | - | `maximum length of the text content is 1000 characters` |
| `voice_id` | string | Yes | - | - | see external Voice Guide; `Voice preview file naming convention: Voice Name#Voice ID#Voice Language` |
| `voice_language` | string | Yes | `zh` | `zh`, `en` | (Required *and* has a default) |
| `voice_speed` | float | No | `1.0` | - | `Valid range: [0.8, 2.0], accurate to one decimal place; values outside this range will be automatically rounded.` |

Response `data`: `task_id`, `task_status` (`submitted, processing, succeed, failed`), `task_status_msg`, `task_result.audios[] { id ("will be cleared after 30 days"), url, duration }`, `final_unit_deduction`, `final_balance_deduction { quota, list_price }`, `created_at`, `updated_at`. No `task_info`/`external_task_id`, no `callback_url`.

### 7.3 Lip-Sync — `kling-lip-sync.md`

**Create Task** — `POST /v1/videos/advanced-lip-sync`

| Field | Type | Required | Default | Key constraints |
|---|---|---:|---|---|
| `session_id` | string | Yes | - | `Generated by the Face Recognition API` |
| `face_choose` | array | Yes | - | `Currently only supports one person lip-sync.` |
| `face_choose[].face_id` | string | Yes | - | `Returned by the facial recognition interface.` |
| `face_choose[].audio_id` | string | No | - | `last 30 days … no less than 2 seconds and no more than 60 seconds`; mutually exclusive with `sound_file` (`cannot be empty or both populated`) |
| `face_choose[].sound_file` | string | No | - | Base64 or URL; `.mp3/.wav/.m4a/.aac (max 5MB)`; 2–60 s |
| `face_choose[].sound_start_time` | long | Yes | - | ms from sound start; `cropped sound must not be shorter than 2 seconds` |
| `face_choose[].sound_end_time` | long | Yes | - | ms; `shouldn't be later than the total duration of the original sound` |
| `face_choose[].sound_insert_time` | long | Yes | - | ms from video start; `should overlap with the face's lip-sync time interval for at least 2 seconds`; must fit within video bounds |
| `face_choose[].sound_volume` | float | No | `1` | `[0, 2]` |
| `face_choose[].original_audio_volume` | float | No | `1` | `[0, 2]`; `No effect if source video is silent.` |
| `watermark_info` | object | No | - | `{ "enabled": boolean }` |
| `external_task_id` | string | No | - | unique per user |
| `callback_url` | string | No | - | |

Response `data`: `task_id`, `task_info.external_task_id`, `task_status` (`submitted, processing, succeed, failed`), `created_at`, `updated_at`.

**Query Task (Single)** — `GET /v1/videos/advanced-lip-sync/{id}` — path param table lists **only `task_id`** (no `external_task_id` option, unlike the other docs). Response `data`: `task_id`, `task_status`, `task_status_msg`, `task_info.parent_video { id, url, duration }` (no `external_task_id` echoed), `task_result.videos[] { id, url, watermark_url, duration }`, `watermark_info.enabled`, `final_unit_deduction`, `final_balance_deduction`, timestamps.

**Query Task (List)** — `GET /v1/videos/advanced-lip-sync?pageNum&pageSize` — array of Single shape.

### 7.4 Face Recognition — `kling-face-recog.md`

**Identify Face** — `POST /v1/videos/identify-face` — synchronous; no task status, no query endpoints.

| Field | Type | Required | Key constraints |
|---|---|---:|---|
| `video_id` | string | No | Kling-generated; `last 30 days with a duration of no more than 60 seconds`; mutually exclusive with `video_url`, `neither can be left empty` |
| `video_url` | string | No | `.mp4/.mov, file size ≤100MB, duration 2s–60s, resolution 720p or 1080p, with both width and height between 512px–2160px` |

Response `data`: `session_id`, `final_unit_deduction`, `final_balance_deduction { quota, list_price }`, `face_data[] { face_id string, face_image url, start_time ms, end_time ms }`.

### 7.5 Image Recognition — `kling-img-recog.md`

**Image Recognition** — `POST /v1/videos/image-recognize` — synchronous; no task status.

| Field | Type | Required | Key constraints |
|---|---|---:|---|
| `image` | string | Yes | Base64 (raw) or URL; `.jpg / .jpeg / .png`; `cannot exceed 10MB … not be less than 300px … aspect ratio … between 1:2.5 ~ 2.5:1` |

Response `data`: `final_unit_deduction`, `final_balance_deduction`, `task_result.images[] { type, is_contain boolean, url }` with `type` values `object_seg`, `head_seg` (`with hair included`), `face_seg` (`without hair included`), `cloth_seg`. The sample JSON repeats `final_unit_deduction`/`final_balance_deduction` after `task_result` (duplicate keys, trailing comma — malformed sample).

### 7.6 Multi-element Video Reference Editing — `kling-multi-element-video-editing.md` (8 endpoints)

1. **Initialize** — `POST /v1/videos/multi-elements/init-selection`
   - Body: `video_id` string (No) / `video_url` string (No) — exactly one; `video_id`: `last 30 days`, duration `≥2 seconds and ≤5 seconds, or ≥7 seconds and ≤10 seconds`; `video_url`: `.mp4/.mov`, same duration windows, `resolution must be between 720px and 2160px (inclusive) in both width and height`, `frame rates of 24, 30, or 60 fps`.
   - Response `data`: `status int` (`Rejection code, non-zero indicates recognition failure`), `session_id` (`valid for 24 hours`), `final_unit_deduction`, `final_balance_deduction`, `fps float` (`required when fetching selection preview video`), `original_duration int` (`required when creating task`), `width int`, `height int` (`currently unused`), `total_frame int` (`required when creating task`), `normalized_video url`.
2. **Add Selection** — `POST /v1/videos/multi-elements/add-selection`
   - Body: `session_id` string (Yes), `frame_index` int (Yes; `A maximum of 10 frames can be marked`, `Only supports marking 1 frame at a time`), `points[]` (Yes) of `{ x float [0-1], y float [0-1] }` (`up to 10 points can be marked on a single frame`; `[0, 1] represents the top-left corner of the frame`).
   - Response `data`: `status`, `session_id`, deductions, `res { frame_index int, rle_mask_list[] { object_id int, rle_mask { size [h,w], counts string }, png_mask { size [h,w], base64 string } } }`. TypeScript RLE decoder + canvas renderer provided.
3. **Delete Selection** — `POST /v1/videos/multi-elements/delete-selection` — same body as Add; `Coordinates must exactly match those used when adding the video selection area`. Same response shape as Add.
4. **Clear Selection** — `POST /v1/videos/multi-elements/clear-selection` — body `session_id` (Yes). Response `data`: `status`, `session_id`, deductions (sample is malformed: missing comma, trailing comma).
5. **Preview** — `POST /v1/videos/multi-elements/preview-selection` — body `session_id` (Yes). Response `data.res { video url, video_cover url, tracking_output url }`.
6. **Create Task** — `POST /v1/videos/multi-elements`

   | Field | Type | Required | Default | Enum | Key constraints |
   |---|---|---:|---|---|---|
   | `session_id` | string | Yes | - | - | |
   | `edit_mode` | string | Yes | - | `addition`, `swap`, `removal` | |
   | `image_list` | array | No | - | - | addition: `required; upload 1–2 images`; swap: `required; upload 1 image only`; removal: `not required`; `The API does not perform cropping` |
   | `image_list[].image` | string | Yes | - | - | Base64 (raw) or URL; `.jpg / .jpeg / .png`; `≤10MB … ≥300px … 1:2.5 and 2.5:1` |
   | `prompt` | string | Yes | - | - | `Use the format <<<xxx>>> to explicitly refer to a specific video or image, such as <<<video_1>>> or <<<image_1>>>`; `Must not exceed 2,500 characters` |
   | `negative_prompt` | string | No | - | - | `Must not exceed 2,500 characters` |
   | `mode` | string | No | `std` | `std`, `pro` | |
   | `duration` | string | No | `5` | `5`, `10` | `To generate a 5-second video, the input video must be ≥2 seconds and ≤5 seconds`; `10-second … ≥7 seconds and ≤10 seconds` |
   | `watermark_info` | object | No | - | - | `{ "enabled": boolean }` |
   | `callback_url` | string | No | - | - | |
   | `external_task_id` | string | No | - | - | unique per account |

   Response `data`: `task_id`, `task_status` (`submitted, processing, succeed, failed`), `task_info.external_task_id`, timestamps.
7. **Query Task (Single)** — `GET /v1/videos/multi-elements/{id}` — `task_id` or `external_task_id`. Response adds `task_status_msg`, `task_result.videos[] { id, session_id, url, watermark_url, duration }`, `watermark_info.enabled`, `final_unit_deduction`, `final_balance_deduction`.
8. **Query Task (List)** — `GET /v1/videos/multi-elements?pageNum&pageSize`.

### 7.7 Text to Audio — `kling-text-to-audio.md`

**Create Task** — `POST /v1/audio/text-to-audio`

| Field | Type | Required | Key constraints |
|---|---|---:|---|
| `prompt` | string | Yes | `Cannot exceed 200 characters` |
| `duration` | float | Yes | `Value range: 3.0s - 10.0s, supports one decimal place precision` |
| `external_task_id` | string | No | unique per account |
| `callback_url` | string | No | |

Response `data`: `task_id`, `task_info.external_task_id`, `task_status` (`submitted, processing, succeed, failed`), timestamps.

**Query (Single)** — `GET /v1/audio/text-to-audio/{id}` (`task_id` or `external_task_id`). Response adds `task_status_msg`, `task_result.audios[] { id, url_mp3, url_wav, duration_mp3, duration_wav }`, `final_unit_deduction`, `final_balance_deduction`. **Query (List)** — `GET /v1/audio/text-to-audio?pageNum&pageSize`.

Note the field names here (`url_mp3`, `url_wav`, `duration_mp3`, `duration_wav`) vs the new-style callback's `mp3_url`, `wav_url`, `mp3_duration`, `wav_duration`.

### 7.8 Video to Audio — `kling-video-to-audio.md`

**Create Task** — `POST /v1/audio/video-to-audio`

| Field | Type | Required | Default | Key constraints |
|---|---|---:|---|---|
| `video_id` | string | No | - | exactly one of `video_id`/`video_url`; `generated within 30 days and with a duration between 3.0s and 20.0s` |
| `video_url` | string | No | - | `.mp4/.mov … File size does not exceed 100MB. Video duration between 3.0s and 20.0s.` |
| `sound_effect_prompt` | string | No | - | `Cannot exceed 200 characters` |
| `bgm_prompt` | string | No | - | `Cannot exceed 200 characters` |
| `asmr_mode` | boolean | No | `false` | |
| `external_task_id` | string | No | - | |
| `callback_url` | string | No | - | |

Response `data`: `task_id`, `task_info.external_task_id`, `task_status` (`submitted, processing, succeed, failed`), timestamps.

**Query (Single)** — `GET /v1/audio/video-to-audio/{id}`. Response `data`: `task_status_msg`, `task_info { external_task_id, parent_video { id, url, duration } }`, `task_result { videos[] { id, url, duration }, audios[] { id, url_mp3, url_wav, duration_mp3, duration_wav } }`, deductions. **Query (List)** — `GET /v1/audio/video-to-audio?pageNum&pageSize`.

### 7.9 Element Management — `kling-o1-element-mgt.md`, `kling-omni-3.0-element-mgt.md`, `kling-image-o1-elements.md`, `kling-image-omni-3.0-elements.md`

Doc-pair analysis (`diff`, 2026-09-20):
- `kling-o1-element-mgt.md` vs `kling-omni-3.0-element-mgt.md`: differ **only** in the `> Source:` URL and `> Sibling Tabs:` header lines. Body byte-identical. **Not materially different.**
- `kling-image-o1-elements.md` vs `kling-image-omni-3.0-elements.md`: same — only Source/Sibling Tabs lines. **Not materially different.**
- **Video** element docs vs **image** element docs (`kling-o1-element-mgt.md` vs `kling-image-o1-elements.md`): differ in Source/Sibling Tabs/BOM **and in exactly one body line**: the Delete path. Video docs: `- Path: \`/v1/general/delete-advanced-elements\``. Image docs: `- Path: \`/v1/general/delete-elements\``. Everything else (create/query/presets paths, bodies, responses) is identical. **Materially different in the delete path only.**

Every element doc carries this banner on Create/Query/Presets: `> The service related to creating entities has been upgraded to a brand new version. If you need to browse the old version, please proceed to:[Kling AI (OLD VERSION) ELEMENTS API Specification](https://ksurl.cn/QYFWJef0)` — and on Delete: `> The services related to the delete custom element have been directly upgraded, eliminating the need to browse other documents`.

**Create Element** — `POST /v1/general/advanced-custom-elements` (async task)

| Field | Type | Required | Default | Enum | Key constraints |
|---|---|---:|---|---|---|
| `element_name` | string | Yes | - | - | `Must not exceed 20 characters.` |
| `element_description` | string | Yes | - | - | `Must not exceed 100 characters.` |
| `reference_type` | string | Yes | - | `video_refer`, `image_refer` | `video_refer: Video Character Elements`; `image_refer: Multi-Image Elements` |
| `element_image_list` | object | No | `None` | - | `{ frontal_image: url, refer_images: [{ image_url }] }`; `at least one frontal reference image (frontal_image), and 1 to 3 additional reference images`; `.jpg / .jpeg / .png … 10MB … 300px … 1:2.5 ~ 2.5:1`; `When reference_type is image_refer, this parameter is required.` |
| `element_video_list` | object | No | `None` | - | `{ refer_videos: [{ video_url }] }`; `Only .mp4/.mov formats. Duration 3s–8s, 1080P, aspect ratio 16:9 or 9:16. At most 1 video, size not exceeding 200MB.`; `Required when referencing videos; invalid when referencing images.`; `only realistic-style humanoid figures can be customized through video`; `If the audio video contains human voice, it will trigger voice customization`; `Video-customized elements are only supported for kling-video-o3 and later models.` |
| `element_voice_id` | string | No | `None` | - | `When binding voices to multi-image elements, only character image elements or humanoid image elements are supported` |
| `tag_list` | array | No | `None` | - | `[{ tag_id }]`; `o_101 Hottest, o_102 Character, o_103 Animal, o_104 Item, o_105 Costume, o_106 Scene, o_107 Effect, o_108 Others` |
| `callback_url` | string | No | - | - | |
| `external_task_id` | string | No | - | - | unique per account |

Response `data`: `task_id`, `task_info.external_task_id`, `task_status` (`submitted, processing, succeed, failed`), timestamps.

**Query Custom Element (Single)** — `GET /v1/general/advanced-custom-elements/{id}` — path param `task_id` (Required: **Yes** here, unlike other docs), `external_task_id` (No; described as `Customized Task ID for audio generation` — copy-paste). Response `data.task_result.elements[] { element_id int, element_name, element_description, reference_type, element_image_list {}, element_video_list {}, element_voice_info { voice_id, voice_name, trial_url, owned_by }, tag_list [], owned_by ("kling is official element library"), status ("succeed when normal, deleted when removed") }`, plus `final_unit_deduction`, `final_balance_deduction`.

**Query Custom Element (List)** — `GET /v1/general/advanced-custom-elements?pageNum&pageSize`.

**Query Presets Element (List)** — `GET /v1/general/advanced-presets-elements?pageNum&pageSize` — same element shape, no deduction fields.

**Delete Custom Element** — `POST /v1/general/delete-advanced-elements` (video docs) / `POST /v1/general/delete-elements` (image docs). Body `element_id` string (Yes; `only supports deleting custom elements`). Response `data { task_id, task_status }`.

### 7.10 Voice Management — `kling-2.6-voice-mgt.md`, `kling-omni-3.0-voice-mgt.md`

Doc-pair: `diff` shows only Source/Sibling Tabs header lines differ. Body byte-identical. **Not materially different.**

**Create Custom Voice** — `POST /v1/general/custom-voices`

| Field | Type | Required | Key constraints |
|---|---|---:|---|
| `voice_name` | string | Yes | `maximum length … 20 characters` |
| `voice_url` | string | No | `.mp3 / .wav audio file and .mp4 / .mov video file`; `clean and free of noise, with only one type of human voice … no less than 5 seconds and no longer than 30 seconds` |
| `video_id` | string | No | Only: `generated on V2.6 model and the value of sound parameter is on`, or `generated through Avatar API`, or `generated through Lip-Sync API` |
| `callback_url` | string | No | |
| `external_task_id` | string | No | unique per account |

(`voice_url`/`video_id` exclusivity is not stated explicitly; the sample passes `"video_id": ""` with a `voice_url`.)

Response `data`: `task_id`, `task_info.external_task_id`, `task_status` (`submitted、processing、succeed、failed` — full-width separators in this file), timestamps.

**Query Custom Voice (Single)** — `GET /v1/general/custom-voices/{id}` — `task_id` (Yes; described as `The task ID of the element creation task` — copy-paste), `external_task_id` (No). Response `data.task_result.voices[] { voice_id, voice_name, trial_url ("URL for generating videos"), owned_by }`, deductions.

**Query Custom Voice (List)** — `GET /v1/general/custom-voices?pageNum&pageSize` — `pageSize` range `[1, 1000]`.

**Query Presets Voice (List)** — `GET /v1/general/presets-voices?pageNum&pageSize` — `[1, 1000]`; response items have no `task_info`/deductions.

**Delete Custom Voice** — `POST /v1/general/delete-voices` — body `voice_id` string (Yes; `only supports deleting custom voices`). Response `data { task_id, task_status }`.

### 7.11 Video Effects — `kling-effects-video-effects.md`

**Create Task** — `POST /v1/videos/effects`

> Total of 219 video effects are available. You can achieve different effects by calling effect_scene.

| Field | Type | Required | Key constraints |
|---|---|---:|---|
| `effect_scene` | string | Yes | Enum of 219 scene names (verified: 220 backticked tokens on the row minus the field name = 219; single-image list = 204 names, dual-image list = 15 names, 204+15=219). |
| `input` | object | Yes | `Fields vary depending on the scene.` |
| `input.image` | string | No | single-image effects; Base64 (raw) or URL; `.jpg / .jpeg / .png`; `≤10MB, dimensions: ≥300px, aspect ratio: 1:2.5 ~ 2.5:1` |
| `input.images` | array | No | dual-image effects; `Array length must be 2. The first image uploaded will be positioned on the left side of the composite photo, and the second image uploaded will be positioned on the right side.` |
| `callback_url` | string | No | |
| `external_task_id` | string | No | `must be unique for each user` |

Dual-image scenes (15): `pet_skateboard, daily_ootd, toss_run, switch_to_silk, studio_look, french_elegance, finger_swipe, smooth_transition, kiss_pro, snow_night_kiss, eternal_kiss, cheers_2026, fight_pro, hug_pro, heart_gesture_pro`. No `mode`, `duration`, or `watermark_info` request fields.

Response `data`: `task_id`, `task_status` (`submitted、processing、succeed、failed`), `task_info.external_task_id`, timestamps.

**Query Task (Single)** — `GET /v1/videos/effects/{id}` (`task_id` or `external_task_id`). Response `data`: `task_status_msg`, `task_result.videos[] { id, url, watermark_url }` (**no `duration`**), `watermark_info.enabled`, `final_unit_deduction`, `final_balance_deduction`. **Query Task (List)** — `GET /v1/videos/effects?pageNum&pageSize`; list items omit `watermark_info`.

---

## 8. TASK STATUS ENUM

Two spellings exist in the corpus.

**`succeed`** — every legacy resource doc that has a task status uses exactly `submitted, processing, succeed, failed` (some with full-width `、` separators). Per-file `grep -c 'succeed[,、 ]'` / `grep -c 'succeeded'` (2026-09-20):

| File | `succeed` lines | `succeeded` lines | Verbatim form |
|---|---:|---:|---|
| `kling-avatar.md` | 3 | 0 | `// Task status, Enum values: submitted, processing, succeed, failed` |
| `kling-text-to-speech.md` | 1 | 0 | same |
| `kling-lip-sync.md` | 3 | 0 | same |
| `kling-face-recog.md` | 0 | 0 | synchronous — no status field |
| `kling-img-recog.md` | 0 | 0 | synchronous — no status field |
| `kling-multi-element-video-editing.md` | 3 | 0 | same (the 5 selection endpoints use an int `status` rejection code instead) |
| `kling-text-to-audio.md` | 3 | 0 | same |
| `kling-video-to-audio.md` | 3 | 0 | same |
| `kling-o1-element-mgt.md` | 8 | 0 | `//Task status: submitted, processing, succeed, failed` and element `"status": "succeed" //Element status: succeed when normal, deleted when removed` |
| `kling-omni-3.0-element-mgt.md` | 8 | 0 | identical to o1 |
| `kling-image-o1-elements.md` | 8 | 0 | identical |
| `kling-image-omni-3.0-elements.md` | 8 | 0 | identical |
| `kling-2.6-voice-mgt.md` | 5 | 0 | `// Task status, Enum values：submitted、processing、succeed、failed` |
| `kling-omni-3.0-voice-mgt.md` | 5 | 0 | identical |
| `kling-effects-video-effects.md` | 3 | 0 | `//Task status, Enum values：submitted、processing、succeed、failed` (create) / `// Task status, Enum values: submitted, processing, succeed, failed` (query) |

Also `kling-get-started-callbacks.md` line 128 (Legacy Callback Function): `"task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed`.

**`succeeded`** — the new-standard shape. In the assigned set it appears only in `kling-get-started-callbacks.md`: line 36 `"status": "string", // Task status, Enum values: submitted, processing, succeeded, failed`; line 69 voice `status` enum `succeeded, deleted`; line 98 element `status` enum `succeeded, deleted`; line 548 test vector body `"status":"succeeded"`. Control outside the assigned set: `kling-3.0-turbo-t2v.md` has 10 `succeeded` hits.

The element/voice **resource** status also flips spelling: legacy element docs `status: "succeed" | "deleted"` vs new callback `outputs[].status: "succeeded" | "deleted"`.

---

## 9. OPEN QUESTIONS / CONTRADICTIONS

1. **Legacy callback applicability vs the 07/15/2026 migration.** `kling-get-started-callbacks.md` says the Legacy Callback is `Applicable to Kling 3.0 Omni and earlier models`, while `kling-updates-api.md` 07/15/2026 says Kling 3.0 Omni, 3.0, 2.6, 2.5 Turbo were added to the new API. Which callback shape a 3.0 Omni task emits presumably depends on which path it was created through, but the callback page frames it by model, not by path. Unresolved.

2. **Legacy callback `task_result` coverage.** Only `images[]` and `videos[]` are documented (`kling-get-started-callbacks.md` lines 145-159). Legacy resource docs return `audios[]` (TTS, T2A, V2A), `elements[]` (element mgmt), `voices[]` (voice mgmt), and `videos[].watermark_url`/`session_id`. Whether callbacks for those products carry those arrays is undocumented.

3. **Callback delivery retry/timeout: undocumented.** Zero hits for retry/timeout in both callback files. Nothing states how long Kling waits for the 200, or whether/how it retries a non-200.

4. **`options.callback_url` vs `callback_url`.** The Webhook Signature prerequisites cite `options.callback_url` (new body shape); every legacy doc uses top-level `callback_url`. Whether signature headers are also attached to legacy-path callbacks is not stated (the mechanism is described as adding headers to "callback requests" generally).

5. **API Key on `/v1/` is inferred, not stated.** The auth page's `(for all models)` heading, the universal `Bearer <API_KEY>` Auth lines in legacy docs, and the 06/17/2026 `Fully compatible with existing models` entry all point one way, but no sentence says "API Key works on legacy endpoints". Conversely, 06/17/2026 says the new API is `API Key only`; the auth page never says JWT is rejected on new paths.

6. **`model_name` absent from all legacy resource docs.** The auth page defines legacy as `the value set as the model_name parameter`, yet none of the 15 legacy resource docs have a `model_name` field (grep, zero hits). These endpoints are legacy by path/response shape only. The `model_name` definition therefore fails to classify avatar, lip-sync, effects, elements, voices, audio, recognition.

7. **`kling-video-o3`.** Element docs: `Video-customized elements are only supported for kling-video-o3 and later models.` No model by that name appears anywhere else in the directory (`grep -rn "kling-video-o3" .` → only the four element docs). Likely a typo for `kling-v3-omni`/`kling-video-o1`; unverifiable from docs. `[VERIFY]`

8. **Delete-element path split.** Video element docs: `/v1/general/delete-advanced-elements`; image element docs: `/v1/general/delete-elements`. Both are attached to the same `advanced-custom-elements` create/query surface with an otherwise identical body. Whether these are two live endpoints or one is a stale copy is not determinable from the docs.

9. **`magic_match_tree` still in the `effect_scene` enum** (`kling-effects-video-effects.md` line 39) despite `kling-updates-api.md` 07/03/2026: `magic_match_tree will be discontinued on July 3rd, 2026`. The earlier discontinued names (`kiss`, `hug`, `fight`, `thumbs_up`, `tiger_hug`, `pet_lion`, `3d_cartoon_1`, `celebration`, `c4d_cartoon`) are absent from the enum (grep, 0 each), so this one looks stale.

10. **QPS statements conflict.** Concurrency page: `The system does not impose any QPS limits.` vs error codes 1302 (`rate limit exceeded`) / 1303 (`Concurrency or QPS exceeds…`) and `/account/costs` (`QPS<=1`).

11. **`pageSize` range inconsistency.** Voice-mgt docs: `[1, 1000]`; every other legacy list endpoint: `[1, 500]`.

12. **Query-by-`external_task_id` inconsistency.** Lip-sync Query (Single) lists only `task_id`; avatar, multi-elements, T2A, V2A, effects list both; element/voice docs mark `task_id` Required: Yes while also allowing `external_task_id`.

13. **TTS `voice_language` is `Required: Yes` with `Default: zh`** — contradictory. TTS also has no query endpoints and no `callback_url`/`external_task_id`, unlike every other legacy task API.

14. **Audio field-name drift.** Legacy T2A/V2A: `url_mp3`, `url_wav`, `duration_mp3`, `duration_wav`; new callback `outputs[].type=audio`: `mp3_url`, `wav_url`, `mp3_duration`, `wav_duration`.

15. **`/account/costs` double envelope.** Response has `data.code` and `data.msg` (not `message`) nested inside the standard `{ code, message, request_id, data }` — the only endpoint in the set with this shape.

16. **`start_time`/`end_time` on `/account/billing/*` marked `Required: No`** in the table but `Required when cursor is empty` in the notes. Conditional requirement; table is misleading.

17. **Malformed sample JSON** (not contract-affecting, but noting for anyone generating types from them): `kling-img-recog.md` duplicates `final_unit_deduction`/`final_balance_deduction` and has a trailing comma; `kling-multi-element-video-editing.md` init-selection response is missing a closing brace and clear-selection is missing a comma; `kling-2.6-voice-mgt.md` List response is missing a comma after `task_result`; `kling-effects-video-effects.md` `videos[]` items end with a trailing comma; element docs' curl samples have `'Content-Type: application/json\'` and `"element_voice_id": string` (unquoted).

18. **Effects `watermark_info`.** Create Task has no `watermark_info` request field, yet Query (Single) returns `watermark_info.enabled` and `videos[].watermark_url`; Query (List) omits `watermark_info`. Effects `videos[]` also lacks `duration` unlike every other video-producing endpoint.

19. **Skill page vs auth page on API Key.** `kling-get-started-kling-skills.md` (`Last updated: 2026/04/01`): `Unable to access through API Key temporarily, expected to support within June`. Refers to the third-party Skill's credential binding; predates the 06/17/2026 API Key release. Not an API contradiction, but a stale page.

20. **No model discontinuations anywhere.** For `kling-v1`, `kling-v1-5`, `kling-v1-6`, `kling-v2-master`, `kling-v2-1`, `kling-v2-1-master`, `kling-v2`, `kling-v2-new`, `kling-video-o1`, `kling-image-o1`: the updates log records launches only. The lone policy statement is 07/15/2026 `The legacy API will continue to be available with no current plans for deprecation.` Any "superseded" claim for these models would be an inference from newer launches, not a documented fact.
