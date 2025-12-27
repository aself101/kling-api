/**
 * Download Integration Tests using nock
 *
 * Tests download functions at the HTTP layer using nock for network interception.
 * This provides higher confidence than module-level mocking by testing:
 * - Actual axios configuration (timeouts, redirects, etc.)
 * - Real HTTP response handling
 * - Buffer integrity with actual image data
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { downloadVideo, downloadImage } from '../../src/utils/downloads.js';

describe('Download Integration Tests (nock)', () => {
  const testDir = join(tmpdir(), 'kling-api-nock-download-test-' + Date.now());

  // Valid PNG magic bytes (minimal valid PNG header)
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // Valid JPEG magic bytes
  const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

  // Create a minimal valid PNG (8 bytes header + enough padding)
  const createValidPng = (): Buffer => {
    const padding = Buffer.alloc(100); // Padding to meet minimum size
    return Buffer.concat([PNG_MAGIC, padding]);
  };

  // Create a minimal valid JPEG
  const createValidJpeg = (): Buffer => {
    const padding = Buffer.alloc(100);
    return Buffer.concat([JPEG_MAGIC, padding]);
  };

  beforeEach(() => {
    nock.disableNetConnect();
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('downloadVideo - HTTP Layer', () => {
    it('should download video and save to file', async () => {
      const videoData = Buffer.from('fake video content for testing');
      const outputPath = join(testDir, 'video.mp4');

      nock('https://cdn.example.com')
        .get('/video/123.mp4')
        .reply(200, videoData, { 'Content-Type': 'video/mp4' });

      const result = await downloadVideo('https://cdn.example.com/video/123.mp4', outputPath);

      expect(result).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);
      expect(readFileSync(outputPath)).toEqual(videoData);
    });

    it('should handle HTTP redirects', async () => {
      const videoData = Buffer.from('redirected video content');
      const outputPath = join(testDir, 'redirected.mp4');

      nock('https://api.example.com')
        .get('/video/redirect')
        .reply(302, '', { Location: 'https://cdn.example.com/actual-video.mp4' });

      nock('https://cdn.example.com')
        .get('/actual-video.mp4')
        .reply(200, videoData);

      const result = await downloadVideo('https://api.example.com/video/redirect', outputPath);

      expect(result).toBe(outputPath);
      expect(readFileSync(outputPath)).toEqual(videoData);
    });

    it('should handle 404 errors', async () => {
      const outputPath = join(testDir, 'notfound.mp4');

      nock('https://example.com').get('/video/notfound.mp4').reply(404, 'Not Found');

      await expect(
        downloadVideo('https://example.com/video/notfound.mp4', outputPath)
      ).rejects.toThrow();
    });

    it('should handle 500 server errors', async () => {
      const outputPath = join(testDir, 'error.mp4');

      nock('https://example.com').get('/video/error.mp4').reply(500, 'Internal Server Error');

      await expect(
        downloadVideo('https://example.com/video/error.mp4', outputPath)
      ).rejects.toThrow();
    });

    it('should handle network failures', async () => {
      const outputPath = join(testDir, 'network-fail.mp4');

      nock('https://example.com')
        .get('/video/network-fail.mp4')
        .replyWithError('Connection reset');

      await expect(
        downloadVideo('https://example.com/video/network-fail.mp4', outputPath)
      ).rejects.toThrow('Connection reset');
    });

    it('should validate HTTPS requirement (SSRF)', async () => {
      const outputPath = join(testDir, 'http.mp4');

      // Should fail before making any HTTP request
      await expect(downloadVideo('http://example.com/video.mp4', outputPath)).rejects.toThrow(
        'Only HTTPS URLs are allowed'
      );
    });

    it('should block private IP addresses (SSRF)', async () => {
      const outputPath = join(testDir, 'private.mp4');

      await expect(downloadVideo('https://10.0.0.1/video.mp4', outputPath)).rejects.toThrow(
        'Access to private/local addresses is not allowed'
      );
    });

    it('should block localhost (SSRF)', async () => {
      const outputPath = join(testDir, 'localhost.mp4');

      await expect(downloadVideo('https://127.0.0.1/video.mp4', outputPath)).rejects.toThrow(
        'Access to private/local addresses is not allowed'
      );
    });

    it('should block IPv4-mapped IPv6 addresses (SSRF bypass prevention)', async () => {
      const outputPath = join(testDir, 'ipv6.mp4');

      await expect(
        downloadVideo('https://[::ffff:127.0.0.1]/video.mp4', outputPath)
      ).rejects.toThrow('IPv4-mapped IPv6');
    });
  });

  describe('downloadImage - HTTP Layer', () => {
    it('should download PNG image with magic byte validation', async () => {
      const pngData = createValidPng();
      const outputPath = join(testDir, 'image.png');

      nock('https://cdn.example.com')
        .get('/image/test.png')
        .reply(200, pngData, { 'Content-Type': 'image/png' });

      const result = await downloadImage('https://cdn.example.com/image/test.png', outputPath);

      expect(result).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);

      const savedData = readFileSync(outputPath);
      // Verify magic bytes are preserved
      expect(savedData.subarray(0, 8)).toEqual(PNG_MAGIC);
    });

    it('should download JPEG image with magic byte validation', async () => {
      const jpegData = createValidJpeg();
      const outputPath = join(testDir, 'image.jpg');

      nock('https://cdn.example.com')
        .get('/image/test.jpg')
        .reply(200, jpegData, { 'Content-Type': 'image/jpeg' });

      const result = await downloadImage('https://cdn.example.com/image/test.jpg', outputPath);

      expect(result).toBe(outputPath);

      const savedData = readFileSync(outputPath);
      // Verify JPEG magic bytes
      expect(savedData.subarray(0, 4)).toEqual(JPEG_MAGIC);
    });

    it('should reject invalid image format (wrong magic bytes)', async () => {
      const invalidData = Buffer.from('This is not an image file');
      const outputPath = join(testDir, 'invalid.png');

      nock('https://cdn.example.com')
        .get('/image/invalid.png')
        .reply(200, invalidData, { 'Content-Type': 'image/png' });

      await expect(
        downloadImage('https://cdn.example.com/image/invalid.png', outputPath)
      ).rejects.toThrow('Invalid image format');
    });

    it('should reject files that are too small', async () => {
      const tinyData = Buffer.from([0x89, 0x50, 0x4e]); // Only 3 bytes (< 4 minimum)
      const outputPath = join(testDir, 'tiny.png');

      nock('https://cdn.example.com')
        .get('/image/tiny.png')
        .reply(200, tinyData, { 'Content-Type': 'image/png' });

      await expect(
        downloadImage('https://cdn.example.com/image/tiny.png', outputPath)
      ).rejects.toThrow('file too small');
    });

    it('should handle 403 forbidden errors', async () => {
      const outputPath = join(testDir, 'forbidden.png');

      nock('https://cdn.example.com')
        .get('/image/forbidden.png')
        .reply(403, 'Forbidden');

      await expect(
        downloadImage('https://cdn.example.com/image/forbidden.png', outputPath)
      ).rejects.toThrow();
    });

    it('should follow redirects up to limit', async () => {
      const pngData = createValidPng();
      const outputPath = join(testDir, 'chain.png');

      // Create redirect chain
      nock('https://api.example.com')
        .get('/redirect/1')
        .reply(302, '', { Location: 'https://api.example.com/redirect/2' });

      nock('https://api.example.com')
        .get('/redirect/2')
        .reply(302, '', { Location: 'https://cdn.example.com/final.png' });

      nock('https://cdn.example.com').get('/final.png').reply(200, pngData);

      const result = await downloadImage('https://api.example.com/redirect/1', outputPath);

      expect(result).toBe(outputPath);
      expect(existsSync(outputPath)).toBe(true);
    });

    it('should validate HTTPS requirement (SSRF)', async () => {
      const outputPath = join(testDir, 'http.png');

      await expect(downloadImage('http://example.com/image.png', outputPath)).rejects.toThrow(
        'Only HTTPS URLs are allowed'
      );
    });

    it('should block cloud metadata endpoints (SSRF)', async () => {
      const outputPath = join(testDir, 'metadata.png');

      await expect(
        downloadImage('https://169.254.169.254/latest/meta-data', outputPath)
      ).rejects.toThrow('Access to this host is not allowed');
    });
  });

  describe('Buffer Integrity', () => {
    it('should preserve exact binary content for video downloads', async () => {
      // Create a buffer with specific binary pattern
      const binaryPattern = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        binaryPattern[i] = i;
      }
      const outputPath = join(testDir, 'binary.mp4');

      nock('https://cdn.example.com').get('/binary.mp4').reply(200, binaryPattern);

      await downloadVideo('https://cdn.example.com/binary.mp4', outputPath);

      const savedData = readFileSync(outputPath);
      expect(savedData).toEqual(binaryPattern);
    });

    it('should preserve exact binary content for image downloads', async () => {
      // Create valid PNG with specific content after header
      const customContent = Buffer.alloc(200);
      customContent[0] = 0x89;
      customContent[1] = 0x50;
      customContent[2] = 0x4e;
      customContent[3] = 0x47;
      customContent[4] = 0x0d;
      customContent[5] = 0x0a;
      customContent[6] = 0x1a;
      customContent[7] = 0x0a;
      // Fill rest with recognizable pattern
      for (let i = 8; i < 200; i++) {
        customContent[i] = (i * 7) % 256;
      }

      const outputPath = join(testDir, 'exact.png');

      nock('https://cdn.example.com').get('/exact.png').reply(200, customContent);

      await downloadImage('https://cdn.example.com/exact.png', outputPath);

      const savedData = readFileSync(outputPath);
      expect(savedData).toEqual(customContent);
    });
  });
});
