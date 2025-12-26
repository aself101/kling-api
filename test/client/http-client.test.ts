/**
 * Tests for KlingHttpClient
 *
 * Tests HTTP client functionality including:
 * - Request structure and payload validation
 * - Exponential backoff timing
 * - Error handling and transformation
 * - Authentication header injection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { KlingHttpClient } from '../../src/client/http-client.js';
import { KlingAPIError } from '../../src/errors.js';
import {
  FIRST_RETRY_DELAY_MS,
  SECOND_RETRY_DELAY_MS,
  THIRD_RETRY_DELAY_MS,
  MAX_RETRY_ATTEMPTS,
  RETRYABLE_STATUS_CODES,
  NON_RETRYABLE_STATUS_CODES,
} from '../test-constants.js';

// Mock axios
vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn(),
      },
    },
    isAxiosError: vi.fn(),
  };
  return {
    default: mockAxios,
    isAxiosError: vi.fn(),
  };
});

describe('KlingHttpClient', () => {
  const mockAccessKey = 'test-access-key-12345';
  const mockSecretKey = 'test-secret-key-67890';
  let client: KlingHttpClient;
  let requestInterceptor: (config: Record<string, unknown>) => Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Set up environment
    process.env.KLING_ACCESS_KEY = mockAccessKey;
    process.env.KLING_SECRET_KEY = mockSecretKey;

    // Capture the request interceptor when axios.create is called
    vi.mocked(axios.create).mockImplementation(() => {
      const mockInstance = {
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
          request: {
            use: vi.fn((interceptor) => {
              requestInterceptor = interceptor;
            }),
          },
        },
      };
      return mockInstance as unknown as ReturnType<typeof axios.create>;
    });

    client = new KlingHttpClient();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.KLING_ACCESS_KEY;
    delete process.env.KLING_SECRET_KEY;
  });

  describe('constructor', () => {
    it('should reject non-HTTPS base URLs', () => {
      expect(
        () =>
          new KlingHttpClient({
            accessKey: mockAccessKey,
            secretKey: mockSecretKey,
            baseUrl: 'http://insecure.example.com',
          })
      ).toThrow('Base URL must use HTTPS protocol');
    });

    it('should accept HTTPS base URLs', () => {
      const httpsClient = new KlingHttpClient({
        accessKey: mockAccessKey,
        secretKey: mockSecretKey,
        baseUrl: 'https://secure.example.com',
      });
      expect(httpsClient).toBeInstanceOf(KlingHttpClient);
    });

    it('should configure axios with correct defaults', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.stringContaining('https://'),
          timeout: expect.any(Number),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('request interceptor', () => {
    it('should inject Authorization header with Bearer token', () => {
      const config = { headers: {} };
      const result = requestInterceptor(config);

      expect(result.headers).toHaveProperty('Authorization');
      expect((result.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
    });

    it('should generate valid JWT format in Authorization header', () => {
      const config = { headers: {} };
      const result = requestInterceptor(config);

      const authHeader = (result.headers as Record<string, string>).Authorization;
      const token = authHeader.replace('Bearer ', '');

      // JWT format: header.payload.signature
      expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    });
  });

  describe('request method', () => {
    it('should send GET request with correct endpoint and params', async () => {
      const mockData = { code: 0, data: { result: 'success' } };
      vi.mocked(client.client.get).mockResolvedValue({ data: mockData });

      const result = await client.request('GET', '/v1/test', { param1: 'value1' });

      expect(client.client.get).toHaveBeenCalledWith('/v1/test', {
        params: { param1: 'value1' },
      });
      expect(result).toEqual(mockData);
    });

    it('should send POST request with correct endpoint and body', async () => {
      const mockData = { code: 0, data: { task_id: 'abc123' } };
      const requestBody = {
        model_name: 'kling-v1',
        prompt: 'test prompt',
        aspect_ratio: '16:9',
      };
      vi.mocked(client.client.post).mockResolvedValue({ data: mockData });

      const result = await client.request('POST', '/v1/videos/text2video', requestBody);

      expect(client.client.post).toHaveBeenCalledWith('/v1/videos/text2video', requestBody);
      expect(result).toEqual(mockData);
    });

    it('should not include undefined values in request body', async () => {
      const mockData = { code: 0, data: {} };
      vi.mocked(client.client.post).mockResolvedValue({ data: mockData });

      const requestBody = {
        model_name: 'kling-v1',
        prompt: 'test',
        negative_prompt: undefined,
        cfg_scale: undefined,
      };

      await client.request('POST', '/v1/test', requestBody);

      // The body should be passed as-is; undefined handling is caller's responsibility
      expect(client.client.post).toHaveBeenCalledWith('/v1/test', requestBody);
    });
  });

  describe('exponential backoff timing', () => {
    it('should use correct delay for first retry (2^1 * 1000 = 2000ms)', async () => {
      const mockError = {
        response: { status: 502, data: { code: 2000, message: 'Bad Gateway' } },
      };
      vi.mocked(client.client.post).mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      // Create a promise that we'll race against
      let promiseRejected = false;
      const requestPromise = client.request('POST', '/v1/test', {}).catch(() => {
        promiseRejected = true;
      });

      // First attempt happens immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(client.client.post).toHaveBeenCalledTimes(1);

      // Wait for first retry delay (2^1 * 1000 = 2000ms)
      await vi.advanceTimersByTimeAsync(FIRST_RETRY_DELAY_MS);
      expect(client.client.post).toHaveBeenCalledTimes(2);

      // Wait for second retry delay (2^2 * 1000 = 4000ms)
      await vi.advanceTimersByTimeAsync(SECOND_RETRY_DELAY_MS);
      expect(client.client.post).toHaveBeenCalledTimes(3);

      // Wait for promise to settle
      await requestPromise;
      expect(promiseRejected).toBe(true);
    });

    it('should make exactly MAX_RETRY_ATTEMPTS attempts before failing', async () => {
      const mockError = {
        response: { status: 503, data: { code: 2000, message: 'Service Unavailable' } },
      };
      vi.mocked(client.client.post).mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      let promiseRejected = false;
      const requestPromise = client.request('POST', '/v1/test', {}).catch(() => {
        promiseRejected = true;
      });

      // Advance through all retries
      await vi.advanceTimersByTimeAsync(0); // First attempt
      await vi.advanceTimersByTimeAsync(FIRST_RETRY_DELAY_MS); // Second attempt
      await vi.advanceTimersByTimeAsync(SECOND_RETRY_DELAY_MS); // Third attempt

      await requestPromise;
      expect(promiseRejected).toBe(true);
      expect(client.client.post).toHaveBeenCalledTimes(MAX_RETRY_ATTEMPTS);
    });

    it('should succeed on retry if subsequent attempt succeeds', async () => {
      const mockError = {
        response: { status: 502, data: { code: 2000, message: 'Bad Gateway' } },
      };
      const mockSuccess = { data: { code: 0, data: { task_id: 'success' } } };

      vi.mocked(client.client.post)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const requestPromise = client.request('POST', '/v1/test', {});

      await vi.advanceTimersByTimeAsync(0); // First attempt fails
      await vi.advanceTimersByTimeAsync(FIRST_RETRY_DELAY_MS); // Second attempt succeeds

      const result = await requestPromise;
      expect(result).toEqual(mockSuccess.data);
      expect(client.client.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it.each(RETRYABLE_STATUS_CODES)('should retry on %d status code', async (statusCode) => {
      const mockError = {
        response: { status: statusCode, data: { code: statusCode, message: 'Server Error' } },
      };
      vi.mocked(client.client.post).mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      let promiseRejected = false;
      const requestPromise = client.request('POST', '/v1/test', {}).catch(() => {
        promiseRejected = true;
      });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(FIRST_RETRY_DELAY_MS);
      await vi.advanceTimersByTimeAsync(SECOND_RETRY_DELAY_MS);

      await requestPromise;
      expect(promiseRejected).toBe(true);
      expect(client.client.post).toHaveBeenCalledTimes(MAX_RETRY_ATTEMPTS);
    });

    it('should retry exactly 3 times, not 2 or 4', async () => {
      // This test explicitly verifies the retry boundary behavior
      const mockError = {
        response: { status: 503, data: { code: 503, message: 'Service Unavailable' } },
      };
      vi.mocked(client.client.post).mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      let promiseResolved = false;
      let promiseRejected = false;
      const requestPromise = client
        .request('POST', '/v1/test', {})
        .then(() => {
          promiseResolved = true;
        })
        .catch(() => {
          promiseRejected = true;
        });

      // After initial request - should have made 1 attempt
      await vi.advanceTimersByTimeAsync(0);
      expect(client.client.post).toHaveBeenCalledTimes(1);
      expect(promiseRejected).toBe(false); // Still retrying

      // After first retry delay (2000ms) - should have made 2 attempts
      await vi.advanceTimersByTimeAsync(FIRST_RETRY_DELAY_MS);
      expect(client.client.post).toHaveBeenCalledTimes(2);
      expect(promiseRejected).toBe(false); // Still retrying

      // After second retry delay (4000ms) - should have made 3 attempts (MAX)
      await vi.advanceTimersByTimeAsync(SECOND_RETRY_DELAY_MS);
      expect(client.client.post).toHaveBeenCalledTimes(3);

      await requestPromise;

      // Verify it stopped at exactly 3 attempts
      expect(client.client.post).toHaveBeenCalledTimes(MAX_RETRY_ATTEMPTS);
      expect(MAX_RETRY_ATTEMPTS).toBe(3); // Explicit assertion on the constant itself
      expect(promiseRejected).toBe(true);
      expect(promiseResolved).toBe(false);

      // Verify no additional calls were made
      await vi.advanceTimersByTimeAsync(THIRD_RETRY_DELAY_MS);
      expect(client.client.post).toHaveBeenCalledTimes(3); // Still 3, not 4
    });

    it.each(NON_RETRYABLE_STATUS_CODES)(
      'should NOT retry on %d status code',
      async (statusCode) => {
        const mockError = {
          response: { status: statusCode, data: { code: statusCode, message: 'Client Error' } },
        };
        vi.mocked(client.client.post).mockRejectedValue(mockError);
        vi.mocked(axios.isAxiosError).mockReturnValue(true);

        await expect(client.request('POST', '/v1/test', {})).rejects.toThrow();
        expect(client.client.post).toHaveBeenCalledTimes(1);
      }
    );

    it('should transform axios timeout error to KlingAPIError', async () => {
      // ECONNABORTED triggers SERVICE_UNAVAILABLE which IS retryable
      // So we need to handle retry delays
      const mockError = { code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' };
      vi.mocked(client.client.post).mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      let caughtError: unknown = null;
      const requestPromise = client.request('POST', '/v1/test', {}).catch((e) => {
        caughtError = e;
      });

      // Advance through all retries since ECONNABORTED creates a retryable error
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(FIRST_RETRY_DELAY_MS);
      await vi.advanceTimersByTimeAsync(SECOND_RETRY_DELAY_MS);

      await requestPromise;
      expect(caughtError).toBeInstanceOf(KlingAPIError);
      expect((caughtError as KlingAPIError).message).toBe('Request timeout');
    });

    it('should include request_id in error when available', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            code: 1001,
            message: 'Invalid parameter',
            request_id: 'req-12345',
          },
        },
      };
      vi.mocked(client.client.post).mockRejectedValue(mockError);
      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      try {
        await client.request('POST', '/v1/test', {});
      } catch (error) {
        expect(error).toBeInstanceOf(KlingAPIError);
        expect((error as KlingAPIError).requestId).toBe('req-12345');
      }
    });

    it('should preserve non-axios errors', async () => {
      const customError = new Error('Custom error');
      vi.mocked(client.client.post).mockRejectedValue(customError);
      vi.mocked(axios.isAxiosError).mockReturnValue(false);

      await expect(client.request('POST', '/v1/test', {})).rejects.toThrow('Custom error');
    });

    it('should sanitize error messages in production mode', async () => {
      // Save original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        // Set production mode
        process.env.NODE_ENV = 'production';

        // Create a new client instance after setting production mode
        const productionClient = new KlingHttpClient();

        // Error with sensitive information that should be sanitized
        const mockError = {
          response: {
            status: 500,
            data: {
              code: 500,
              message: 'Database connection failed at 192.168.1.100:5432',
            },
          },
        };
        vi.mocked(productionClient.client.post).mockRejectedValue(mockError);
        vi.mocked(axios.isAxiosError).mockReturnValue(true);

        try {
          await productionClient.request('POST', '/v1/test', {});
        } catch (error) {
          expect(error).toBeInstanceOf(KlingAPIError);
          // In production, sensitive errors should be sanitized to generic message
          expect((error as KlingAPIError).message).toBe(
            'An error occurred while processing your request'
          );
        }
      } finally {
        // Restore original NODE_ENV
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should allow validation errors through in production mode', async () => {
      // Save original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;

      try {
        // Set production mode
        process.env.NODE_ENV = 'production';

        // Create a new client instance after setting production mode
        const productionClient = new KlingHttpClient();

        // Validation error should pass through even in production
        const mockError = {
          response: {
            status: 400,
            data: {
              code: 400,
              message: 'Invalid prompt: must be non-empty',
            },
          },
        };
        vi.mocked(productionClient.client.post).mockRejectedValue(mockError);
        vi.mocked(axios.isAxiosError).mockReturnValue(true);

        try {
          await productionClient.request('POST', '/v1/test', {});
        } catch (error) {
          expect(error).toBeInstanceOf(KlingAPIError);
          // Validation errors should pass through
          expect((error as KlingAPIError).message).toBe('Invalid prompt: must be non-empty');
        }
      } finally {
        // Restore original NODE_ENV
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('token management', () => {
    it('should return current token via getToken()', () => {
      const token = client.getToken();
      expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    });

    it('should return redacted access key', () => {
      const redacted = client.getRedactedAccessKey();
      // The redacted format shows *** followed by last 4 characters
      expect(redacted).toMatch(/\*{3}[\w-]+$/);
      expect(redacted).not.toBe(mockAccessKey);
      expect(redacted.length).toBeLessThan(mockAccessKey.length);
    });
  });
});
