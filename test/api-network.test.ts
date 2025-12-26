/**
 * Network-layer API tests using nock
 *
 * These tests use nock to intercept HTTP requests at the network level,
 * providing more realistic testing than module-level mocking.
 *
 * This approach:
 * - Tests actual axios configuration (interceptors, headers, timeouts)
 * - Validates request payload serialization
 * - Catches issues that module mocks might miss
 *
 * Pattern: Use for critical API paths. Keep module mocks for comprehensive coverage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { KlingAPI } from '../src/api.js';
import { BASE_URL } from '../src/config/constants.js';

describe('KlingAPI Network-Layer Tests', () => {
  let api: KlingAPI;
  const testAccessKey = 'test-access-key-12345';
  const testSecretKey = 'test-secret-key-67890';

  beforeEach(() => {
    // Enable nock
    nock.disableNetConnect();

    // Create API instance
    api = new KlingAPI({
      accessKey: testAccessKey,
      secretKey: testSecretKey,
    });
  });

  afterEach(() => {
    // Clean up nock
    nock.cleanAll();
    nock.enableNetConnect();
  });

  describe('textToVideo', () => {
    it('should send correct request payload to API', async () => {
      const taskResponse = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-456',
          task_status: 'submitted',
        },
      };

      // Intercept the actual HTTP request
      const scope = nock(BASE_URL)
        .post('/v1/videos/text2video', (body) => {
          // Validate request payload structure
          expect(body).toHaveProperty('prompt', 'A beautiful sunset');
          expect(body).toHaveProperty('model_name', 'kling-v1');
          return true;
        })
        .matchHeader('authorization', /^Bearer /)
        .matchHeader('content-type', 'application/json')
        .reply(200, taskResponse);

      const result = await api.textToVideo({
        prompt: 'A beautiful sunset',
        model_name: 'kling-v1',
      });

      expect(result.data.task_id).toBe('task-456');
      expect(scope.isDone()).toBe(true);
    });

    it('should include optional parameters in request', async () => {
      const taskResponse = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-789',
          task_status: 'submitted',
        },
      };

      const scope = nock(BASE_URL)
        .post('/v1/videos/text2video', (body) => {
          expect(body).toHaveProperty('prompt', 'A cat playing');
          expect(body).toHaveProperty('negative_prompt', 'blurry');
          expect(body).toHaveProperty('aspect_ratio', '16:9');
          expect(body).toHaveProperty('duration', '5');
          expect(body).toHaveProperty('mode', 'pro');
          return true;
        })
        .reply(200, taskResponse);

      const result = await api.textToVideo({
        prompt: 'A cat playing',
        negative_prompt: 'blurry',
        aspect_ratio: '16:9',
        duration: '5',
        mode: 'pro',
      });

      expect(result.data.task_id).toBe('task-789');
      expect(scope.isDone()).toBe(true);
    });

    it('should handle API error responses correctly', async () => {
      const errorResponse = {
        code: 1001,
        message: 'Invalid API key',
        request_id: 'req-error',
      };

      nock(BASE_URL).post('/v1/videos/text2video').reply(401, errorResponse);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow();
    });
  });

  describe('queryTextToVideoTask', () => {
    it('should query task status with correct endpoint', async () => {
      const statusResponse = {
        code: 0,
        message: 'success',
        request_id: 'req-status',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_result: {
            videos: [{ url: 'https://example.com/video.mp4' }],
          },
        },
      };

      const scope = nock(BASE_URL)
        .get('/v1/videos/text2video/task-123')
        .matchHeader('authorization', /^Bearer /)
        .reply(200, statusResponse);

      const result = await api.queryTextToVideoTask('task-123');

      expect(result.data.task_status).toBe('succeed');
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('generateImage', () => {
    it('should send image generation request correctly', async () => {
      const taskResponse = {
        code: 0,
        message: 'success',
        request_id: 'req-img',
        data: {
          task_id: 'img-task-001',
          task_status: 'submitted',
        },
      };

      const scope = nock(BASE_URL)
        .post('/v1/images/generations', (body) => {
          expect(body).toHaveProperty('prompt', 'A mountain landscape');
          expect(body).toHaveProperty('n', 2);
          return true;
        })
        .reply(200, taskResponse);

      const result = await api.generateImage({
        prompt: 'A mountain landscape',
        n: 2,
      });

      expect(result.data.task_id).toBe('img-task-001');
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is accessible', async () => {
      // healthCheck calls getAccountInfo which uses /account/costs endpoint
      nock(BASE_URL)
        .get('/account/costs')
        .query(true) // Match any query parameters (start_time, end_time)
        .reply(200, { code: 0, data: { total_count: 1000 } });

      const isHealthy = await api.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when API returns error', async () => {
      nock(BASE_URL)
        .get('/account/costs')
        .query(true)
        .reply(500, { code: 5000, message: 'Internal Server Error' });

      const isHealthy = await api.healthCheck();
      expect(isHealthy).toBe(false);
    });

    it('should return false on network failure', async () => {
      nock(BASE_URL).get('/account/costs').query(true).replyWithError('Network error');

      const isHealthy = await api.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('request authentication', () => {
    it('should include JWT token in authorization header', async () => {
      let capturedAuthHeader: string | undefined;

      nock(BASE_URL)
        .post('/v1/videos/text2video')
        .reply(function () {
          capturedAuthHeader = this.req.headers['authorization'] as string;
          return [200, { code: 0, data: { task_id: 'test' } }];
        });

      await api.textToVideo({ prompt: 'test' });

      expect(capturedAuthHeader).toBeDefined();
      expect(capturedAuthHeader).toMatch(/^Bearer eyJ/); // JWT starts with eyJ
    });
  });

  describe('retry behavior', () => {
    it('should retry on 502 and succeed on second attempt', async () => {
      // First request fails with 502
      nock(BASE_URL)
        .post('/v1/videos/text2video')
        .reply(502, { code: 2000, message: 'Bad Gateway' });

      // Second request succeeds
      nock(BASE_URL)
        .post('/v1/videos/text2video')
        .reply(200, { code: 0, data: { task_id: 'retry-success' } });

      const result = await api.textToVideo({ prompt: 'test' });
      expect(result.data.task_id).toBe('retry-success');
    });

    it('should not retry on 401 authentication error', async () => {
      // Only one request should be made
      const scope = nock(BASE_URL)
        .post('/v1/videos/text2video')
        .reply(401, { code: 1001, message: 'Unauthorized' });

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow();
      expect(scope.isDone()).toBe(true);
    });
  });
});
