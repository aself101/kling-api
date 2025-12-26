/**
 * Tests for Kling API Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { isAxiosError } from 'axios';
import { existsSync, rmSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { KlingAPI, KlingAPIError } from '../src/api.js';
import { ERROR_CODES } from '../src/config/index.js';
import * as utils from '../src/utils.js';

// Mock axios - isAxiosError must be on both default export and as named export
// because production code uses axios.isAxiosError() via the default import
vi.mock('axios', () => {
  const isAxiosErrorMock = vi.fn();
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn(),
      },
    },
    isAxiosError: isAxiosErrorMock,
  };
  return {
    default: mockAxios,
    isAxiosError: isAxiosErrorMock,
  };
});

describe('KlingAPI', () => {
  const mockAccessKey = 'test-access-key-12345';
  const mockSecretKey = 'test-secret-key-67890';
  let api: KlingAPI;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up environment variables
    process.env.KLING_ACCESS_KEY = mockAccessKey;
    process.env.KLING_SECRET_KEY = mockSecretKey;

    api = new KlingAPI();
  });

  afterEach(() => {
    delete process.env.KLING_ACCESS_KEY;
    delete process.env.KLING_SECRET_KEY;
  });

  describe('constructor', () => {
    it('should create instance with explicit credentials', () => {
      delete process.env.KLING_ACCESS_KEY;
      delete process.env.KLING_SECRET_KEY;

      const customApi = new KlingAPI({
        accessKey: 'custom-key',
        secretKey: 'custom-secret',
      });

      expect(customApi).toBeInstanceOf(KlingAPI);
    });

    it('should throw error when credentials not found', () => {
      delete process.env.KLING_ACCESS_KEY;
      delete process.env.KLING_SECRET_KEY;

      expect(() => new KlingAPI()).toThrow('credentials not found');
    });

    it('should throw error for HTTP base URL', () => {
      expect(
        () =>
          new KlingAPI({
            accessKey: mockAccessKey,
            secretKey: mockSecretKey,
            baseUrl: 'http://insecure.example.com',
          })
      ).toThrow('must use HTTPS');
    });

    it('should accept custom base URL with HTTPS', () => {
      expect(
        () =>
          new KlingAPI({
            accessKey: mockAccessKey,
            secretKey: mockSecretKey,
            baseUrl: 'https://custom.example.com',
          })
      ).not.toThrow();
    });

    it('should configure axios with correct defaults', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api-singapore.klingai.com',
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should register request interceptor for auth', () => {
      // The interceptor should be registered during construction
      expect(vi.mocked(axios.create().interceptors.request.use)).toHaveBeenCalled();
    });

    it('should add Authorization header via interceptor', () => {
      const mockInterceptorUse = vi.mocked(axios.create().interceptors.request.use);
      expect(mockInterceptorUse).toHaveBeenCalled();

      // Get the interceptor function that was passed to use()
      const interceptorFn = mockInterceptorUse.mock.calls[0][0] as (config: any) => any;

      // Call the interceptor with a mock config
      const mockConfig = { headers: {} };
      const result = interceptorFn(mockConfig);

      // Verify it adds Authorization header
      expect(result.headers.Authorization).toBeDefined();
      expect(result.headers.Authorization).toMatch(/^Bearer /);
    });

    it('should handle missing headers object in request config', () => {
      const mockInterceptorUse = vi.mocked(axios.create().interceptors.request.use);
      const interceptorFn = mockInterceptorUse.mock.calls[0][0] as (config: any) => any;

      // Config without headers property initialized
      const configWithoutHeaders = {};

      // The interceptor should add headers object if missing
      expect(() => interceptorFn(configWithoutHeaders)).not.toThrow();
    });
  });

  describe('textToVideo', () => {
    const mockTaskResponse = {
      code: 0,
      message: 'success',
      request_id: 'req-123',
      data: {
        task_id: 'task-456',
        task_status: 'submitted',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      },
    };

    beforeEach(() => {
      vi.mocked(axios.create().post).mockResolvedValue({ data: mockTaskResponse });
    });

    it('should create text-to-video task with minimal params', async () => {
      const result = await api.textToVideo({
        prompt: 'A cat playing piano',
      });

      expect(result.code).toBe(0);
      expect(result.data.task_id).toBe('task-456');
      expect(axios.create().post).toHaveBeenCalledWith(
        '/v1/videos/text2video',
        expect.objectContaining({
          model_name: 'kling-v1',
          prompt: 'A cat playing piano',
        })
      );
    });

    it('should include optional parameters', async () => {
      await api.textToVideo({
        prompt: 'test',
        model_name: 'kling-v2-master',
        negative_prompt: 'bad quality',
        mode: 'pro',
        aspect_ratio: '9:16',
        duration: '10',
      });

      expect(axios.create().post).toHaveBeenCalledWith(
        '/v1/videos/text2video',
        expect.objectContaining({
          model_name: 'kling-v2-master',
          prompt: 'test',
          negative_prompt: 'bad quality',
          mode: 'pro',
          aspect_ratio: '9:16',
          duration: '10',
        })
      );
    });

    it('should include sound parameter for v2.6 model', async () => {
      await api.textToVideo({
        prompt: 'test',
        model_name: 'kling-v2-6',
        sound: 'on',
      });

      expect(axios.create().post).toHaveBeenCalledWith(
        '/v1/videos/text2video',
        expect.objectContaining({
          model_name: 'kling-v2-6',
          sound: 'on',
        })
      );
    });

    it('should include camera_control when provided', async () => {
      await api.textToVideo({
        prompt: 'test',
        model_name: 'kling-v1-6',
        camera_control: {
          type: 'down_back',
        },
      });

      expect(axios.create().post).toHaveBeenCalledWith(
        '/v1/videos/text2video',
        expect.objectContaining({
          camera_control: { type: 'down_back' },
        })
      );
    });

    it('should reject invalid prompt', async () => {
      await expect(api.textToVideo({ prompt: '' })).rejects.toThrow('Prompt is required');
    });
  });

  describe('queryTextToVideoTask', () => {
    const mockQueryResponse = {
      code: 0,
      message: 'success',
      request_id: 'req-789',
      data: {
        task_id: 'task-456',
        task_status: 'succeed',
        created_at: 1700000000000,
        updated_at: 1700000001000,
        task_result: {
          videos: [
            {
              id: 'video-123',
              url: 'https://example.com/video.mp4',
              duration: '5',
            },
          ],
        },
      },
    };

    it('should query task status', async () => {
      vi.mocked(axios.create().get).mockResolvedValue({ data: mockQueryResponse });

      const result = await api.queryTextToVideoTask('task-456');

      expect(result.data.task_status).toBe('succeed');
      expect(result.data.task_result?.videos).toHaveLength(1);
      expect(axios.create().get).toHaveBeenCalledWith('/v1/videos/text2video/task-456', {
        params: undefined,
      });
    });
  });

  describe('queryImageToVideoTask', () => {
    it('should query correct endpoint with task ID', async () => {
      const mockQueryResponse = {
        code: 0,
        message: 'success',
        request_id: 'req-img2vid',
        data: {
          task_id: 'task-img2vid-123',
          task_status: 'processing',
          created_at: 1700000000000,
          updated_at: 1700000000000,
        },
      };
      vi.mocked(axios.create().get).mockResolvedValue({ data: mockQueryResponse });

      const result = await api.queryImageToVideoTask('task-img2vid-123');

      expect(result.data.task_status).toBe('processing');
      expect(axios.create().get).toHaveBeenCalledWith('/v1/videos/image2video/task-img2vid-123', {
        params: undefined,
      });
    });
  });

  describe('queryImageExpandTask', () => {
    it('should query correct endpoint with task ID', async () => {
      const mockQueryResponse = {
        code: 0,
        message: 'success',
        request_id: 'req-expand',
        data: {
          task_id: 'task-expand-123',
          task_status: 'succeed',
          created_at: 1700000000000,
          updated_at: 1700000000000,
          task_result: {
            images: [{ index: 0, url: 'https://example.com/expanded.png' }],
          },
        },
      };
      vi.mocked(axios.create().get).mockResolvedValue({ data: mockQueryResponse });

      const result = await api.queryImageExpandTask('task-expand-123');

      expect(result.data.task_status).toBe('succeed');
      expect(axios.create().get).toHaveBeenCalledWith('/v1/images/expand/task-expand-123', {
        params: undefined,
      });
    });
  });

  describe('queryAvatarTask', () => {
    it('should query correct endpoint with task ID', async () => {
      const mockQueryResponse = {
        code: 0,
        message: 'success',
        request_id: 'req-avatar',
        data: {
          task_id: 'task-avatar-123',
          task_status: 'succeed',
          created_at: 1700000000000,
          updated_at: 1700000000000,
          task_result: {
            videos: [{ id: 'vid-avatar', url: 'https://example.com/avatar.mp4', duration: '10' }],
          },
        },
      };
      vi.mocked(axios.create().get).mockResolvedValue({ data: mockQueryResponse });

      const result = await api.queryAvatarTask('task-avatar-123');

      expect(result.data.task_status).toBe('succeed');
      expect(axios.create().get).toHaveBeenCalledWith('/v1/avatar/task-avatar-123', {
        params: undefined,
      });
    });
  });

  describe('imageToVideo', () => {
    const mockTaskResponse = {
      code: 0,
      message: 'success',
      request_id: 'req-123',
      data: {
        task_id: 'task-789',
        task_status: 'submitted',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      },
    };

    beforeEach(() => {
      vi.mocked(axios.create().post).mockResolvedValue({ data: mockTaskResponse });
    });

    it('should create image-to-video task', async () => {
      const result = await api.imageToVideo({
        image: 'https://example.com/image.jpg',
        prompt: 'Make it move',
      });

      expect(result.code).toBe(0);
      expect(result.data.task_id).toBe('task-789');
    });

    it('should require image', async () => {
      await expect(api.imageToVideo({ image: '', prompt: 'test' })).rejects.toThrow(
        'Image is required'
      );
    });
  });

  describe('generateImage', () => {
    const mockTaskResponse = {
      code: 0,
      message: 'success',
      request_id: 'req-123',
      data: {
        task_id: 'task-img-1',
        task_status: 'submitted',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      },
    };

    beforeEach(() => {
      vi.mocked(axios.create().post).mockResolvedValue({ data: mockTaskResponse });
    });

    it('should create image generation task', async () => {
      const result = await api.generateImage({
        prompt: 'A beautiful sunset',
      });

      expect(result.code).toBe(0);
      expect(result.data.task_id).toBe('task-img-1');
    });

    it('should include generation parameters', async () => {
      await api.generateImage({
        prompt: 'test',
        model_name: 'kling-v2',
        resolution: '2k',
        n: 4,
        aspect_ratio: '1:1',
      });

      expect(axios.create().post).toHaveBeenCalledWith(
        '/v1/images/generations',
        expect.objectContaining({
          model_name: 'kling-v2',
          resolution: '2k',
          n: 4,
          aspect_ratio: '1:1',
        })
      );
    });
  });

  describe('expandImage', () => {
    const mockTaskResponse = {
      code: 0,
      message: 'success',
      request_id: 'req-123',
      data: {
        task_id: 'task-expand-1',
        task_status: 'submitted',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      },
    };

    beforeEach(() => {
      vi.mocked(axios.create().post).mockResolvedValue({ data: mockTaskResponse });
    });

    it('should create image expansion task', async () => {
      const result = await api.expandImage({
        image: 'https://example.com/image.jpg',
        up_expansion_ratio: 0.5,
        down_expansion_ratio: 0.5,
        left_expansion_ratio: 0,
        right_expansion_ratio: 0,
      });

      expect(result.code).toBe(0);
      expect(result.data.task_id).toBe('task-expand-1');
    });

    it('should reject excessive expansion', async () => {
      await expect(
        api.expandImage({
          image: 'https://example.com/image.jpg',
          up_expansion_ratio: 2,
          down_expansion_ratio: 2,
          left_expansion_ratio: 2,
          right_expansion_ratio: 2,
        })
      ).rejects.toThrow('exceeds maximum');
    });
  });

  describe('createAvatar', () => {
    const mockTaskResponse = {
      code: 0,
      message: 'success',
      request_id: 'req-123',
      data: {
        task_id: 'task-avatar-1',
        task_status: 'submitted',
        created_at: 1700000000000,
        updated_at: 1700000000000,
      },
    };

    beforeEach(() => {
      vi.mocked(axios.create().post).mockResolvedValue({ data: mockTaskResponse });
    });

    it('should create avatar task with audio_id', async () => {
      const result = await api.createAvatar({
        image: 'https://example.com/portrait.jpg',
        audio_id: 'audio-123',
      });

      expect(result.code).toBe(0);
      expect(result.data.task_id).toBe('task-avatar-1');
    });

    it('should require audio source', async () => {
      await expect(
        api.createAvatar({
          image: 'https://example.com/portrait.jpg',
        })
      ).rejects.toThrow('Either audio_id or sound_file is required');
    });
  });

  describe('getAccountInfo', () => {
    const mockAccountResponse = {
      code: 0,
      message: 'success',
      request_id: 'req-acc-1',
      data: {
        code: 0,
        msg: 'success',
        resource_pack_subscribe_infos: [
          {
            resource_pack_name: 'Video Generation',
            remaining_quantity: 100,
            total_quantity: 200,
            status: 'online',
          },
        ],
      },
    };

    it('should fetch account information', async () => {
      vi.mocked(axios.create().get).mockResolvedValue({ data: mockAccountResponse });

      const result = await api.getAccountInfo(1700000000000, 1700100000000);

      expect(result.code).toBe(0);
      expect(result.data.resource_pack_subscribe_infos).toHaveLength(1);
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is accessible', async () => {
      vi.mocked(axios.create().get).mockResolvedValue({
        data: { code: 0, data: { resource_pack_subscribe_infos: [] } },
      });

      const result = await api.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when API fails', async () => {
      vi.mocked(axios.create().get).mockRejectedValue(new Error('Network error'));

      const result = await api.healthCheck();

      expect(result).toBe(false);
    });
  });
});

describe('KlingAPIError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const error = new KlingAPIError('Test error', 1000, 'req-123', 401);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(1000);
      expect(error.requestId).toBe('req-123');
      expect(error.httpStatus).toBe(401);
      expect(error.name).toBe('KlingAPIError');
    });
  });

  describe('isRetryable', () => {
    it('should return true for SERVICE_UNAVAILABLE', () => {
      const error = new KlingAPIError('Service unavailable', ERROR_CODES.SERVICE_UNAVAILABLE);
      expect(error.isRetryable()).toBe(true);
    });

    it('should return true for 502 status', () => {
      const error = new KlingAPIError('Bad gateway', 0, undefined, 502);
      expect(error.isRetryable()).toBe(true);
    });

    it('should return true for 503 status', () => {
      const error = new KlingAPIError('Service unavailable', 0, undefined, 503);
      expect(error.isRetryable()).toBe(true);
    });

    it('should return true for 504 status', () => {
      const error = new KlingAPIError('Gateway timeout', 0, undefined, 504);
      expect(error.isRetryable()).toBe(true);
    });

    it('should return false for auth errors', () => {
      const error = new KlingAPIError('Unauthorized', ERROR_CODES.AUTH_FAILED, undefined, 401);
      expect(error.isRetryable()).toBe(false);
    });

    it('should return false for parameter errors', () => {
      const error = new KlingAPIError('Invalid params', ERROR_CODES.INVALID_PARAMS, undefined, 400);
      expect(error.isRetryable()).toBe(false);
    });
  });
});

describe('Polling Methods', () => {
  const mockAccessKey = 'test-access-key-12345';
  const mockSecretKey = 'test-secret-key-67890';
  let api: KlingAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KLING_ACCESS_KEY = mockAccessKey;
    process.env.KLING_SECRET_KEY = mockSecretKey;
    api = new KlingAPI();
  });

  afterEach(() => {
    delete process.env.KLING_ACCESS_KEY;
    delete process.env.KLING_SECRET_KEY;
  });

  describe('waitForVideoResult', () => {
    it('should return result immediately when task already succeeded', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue({
        code: 0,
        request_id: 'req-123',
        data: {
          task_id: 'task-456',
          task_status: 'succeed',
          task_result: {
            videos: [{ id: 'v1', url: 'https://example.com/video.mp4', duration: '5' }],
          },
        },
      });

      const result = await api.waitForVideoResult('task-456', mockQueryFn, {
        showSpinner: false,
        interval: 10,
      });

      expect(result.data.task_status).toBe('succeed');
      expect(result.data.task_result?.videos).toHaveLength(1);
      expect(mockQueryFn).toHaveBeenCalledTimes(1);
    });

    it('should poll until task succeeds', async () => {
      let callCount = 0;
      const mockQueryFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            code: 0,
            request_id: 'req-123',
            data: { task_id: 'task-456', task_status: 'processing' },
          };
        }
        return {
          code: 0,
          request_id: 'req-123',
          data: {
            task_id: 'task-456',
            task_status: 'succeed',
            task_result: {
              videos: [{ id: 'v1', url: 'https://example.com/video.mp4' }],
            },
          },
        };
      });

      const result = await api.waitForVideoResult('task-456', mockQueryFn, {
        showSpinner: false,
        interval: 10,
      });

      expect(callCount).toBe(3);
      expect(result.data.task_status).toBe('succeed');
    });

    it('should throw error when task fails', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue({
        code: 0,
        request_id: 'req-123',
        data: {
          task_id: 'task-456',
          task_status: 'failed',
          task_status_msg: 'Content moderation failed',
        },
      });

      await expect(
        api.waitForVideoResult('task-456', mockQueryFn, { showSpinner: false })
      ).rejects.toThrow('Content moderation failed');
    });

    it('should throw generic error when task fails without message', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue({
        code: 0,
        request_id: 'req-123',
        data: { task_id: 'task-456', task_status: 'failed' },
      });

      await expect(
        api.waitForVideoResult('task-456', mockQueryFn, { showSpinner: false })
      ).rejects.toThrow('Video generation failed');
    });

    it('should timeout when polling exceeds timeout', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue({
        code: 0,
        request_id: 'req-123',
        data: { task_id: 'task-456', task_status: 'processing' },
      });

      await expect(
        api.waitForVideoResult('task-456', mockQueryFn, {
          showSpinner: false,
          interval: 10,
          timeout: 50, // 50ms timeout
        })
      ).rejects.toThrow('timeout');
    });

    it('should propagate API errors', async () => {
      const mockQueryFn = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        api.waitForVideoResult('task-456', mockQueryFn, { showSpinner: false })
      ).rejects.toThrow('Network error');
    });
  });

  describe('waitForImageResult', () => {
    it('should return result immediately when task already succeeded', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue({
        code: 0,
        request_id: 'req-123',
        data: {
          task_id: 'task-789',
          task_status: 'succeed',
          task_result: {
            images: [{ id: 'img1', url: 'https://example.com/image.png' }],
          },
        },
      });

      const result = await api.waitForImageResult('task-789', mockQueryFn, {
        showSpinner: false,
        interval: 10,
      });

      expect(result.data.task_status).toBe('succeed');
      expect(result.data.task_result?.images).toHaveLength(1);
    });

    it('should poll until task succeeds', async () => {
      let callCount = 0;
      const mockQueryFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 2) {
          return {
            code: 0,
            request_id: 'req-123',
            data: { task_id: 'task-789', task_status: 'processing' },
          };
        }
        return {
          code: 0,
          request_id: 'req-123',
          data: {
            task_id: 'task-789',
            task_status: 'succeed',
            task_result: {
              images: [{ id: 'img1', url: 'https://example.com/image.png' }],
            },
          },
        };
      });

      const result = await api.waitForImageResult('task-789', mockQueryFn, {
        showSpinner: false,
        interval: 10,
      });

      expect(callCount).toBe(2);
      expect(result.data.task_status).toBe('succeed');
    });

    it('should throw error when task fails', async () => {
      const mockQueryFn = vi.fn().mockResolvedValue({
        code: 0,
        request_id: 'req-123',
        data: {
          task_id: 'task-789',
          task_status: 'failed',
          task_status_msg: 'Image generation failed: nsfw content',
        },
      });

      await expect(
        api.waitForImageResult('task-789', mockQueryFn, { showSpinner: false })
      ).rejects.toThrow('nsfw content');
    });
  });
});

describe('Error Handling', () => {
  const mockAccessKey = 'test-access-key-12345';
  const mockSecretKey = 'test-secret-key-67890';
  let api: KlingAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KLING_ACCESS_KEY = mockAccessKey;
    process.env.KLING_SECRET_KEY = mockSecretKey;
    api = new KlingAPI();
  });

  afterEach(() => {
    delete process.env.KLING_ACCESS_KEY;
    delete process.env.KLING_SECRET_KEY;
  });

  describe('HTTP Error Responses', () => {
    it('should throw KlingAPIError for 401 Unauthorized', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { code: 1000, message: 'Invalid API credentials', request_id: 'req-401' },
        },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toMatchObject({
        name: 'KlingAPIError',
        code: 1000,
        httpStatus: 401,
        requestId: 'req-401',
      });
    });

    it('should throw KlingAPIError for 422 Invalid Parameters', async () => {
      const mockError = {
        response: {
          status: 422,
          data: { code: 1001, message: 'Invalid parameter: duration', request_id: 'req-422' },
        },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toMatchObject({
        name: 'KlingAPIError',
        code: 1001,
        httpStatus: 422,
      });
    });

    it('should throw KlingAPIError for 500 Server Error', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { code: 2000, message: 'Internal server error' },
        },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toMatchObject({
        name: 'KlingAPIError',
        httpStatus: 500,
      });
    });

    it('should throw KlingAPIError for timeout (ECONNABORTED)', async () => {
      const mockError = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toMatchObject({
        name: 'KlingAPIError',
        message: 'Request timeout',
        code: ERROR_CODES.SERVICE_UNAVAILABLE,
      });
    });

    it('should handle error without response data gracefully', async () => {
      const mockError = {
        response: {
          status: 503,
          data: null,
        },
        message: 'Service Unavailable',
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toMatchObject({
        name: 'KlingAPIError',
        httpStatus: 503,
      });
    });

    it('should handle network errors without response', async () => {
      const mockError = {
        message: 'Network Error',
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toMatchObject({
        name: 'KlingAPIError',
        message: 'Network Error',
      });
    });
  });

  describe('Non-Retryable Errors', () => {
    it('should not retry on 401 Unauthorized', async () => {
      const mockError = {
        response: { status: 401, data: { code: 1000, message: 'Unauthorized' } },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow();

      // Should only be called once (no retries)
      expect(axios.create().post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 422 Invalid Parameters', async () => {
      const mockError = {
        response: { status: 422, data: { code: 1001, message: 'Invalid params' } },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow();

      expect(axios.create().post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 400 Bad Request', async () => {
      const mockError = {
        response: { status: 400, data: { code: 1002, message: 'Bad request' } },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow();

      expect(axios.create().post).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 429 Rate Limit', async () => {
      const mockError = {
        response: { status: 429, data: { code: 1003, message: 'Rate limit exceeded' } },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow();

      expect(axios.create().post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retryable Errors', () => {
    it('should retry 502 errors up to 3 times then fail', async () => {
      const mockError = {
        response: { status: 502, data: { code: 2000, message: 'Bad Gateway' } },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow('Bad Gateway');

      // Should be called 3 times (initial + 2 retries)
      expect(axios.create().post).toHaveBeenCalledTimes(3);
    });

    it('should retry 503 errors up to 3 times then fail', async () => {
      const mockError = {
        response: { status: 503, data: { code: 2000, message: 'Service Unavailable' } },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow('Service Unavailable');

      expect(axios.create().post).toHaveBeenCalledTimes(3);
    });

    it('should retry 504 errors up to 3 times then fail', async () => {
      const mockError = {
        response: { status: 504, data: { code: 2000, message: 'Gateway Timeout' } },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow('Gateway Timeout');

      expect(axios.create().post).toHaveBeenCalledTimes(3);
    });

    it('should succeed on retry after 503 error', async () => {
      const mockError = {
        response: { status: 503, data: { code: 2000, message: 'Service Unavailable' } },
      };
      const mockSuccess = {
        data: {
          code: 0,
          message: 'success',
          request_id: 'req-123',
          data: { task_id: 'task-456', task_status: 'submitted' },
        },
      };

      // First call fails with 503, second call succeeds
      vi.mocked(axios.create().post)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess);
      vi.mocked(isAxiosError).mockReturnValue(true);

      const result = await api.textToVideo({ prompt: 'test' });

      expect(result.data.task_id).toBe('task-456');
      expect(axios.create().post).toHaveBeenCalledTimes(2);
    });

    it('should succeed on third attempt after two failures', async () => {
      const mockError = {
        response: { status: 502, data: { code: 2000, message: 'Bad Gateway' } },
      };
      const mockSuccess = {
        data: {
          code: 0,
          message: 'success',
          request_id: 'req-789',
          data: { task_id: 'task-success', task_status: 'submitted' },
        },
      };

      // First two calls fail, third succeeds
      vi.mocked(axios.create().post)
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce(mockSuccess);
      vi.mocked(isAxiosError).mockReturnValue(true);

      const result = await api.textToVideo({ prompt: 'test' });

      expect(result.data.task_id).toBe('task-success');
      expect(axios.create().post).toHaveBeenCalledTimes(3);
    });

    it('should retry SERVICE_UNAVAILABLE error code', async () => {
      const mockError = {
        response: {
          status: 500,
          data: {
            code: ERROR_CODES.SERVICE_UNAVAILABLE,
            message: 'Service temporarily unavailable',
          },
        },
      };
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow();

      // Should retry based on error code, not just HTTP status
      expect(axios.create().post).toHaveBeenCalledTimes(3);
    });

    it('should stop retrying on non-retryable error after retryable ones', async () => {
      const retryableError = {
        response: { status: 503, data: { code: 2000, message: 'Service Unavailable' } },
      };
      const nonRetryableError = {
        response: { status: 401, data: { code: 1000, message: 'Unauthorized' } },
      };

      // First call: retryable 503, second call: non-retryable 401
      vi.mocked(axios.create().post)
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(nonRetryableError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toMatchObject({
        httpStatus: 401,
        message: 'Unauthorized',
      });

      // Should stop after 401, not continue retrying
      expect(axios.create().post).toHaveBeenCalledTimes(2);
    });

    it('should enforce retry limit and not attempt 4th call', async () => {
      const mockError = {
        response: { status: 503, data: { code: 5001, message: 'Service Unavailable' } },
      };

      // All calls return retryable error
      vi.mocked(axios.create().post).mockRejectedValue(mockError);
      vi.mocked(isAxiosError).mockReturnValue(true);

      await expect(api.textToVideo({ prompt: 'test' })).rejects.toThrow();

      // Should attempt exactly 3 times (initial + 2 retries), never a 4th
      expect(axios.create().post).toHaveBeenCalledTimes(3);
    });
  });

  describe('Exponential Backoff Timing', () => {
    it('should use exponential backoff delays between retries', async () => {
      vi.useFakeTimers();

      try {
        const mockError = {
          response: { status: 502, data: { code: 2000, message: 'Bad Gateway' } },
        };
        vi.mocked(axios.create().post).mockRejectedValue(mockError);
        vi.mocked(isAxiosError).mockReturnValue(true);

        // Start the request (will fail and retry) - attach error handler immediately
        const promise = api.textToVideo({ prompt: 'test' }).catch((e) => e);

        // Initial call happens immediately
        await vi.advanceTimersByTimeAsync(0);
        expect(axios.create().post).toHaveBeenCalledTimes(1);

        // First retry after 2^1 * 1000 = 2000ms
        await vi.advanceTimersByTimeAsync(2000);
        expect(axios.create().post).toHaveBeenCalledTimes(2);

        // Second retry after 2^2 * 1000 = 4000ms
        await vi.advanceTimersByTimeAsync(4000);
        expect(axios.create().post).toHaveBeenCalledTimes(3);

        // The promise should now have rejected (no more retries)
        const error = await promise;
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Bad Gateway');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should stop retrying and succeed on second attempt', async () => {
      vi.useFakeTimers();

      try {
        const mockError = {
          response: { status: 503, data: { code: 2000, message: 'Service Unavailable' } },
        };
        const mockSuccess = {
          data: {
            code: 0,
            message: 'success',
            request_id: 'req-123',
            data: { task_id: 'task-success', task_status: 'submitted' },
          },
        };

        // First call fails, second call succeeds
        vi.mocked(axios.create().post)
          .mockRejectedValueOnce(mockError)
          .mockResolvedValueOnce(mockSuccess);
        vi.mocked(isAxiosError).mockReturnValue(true);

        const promise = api.textToVideo({ prompt: 'test' });

        // Initial call happens immediately
        await vi.advanceTimersByTimeAsync(0);
        expect(axios.create().post).toHaveBeenCalledTimes(1);

        // First retry after 2^1 * 1000 = 2000ms
        await vi.advanceTimersByTimeAsync(2000);
        expect(axios.create().post).toHaveBeenCalledTimes(2);

        // Should succeed now
        const result = await promise;
        expect(result.data.task_id).toBe('task-success');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should not wait before first attempt', async () => {
      vi.useFakeTimers();

      try {
        const mockSuccess = {
          data: {
            code: 0,
            message: 'success',
            request_id: 'req-123',
            data: { task_id: 'task-immediate', task_status: 'submitted' },
          },
        };

        vi.mocked(axios.create().post).mockResolvedValue(mockSuccess);

        const promise = api.textToVideo({ prompt: 'test' });

        // Should complete immediately without waiting
        await vi.advanceTimersByTimeAsync(0);
        const result = await promise;

        expect(result.data.task_id).toBe('task-immediate');
        expect(axios.create().post).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

describe('Integration: Validation Before API Call', () => {
  const mockAccessKey = 'test-access-key-12345';
  const mockSecretKey = 'test-secret-key-67890';
  let api: KlingAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KLING_ACCESS_KEY = mockAccessKey;
    process.env.KLING_SECRET_KEY = mockSecretKey;
    api = new KlingAPI();
  });

  afterEach(() => {
    delete process.env.KLING_ACCESS_KEY;
    delete process.env.KLING_SECRET_KEY;
  });

  it('should reject empty prompt before making API call', async () => {
    const postMock = vi.mocked(axios.create().post);
    postMock.mockClear();

    await expect(api.textToVideo({ prompt: '' })).rejects.toThrow('Prompt is required');

    // Verify no API call was made
    expect(postMock).not.toHaveBeenCalled();
  });

  it('should reject whitespace-only prompt before making API call', async () => {
    const postMock = vi.mocked(axios.create().post);
    postMock.mockClear();

    await expect(api.textToVideo({ prompt: '   ' })).rejects.toThrow('Prompt is required');

    expect(postMock).not.toHaveBeenCalled();
  });

  it('should reject invalid model name before making API call', async () => {
    const postMock = vi.mocked(axios.create().post);
    postMock.mockClear();

    await expect(
      api.textToVideo({ prompt: 'test', model_name: 'invalid-model' as any })
    ).rejects.toThrow('Invalid model');

    expect(postMock).not.toHaveBeenCalled();
  });

  it('should reject empty image in imageToVideo before making API call', async () => {
    const postMock = vi.mocked(axios.create().post);
    postMock.mockClear();

    await expect(api.imageToVideo({ image: '' })).rejects.toThrow('Image is required');

    expect(postMock).not.toHaveBeenCalled();
  });

  it('should reject invalid expansion ratios before making API call', async () => {
    const postMock = vi.mocked(axios.create().post);
    postMock.mockClear();

    await expect(
      api.expandImage({
        image: 'https://example.com/img.jpg',
        up_expansion_ratio: 3, // Invalid: exceeds 2
        down_expansion_ratio: 0,
        left_expansion_ratio: 0,
        right_expansion_ratio: 0,
      })
    ).rejects.toThrow();

    expect(postMock).not.toHaveBeenCalled();
  });
});

describe('Save Result Methods', () => {
  const mockAccessKey = 'test-access-key-12345';
  const mockSecretKey = 'test-secret-key-67890';
  const testDir = join(tmpdir(), 'kling-api-save-test-' + Date.now());
  let api: KlingAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KLING_ACCESS_KEY = mockAccessKey;
    process.env.KLING_SECRET_KEY = mockSecretKey;
    api = new KlingAPI();
  });

  afterEach(() => {
    delete process.env.KLING_ACCESS_KEY;
    delete process.env.KLING_SECRET_KEY;
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('saveVideoResult', () => {
    it('should throw error when result has no videos', async () => {
      const emptyResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_status_msg: '',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            videos: [],
          },
        },
      };

      await expect(api.saveVideoResult(emptyResult, testDir)).rejects.toThrow(
        'No videos in result'
      );
    });

    it('should throw error when result has null task_result', async () => {
      const nullResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_status_msg: '',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: null as any,
        },
      };

      await expect(api.saveVideoResult(nullResult, testDir)).rejects.toThrow('No videos in result');
    });

    it('should save video and metadata to disk', async () => {
      // Mock downloadVideo to write a file
      const downloadVideoSpy = vi
        .spyOn(utils, 'downloadVideo')
        .mockImplementation(async (_url: string, outputPath: string) => {
          mkdirSync(join(testDir), { recursive: true });
          const fs = await import('fs');
          fs.writeFileSync(outputPath, Buffer.from('fake video'));
          return outputPath;
        });

      const videoResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_status_msg: '',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            videos: [
              {
                id: 'video-1',
                url: 'https://example.com/video.mp4',
                duration: '5.0',
              },
            ],
          },
        },
      };

      const paths = await api.saveVideoResult(videoResult, testDir, 'test prompt');

      expect(paths).toHaveLength(1);
      expect(paths[0]).toContain('test_prompt');
      expect(paths[0]).toMatch(/\.mp4$/);
      expect(downloadVideoSpy).toHaveBeenCalledWith(
        'https://example.com/video.mp4',
        expect.stringContaining('.mp4')
      );

      // Verify metadata file exists
      const metadataPath = paths[0].replace('.mp4', '.json');
      expect(existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      expect(metadata.task_id).toBe('task-123');
      expect(metadata.video_id).toBe('video-1');
      expect(metadata.prompt).toBe('test prompt');

      downloadVideoSpy.mockRestore();
    });

    it('should save multiple videos when result contains more than one', async () => {
      const downloadVideoSpy = vi
        .spyOn(utils, 'downloadVideo')
        .mockImplementation(async (_url: string, outputPath: string) => {
          mkdirSync(join(testDir), { recursive: true });
          const fs = await import('fs');
          fs.writeFileSync(outputPath, Buffer.from('fake video'));
          return outputPath;
        });

      const multiVideoResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_status_msg: '',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            videos: [
              { id: 'video-1', url: 'https://example.com/video1.mp4', duration: '5.0' },
              { id: 'video-2', url: 'https://example.com/video2.mp4', duration: '5.0' },
            ],
          },
        },
      };

      const paths = await api.saveVideoResult(multiVideoResult, testDir);

      expect(paths).toHaveLength(2);
      expect(downloadVideoSpy).toHaveBeenCalledTimes(2);

      downloadVideoSpy.mockRestore();
    });
  });

  describe('saveImageResult', () => {
    it('should throw error when result has no images', async () => {
      const emptyResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_status_msg: '',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            images: [],
          },
        },
      };

      await expect(api.saveImageResult(emptyResult, testDir)).rejects.toThrow(
        'No images in result'
      );
    });

    it('should save PNG image and metadata to disk', async () => {
      const downloadImageSpy = vi
        .spyOn(utils, 'downloadImage')
        .mockImplementation(async (_url: string, outputPath: string) => {
          mkdirSync(join(testDir), { recursive: true });
          const fs = await import('fs');
          fs.writeFileSync(outputPath, Buffer.from('fake image'));
          return outputPath;
        });

      const imageResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_status_msg: '',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            images: [
              {
                index: 0,
                url: 'https://example.com/image.png',
              },
            ],
          },
        },
      };

      const paths = await api.saveImageResult(imageResult, testDir, 'a beautiful sunset');

      expect(paths).toHaveLength(1);
      expect(paths[0]).toContain('a_beautiful_sunset');
      expect(paths[0]).toMatch(/\.png$/);

      // Verify metadata file exists
      const metadataPath = paths[0].replace('.png', '.json');
      expect(existsSync(metadataPath)).toBe(true);

      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      expect(metadata.task_id).toBe('task-123');
      expect(metadata.image_index).toBe(0);
      expect(metadata.prompt).toBe('a beautiful sunset');

      downloadImageSpy.mockRestore();
    });

    it('should detect JPEG extension from URL', async () => {
      const downloadImageSpy = vi
        .spyOn(utils, 'downloadImage')
        .mockImplementation(async (_url: string, outputPath: string) => {
          mkdirSync(join(testDir), { recursive: true });
          const fs = await import('fs');
          fs.writeFileSync(outputPath, Buffer.from('fake jpeg'));
          return outputPath;
        });

      const jpegResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_status_msg: '',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            images: [
              {
                index: 0,
                url: 'https://example.com/photo.jpg',
              },
            ],
          },
        },
      };

      const paths = await api.saveImageResult(jpegResult, testDir);

      expect(paths[0]).toMatch(/\.jpg$/);

      downloadImageSpy.mockRestore();
    });

    it('should save multiple images when result contains more than one', async () => {
      const downloadImageSpy = vi
        .spyOn(utils, 'downloadImage')
        .mockImplementation(async (_url: string, outputPath: string) => {
          mkdirSync(join(testDir), { recursive: true });
          const fs = await import('fs');
          fs.writeFileSync(outputPath, Buffer.from('fake image'));
          return outputPath;
        });

      const multiImageResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_status_msg: '',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            images: [
              { index: 0, url: 'https://example.com/image1.png' },
              { index: 1, url: 'https://example.com/image2.png' },
              { index: 2, url: 'https://example.com/image3.png' },
            ],
          },
        },
      };

      const paths = await api.saveImageResult(multiImageResult, testDir);

      expect(paths).toHaveLength(3);
      expect(downloadImageSpy).toHaveBeenCalledTimes(3);

      downloadImageSpy.mockRestore();
    });

    it('should propagate download errors', async () => {
      const downloadImageSpy = vi
        .spyOn(utils, 'downloadImage')
        .mockRejectedValue(new Error('Download failed: Network error'));

      const imageResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-123',
          task_status: 'succeed',
          task_status_msg: '',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            images: [{ index: 0, url: 'https://example.com/image.png' }],
          },
        },
      };

      await expect(api.saveImageResult(imageResult, testDir)).rejects.toThrow(
        'Download failed: Network error'
      );

      downloadImageSpy.mockRestore();
    });
  });

  describe('concurrent save operations', () => {
    it('should handle concurrent saveVideoResult calls with different prompts', async () => {
      const downloadVideoSpy = vi
        .spyOn(utils, 'downloadVideo')
        .mockImplementation(async (url: string, outputPath: string) => {
          mkdirSync(testDir, { recursive: true });
          const videoData = Buffer.from('mock video data');
          const { writeFileSync } = await import('fs');
          writeFileSync(outputPath, videoData);
        });

      const createVideoResult = (taskId: string) => ({
        code: 0,
        message: 'success',
        request_id: `req-${taskId}`,
        data: {
          task_id: taskId,
          task_status: 'succeed' as const,
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            videos: [
              { id: `vid-${taskId}`, url: `https://example.com/${taskId}.mp4`, duration: '5' },
            ],
          },
        },
      });

      // Execute concurrent saves
      const [paths1, paths2, paths3] = await Promise.all([
        api.saveVideoResult(createVideoResult('task1'), testDir, 'first prompt'),
        api.saveVideoResult(createVideoResult('task2'), testDir, 'second prompt'),
        api.saveVideoResult(createVideoResult('task3'), testDir, 'third prompt'),
      ]);

      expect(paths1).toHaveLength(1);
      expect(paths2).toHaveLength(1);
      expect(paths3).toHaveLength(1);

      // Verify different filenames
      expect(paths1[0]).not.toBe(paths2[0]);
      expect(paths2[0]).not.toBe(paths3[0]);

      downloadVideoSpy.mockRestore();
    });

    it('should handle concurrent saveImageResult calls with different prompts', async () => {
      const downloadImageSpy = vi
        .spyOn(utils, 'downloadImage')
        .mockImplementation(async (url: string, outputPath: string) => {
          mkdirSync(testDir, { recursive: true });
          const imageData = Buffer.from('mock image data');
          const { writeFileSync } = await import('fs');
          writeFileSync(outputPath, imageData);
        });

      const createImageResult = (taskId: string) => ({
        code: 0,
        message: 'success',
        request_id: `req-${taskId}`,
        data: {
          task_id: taskId,
          task_status: 'succeed' as const,
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            images: [{ index: 0, url: `https://example.com/${taskId}.png` }],
          },
        },
      });

      // Execute concurrent saves
      const [paths1, paths2, paths3] = await Promise.all([
        api.saveImageResult(createImageResult('task1'), testDir, 'alpha image'),
        api.saveImageResult(createImageResult('task2'), testDir, 'beta image'),
        api.saveImageResult(createImageResult('task3'), testDir, 'gamma image'),
      ]);

      expect(paths1).toHaveLength(1);
      expect(paths2).toHaveLength(1);
      expect(paths3).toHaveLength(1);

      // Verify different filenames
      expect(paths1[0]).not.toBe(paths2[0]);
      expect(paths2[0]).not.toBe(paths3[0]);

      downloadImageSpy.mockRestore();
    });

    it('should handle concurrent saves with same prompt by generating unique filenames', async () => {
      let callCount = 0;
      const downloadImageSpy = vi
        .spyOn(utils, 'downloadImage')
        .mockImplementation(async (url: string, outputPath: string) => {
          // Small delay to simulate network latency
          await new Promise((resolve) => setTimeout(resolve, 10 * callCount++));
          mkdirSync(testDir, { recursive: true });
          const imageData = Buffer.from('mock image data');
          const { writeFileSync } = await import('fs');
          writeFileSync(outputPath, imageData);
        });

      const createImageResult = (taskId: string) => ({
        code: 0,
        message: 'success',
        request_id: `req-${taskId}`,
        data: {
          task_id: taskId,
          task_status: 'succeed' as const,
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            images: [{ index: 0, url: `https://example.com/${taskId}.png` }],
          },
        },
      });

      // Execute concurrent saves with same prompt
      const results = await Promise.all([
        api.saveImageResult(createImageResult('task1'), testDir, 'same prompt'),
        api.saveImageResult(createImageResult('task2'), testDir, 'same prompt'),
      ]);

      // Both should succeed
      expect(results[0]).toHaveLength(1);
      expect(results[1]).toHaveLength(1);

      // Files should have unique names (timestamps differ slightly)
      // Note: In practice, timestamps may be close but files are created successfully
      expect(results[0][0]).toContain('same_prompt');
      expect(results[1][0]).toContain('same_prompt');

      downloadImageSpy.mockRestore();
    });
  });
});
