/**
 * Tests for Kling API Utilities Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import axios from 'axios';
import { BASE64_FORMAT_REGEX } from './test-constants.js';

import {
  ensureDirectory,
  generateFilename,
  sanitizePromptForFilename,
  saveFile,
  saveMetadata,
  validateImageBuffer,
  validateImageExtension,
  validateAudioExtension,
  validateUrl,
  redactKey,
  sanitizeError,
  isProduction,
  sleep,
  formatDuration,
  pollWithSpinner,
  imageToBase64,
  audioToBase64,
  downloadVideo,
  downloadImage,
} from '../src/utils/index.js';

// Mock axios for download tests
vi.mock('axios', async () => {
  const actual = await vi.importActual<typeof import('axios')>('axios');
  return {
    default: {
      ...actual.default,
      get: vi.fn(),
    },
  };
});

describe('File I/O Functions', () => {
  const testDir = join(tmpdir(), 'kling-api-test-' + Date.now());

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('ensureDirectory', () => {
    it('should create directory if it does not exist', () => {
      const newDir = join(testDir, 'new-dir');
      expect(existsSync(newDir)).toBe(false);

      ensureDirectory(newDir);

      expect(existsSync(newDir)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      const existingDir = join(testDir, 'existing');
      mkdirSync(existingDir, { recursive: true });

      expect(() => ensureDirectory(existingDir)).not.toThrow();
    });

    it('should create nested directories', () => {
      const nestedDir = join(testDir, 'a', 'b', 'c');

      ensureDirectory(nestedDir);

      expect(existsSync(nestedDir)).toBe(true);
    });
  });

  describe('generateFilename', () => {
    it('should include timestamp prefix', () => {
      const filename = generateFilename('test prompt', 'mp4');
      // Format: YYYY-MM-DDTHH-MM-SS-sssZ_prompt.ext
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    });

    it('should include sanitized prompt', () => {
      const filename = generateFilename('a cat playing piano', 'mp4');
      expect(filename).toContain('a_cat_playing_piano');
    });

    it('should include correct extension', () => {
      const filename = generateFilename('test', 'mp4');
      expect(filename).toMatch(/\.mp4$/);
    });

    it('should handle special characters in prompt', () => {
      const filename = generateFilename('Test! @#$% Prompt', 'png');
      expect(filename).not.toMatch(/[!@#$%]/);
      expect(filename).toContain('test');
      expect(filename).toContain('prompt');
    });
  });

  describe('sanitizePromptForFilename', () => {
    it('should convert to lowercase', () => {
      expect(sanitizePromptForFilename('HELLO World')).toBe('hello_world');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizePromptForFilename('hello world')).toBe('hello_world');
    });

    it('should remove special characters', () => {
      expect(sanitizePromptForFilename('hello!@#$%^&*()')).toBe('hello');
    });

    it('should truncate to max length', () => {
      const longPrompt = 'a'.repeat(100);
      expect(sanitizePromptForFilename(longPrompt, 50)).toHaveLength(50);
    });

    it('should remove trailing underscores', () => {
      expect(sanitizePromptForFilename('hello___')).toBe('hello');
    });
  });

  describe('saveFile', () => {
    it('should save buffer to file', () => {
      const filePath = join(testDir, 'test.bin');
      const data = Buffer.from('test data');

      saveFile(filePath, data);

      expect(existsSync(filePath)).toBe(true);
      expect(readFileSync(filePath).toString()).toBe('test data');
    });

    it('should create parent directories', () => {
      const filePath = join(testDir, 'nested', 'dir', 'test.bin');
      const data = Buffer.from('test');

      saveFile(filePath, data);

      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('saveMetadata', () => {
    it('should save JSON metadata alongside media file', () => {
      const mediaPath = join(testDir, 'video.mp4');
      const metadata = { task_id: '123', prompt: 'test' };

      // First create the media file
      saveFile(mediaPath, Buffer.from('fake video'));

      saveMetadata(mediaPath, metadata);

      const jsonPath = join(testDir, 'video.json');
      expect(existsSync(jsonPath)).toBe(true);

      const savedMetadata = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      expect(savedMetadata.task_id).toBe('123');
      expect(savedMetadata.prompt).toBe('test');
    });
  });
});

describe('Image Validation Functions', () => {
  describe('validateImageBuffer', () => {
    it('should accept valid PNG buffer', () => {
      // PNG magic bytes: 89 50 4E 47
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(() => validateImageBuffer(pngBuffer)).not.toThrow();
    });

    it('should accept valid JPEG buffer', () => {
      // JPEG magic bytes: FF D8 FF
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(() => validateImageBuffer(jpegBuffer)).not.toThrow();
    });

    it('should reject invalid buffer', () => {
      const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      expect(() => validateImageBuffer(invalidBuffer)).toThrow('Invalid image format');
    });

    it('should reject buffer that is too small', () => {
      const tinyBuffer = Buffer.from([0x89]);
      expect(() => validateImageBuffer(tinyBuffer)).toThrow('file too small');
    });
  });

  describe('validateImageExtension', () => {
    it('should accept valid extensions', () => {
      expect(() => validateImageExtension('test.jpg')).not.toThrow();
      expect(() => validateImageExtension('test.jpeg')).not.toThrow();
      expect(() => validateImageExtension('test.png')).not.toThrow();
    });

    it('should be case-insensitive', () => {
      expect(() => validateImageExtension('test.JPG')).not.toThrow();
      expect(() => validateImageExtension('test.PNG')).not.toThrow();
    });

    it('should reject unsupported extensions', () => {
      expect(() => validateImageExtension('test.gif')).toThrow('Unsupported image format');
      expect(() => validateImageExtension('test.bmp')).toThrow('Unsupported image format');
    });
  });

  describe('validateAudioExtension', () => {
    it('should accept valid extensions', () => {
      expect(() => validateAudioExtension('test.mp3')).not.toThrow();
      expect(() => validateAudioExtension('test.wav')).not.toThrow();
      expect(() => validateAudioExtension('test.m4a')).not.toThrow();
      expect(() => validateAudioExtension('test.aac')).not.toThrow();
    });

    it('should reject unsupported extensions', () => {
      expect(() => validateAudioExtension('test.ogg')).toThrow('Unsupported audio format');
      expect(() => validateAudioExtension('test.flac')).toThrow('Unsupported audio format');
    });
  });
});

describe('Security Functions', () => {
  describe('validateUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      expect(() => validateUrl('https://example.com/image.jpg')).not.toThrow();
    });

    it('should reject HTTP URLs', () => {
      expect(() => validateUrl('http://example.com/image.jpg')).toThrow(
        'Only HTTPS URLs are allowed'
      );
    });

    it('should reject invalid URL format', () => {
      expect(() => validateUrl('not-a-url')).toThrow('Invalid URL format');
    });

    it('should reject localhost', () => {
      expect(() => validateUrl('https://localhost/test')).toThrow(
        'private/local addresses is not allowed'
      );
    });

    it('should reject 127.0.0.1', () => {
      expect(() => validateUrl('https://127.0.0.1/test')).toThrow(
        'private/local addresses is not allowed'
      );
    });

    it('should reject private IP ranges', () => {
      expect(() => validateUrl('https://10.0.0.1/test')).toThrow(
        'private/local addresses is not allowed'
      );
      expect(() => validateUrl('https://192.168.1.1/test')).toThrow(
        'private/local addresses is not allowed'
      );
      expect(() => validateUrl('https://172.16.0.1/test')).toThrow(
        'private/local addresses is not allowed'
      );
    });

    it('should reject cloud metadata endpoints', () => {
      expect(() => validateUrl('https://169.254.169.254/test')).toThrow('this host is not allowed');
      expect(() => validateUrl('https://metadata.google.internal/test')).toThrow(
        'this host is not allowed'
      );
    });

    it('should reject IPv4-mapped IPv6 addresses', () => {
      expect(() => validateUrl('https://[::ffff:127.0.0.1]/test')).toThrow(
        'IPv4-mapped IPv6 addresses are not allowed'
      );
    });
  });

  describe('redactKey', () => {
    it('should show only last 4 characters', () => {
      expect(redactKey('abcdefghijklmnop')).toBe('***mnop');
    });

    it('should return **** for short keys', () => {
      expect(redactKey('abc')).toBe('****');
      expect(redactKey('abcd')).toBe('****');
    });

    it('should handle empty string', () => {
      expect(redactKey('')).toBe('****');
    });

    it('should handle undefined-like values', () => {
      expect(redactKey(null as any)).toBe('****');
      expect(redactKey(undefined as any)).toBe('****');
    });
  });

  describe('sanitizeError', () => {
    it('should return message in development mode', () => {
      const error = new Error('Detailed error message');
      expect(sanitizeError(error, true)).toBe('Detailed error message');
    });

    it('should return generic message in production for sensitive errors', () => {
      const error = new Error('Database connection failed at 192.168.1.1');
      expect(sanitizeError(error, false)).toBe('An error occurred while processing your request');
    });

    it('should allow safe validation errors through', () => {
      const error = new Error('Invalid prompt: must be non-empty');
      expect(sanitizeError(error, false)).toBe('Invalid prompt: must be non-empty');
    });

    it('should handle non-Error objects', () => {
      expect(sanitizeError('string error', true)).toBe('string error');
    });
  });

  describe('isProduction', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should return true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(isProduction()).toBe(true);
    });

    it('should return false when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      expect(isProduction()).toBe(false);
    });

    it('should return false when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;
      expect(isProduction()).toBe(false);
    });
  });
});

describe('Utility Functions', () => {
  describe('sleep', () => {
    it('should pause execution for specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;

      // Allow generous tolerance for CI environments with variable timing
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(45000)).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(185000)).toBe('3m 5s');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should handle sub-second values', () => {
      expect(formatDuration(500)).toBe('0s');
    });
  });
});

describe('Polling Functions', () => {
  describe('pollWithSpinner', () => {
    it('should return result immediately if isComplete returns true on first check', async () => {
      let callCount = 0;
      const checkFn = vi.fn(async () => {
        callCount++;
        return { status: 'succeed', data: 'result' };
      });
      const isComplete = vi.fn((result: { status: string }) => result.status === 'succeed');

      const result = await pollWithSpinner(checkFn, isComplete, {
        showSpinner: false,
        interval: 100,
      });

      expect(result.status).toBe('succeed');
      expect(callCount).toBe(1);
      expect(checkFn).toHaveBeenCalledTimes(1);
    });

    it('should poll multiple times until isComplete returns true', async () => {
      let callCount = 0;
      const checkFn = vi.fn(async () => {
        callCount++;
        return { status: callCount < 3 ? 'processing' : 'succeed', data: `call-${callCount}` };
      });
      const isComplete = vi.fn((result: { status: string }) => result.status === 'succeed');

      const result = await pollWithSpinner(checkFn, isComplete, {
        showSpinner: false,
        interval: 10, // Fast polling for tests
      });

      expect(callCount).toBe(3);
      expect(result.status).toBe('succeed');
      expect(result.data).toBe('call-3');
    });

    it('should throw timeout error when polling exceeds timeout', async () => {
      const checkFn = vi.fn(async () => ({ status: 'processing' }));
      const isComplete = vi.fn(() => false); // Never complete

      await expect(
        pollWithSpinner(checkFn, isComplete, {
          showSpinner: false,
          interval: 10,
          timeout: 50, // 50ms timeout
        })
      ).rejects.toThrow('Polling timeout');
    });

    it('should propagate errors from checkFn', async () => {
      const checkFn = vi.fn(async () => {
        throw new Error('API Error');
      });
      const isComplete = vi.fn(() => false);

      await expect(pollWithSpinner(checkFn, isComplete, { showSpinner: false })).rejects.toThrow(
        'API Error'
      );
    });

    it('should use default options when not provided', async () => {
      const checkFn = vi.fn(async () => ({ status: 'succeed' }));
      const isComplete = vi.fn(() => true);

      const result = await pollWithSpinner(checkFn, isComplete, { showSpinner: false });

      expect(result.status).toBe('succeed');
    });
  });
});

describe('Image Conversion Functions', () => {
  describe('imageToBase64', () => {
    describe('URL-based conversion', () => {
      it('should download and convert HTTPS URL to base64', async () => {
        // Valid PNG data
        const pngBuffer = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
          0x52,
        ]);

        vi.mocked(axios.get).mockResolvedValue({
          data: pngBuffer,
          status: 200,
        });

        const result = await imageToBase64('https://example.com/image.png');

        expect(result).toMatch(BASE64_FORMAT_REGEX);
        expect(typeof result).toBe('string');

        // Verify it's valid base64 encoding of the PNG
        const decoded = Buffer.from(result, 'base64');
        expect(decoded).toEqual(pngBuffer);

        // Verify axios was called with correct options
        expect(axios.get).toHaveBeenCalledWith(
          'https://example.com/image.png',
          expect.objectContaining({
            responseType: 'arraybuffer',
            timeout: expect.any(Number),
            maxContentLength: expect.any(Number),
            maxRedirects: expect.any(Number),
          })
        );
      });

      it('should reject HTTP URLs for image conversion (security)', async () => {
        await expect(imageToBase64('http://example.com/image.png')).rejects.toThrow(
          'Only HTTPS URLs are allowed'
        );
      });

      it('should reject private IP addresses in image URLs (SSRF protection)', async () => {
        await expect(imageToBase64('https://192.168.1.1/image.png')).rejects.toThrow(
          'Access to private/local addresses is not allowed'
        );
      });

      it('should reject localhost in image URLs (SSRF protection)', async () => {
        await expect(imageToBase64('https://localhost/image.png')).rejects.toThrow(
          'Access to private/local addresses is not allowed'
        );
      });

      it('should reject cloud metadata endpoints in image URLs (SSRF protection)', async () => {
        await expect(imageToBase64('https://169.254.169.254/latest/meta-data')).rejects.toThrow(
          'Access to this host is not allowed'
        );
      });

      it('should validate image format from URL response', async () => {
        // Invalid image data (not PNG or JPEG)
        const invalidData = Buffer.from('not an image');

        vi.mocked(axios.get).mockResolvedValue({
          data: invalidData,
          status: 200,
        });

        await expect(imageToBase64('https://example.com/image.png')).rejects.toThrow(
          'Invalid image format'
        );
      });

      it('should handle network errors during URL download', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('Network Error'));

        await expect(imageToBase64('https://example.com/image.png')).rejects.toThrow(
          'Network Error'
        );
      });

      it('should download JPEG from URL', async () => {
        const jpegBuffer = Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
          0x01,
        ]);

        vi.mocked(axios.get).mockResolvedValue({
          data: jpegBuffer,
          status: 200,
        });

        const result = await imageToBase64('https://example.com/photo.jpg');

        expect(result).toMatch(BASE64_FORMAT_REGEX);
        const decoded = Buffer.from(result, 'base64');
        expect(decoded[0]).toBe(0xff);
        expect(decoded[1]).toBe(0xd8);
      });
    });

    describe('local file conversion', () => {
      it('should convert local file to base64', async () => {
        const testDir = join(tmpdir(), 'kling-api-test-img-' + Date.now());
        mkdirSync(testDir, { recursive: true });

        // Create a valid PNG file (minimal PNG header)
        const pngBuffer = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
          0x52,
        ]);
        const testFile = join(testDir, 'test.png');
        writeFileSync(testFile, pngBuffer);

        const result = await imageToBase64(testFile);

        expect(result).toMatch(BASE64_FORMAT_REGEX);
        expect(typeof result).toBe('string');
        // Verify it's valid base64
        const decoded = Buffer.from(result, 'base64');
        expect(decoded[0]).toBe(0x89); // PNG magic byte preserved
        expect(decoded[1]).toBe(0x50);

        // Cleanup
        rmSync(testDir, { recursive: true, force: true });
      });

      it('should throw error for non-existent file', async () => {
        await expect(imageToBase64('/nonexistent/path/image.png')).rejects.toThrow(
          'Image file not found'
        );
      });

      it('should throw error for invalid image format', async () => {
        const testDir = join(tmpdir(), 'kling-api-test-invalid-' + Date.now());
        mkdirSync(testDir, { recursive: true });

        // Create an invalid file (not an image)
        const invalidBuffer = Buffer.from('not an image');
        const testFile = join(testDir, 'invalid.txt');
        writeFileSync(testFile, invalidBuffer);

        await expect(imageToBase64(testFile)).rejects.toThrow('Invalid image format');

        rmSync(testDir, { recursive: true, force: true });
      });

      it('should handle JPEG files', async () => {
        const testDir = join(tmpdir(), 'kling-api-test-jpeg-' + Date.now());
        mkdirSync(testDir, { recursive: true });

        // Create a valid JPEG file (minimal JPEG header)
        const jpegBuffer = Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
          0x01,
        ]);
        const testFile = join(testDir, 'test.jpg');
        writeFileSync(testFile, jpegBuffer);

        const result = await imageToBase64(testFile);

        expect(result).toMatch(BASE64_FORMAT_REGEX);
        const decoded = Buffer.from(result, 'base64');
        expect(decoded[0]).toBe(0xff); // JPEG magic byte
        expect(decoded[1]).toBe(0xd8);

        rmSync(testDir, { recursive: true, force: true });
      });

      it('should reject file that is too small', async () => {
        const testDir = join(tmpdir(), 'kling-api-test-small-' + Date.now());
        mkdirSync(testDir, { recursive: true });

        // Create a file that is too small to be valid
        const tinyBuffer = Buffer.from([0x89]);
        const testFile = join(testDir, 'tiny.png');
        writeFileSync(testFile, tinyBuffer);

        await expect(imageToBase64(testFile)).rejects.toThrow('file too small');

        rmSync(testDir, { recursive: true, force: true });
      });
    }); // End of local file conversion describe
  }); // End of imageToBase64 describe

  describe('audioToBase64', () => {
    describe('URL-based conversion', () => {
      it('should download and convert HTTPS audio URL to base64', async () => {
        const audioBuffer = Buffer.from('fake audio content');

        vi.mocked(axios.get).mockResolvedValue({
          data: audioBuffer,
          status: 200,
        });

        const result = await audioToBase64('https://example.com/audio.mp3');

        expect(result).toMatch(BASE64_FORMAT_REGEX);
        expect(typeof result).toBe('string');

        // Verify it's valid base64 encoding
        const decoded = Buffer.from(result, 'base64');
        expect(decoded).toEqual(audioBuffer);

        // Verify axios was called with correct options
        expect(axios.get).toHaveBeenCalledWith(
          'https://example.com/audio.mp3',
          expect.objectContaining({
            responseType: 'arraybuffer',
            timeout: expect.any(Number),
            maxContentLength: expect.any(Number),
            maxRedirects: expect.any(Number),
          })
        );
      });

      it('should reject HTTP URLs for audio conversion (security)', async () => {
        await expect(audioToBase64('http://example.com/audio.mp3')).rejects.toThrow(
          'Only HTTPS URLs are allowed'
        );
      });

      it('should reject private IP addresses in audio URLs (SSRF protection)', async () => {
        await expect(audioToBase64('https://192.168.1.1/audio.mp3')).rejects.toThrow(
          'Access to private/local addresses is not allowed'
        );
      });

      it('should reject localhost in audio URLs (SSRF protection)', async () => {
        await expect(audioToBase64('https://localhost/audio.mp3')).rejects.toThrow(
          'Access to private/local addresses is not allowed'
        );
      });

      it('should handle network errors during audio URL download', async () => {
        vi.mocked(axios.get).mockRejectedValue(new Error('Network Error'));

        await expect(audioToBase64('https://example.com/audio.mp3')).rejects.toThrow(
          'Network Error'
        );
      });
    });

    describe('local file conversion', () => {
      it('should convert local audio file to base64', async () => {
        const testDir = join(tmpdir(), 'kling-api-test-audio-' + Date.now());
        mkdirSync(testDir, { recursive: true });

        // Create a minimal valid audio file content
        const audioBuffer = Buffer.from('fake audio content for testing');
        const testFile = join(testDir, 'test.mp3');
        writeFileSync(testFile, audioBuffer);

        const result = await audioToBase64(testFile);

        expect(result).toMatch(BASE64_FORMAT_REGEX);
        expect(typeof result).toBe('string');

        rmSync(testDir, { recursive: true, force: true });
      });

      it('should throw error for non-existent audio file', async () => {
        await expect(audioToBase64('/nonexistent/path/audio.mp3')).rejects.toThrow(
          'Audio file not found'
        );
      });
    }); // End of local file conversion describe
  }); // End of audioToBase64 describe
});

describe('Polling Timeout Boundary Tests', () => {
  describe('pollWithSpinner', () => {
    it('should NOT timeout when elapsed time equals timeout minus epsilon', async () => {
      let callCount = 0;
      const checkFn = vi.fn(async () => {
        callCount++;
        // Complete on 3rd call
        return { status: callCount >= 3 ? 'succeed' : 'processing' };
      });
      const isComplete = vi.fn((result: { status: string }) => result.status === 'succeed');

      // Use a timeout that gives room for 3 polls
      const result = await pollWithSpinner(checkFn, isComplete, {
        showSpinner: false,
        interval: 10,
        timeout: 100, // Should have time for ~10 polls
      });

      expect(result.status).toBe('succeed');
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('should timeout when elapsed time exceeds timeout', async () => {
      const checkFn = vi.fn(async () => ({ status: 'processing' }));
      const isComplete = vi.fn(() => false);

      await expect(
        pollWithSpinner(checkFn, isComplete, {
          showSpinner: false,
          interval: 20,
          timeout: 30, // Only allows ~1-2 checks before timeout
        })
      ).rejects.toThrow('Polling timeout');
    });

    it('should complete exactly at timeout boundary if isComplete returns true', async () => {
      // This tests that the isComplete check happens before the timeout check
      let callCount = 0;
      const checkFn = vi.fn(async () => {
        callCount++;
        return { status: 'succeed', callNumber: callCount };
      });
      const isComplete = vi.fn(() => true);

      const result = await pollWithSpinner(checkFn, isComplete, {
        showSpinner: false,
        interval: 1,
        timeout: 1, // Very tight timeout
      });

      // Should complete successfully on first check (before timeout is evaluated)
      expect(result.status).toBe('succeed');
    });
  });
});

describe('Download Functions', () => {
  const testDir = join(tmpdir(), 'kling-api-download-test-' + Date.now());

  beforeEach(() => {
    vi.clearAllMocks();
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('downloadVideo', () => {
    it('should reject HTTP URLs (SSRF protection)', async () => {
      await expect(
        downloadVideo('http://example.com/video.mp4', join(testDir, 'video.mp4'))
      ).rejects.toThrow('Only HTTPS URLs are allowed');
    });

    it('should reject localhost URLs (SSRF protection)', async () => {
      await expect(
        downloadVideo('https://localhost/video.mp4', join(testDir, 'video.mp4'))
      ).rejects.toThrow('Access to private/local addresses is not allowed');
    });

    it('should reject private IP addresses (SSRF protection)', async () => {
      await expect(
        downloadVideo('https://192.168.1.1/video.mp4', join(testDir, 'video.mp4'))
      ).rejects.toThrow('Access to private/local addresses is not allowed');
    });

    it('should download and save video from valid HTTPS URL', async () => {
      const videoData = Buffer.from('fake video content');
      vi.mocked(axios.get).mockResolvedValue({
        data: videoData,
        status: 200,
      });

      const outputPath = join(testDir, 'downloaded.mp4');
      const result = await downloadVideo('https://example.com/video.mp4', outputPath);

      expect(result).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath)).toEqual(videoData);
    });

    it('should propagate network errors', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Network Error'));

      await expect(
        downloadVideo('https://example.com/video.mp4', join(testDir, 'video.mp4'))
      ).rejects.toThrow('Network Error');
    });

    it('should propagate timeout errors', async () => {
      const timeoutError = new Error('timeout of 120000ms exceeded');
      timeoutError.name = 'AxiosError';
      vi.mocked(axios.get).mockRejectedValue(timeoutError);

      await expect(
        downloadVideo('https://example.com/video.mp4', join(testDir, 'video.mp4'))
      ).rejects.toThrow('timeout');
    });

    it('should reject videos exceeding size limit', async () => {
      const sizeError = new Error('maxContentLength size of 104857600 exceeded');
      sizeError.name = 'AxiosError';
      vi.mocked(axios.get).mockRejectedValue(sizeError);

      await expect(
        downloadVideo('https://example.com/large-video.mp4', join(testDir, 'large.mp4'))
      ).rejects.toThrow('maxContentLength');
    });
  });

  describe('downloadImage', () => {
    it('should reject HTTP URLs (SSRF protection)', async () => {
      await expect(
        downloadImage('http://example.com/image.png', join(testDir, 'image.png'))
      ).rejects.toThrow('Only HTTPS URLs are allowed');
    });

    it('should reject cloud metadata endpoints (SSRF protection)', async () => {
      await expect(
        downloadImage('https://169.254.169.254/latest/meta-data', join(testDir, 'meta'))
      ).rejects.toThrow('Access to this host is not allowed');
    });

    it('should download and save valid PNG image', async () => {
      // Valid PNG header
      const pngData = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
        0x52,
      ]);
      vi.mocked(axios.get).mockResolvedValue({
        data: pngData,
        status: 200,
      });

      const outputPath = join(testDir, 'downloaded.png');
      const result = await downloadImage('https://example.com/image.png', outputPath);

      expect(result).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath)).toEqual(pngData);
    });

    it('should download and save valid JPEG image', async () => {
      // Valid JPEG header
      const jpegData = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00,
        0x01,
      ]);
      vi.mocked(axios.get).mockResolvedValue({
        data: jpegData,
        status: 200,
      });

      const outputPath = join(testDir, 'downloaded.jpg');
      const result = await downloadImage('https://example.com/image.jpg', outputPath);

      expect(result).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);
    });

    it('should reject invalid image format', async () => {
      // Not a valid image (no valid magic bytes)
      const invalidData = Buffer.from('this is not an image');
      vi.mocked(axios.get).mockResolvedValue({
        data: invalidData,
        status: 200,
      });

      await expect(
        downloadImage('https://example.com/image.png', join(testDir, 'invalid.png'))
      ).rejects.toThrow('Invalid image format');
    });

    it('should reject image that is too small', async () => {
      // Too few bytes to be valid
      const tinyData = Buffer.from([0x89, 0x50]);
      vi.mocked(axios.get).mockResolvedValue({
        data: tinyData,
        status: 200,
      });

      await expect(
        downloadImage('https://example.com/tiny.png', join(testDir, 'tiny.png'))
      ).rejects.toThrow('file too small');
    });

    it('should propagate network errors', async () => {
      vi.mocked(axios.get).mockRejectedValue(new Error('Connection refused'));

      await expect(
        downloadImage('https://example.com/image.png', join(testDir, 'image.png'))
      ).rejects.toThrow('Connection refused');
    });

    it('should reject images exceeding size limit', async () => {
      const sizeError = new Error('maxContentLength size of 10485760 exceeded');
      sizeError.name = 'AxiosError';
      vi.mocked(axios.get).mockRejectedValue(sizeError);

      await expect(
        downloadImage('https://example.com/large-image.png', join(testDir, 'large.png'))
      ).rejects.toThrow('maxContentLength');
    });
  });
});
