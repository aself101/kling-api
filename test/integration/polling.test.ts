/**
 * Polling Integration Tests
 *
 * Tests polling functionality without mocking pollWithSpinner.
 * This ensures actual timeout enforcement and interval behavior
 * work correctly in real usage scenarios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitForVideoResult, waitForImageResult } from '../../src/handlers/result-poller.js';
import { pollWithSpinner } from '../../src/utils/polling.js';
import { KlingAPIError } from '../../src/errors.js';
import type { VideoTaskResult, ImageTaskResult } from '../../src/types.js';

// DO NOT mock pollWithSpinner - we want to test actual behavior
// vi.mock is intentionally NOT used here

describe('Polling Integration Tests (No Mocks)', () => {
  describe('pollWithSpinner timeout enforcement', () => {
    it('should timeout after specified duration', async () => {
      const checkFn = vi.fn().mockResolvedValue({ status: 'processing' });
      const isComplete = vi.fn().mockReturnValue(false);

      const startTime = Date.now();

      await expect(
        pollWithSpinner(checkFn, isComplete, {
          showSpinner: false,
          interval: 10,
          timeout: 50,
        })
      ).rejects.toThrow('Polling timeout');

      const elapsed = Date.now() - startTime;
      // Should take approximately 50ms (with some tolerance for execution time)
      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(200); // Generous upper bound
    });

    it('should enforce timeout even with slow check function', async () => {
      // Check function that takes 30ms each call
      const checkFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { status: 'processing' };
      });
      const isComplete = vi.fn().mockReturnValue(false);

      await expect(
        pollWithSpinner(checkFn, isComplete, {
          showSpinner: false,
          interval: 10,
          timeout: 100,
        })
      ).rejects.toThrow('Polling timeout');
    });

    it('should complete before timeout if condition is met', async () => {
      let callCount = 0;
      const checkFn = vi.fn(async () => {
        callCount++;
        return { status: callCount >= 2 ? 'succeed' : 'processing' };
      });
      const isComplete = vi.fn((result: { status: string }) => result.status === 'succeed');

      const result = await pollWithSpinner(checkFn, isComplete, {
        showSpinner: false,
        interval: 10,
        timeout: 1000,
      });

      expect(result.status).toBe('succeed');
      expect(callCount).toBe(2);
    });

    it('should respect interval between polls', async () => {
      const callTimes: number[] = [];
      let callCount = 0;

      const checkFn = vi.fn(async () => {
        callTimes.push(Date.now());
        callCount++;
        return { status: callCount >= 3 ? 'succeed' : 'processing' };
      });
      const isComplete = vi.fn((result: { status: string }) => result.status === 'succeed');

      await pollWithSpinner(checkFn, isComplete, {
        showSpinner: false,
        interval: 50,
        timeout: 1000,
      });

      // Verify intervals between calls
      expect(callTimes.length).toBe(3);
      for (let i = 1; i < callTimes.length; i++) {
        const interval = callTimes[i] - callTimes[i - 1];
        // Should be approximately 50ms (with tolerance)
        expect(interval).toBeGreaterThanOrEqual(40);
        expect(interval).toBeLessThan(100);
      }
    });
  });

  describe('waitForVideoResult without mocks', () => {
    const createVideoResult = (
      status: 'pending' | 'processing' | 'succeed' | 'failed',
      statusMsg?: string
    ): VideoTaskResult => ({
      code: 0,
      message: 'success',
      request_id: 'req-123',
      data: {
        task_id: 'task-456',
        task_status: status,
        task_status_msg: statusMsg,
        created_at: 1234567890,
        updated_at: 1234567900,
        task_result:
          status === 'succeed'
            ? { videos: [{ id: 'v1', url: 'https://example.com/video.mp4', duration: '5' }] }
            : undefined,
      },
    });

    it('should complete when task succeeds', async () => {
      let callCount = 0;
      const queryFn = vi.fn(async () => {
        callCount++;
        return createVideoResult(callCount >= 2 ? 'succeed' : 'processing');
      });

      const result = await waitForVideoResult('task-456', queryFn, {
        interval: 10,
        timeout: 1000,
        showSpinner: false,
      });

      expect(result.data.task_status).toBe('succeed');
      expect(callCount).toBe(2);
    });

    it('should throw on task failure without timing out', async () => {
      let callCount = 0;
      const queryFn = vi.fn(async () => {
        callCount++;
        return createVideoResult(callCount >= 2 ? 'failed' : 'processing', 'Content moderation');
      });

      await expect(
        waitForVideoResult('task-456', queryFn, {
          interval: 10,
          timeout: 1000,
          showSpinner: false,
        })
      ).rejects.toThrow(KlingAPIError);

      expect(callCount).toBe(2);
    });

    it('should timeout when task stays in processing state', async () => {
      const queryFn = vi.fn(async () => createVideoResult('processing'));

      await expect(
        waitForVideoResult('task-456', queryFn, {
          interval: 10,
          timeout: 50,
          showSpinner: false,
        })
      ).rejects.toThrow('Polling timeout');
    });
  });

  describe('waitForImageResult without mocks', () => {
    const createImageResult = (
      status: 'pending' | 'processing' | 'succeed' | 'failed',
      statusMsg?: string
    ): ImageTaskResult => ({
      code: 0,
      message: 'success',
      request_id: 'req-789',
      data: {
        task_id: 'img-task-123',
        task_status: status,
        task_status_msg: statusMsg,
        created_at: 1234567890,
        updated_at: 1234567900,
        task_result:
          status === 'succeed'
            ? { images: [{ index: 0, url: 'https://example.com/image.png' }] }
            : undefined,
      },
    });

    it('should complete when image task succeeds', async () => {
      let callCount = 0;
      const queryFn = vi.fn(async () => {
        callCount++;
        return createImageResult(callCount >= 3 ? 'succeed' : 'pending');
      });

      const result = await waitForImageResult('img-task-123', queryFn, {
        interval: 10,
        timeout: 1000,
        showSpinner: false,
      });

      expect(result.data.task_status).toBe('succeed');
      expect(callCount).toBe(3);
    });

    it('should throw on image task failure', async () => {
      const queryFn = vi.fn(async () => createImageResult('failed', 'NSFW content detected'));

      await expect(
        waitForImageResult('img-task-123', queryFn, {
          interval: 10,
          timeout: 1000,
          showSpinner: false,
        })
      ).rejects.toThrow('NSFW content detected');
    });

    it('should timeout when image stays pending', async () => {
      const queryFn = vi.fn(async () => createImageResult('pending'));

      await expect(
        waitForImageResult('img-task-123', queryFn, {
          interval: 10,
          timeout: 50,
          showSpinner: false,
        })
      ).rejects.toThrow('Polling timeout');
    });
  });

  describe('Resource cleanup', () => {
    it('should stop polling after timeout', async () => {
      let callCount = 0;
      const checkFn = vi.fn(async () => {
        callCount++;
        return { status: 'processing' };
      });
      const isComplete = vi.fn().mockReturnValue(false);

      await expect(
        pollWithSpinner(checkFn, isComplete, {
          showSpinner: false,
          interval: 10,
          timeout: 50,
        })
      ).rejects.toThrow('Polling timeout');

      const countAtTimeout = callCount;

      // Wait additional time to ensure no more calls happen
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callCount).toBe(countAtTimeout);
    });

    it('should stop polling after success', async () => {
      let callCount = 0;
      const checkFn = vi.fn(async () => {
        callCount++;
        return { status: callCount >= 2 ? 'succeed' : 'processing' };
      });
      const isComplete = vi.fn((result: { status: string }) => result.status === 'succeed');

      await pollWithSpinner(checkFn, isComplete, {
        showSpinner: false,
        interval: 10,
        timeout: 1000,
      });

      const countAtSuccess = callCount;

      // Wait to ensure no more calls happen
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callCount).toBe(countAtSuccess);
    });

    it('should stop polling after error in check function', async () => {
      let callCount = 0;
      const checkFn = vi.fn(async () => {
        callCount++;
        if (callCount >= 2) {
          throw new Error('API Error');
        }
        return { status: 'processing' };
      });
      const isComplete = vi.fn().mockReturnValue(false);

      await expect(
        pollWithSpinner(checkFn, isComplete, {
          showSpinner: false,
          interval: 10,
          timeout: 1000,
        })
      ).rejects.toThrow('API Error');

      const countAtError = callCount;

      // Wait to ensure no more calls happen
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(callCount).toBe(countAtError);
    });
  });
});
