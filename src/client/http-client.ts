/**
 * Kling HTTP Client
 *
 * Core HTTP client for making authenticated requests to the Kling API.
 * Handles authentication, retries, and error transformation.
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';

import { KlingAuth } from '../auth.js';
import { KlingAPIError } from '../errors.js';
import { BASE_URL, DEFAULT_TIMEOUT, ERROR_CODES, loadCredentials } from '../config/index.js';
import { sanitizeError, isProduction, logger, BACKOFF_BASE_MS } from '../utils/index.js';
import type { KlingConfig } from '../types.js';

/**
 * HTTP Client for Kling API
 *
 * Provides low-level HTTP methods with authentication, retry logic,
 * and error handling.
 */
export class KlingHttpClient {
  private auth: KlingAuth;
  /** @internal Exposed for testing only */
  public client: AxiosInstance;
  private baseUrl: string;
  private debug: boolean;

  /**
   * Create a new KlingHttpClient instance
   *
   * @param config - API configuration
   * @throws Error if credentials are not provided
   */
  constructor(config: KlingConfig = {}) {
    // Load credentials with priority chain
    const credentials = loadCredentials(config.accessKey, config.secretKey);

    if (!credentials.accessKey || !credentials.secretKey) {
      throw new Error(
        'Kling API credentials not found. Provide accessKey and secretKey via:\n' +
          '1. Constructor parameters\n' +
          '2. Environment variables (KLING_ACCESS_KEY, KLING_SECRET_KEY)\n' +
          '3. Local .env file\n' +
          '4. Global ~/.kling/.env file'
      );
    }

    this.auth = new KlingAuth(credentials.accessKey, credentials.secretKey);
    this.baseUrl = config.baseUrl ?? BASE_URL;
    this.debug = config.debug ?? false;

    // Validate HTTPS
    if (!this.baseUrl.startsWith('https://')) {
      throw new Error('Base URL must use HTTPS protocol');
    }

    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for auth
    this.client.interceptors.request.use((requestConfig) => {
      // Ensure headers object exists (use plain object for compatibility)
      const headers = requestConfig.headers ?? {};
      headers.Authorization = this.auth.getAuthorizationHeader();
      requestConfig.headers = headers;
      return requestConfig;
    });

    if (this.debug) {
      logger.debug(`KlingHttpClient initialized with base URL: ${this.baseUrl}`);
      logger.debug(`Using access key: ${this.auth.getRedactedAccessKey()}`);
    }
  }

  /**
   * Make an API request with error handling and retries
   *
   * @param method - HTTP method (GET or POST)
   * @param endpoint - API endpoint path
   * @param data - Request data (query params for GET, body for POST)
   * @param retries - Number of retry attempts for transient errors
   * @returns Response data
   */
  async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: Record<string, unknown>,
    retries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (this.debug) {
          logger.debug(`[${method}] ${endpoint} (attempt ${attempt}/${retries})`);
        }

        const response =
          method === 'GET'
            ? await this.client.get<T>(endpoint, { params: data })
            : await this.client.post<T>(endpoint, data);

        return response.data;
      } catch (error) {
        lastError = this.handleError(error);

        // Check if retryable
        if (lastError instanceof KlingAPIError && lastError.isRetryable() && attempt < retries) {
          const delay = Math.pow(2, attempt) * BACKOFF_BASE_MS; // Exponential backoff
          if (this.debug) {
            logger.debug(`Retrying in ${delay}ms...`);
          }
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /**
   * Handle and transform API errors
   *
   * @param error - Error from axios or other source
   * @returns Transformed error
   */
  private handleError(error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{
        code: number;
        message: string;
        request_id?: string;
      }>;

      if (axiosError.response) {
        const { status, data } = axiosError.response;
        const code = data?.code || status;
        const message = data?.message || axiosError.message;
        const requestId = data?.request_id;

        // Sanitize error in production
        const finalMessage = isProduction() ? sanitizeError(message, false) : message;

        return new KlingAPIError(finalMessage, code, requestId, status);
      }

      if (axiosError.code === 'ECONNABORTED') {
        return new KlingAPIError('Request timeout', ERROR_CODES.SERVICE_UNAVAILABLE);
      }

      return new KlingAPIError(axiosError.message, ERROR_CODES.INTERNAL_ERROR);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error(String(error));
  }

  /**
   * Get the current authentication token (for debugging)
   *
   * @returns Current JWT token
   */
  getToken(): string {
    return this.auth.getValidToken();
  }

  /**
   * Force refresh the authentication token
   */
  refreshToken(): void {
    this.auth.refreshToken();
  }

  /**
   * Get the redacted access key for logging
   *
   * @returns Redacted access key
   */
  getRedactedAccessKey(): string {
    return this.auth.getRedactedAccessKey();
  }
}
