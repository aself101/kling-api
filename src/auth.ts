/**
 * Kling API JWT Authentication Module
 *
 * Handles JWT token generation and caching for Kling API authentication.
 * Uses HS256 algorithm with AccessKey and SecretKey.
 */

import jwt from 'jsonwebtoken';

/** JWT payload structure for Kling API */
interface KlingJwtPayload {
  /** Issuer - the AccessKey */
  iss: string;
  /** Expiration time (Unix timestamp in seconds) */
  exp: number;
  /** Not before time (Unix timestamp in seconds) */
  nbf: number;
}

/** JWT header structure */
interface KlingJwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

/**
 * Kling API Authentication Handler
 *
 * Manages JWT token generation and caching for API requests.
 * Tokens are cached for 25 minutes (with 5 minute buffer before expiry).
 *
 * @example
 * ```typescript
 * const auth = new KlingAuth('your-access-key', 'your-secret-key');
 * const token = auth.getValidToken();
 * // Use token in Authorization header: `Bearer ${token}`
 * ```
 */
export class KlingAuth {
  private accessKey: string;
  private secretKey: string;
  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  /** Token validity duration in seconds (30 minutes) */
  private static readonly TOKEN_VALIDITY_SECONDS = 1800;

  /** Cache buffer in seconds (refresh 5 minutes before expiry) */
  private static readonly CACHE_BUFFER_SECONDS = 300;

  /** Clock skew tolerance in seconds */
  private static readonly CLOCK_SKEW_SECONDS = 5;

  /**
   * Create a new KlingAuth instance
   *
   * @param accessKey - Kling API Access Key
   * @param secretKey - Kling API Secret Key
   * @throws Error if accessKey or secretKey is empty
   */
  constructor(accessKey: string, secretKey: string) {
    if (!accessKey || accessKey.trim() === '') {
      throw new Error('Access key is required for Kling API authentication');
    }
    if (!secretKey || secretKey.trim() === '') {
      throw new Error('Secret key is required for Kling API authentication');
    }

    this.accessKey = accessKey.trim();
    this.secretKey = secretKey.trim();
  }

  /**
   * Generate a new JWT token
   *
   * Creates a JWT with:
   * - Header: { alg: 'HS256', typ: 'JWT' }
   * - Payload: { iss: accessKey, exp: now + 1800, nbf: now - 5 }
   * - Signature: HMAC-SHA256 with secretKey
   *
   * @returns Generated JWT token string
   */
  generateToken(): string {
    const now = Math.floor(Date.now() / 1000);

    const header: KlingJwtHeader = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const payload: KlingJwtPayload = {
      iss: this.accessKey,
      exp: now + KlingAuth.TOKEN_VALIDITY_SECONDS,
      nbf: now - KlingAuth.CLOCK_SKEW_SECONDS,
    };

    const token = jwt.sign(payload, this.secretKey, {
      algorithm: 'HS256',
      header,
    });

    // Update cache
    this.cachedToken = token;
    this.tokenExpiry = payload.exp;

    return token;
  }

  /**
   * Check if the cached token is still valid
   *
   * Returns false if:
   * - No token is cached
   * - Token expires within the buffer period (5 minutes)
   *
   * @returns True if cached token is valid, false otherwise
   */
  isTokenValid(): boolean {
    if (!this.cachedToken) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const bufferTime = now + KlingAuth.CACHE_BUFFER_SECONDS;

    return this.tokenExpiry > bufferTime;
  }

  /**
   * Get a valid token, generating a new one if necessary
   *
   * This is the primary method to use for getting tokens.
   * It returns the cached token if valid, or generates a new one.
   *
   * @returns Valid JWT token string
   */
  getValidToken(): string {
    if (this.isTokenValid() && this.cachedToken) {
      return this.cachedToken;
    }

    return this.generateToken();
  }

  /**
   * Force generation of a new token, bypassing the cache
   *
   * Use this if you suspect the token has been invalidated server-side.
   *
   * @returns Newly generated JWT token string
   */
  refreshToken(): string {
    return this.generateToken();
  }

  /**
   * Get the Authorization header value
   *
   * @returns Bearer token string for Authorization header
   */
  getAuthorizationHeader(): string {
    return `Bearer ${this.getValidToken()}`;
  }

  /**
   * Clear the cached token
   *
   * Forces the next getValidToken() call to generate a new token.
   */
  clearCache(): void {
    this.cachedToken = null;
    this.tokenExpiry = 0;
  }

  /**
   * Get time until token expiry in seconds
   *
   * @returns Seconds until expiry, or 0 if no valid token
   */
  getTimeUntilExpiry(): number {
    if (!this.cachedToken) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    const remaining = this.tokenExpiry - now;

    return Math.max(0, remaining);
  }

  /**
   * Get a redacted version of the access key for logging
   *
   * Shows only the last 4 characters to protect credentials.
   *
   * @returns Redacted access key string
   */
  getRedactedAccessKey(): string {
    if (this.accessKey.length <= 4) {
      return '****';
    }
    return `***${this.accessKey.slice(-4)}`;
  }

  /**
   * Validate that credentials are properly formatted
   *
   * Checks that accessKey and secretKey meet basic requirements.
   * Does NOT verify they are valid with the API.
   *
   * @returns True if credentials appear valid
   */
  validateCredentials(): boolean {
    // Access keys and secret keys should be non-empty strings
    // Additional format validation can be added based on Kling's key format
    return (
      typeof this.accessKey === 'string' &&
      this.accessKey.length > 0 &&
      typeof this.secretKey === 'string' &&
      this.secretKey.length > 0
    );
  }
}

/**
 * Decode a JWT token without verification (for debugging)
 *
 * WARNING: This does not verify the token signature.
 * Only use for debugging/logging purposes.
 *
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
export function decodeToken(token: string): KlingJwtPayload | null {
  try {
    const decoded = jwt.decode(token) as KlingJwtPayload | null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired (without verification)
 *
 * @param token - JWT token string
 * @returns True if token is expired or invalid
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded?.exp) {
    return true;
  }

  const now = Math.floor(Date.now() / 1000);
  return decoded.exp <= now;
}

export default KlingAuth;
