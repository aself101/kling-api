> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Error Codes

> Source: https://kling.ai/document-api/api/get-started/error-codes
> Locale: en
> Current Tab: Error Codes
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

| HTTP Status Code | Service Code | Definition of Service Code | Explanation of Service Code | Suggested Solutions  |
| ---------- | ------ | ------------ | --------------------------------- | ----------------------------------------------- |
| 200        | 0      | Request successful     | -                                 | -                                               |
| 401        | 1000   | Authentication failed | Authentication failed   | Check if the Authorization is correct              |
| 401        | 1001   | Authentication failed | Authorization is empty | Fill in the correct Authorization in the Request Header |
| 401        | 1002   | Authentication failed | Authorization is invalid | Fill in the correct Authorization in the Request Header |
| 401        | 1003   | Authentication failed | Authorization is not yet valid | Check the start effective time of the token, wait for it to take effect or reissue  |
| 401        | 1004   | Authentication failed | Authorization has expired | Check the validity period of the token and reissue it |
| 429        | 1100   | Account exception     | Abnormal account status | Verifying account configuration information |
| 429        | 1101   | Account exception     | Account in arrears (postpaid scenario) | Recharge the account to ensure sufficient balance |
| 429        | 1102   | Account exception     | Resource pack exhausted or expired (prepaid scenario) | Purchase additional resource packages, or activate the post-payment service (if available) |
| 403        | 1103   | Account exception     | Unauthorized access to requested resource, such as API/model     | Verifying account permissions  |
| 400        | 1200   | Invalid request parameters | Invalid request parameters | Check whether the request parameters are correct  |
| 400        | 1201   | Invalid request parameters | Invalid parameters, such as an incorrect key or invalid value  | Refer to the specific information in the message field of the returned body and modify the request parameters |
| 404        | 1202   | Invalid request parameters | The requested method is invalid | Review the API documentation and use the correct request method |
| 404        | 1203   | Invalid request parameters | The requested resource does not exist, such as the model | Refer to the specific information in the message field and modify the request parameters |
| 400        | 1300   | Trigger strategy     | Request blocked by platform policy   | Check if any platform policies have been triggered |
| 400        | 1301   | Trigger strategy     | Trigger the platform's content security policy          | Check the input content, modify it, and resend the request  |
| 429        | 1302   | Trigger strategy     | Too many requests; rate limit exceeded  | Reduce the request frequency, try again later, or contact customer service to increase the limit |
| 429        | 1303   | Trigger strategy     | Concurrency or QPS exceeds the prepaid resource package limit   | Reduce the request frequency, try again later, or contact customer service to increase the limit |
| 429        | 1304   | Trigger strategy     | Trigger the platform's IP whitelist policy | Contact customer service |
| 500        | 5000   | Internal error     | Server internal error   | Try again later, or contact customer service |
| 503        | 5001   | Internal error     | Server temporarily unavailable, usually due to maintenance | Try again later, or contact customer service |
| 504        | 5002   | Internal error     | Server internal timeout, usually due to a backlog | Try again later, or contact customer service |
