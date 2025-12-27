/**
 * Tests for Video Operations
 *
 * Tests for text-to-video, image-to-video, video extension,
 * multi-image-to-video, and omni-video operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KlingAPI } from '../../src/api.js';

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
  return { default: mockAxios };
});

describe('Video Operations', () => {
  let api: KlingAPI;
  let mockPost: ReturnType<typeof vi.fn>;
  let mockGet: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('KLING_ACCESS_KEY', 'test-access-key');
    vi.stubEnv('KLING_SECRET_KEY', 'test-secret-key');
    api = new KlingAPI();

    // @ts-expect-error - accessing private client for testing
    const client = api.client;
    mockPost = vi.fn().mockResolvedValue({
      data: {
        code: 0,
        message: 'success',
        request_id: 'req-video',
        data: {
          task_id: 'video-task-123',
          task_status: 'submitted',
          created_at: Date.now(),
          updated_at: Date.now(),
        },
      },
    });
    mockGet = vi.fn().mockResolvedValue({
      data: {
        code: 0,
        message: 'success',
        request_id: 'req-video',
        data: {
          task_id: 'video-task-123',
          task_status: 'succeed',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            videos: [{ id: 'v1', url: 'https://example.com/video.mp4', duration: '5' }],
          },
        },
      },
    });
    client.post = mockPost;
    client.get = mockGet;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Text-to-Video Tests
  // ==========================================================================

  describe('textToVideo', () => {
    it('should create text-to-video task with minimal params', async () => {
      const result = await api.textToVideo({
        prompt: 'A cat playing piano',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/text2video',
        expect.objectContaining({
          model_name: 'kling-v1',
          prompt: 'A cat playing piano',
        })
      );
      expect(result.data.task_id).toBe('video-task-123');
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

      expect(mockPost).toHaveBeenCalledWith(
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

      expect(mockPost).toHaveBeenCalledWith(
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
        model_name: 'kling-v1',
        camera_control: {
          type: 'down_back',
        },
      });

      expect(mockPost).toHaveBeenCalledWith(
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
    it('should query task status', async () => {
      const result = await api.queryTextToVideoTask('task-456');

      expect(result.data.task_status).toBe('succeed');
      expect(mockGet).toHaveBeenCalledWith('/v1/videos/text2video/task-456', {
        params: undefined,
      });
    });
  });

  // ==========================================================================
  // Image-to-Video Tests
  // ==========================================================================

  describe('imageToVideo', () => {
    it('should create image-to-video task', async () => {
      const result = await api.imageToVideo({
        image: 'https://example.com/image.jpg',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/image2video',
        expect.objectContaining({
          model_name: 'kling-v1',
          image: expect.any(String),
        })
      );
      expect(result.data.task_id).toBe('video-task-123');
    });

    it('should include optional prompt', async () => {
      await api.imageToVideo({
        image: 'https://example.com/image.jpg',
        prompt: 'Make this image come alive',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/image2video',
        expect.objectContaining({
          prompt: 'Make this image come alive',
        })
      );
    });

    it('should reject empty image', async () => {
      await expect(api.imageToVideo({ image: '' })).rejects.toThrow('Image is required');
    });
  });

  describe('queryImageToVideoTask', () => {
    it('should query correct endpoint', async () => {
      await api.queryImageToVideoTask('img2vid-task-123');
      expect(mockGet).toHaveBeenCalledWith('/v1/videos/image2video/img2vid-task-123', {
        params: undefined,
      });
    });
  });

  // ==========================================================================
  // Video Extension Tests
  // ==========================================================================

  describe('extendVideo', () => {
    it('should create video extension task', async () => {
      const result = await api.extendVideo({
        video_id: 'existing-video-123',
      });

      expect(mockPost).toHaveBeenCalledWith('/v1/videos/video-extend', {
        video_id: 'existing-video-123',
      });
      expect(result.data.task_id).toBe('video-task-123');
    });

    it('should include optional parameters', async () => {
      await api.extendVideo({
        video_id: 'existing-video-123',
        prompt: 'Continue with more action',
        negative_prompt: 'No blur',
        cfg_scale: 0.7,
        callback_url: 'https://callback.example.com',
      });

      expect(mockPost).toHaveBeenCalledWith('/v1/videos/video-extend', {
        video_id: 'existing-video-123',
        prompt: 'Continue with more action',
        negative_prompt: 'No blur',
        cfg_scale: 0.7,
        callback_url: 'https://callback.example.com',
      });
    });

    it('should require video_id', async () => {
      await expect(api.extendVideo({ video_id: '' })).rejects.toThrow('Video ID is required');
    });
  });

  describe('queryExtendVideoTask', () => {
    it('should query correct endpoint', async () => {
      await api.queryExtendVideoTask('extend-task-123');
      expect(mockGet).toHaveBeenCalledWith('/v1/videos/video-extend/extend-task-123', {
        params: undefined,
      });
    });
  });

  // ==========================================================================
  // Multi-Image-to-Video Tests
  // ==========================================================================

  describe('multiImageToVideo', () => {
    it('should create multi-image video task', async () => {
      const result = await api.multiImageToVideo({
        image_list: [
          { image: 'https://example.com/img1.jpg' },
          { image: 'https://example.com/img2.jpg' },
        ],
        prompt: 'Create a smooth transition video',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/multi-image2video',
        expect.objectContaining({
          model_name: 'kling-v1-6',
          prompt: 'Create a smooth transition video',
          image_list: expect.any(Array),
        })
      );
      expect(result.data.task_id).toBe('video-task-123');
    });

    it('should reject empty image_list', async () => {
      await expect(
        api.multiImageToVideo({
          image_list: [],
          prompt: 'Test',
        })
      ).rejects.toThrow('At least one image is required');
    });
  });

  describe('queryMultiImageToVideoTask', () => {
    it('should query correct endpoint', async () => {
      await api.queryMultiImageToVideoTask('multi-task-123');
      expect(mockGet).toHaveBeenCalledWith('/v1/videos/multi-image2video/multi-task-123', {
        params: undefined,
      });
    });
  });

  // ==========================================================================
  // Omni Video Tests
  // ==========================================================================

  describe('omniVideo', () => {
    it('should create omni video task', async () => {
      const result = await api.omniVideo({
        prompt: 'Generate a video featuring <<<image_1>>>',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/omni-video',
        expect.objectContaining({
          model_name: 'kling-video-o1',
          prompt: 'Generate a video featuring <<<image_1>>>',
        })
      );
      expect(result.data.task_id).toBe('video-task-123');
    });

    it('should include image_list when provided', async () => {
      await api.omniVideo({
        prompt: 'A video featuring <<<image_1>>>',
        image_list: [{ image_url: 'https://example.com/img.jpg', type: 'first_frame' }],
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/omni-video',
        expect.objectContaining({
          image_list: expect.arrayContaining([expect.objectContaining({ type: 'first_frame' })]),
        })
      );
    });

    it('should include element_list when provided', async () => {
      await api.omniVideo({
        prompt: 'A video featuring <<<element_1>>>',
        element_list: [{ element_id: 12345 }],
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/omni-video',
        expect.objectContaining({
          element_list: [{ element_id: 12345 }],
        })
      );
    });
  });

  describe('queryOmniVideoTask', () => {
    it('should query correct endpoint', async () => {
      await api.queryOmniVideoTask('omni-video-123');
      expect(mockGet).toHaveBeenCalledWith('/v1/videos/omni-video/omni-video-123', {
        params: undefined,
      });
    });
  });
});
