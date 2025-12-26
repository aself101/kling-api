/**
 * Tests for File Saving Handlers
 *
 * Tests file saving functionality including:
 * - Video and image download and save
 * - Directory creation
 * - Metadata generation
 * - Error handling for empty results
 * - Filename generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveVideoResult, saveImageResult } from '../../src/handlers/file-saver.js';
import type { VideoTaskResult, ImageTaskResult } from '../../src/types.js';

// Mock the utils module
vi.mock('../../src/utils.js', () => ({
  downloadVideo: vi.fn(),
  downloadImage: vi.fn(),
  saveMetadata: vi.fn(),
  ensureDirectory: vi.fn(),
  generateFilename: vi.fn(),
}));

// Import mocked functions
import {
  downloadVideo,
  downloadImage,
  saveMetadata,
  ensureDirectory,
  generateFilename,
} from '../../src/utils.js';

describe('File Saving Handlers', () => {
  const mockOutputDir = '/tmp/kling-test-output';
  const mockPrompt = 'a beautiful sunset over the ocean';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('saveVideoResult', () => {
    const createVideoResult = (videos: Array<{ id: string; url: string; duration: string }>): VideoTaskResult => ({
      code: 0,
      message: 'success',
      request_id: 'req-123',
      data: {
        task_id: 'task-456',
        task_status: 'succeed',
        created_at: 1234567890,
        updated_at: 1234567900,
        task_result: { videos },
      },
    });

    it('should throw error when no videos in result', async () => {
      const emptyResult: VideoTaskResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-456',
          task_status: 'succeed',
          created_at: 1234567890,
          updated_at: 1234567900,
          task_result: { videos: [] },
        },
      };

      await expect(saveVideoResult(emptyResult, mockOutputDir, mockPrompt)).rejects.toThrow(
        'No videos in result'
      );
    });

    it('should throw error when task_result is undefined', async () => {
      const noResultData: VideoTaskResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-456',
          task_status: 'succeed',
          created_at: 1234567890,
          updated_at: 1234567900,
        },
      };

      await expect(saveVideoResult(noResultData, mockOutputDir, mockPrompt)).rejects.toThrow(
        'No videos in result'
      );
    });

    it('should throw error when videos array is undefined', async () => {
      const noVideosArray: VideoTaskResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-456',
          task_status: 'succeed',
          created_at: 1234567890,
          updated_at: 1234567900,
          task_result: {} as VideoTaskResult['data']['task_result'],
        },
      };

      await expect(saveVideoResult(noVideosArray, mockOutputDir, mockPrompt)).rejects.toThrow(
        'No videos in result'
      );
    });

    it('should ensure output directory exists', async () => {
      const result = createVideoResult([
        { id: 'v1', url: 'https://example.com/video1.mp4', duration: '5' },
      ]);
      vi.mocked(generateFilename).mockReturnValue('video-1234.mp4');

      await saveVideoResult(result, mockOutputDir, mockPrompt);

      expect(ensureDirectory).toHaveBeenCalledWith(mockOutputDir);
    });

    it('should download video from URL and save to correct path', async () => {
      const videoUrl = 'https://example.com/generated-video.mp4';
      const result = createVideoResult([{ id: 'v1', url: videoUrl, duration: '5' }]);
      vi.mocked(generateFilename).mockReturnValue('video-1234.mp4');

      await saveVideoResult(result, mockOutputDir, mockPrompt);

      expect(downloadVideo).toHaveBeenCalledWith(videoUrl, '/tmp/kling-test-output/video-1234.mp4');
    });

    it('should save metadata alongside video file', async () => {
      const result = createVideoResult([
        { id: 'v1', url: 'https://example.com/video.mp4', duration: '5' },
      ]);
      vi.mocked(generateFilename).mockReturnValue('video-1234.mp4');

      await saveVideoResult(result, mockOutputDir, mockPrompt);

      expect(saveMetadata).toHaveBeenCalledWith(
        '/tmp/kling-test-output/video-1234.mp4',
        expect.objectContaining({
          task_id: 'task-456',
          video_id: 'v1',
          duration: '5',
          url: 'https://example.com/video.mp4',
          created_at: 1234567890,
          prompt: mockPrompt,
        })
      );
    });

    it('should return array of saved file paths', async () => {
      const result = createVideoResult([
        { id: 'v1', url: 'https://example.com/video1.mp4', duration: '5' },
      ]);
      vi.mocked(generateFilename).mockReturnValue('video-1234.mp4');

      const savedPaths = await saveVideoResult(result, mockOutputDir, mockPrompt);

      expect(savedPaths).toEqual(['/tmp/kling-test-output/video-1234.mp4']);
    });

    it('should handle multiple videos in result', async () => {
      const result = createVideoResult([
        { id: 'v1', url: 'https://example.com/video1.mp4', duration: '5' },
        { id: 'v2', url: 'https://example.com/video2.mp4', duration: '10' },
      ]);
      vi.mocked(generateFilename)
        .mockReturnValueOnce('video-1234.mp4')
        .mockReturnValueOnce('video-5678.mp4');

      const savedPaths = await saveVideoResult(result, mockOutputDir, mockPrompt);

      expect(savedPaths).toHaveLength(2);
      expect(downloadVideo).toHaveBeenCalledTimes(2);
      expect(saveMetadata).toHaveBeenCalledTimes(2);
    });

    it('should use "video" as default prompt for filename when prompt is undefined', async () => {
      const result = createVideoResult([
        { id: 'v1', url: 'https://example.com/video.mp4', duration: '5' },
      ]);
      vi.mocked(generateFilename).mockReturnValue('video-default.mp4');

      await saveVideoResult(result, mockOutputDir);

      expect(generateFilename).toHaveBeenCalledWith('video', 'mp4');
    });

    it('should propagate download errors', async () => {
      const result = createVideoResult([
        { id: 'v1', url: 'https://example.com/video.mp4', duration: '5' },
      ]);
      vi.mocked(generateFilename).mockReturnValue('video-1234.mp4');
      vi.mocked(downloadVideo).mockRejectedValue(new Error('Network error'));

      await expect(saveVideoResult(result, mockOutputDir, mockPrompt)).rejects.toThrow(
        'Network error'
      );
    });
  });

  describe('saveImageResult', () => {
    const createImageResult = (images: Array<{ index: number; url: string }>): ImageTaskResult => ({
      code: 0,
      message: 'success',
      request_id: 'req-123',
      data: {
        task_id: 'task-789',
        task_status: 'succeed',
        created_at: 1234567890,
        updated_at: 1234567900,
        task_result: { images },
      },
    });

    it('should throw error when no images in result', async () => {
      const emptyResult: ImageTaskResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-789',
          task_status: 'succeed',
          created_at: 1234567890,
          updated_at: 1234567900,
          task_result: { images: [] },
        },
      };

      await expect(saveImageResult(emptyResult, mockOutputDir, mockPrompt)).rejects.toThrow(
        'No images in result'
      );
    });

    it('should throw error when task_result is undefined', async () => {
      const noResultData: ImageTaskResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-789',
          task_status: 'succeed',
          created_at: 1234567890,
          updated_at: 1234567900,
        },
      };

      await expect(saveImageResult(noResultData, mockOutputDir, mockPrompt)).rejects.toThrow(
        'No images in result'
      );
    });

    it('should determine extension from URL - jpg', async () => {
      const result = createImageResult([{ index: 0, url: 'https://example.com/image.jpg' }]);
      vi.mocked(generateFilename).mockReturnValue('image-1234.jpg');

      await saveImageResult(result, mockOutputDir, mockPrompt);

      expect(generateFilename).toHaveBeenCalledWith(mockPrompt, 'jpg');
    });

    it('should determine extension from URL - jpeg', async () => {
      const result = createImageResult([{ index: 0, url: 'https://example.com/image.jpeg' }]);
      vi.mocked(generateFilename).mockReturnValue('image-1234.jpg');

      await saveImageResult(result, mockOutputDir, mockPrompt);

      expect(generateFilename).toHaveBeenCalledWith(mockPrompt, 'jpg');
    });

    it('should default to png for non-jpg URLs', async () => {
      const result = createImageResult([{ index: 0, url: 'https://example.com/image.png' }]);
      vi.mocked(generateFilename).mockReturnValue('image-1234.png');

      await saveImageResult(result, mockOutputDir, mockPrompt);

      expect(generateFilename).toHaveBeenCalledWith(mockPrompt, 'png');
    });

    it('should default to png for URLs without extension', async () => {
      const result = createImageResult([
        { index: 0, url: 'https://example.com/api/image?id=123' },
      ]);
      vi.mocked(generateFilename).mockReturnValue('image-1234.png');

      await saveImageResult(result, mockOutputDir, mockPrompt);

      expect(generateFilename).toHaveBeenCalledWith(mockPrompt, 'png');
    });

    it('should download image and save to correct path', async () => {
      const imageUrl = 'https://example.com/generated-image.png';
      const result = createImageResult([{ index: 0, url: imageUrl }]);
      vi.mocked(generateFilename).mockReturnValue('image-1234.png');

      await saveImageResult(result, mockOutputDir, mockPrompt);

      expect(downloadImage).toHaveBeenCalledWith(
        imageUrl,
        '/tmp/kling-test-output/image-1234.png'
      );
    });

    it('should save metadata with image_index', async () => {
      const result = createImageResult([{ index: 2, url: 'https://example.com/image.png' }]);
      vi.mocked(generateFilename).mockReturnValue('image-1234.png');

      await saveImageResult(result, mockOutputDir, mockPrompt);

      expect(saveMetadata).toHaveBeenCalledWith(
        '/tmp/kling-test-output/image-1234.png',
        expect.objectContaining({
          task_id: 'task-789',
          image_index: 2,
          url: 'https://example.com/image.png',
          created_at: 1234567890,
          prompt: mockPrompt,
        })
      );
    });

    it('should handle multiple images in result', async () => {
      const result = createImageResult([
        { index: 0, url: 'https://example.com/image1.png' },
        { index: 1, url: 'https://example.com/image2.jpg' },
        { index: 2, url: 'https://example.com/image3.png' },
      ]);
      vi.mocked(generateFilename)
        .mockReturnValueOnce('image-1.png')
        .mockReturnValueOnce('image-2.jpg')
        .mockReturnValueOnce('image-3.png');

      const savedPaths = await saveImageResult(result, mockOutputDir, mockPrompt);

      expect(savedPaths).toHaveLength(3);
      expect(downloadImage).toHaveBeenCalledTimes(3);
      expect(saveMetadata).toHaveBeenCalledTimes(3);
    });

    it('should use "image" as default prompt for filename when prompt is undefined', async () => {
      const result = createImageResult([{ index: 0, url: 'https://example.com/image.png' }]);
      vi.mocked(generateFilename).mockReturnValue('image-default.png');

      await saveImageResult(result, mockOutputDir);

      expect(generateFilename).toHaveBeenCalledWith('image', 'png');
    });

    it('should propagate download errors', async () => {
      const result = createImageResult([{ index: 0, url: 'https://example.com/image.png' }]);
      vi.mocked(generateFilename).mockReturnValue('image-1234.png');
      vi.mocked(downloadImage).mockRejectedValue(new Error('Download failed'));

      await expect(saveImageResult(result, mockOutputDir, mockPrompt)).rejects.toThrow(
        'Download failed'
      );
    });

    it('should stop processing on first download failure', async () => {
      const result = createImageResult([
        { index: 0, url: 'https://example.com/image1.png' },
        { index: 1, url: 'https://example.com/image2.png' },
      ]);
      vi.mocked(generateFilename).mockReturnValue('image.png');
      vi.mocked(downloadImage).mockRejectedValue(new Error('First download failed'));

      await expect(saveImageResult(result, mockOutputDir, mockPrompt)).rejects.toThrow(
        'First download failed'
      );

      // Should only attempt first download
      expect(downloadImage).toHaveBeenCalledTimes(1);
    });
  });

  describe('directory handling', () => {
    it('should call ensureDirectory before any downloads for video', async () => {
      const result: VideoTaskResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-456',
          task_status: 'succeed',
          created_at: 1234567890,
          updated_at: 1234567900,
          task_result: {
            videos: [{ id: 'v1', url: 'https://example.com/video.mp4', duration: '5' }],
          },
        },
      };
      vi.mocked(generateFilename).mockReturnValue('video.mp4');

      await saveVideoResult(result, mockOutputDir);

      // Verify ensureDirectory was called before downloadVideo
      const ensureOrder = vi.mocked(ensureDirectory).mock.invocationCallOrder[0];
      const downloadOrder = vi.mocked(downloadVideo).mock.invocationCallOrder[0];
      expect(ensureOrder).toBeLessThan(downloadOrder);
    });

    it('should call ensureDirectory before any downloads for image', async () => {
      const result: ImageTaskResult = {
        code: 0,
        message: 'success',
        request_id: 'req-123',
        data: {
          task_id: 'task-789',
          task_status: 'succeed',
          created_at: 1234567890,
          updated_at: 1234567900,
          task_result: {
            images: [{ index: 0, url: 'https://example.com/image.png' }],
          },
        },
      };
      vi.mocked(generateFilename).mockReturnValue('image.png');

      await saveImageResult(result, mockOutputDir);

      const ensureOrder = vi.mocked(ensureDirectory).mock.invocationCallOrder[0];
      const downloadOrder = vi.mocked(downloadImage).mock.invocationCallOrder[0];
      expect(ensureOrder).toBeLessThan(downloadOrder);
    });
  });
});
