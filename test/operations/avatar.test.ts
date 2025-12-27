/**
 * Tests for Avatar Operations
 *
 * Tests for avatar (talking head) generation.
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

describe('Avatar Operations', () => {
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
        request_id: 'req-avatar',
        data: {
          task_id: 'avatar-task-123',
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
        request_id: 'req-avatar',
        data: {
          task_id: 'avatar-task-123',
          task_status: 'succeed',
          created_at: Date.now(),
          updated_at: Date.now(),
          task_result: {
            videos: [
              { id: 'avatar-video-1', url: 'https://example.com/avatar.mp4', duration: '10' },
            ],
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

  describe('createAvatar', () => {
    it('should create avatar task with image and audio_id', async () => {
      const result = await api.createAvatar({
        image: 'https://example.com/portrait.jpg',
        audio_id: 'audio-12345',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/avatar/image2video',
        expect.objectContaining({
          image: expect.any(String),
          audio_id: 'audio-12345',
        })
      );
      expect(result.data.task_id).toBe('avatar-task-123');
    });

    it('should create avatar task with image and sound_file', async () => {
      await api.createAvatar({
        image: 'https://example.com/portrait.jpg',
        sound_file: 'https://example.com/speech.mp3',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/avatar/image2video',
        expect.objectContaining({
          image: expect.any(String),
          sound_file: expect.any(String),
        })
      );
    });

    it('should include optional parameters', async () => {
      await api.createAvatar({
        image: 'https://example.com/portrait.jpg',
        audio_id: 'audio-12345',
        prompt: 'Speak naturally',
        mode: 'pro',
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/videos/avatar/image2video',
        expect.objectContaining({
          prompt: 'Speak naturally',
          mode: 'pro',
        })
      );
    });

    it('should reject missing audio source', async () => {
      await expect(
        api.createAvatar({
          image: 'https://example.com/portrait.jpg',
        })
      ).rejects.toThrow('Either audio_id or sound_file is required');
    });

    it('should reject empty image', async () => {
      await expect(
        api.createAvatar({
          image: '',
          audio_id: 'audio-12345',
        })
      ).rejects.toThrow('Portrait image is required');
    });
  });

  describe('queryAvatarTask', () => {
    it('should query correct endpoint', async () => {
      const result = await api.queryAvatarTask('avatar-task-123');

      expect(result.data.task_status).toBe('succeed');
      expect(result.data.task_result?.videos).toHaveLength(1);
      expect(mockGet).toHaveBeenCalledWith('/v1/videos/avatar/image2video/avatar-task-123', {
        params: undefined,
      });
    });
  });
});
