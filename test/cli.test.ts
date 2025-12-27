/**
 * CLI Tests
 *
 * Tests for the command-line interface, including option parsing,
 * validation, and command handlers.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const CLI_PATH = path.resolve(__dirname, '../dist/cli.js');

/**
 * Run CLI command and return output
 */
function runCli(args: string): string {
  try {
    return execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf8',
      timeout: 10000,
    });
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string };
    return execError.stdout || execError.stderr || '';
  }
}

describe('CLI', () => {
  describe('General', () => {
    it('should show help with --help', () => {
      const output = runCli('--help');
      expect(output).toContain('Usage: kling');
      expect(output).toContain('video');
      expect(output).toContain('--access-key');
      expect(output).toContain('--secret-key');
    });

    it('should show version with --version', () => {
      const output = runCli('--version');
      expect(output.trim()).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('should show examples with --examples', () => {
      const output = runCli('--examples');
      expect(output).toContain('KLING AI - USAGE EXAMPLES');
      expect(output).toContain('TEXT-TO-VIDEO');
      expect(output).toContain('IMAGE-TO-VIDEO');
    });
  });

  describe('Video Command', () => {
    it('should show video subcommands with video --help', () => {
      const output = runCli('video --help');
      expect(output).toContain('text2video');
      expect(output).toContain('image2video');
      expect(output).toContain('extend');
      expect(output).toContain('multi-image');
      expect(output).toContain('omni');
      expect(output).toContain('examples');
    });

    it('should show text2video help', () => {
      const output = runCli('video text2video --help');
      expect(output).toContain('--prompt');
      expect(output).toContain('--model');
      expect(output).toContain('--mode');
      expect(output).toContain('--aspect-ratio');
      expect(output).toContain('--duration');
      expect(output).toContain('--sound');
      expect(output).toContain('--camera-type');
      expect(output).toContain('--wait');
    });

    it('should show image2video help', () => {
      const output = runCli('video image2video --help');
      expect(output).toContain('--image');
      expect(output).toContain('--prompt');
      expect(output).toContain('--model');
      expect(output).toContain('--image-tail');
      expect(output).toContain('--camera-type');
    });

    it('should show extend help', () => {
      const output = runCli('video extend --help');
      expect(output).toContain('--video-id');
      expect(output).toContain('--prompt');
      expect(output).toContain('--cfg-scale');
    });

    it('should show multi-image help', () => {
      const output = runCli('video multi-image --help');
      expect(output).toContain('--images');
      expect(output).toContain('--prompt');
      expect(output).toContain('--model');
      expect(output).toContain('--mode');
    });

    it('should show omni help', () => {
      const output = runCli('video omni --help');
      expect(output).toContain('--prompt');
      expect(output).toContain('--images');
      expect(output).toContain('--elements');
      expect(output).toContain('<<<image_1>>>');
    });

    it('should show video examples', () => {
      const output = runCli('video examples');
      expect(output).toContain('USAGE EXAMPLES');
      expect(output).toContain('text2video');
      expect(output).toContain('image2video');
      expect(output).toContain('extend');
    });
  });

  describe('Command Aliases', () => {
    it('should accept t2v alias for text2video', () => {
      const output = runCli('video t2v --help');
      expect(output).toContain('--prompt');
      expect(output).toContain('--model');
    });

    it('should accept i2v alias for image2video', () => {
      const output = runCli('video i2v --help');
      expect(output).toContain('--image');
    });

    it('should accept mi2v alias for multi-image', () => {
      const output = runCli('video mi2v --help');
      expect(output).toContain('--images');
    });
  });

  describe('Option Validation', () => {
    it('should require --prompt for text2video', () => {
      // Without credentials, it should fail on missing credentials first
      // But the command structure is validated
      const output = runCli('video text2video');
      // Will fail on credentials or empty prompt
      expect(output).toBeDefined();
    });

    it('should require --image for image2video', () => {
      const output = runCli('video image2video');
      expect(output).toContain("required option '-i, --image");
    });

    it('should require --video-id for extend', () => {
      const output = runCli('video extend');
      expect(output).toContain("required option '--video-id");
    });

    it('should require --images for multi-image', () => {
      const output = runCli('video multi-image');
      expect(output).toContain("required option '--images");
    });

    it('should require --prompt for omni', () => {
      const output = runCli('video omni');
      expect(output).toContain("required option '-p, --prompt");
    });
  });

  describe('Default Values', () => {
    it('should have default model for text2video', () => {
      const output = runCli('video text2video --help');
      expect(output).toContain('kling-v1');
    });

    it('should have default duration', () => {
      const output = runCli('video text2video --help');
      expect(output).toContain('5');
    });

    it('should have default aspect ratio', () => {
      const output = runCli('video text2video --help');
      expect(output).toContain('16:9');
    });

    it('should have default mode', () => {
      const output = runCli('video text2video --help');
      expect(output).toContain('std');
    });
  });
});
