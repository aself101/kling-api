/**
 * Tests for Image Operations
 *
 * Tests for image generation, image expansion, omni-image,
 * and multi-image-to-image operations.
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

describe('Image Operations', () => {
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
        request_id: 'req-image',
        data: {
          task_id: 'image-task-123',
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
        request_id: 'req-image',
        data: {
          task_id: 'image-task-123',
          task_status: 'succeed',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            images: [{ index: 0, url: 'https://example.com/image.png' }],
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
  // Image Generation Tests
  // ==========================================================================

  describe('generateImage', () => {
    it('should create image generation task with minimal params', async () => {
      const result = await api.generateImage({
        prompt: 'A beautiful sunset over mountains',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/images/generations',
        expect.objectContaining({
          model_name: 'kling-v1',
          prompt: 'A beautiful sunset over mountains',
        })
      );
      expect(result.data.task_id).toBe('image-task-123');
    });

    it('should include optional parameters', async () => {
      await api.generateImage({
        prompt: 'test',
        model_name: 'kling-v2',
        negative_prompt: 'bad quality',
        n: 4,
        aspect_ratio: '16:9',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/images/generations',
        expect.objectContaining({
          model_name: 'kling-v2',
          prompt: 'test',
          negative_prompt: 'bad quality',
          n: 4,
          aspect_ratio: '16:9',
        })
      );
    });

    it('should reject invalid prompt', async () => {
      await expect(api.generateImage({ prompt: '' })).rejects.toThrow('Prompt is required');
    });
  });

  describe('queryImageGenTask', () => {
    it('should query task status', async () => {
      const result = await api.queryImageGenTask('gen-task-456');

      expect(result.data.task_status).toBe('succeed');
      expect(mockGet).toHaveBeenCalledWith('/v1/images/generations/gen-task-456', {
        params: undefined,
      });
    });
  });

  // ==========================================================================
  // Image Expansion Tests
  // ==========================================================================

  describe('expandImage', () => {
    it('should create image expansion task', async () => {
      // Use ratios that result in total area <= 3x: (1+0.2+0.2) * (1+0.2+0.2) = 1.4 * 1.4 = 1.96x
      const result = await api.expandImage({
        image: 'https://example.com/image.jpg',
        up_expansion_ratio: 0.2,
        down_expansion_ratio: 0.2,
        left_expansion_ratio: 0.2,
        right_expansion_ratio: 0.2,
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/images/editing/expand',
        expect.objectContaining({
          image: expect.any(String),
          up_expansion_ratio: 0.2,
          down_expansion_ratio: 0.2,
          left_expansion_ratio: 0.2,
          right_expansion_ratio: 0.2,
        })
      );
      expect(result.data.task_id).toBe('image-task-123');
    });

    it('should reject empty image', async () => {
      await expect(
        api.expandImage({
          image: '',
          up_expansion_ratio: 0.2,
          down_expansion_ratio: 0.2,
          left_expansion_ratio: 0.2,
          right_expansion_ratio: 0.2,
        })
      ).rejects.toThrow('Image is required');
    });
  });

  describe('queryImageExpandTask', () => {
    it('should query correct endpoint', async () => {
      await api.queryImageExpandTask('expand-task-123');
      expect(mockGet).toHaveBeenCalledWith('/v1/images/editing/expand/expand-task-123', {
        params: undefined,
      });
    });
  });

  // ==========================================================================
  // Omni Image Tests
  // ==========================================================================

  describe('omniImage', () => {
    it('should create omni image task', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          code: 0,
          message: 'success',
          request_id: 'req-omni-img',
          data: {
            task_id: 'omni-img-123',
            task_status: 'submitted',
            created_at: Date.now(),
            updated_at: Date.now(),
          },
        },
      });

      const result = await api.omniImage({
        prompt: 'Generate an image with <<<image_1>>>',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/images/omni-image',
        expect.objectContaining({
          model_name: 'kling-image-o1',
          prompt: 'Generate an image with <<<image_1>>>',
        })
      );
      expect(result.data.task_id).toBe('omni-img-123');
    });

    it('should include optional parameters', async () => {
      await api.omniImage({
        prompt: 'Generate multiple images',
        n: 4,
        resolution: '2k',
        aspect_ratio: 'auto',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/images/omni-image',
        expect.objectContaining({
          n: 4,
          resolution: '2k',
          aspect_ratio: 'auto',
        })
      );
    });
  });

  describe('queryOmniImageTask', () => {
    it('should query correct endpoint', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          code: 0,
          message: 'success',
          request_id: 'req-omni-img-query',
          data: {
            task_id: 'omni-img-123',
            task_status: 'succeed',
            created_at: Date.now(),
            updated_at: Date.now(),
            task_result: { images: [{ index: 0, url: 'https://example.com/omni.png' }] },
          },
        },
      });

      await api.queryOmniImageTask('omni-img-123');
      expect(mockGet).toHaveBeenCalledWith('/v1/images/omni-image/omni-img-123', {
        params: undefined,
      });
    });
  });

  // ==========================================================================
  // Multi-Image-to-Image Tests
  // ==========================================================================

  describe('multiImageToImage', () => {
    it('should create multi-image-to-image task', async () => {
      const result = await api.multiImageToImage({
        subject_image_list: [
          { subject_image: 'https://example.com/subject1.jpg' },
          { subject_image: 'https://example.com/subject2.jpg' },
        ],
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/images/multi-image2image',
        expect.objectContaining({
          model_name: 'kling-v2',
          subject_image_list: expect.any(Array),
        })
      );
      expect(result.data.task_id).toBe('image-task-123');
    });

    it('should include optional scene and style images', async () => {
      await api.multiImageToImage({
        subject_image_list: [{ subject_image: 'https://example.com/subject.jpg' }],
        scene_image: 'https://example.com/scene.jpg',
        style_image: 'https://example.com/style.jpg',
        prompt: 'Combine subject with scene and style',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/images/multi-image2image',
        expect.objectContaining({
          scene_image: expect.any(String),
          style_image: expect.any(String),
          prompt: 'Combine subject with scene and style',
        })
      );
    });

    it('should reject empty subject_image_list', async () => {
      await expect(
        api.multiImageToImage({
          subject_image_list: [],
        })
      ).rejects.toThrow('At least one subject image is required');
    });
  });

  describe('queryMultiImageToImageTask', () => {
    it('should query correct endpoint', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          code: 0,
          message: 'success',
          request_id: 'req-multi-img-query',
          data: {
            task_id: 'multi-img-123',
            task_status: 'succeed',
            created_at: Date.now(),
            updated_at: Date.now(),
            task_result: { images: [{ index: 0, url: 'https://example.com/result.png' }] },
          },
        },
      });

      await api.queryMultiImageToImageTask('multi-img-123');
      expect(mockGet).toHaveBeenCalledWith('/v1/images/multi-image2image/multi-img-123', {
        params: undefined,
      });
    });
  });
});
