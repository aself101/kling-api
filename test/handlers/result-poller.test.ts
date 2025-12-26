/**
 * Tests for Result Polling Handlers
 *
 * Tests polling functionality including:
 * - Success scenarios with different status transitions
 * - Failure handling with error messages
 * - Timeout behavior
 * - Polling options
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForVideoResult, waitForImageResult } from '../../src/handlers/result-poller.js';
import { KlingAPIError } from '../../src/errors.js';
import { ERROR_CODES } from '../../src/config/index.js';
import type { VideoTaskResult, ImageTaskResult } from '../../src/types.js';
import { DEFAULT_POLL_INTERVAL_MS, DEFAULT_POLL_TIMEOUT_MS } from '../test-constants.js';

// Mock the utils module for pollWithSpinner
vi.mock('../../src/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/index.js')>();
  return {
    ...actual,
    pollWithSpinner: vi.fn(),
  };
});

// Import the mocked function
import { pollWithSpinner } from '../../src/utils/index.js';

describe('Result Polling Handlers', () => {
  const mockTaskId = 'task-12345';
  const mockRequestId = 'req-67890';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('waitForVideoResult', () => {
    const createVideoResult = (
      status: 'pending' | 'processing' | 'succeed' | 'failed',
      statusMsg?: string
    ): VideoTaskResult => ({
      code: 0,
      message: 'success',
      request_id: mockRequestId,
      data: {
        task_id: mockTaskId,
        task_status: status,
        task_status_msg: statusMsg,
        created_at: 1234567890,
        updated_at: 1234567900,
        task_result: status === 'succeed' ? {
          videos: [{ id: 'v1', url: 'https://example.com/video.mp4', duration: '5' }],
        } : undefined,
      },
    });

    it('should return result when task succeeds', async () => {
      const successResult = createVideoResult('succeed');
      const mockQueryFn = vi.fn().mockResolvedValue(successResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn, checkFn) => {
        const result = await pollFn();
        if (checkFn(result)) return result;
        throw new Error('Should not reach here');
      });

      const result = await waitForVideoResult(mockTaskId, mockQueryFn);

      expect(result).toEqual(successResult);
      expect(pollWithSpinner).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          interval: DEFAULT_POLL_INTERVAL_MS,
          timeout: DEFAULT_POLL_TIMEOUT_MS,
        })
      );
    });

    it('should throw KlingAPIError when task fails', async () => {
      const failedResult = createVideoResult('failed', 'Content moderation failed');
      const mockQueryFn = vi.fn().mockResolvedValue(failedResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn, checkFn) => {
        const result = await pollFn();
        if (checkFn(result)) return result;
        throw new Error('Should not reach here');
      });

      await expect(waitForVideoResult(mockTaskId, mockQueryFn)).rejects.toThrow(KlingAPIError);
      await expect(waitForVideoResult(mockTaskId, mockQueryFn)).rejects.toThrow(
        'Content moderation failed'
      );
    });

    it('should use default error message when task_status_msg is empty', async () => {
      const failedResult = createVideoResult('failed');
      const mockQueryFn = vi.fn().mockResolvedValue(failedResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn, checkFn) => {
        const result = await pollFn();
        if (checkFn(result)) return result;
        throw new Error('Should not reach here');
      });

      await expect(waitForVideoResult(mockTaskId, mockQueryFn)).rejects.toThrow(
        'Video generation failed'
      );
    });

    it('should pass custom polling options', async () => {
      const successResult = createVideoResult('succeed');
      const mockQueryFn = vi.fn().mockResolvedValue(successResult);
      const customOptions = {
        interval: 5000,
        timeout: 120000,
        showSpinner: false,
        spinnerText: 'Custom spinner text',
      };

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn) => {
        return await pollFn();
      });

      await waitForVideoResult(mockTaskId, mockQueryFn, customOptions);

      expect(pollWithSpinner).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          interval: 5000,
          timeout: 120000,
          showSpinner: false,
          spinnerText: 'Custom spinner text',
        })
      );
    });

    it('should call queryFn with correct taskId', async () => {
      const successResult = createVideoResult('succeed');
      const mockQueryFn = vi.fn().mockResolvedValue(successResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn) => {
        return await pollFn();
      });

      await waitForVideoResult(mockTaskId, mockQueryFn);

      expect(mockQueryFn).toHaveBeenCalledWith(mockTaskId);
    });

    it('should check for both succeed and failed statuses in completion check', async () => {
      const successResult = createVideoResult('succeed');
      const mockQueryFn = vi.fn().mockResolvedValue(successResult);
      let capturedCheckFn: ((result: VideoTaskResult) => boolean) | undefined;

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn, checkFn) => {
        capturedCheckFn = checkFn;
        return await pollFn();
      });

      await waitForVideoResult(mockTaskId, mockQueryFn);

      expect(capturedCheckFn).toBeDefined();
      // Test the check function with different statuses
      expect(capturedCheckFn!(createVideoResult('succeed'))).toBe(true);
      expect(capturedCheckFn!(createVideoResult('failed'))).toBe(true);
      expect(capturedCheckFn!(createVideoResult('pending'))).toBe(false);
      expect(capturedCheckFn!(createVideoResult('processing'))).toBe(false);
    });

    it('should include request_id in thrown error', async () => {
      const failedResult = createVideoResult('failed', 'Error message');
      const mockQueryFn = vi.fn().mockResolvedValue(failedResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn) => {
        return await pollFn();
      });

      try {
        await waitForVideoResult(mockTaskId, mockQueryFn);
      } catch (error) {
        expect(error).toBeInstanceOf(KlingAPIError);
        expect((error as KlingAPIError).requestId).toBe(mockRequestId);
      }
    });
  });

  describe('waitForImageResult', () => {
    const createImageResult = (
      status: 'pending' | 'processing' | 'succeed' | 'failed',
      statusMsg?: string
    ): ImageTaskResult => ({
      code: 0,
      message: 'success',
      request_id: mockRequestId,
      data: {
        task_id: mockTaskId,
        task_status: status,
        task_status_msg: statusMsg,
        created_at: 1234567890,
        updated_at: 1234567900,
        task_result: status === 'succeed' ? {
          images: [{ index: 0, url: 'https://example.com/image.png' }],
        } : undefined,
      },
    });

    it('should return result when task succeeds', async () => {
      const successResult = createImageResult('succeed');
      const mockQueryFn = vi.fn().mockResolvedValue(successResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn) => {
        return await pollFn();
      });

      const result = await waitForImageResult(mockTaskId, mockQueryFn);

      expect(result).toEqual(successResult);
    });

    it('should throw KlingAPIError when task fails', async () => {
      const failedResult = createImageResult('failed', 'NSFW content detected');
      const mockQueryFn = vi.fn().mockResolvedValue(failedResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn) => {
        return await pollFn();
      });

      await expect(waitForImageResult(mockTaskId, mockQueryFn)).rejects.toThrow(KlingAPIError);
      await expect(waitForImageResult(mockTaskId, mockQueryFn)).rejects.toThrow(
        'NSFW content detected'
      );
    });

    it('should use default error message when task_status_msg is empty', async () => {
      const failedResult = createImageResult('failed');
      const mockQueryFn = vi.fn().mockResolvedValue(failedResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn) => {
        return await pollFn();
      });

      await expect(waitForImageResult(mockTaskId, mockQueryFn)).rejects.toThrow(
        'Image generation failed'
      );
    });

    it('should use different default spinner text than video', async () => {
      const successResult = createImageResult('succeed');
      const mockQueryFn = vi.fn().mockResolvedValue(successResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn) => {
        return await pollFn();
      });

      await waitForImageResult(mockTaskId, mockQueryFn);

      expect(pollWithSpinner).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          spinnerText: 'Generating image',
        })
      );
    });

    it('should handle status transition from pending to succeed', async () => {
      let callCount = 0;
      const mockQueryFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve(createImageResult('pending'));
        }
        return Promise.resolve(createImageResult('succeed'));
      });

      // Simulate realistic polling behavior
      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn, checkFn) => {
        let result;
        do {
          result = await pollFn();
        } while (!checkFn(result));
        return result;
      });

      const result = await waitForImageResult(mockTaskId, mockQueryFn);

      expect(result.data.task_status).toBe('succeed');
      expect(mockQueryFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('error code handling', () => {
    it('should use INTERNAL_ERROR code for failed tasks', async () => {
      const failedResult: VideoTaskResult = {
        code: 0,
        message: 'success',
        request_id: mockRequestId,
        data: {
          task_id: mockTaskId,
          task_status: 'failed',
          task_status_msg: 'Generation failed',
          created_at: 1234567890,
          updated_at: 1234567900,
        },
      };
      const mockQueryFn = vi.fn().mockResolvedValue(failedResult);

      vi.mocked(pollWithSpinner).mockImplementation(async (pollFn) => {
        return await pollFn();
      });

      try {
        await waitForVideoResult(mockTaskId, mockQueryFn);
      } catch (error) {
        expect(error).toBeInstanceOf(KlingAPIError);
        expect((error as KlingAPIError).code).toBe(ERROR_CODES.INTERNAL_ERROR);
      }
    });
  });
});
