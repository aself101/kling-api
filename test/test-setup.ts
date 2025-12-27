/**
 * Shared Test Setup
 *
 * Common mocks, utilities, and setup functions for all test files.
 */

import { vi } from 'vitest';

// ============================================================================
// Axios Mock Factory
// ============================================================================

/**
 * Create a mock axios instance for testing
 *
 * This mock mirrors the structure of the real axios module and can be
 * used with vi.mock('axios', () => createAxiosMock()).
 */
export function createAxiosMock() {
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
}

// ============================================================================
// Test Credentials
// ============================================================================

export const TEST_ACCESS_KEY = 'test-access-key-12345';
export const TEST_SECRET_KEY = 'test-secret-key-67890';

/**
 * Set up test environment with mock credentials
 */
export function setupTestCredentials() {
  process.env.KLING_ACCESS_KEY = TEST_ACCESS_KEY;
  process.env.KLING_SECRET_KEY = TEST_SECRET_KEY;
}

/**
 * Clean up test credentials
 */
export function cleanupTestCredentials() {
  delete process.env.KLING_ACCESS_KEY;
  delete process.env.KLING_SECRET_KEY;
}

// ============================================================================
// Mock Response Factories
// ============================================================================

/**
 * Create a mock task response
 */
export function createMockTaskResponse(taskId = 'task-123', status = 'submitted') {
  return {
    code: 0,
    message: 'success',
    request_id: `req-${taskId}`,
    data: {
      task_id: taskId,
      task_status: status,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
  };
}

/**
 * Create a mock video task result
 */
export function createMockVideoResult(taskId = 'task-123', status = 'succeed') {
  return {
    code: 0,
    message: 'success',
    request_id: `req-${taskId}`,
    data: {
      task_id: taskId,
      task_status: status,
      created_at: Date.now(),
      updated_at: Date.now(),
      task_result: {
        videos: [
          {
            id: 'video-1',
            url: 'https://example.com/video.mp4',
            duration: '5',
          },
        ],
      },
    },
  };
}

/**
 * Create a mock image task result
 */
export function createMockImageResult(taskId = 'task-123', status = 'succeed') {
  return {
    code: 0,
    message: 'success',
    request_id: `req-${taskId}`,
    data: {
      task_id: taskId,
      task_status: status,
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
}

/**
 * Create a mock API error response
 */
export function createMockErrorResponse(
  status: number,
  code: number,
  message: string,
  requestId = 'req-error'
) {
  return {
    response: {
      status,
      data: {
        code,
        message,
        request_id: requestId,
      },
    },
    isAxiosError: true,
    message,
  };
}
