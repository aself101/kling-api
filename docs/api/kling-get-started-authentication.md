> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Authentication

> Source: https://kling.ai/document-api/api/get-started/authentication
> Locale: en
> Current Tab: Authentication
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Domain

```bash
https://api-singapore.klingai.com
```

> **Notice**: The API endpoint has been changed from https://api.klingai.com to **https://api-singapore.klingai.com**. This API is suitable for users whose servers are located outside of China.

## Authentication

### API Key (for all models)

API Key authentication must be used to call Kling AI API. The sensitivity of this key is high, and leakage can lead to the theft of call limits. Therefore, it is recommended to configure the API Key to be used in the environment variable. The specific configuration method is as follows.

- Step 1: Open the Kling AI console and log in.
- Step 2: Click the "**+ Create a new API Key**" button.
- Step 3: In the popup, name your **API Key** and confirm. The **API Key** will then be displayed on the page.
- Step 4: Copy the **API Key**. It will only be shown once — please store it securely.
- Step 5: Add the **API Key** to the **Request Header** as an **Authorization** field.
    - Format: **Authorization = "Bearer XXX"**, where XXX is the **API Key** obtained in Step 1 (Note: include a space between "Bearer" and the key.)

### Access Key / Secret Key (API only applicable to legacy version design standards) (How to distinguish between new and legacy API design standards? The model version information located in the path is the new version, while the value set as the model_name parameter is the legacy version.)

- Step-1：Obtain **AccessKey** + **SecretKey**
- Step-2：For each API request, you need to generate an API Token using the following encryption method; put Authorization = Bearer \<API Token\> in the Request Header
    - Encryption Method：Follow JWT（Json Web Token, RFC 7519）standard
    - A JWT consists of three parts: Header, Payload, and Signature.

```python
import time
import jwt

ak = "" # fill access key
sk = "" # fill secret key

def encode_jwt_token(ak, sk):
    headers = {
        "alg": "HS256",
        "typ": "JWT"
    }
    payload = {
        "iss": ak,
        "exp": int(time.time()) + 1800, # The valid time, in this example, represents the current time+1800s(30min)
        "nbf": int(time.time()) - 5 # The time when it starts to take effect, in this example, represents the current time -5s
    }
    token = jwt.encode(payload, sk, headers=headers)
    return token

authorization = encode_jwt_token(ak, sk)
print(authorization) # Printing the generated API_TOKEN
```

```java
package test;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

public class JWTDemo {

    static String ak = ""; // fill access key
    static String sk = ""; // fill secret key

    public static void main(String[] args) {
        String token = sign(ak, sk);
        System.out.println(token); // Printing the generated API_TOKEN
    }
    static String sign(String ak,String sk) {
        try {
            Date expiredAt = new Date(System.currentTimeMillis() + 1800*1000); // The valid time, in this example, represents the current time+1800s(30min)
            Date notBefore = new Date(System.currentTimeMillis() - 5*1000); // The time when it starts to take effect, in this example, represents the current time minus 5s
            Algorithm algo = Algorithm.HMAC256(sk);
            Map<String, Object> header = new HashMap<String, Object>();
            header.put("alg", "HS256");
            return JWT.create()
                    .withIssuer(ak)
                    .withHeader(header)
                    .withExpiresAt(expiredAt)
                    .withNotBefore(notBefore)
                    .sign(algo);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}
```

- Step-3: Use the API Token generated in Step 2 to construct the Authorization header and include it in the request header.
    - Format: Authorization: Bearer XXX, where XXX is the API Token generated in Step 2.
    - Note: There should be a space between Bearer and XXX.
