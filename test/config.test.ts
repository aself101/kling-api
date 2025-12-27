/**
 * Tests for Kling API Configuration Module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadCredentials,
  loadConfig,
  validateTextToVideoParams,
  validateImageToVideoParams,
  validateImageGenParams,
  validateImageExpandParams,
  validateAvatarParams,
  validateExtendVideoParams,
  validateMultiImageToVideoParams,
  validateOmniVideoParams,
  validateOmniImageParams,
  validateMultiImageToImageParams,
  ValidationError,
  BASE_URL,
  DEFAULT_TIMEOUT,
  TEXT_TO_VIDEO_MODELS,
  IMAGE_TO_VIDEO_MODELS,
  VALID_VIDEO_ASPECT_RATIOS,
  VALID_IMAGE_ASPECT_RATIOS,
} from '../src/config/index.js';

describe('Constants', () => {
  describe('BASE_URL', () => {
    it('should use HTTPS protocol', () => {
      expect(BASE_URL).toMatch(/^https:\/\//);
    });

    it('should point to Kling API domain', () => {
      expect(BASE_URL).toContain('klingai.com');
    });
  });

  describe('DEFAULT_TIMEOUT', () => {
    it('should be a reasonable timeout value (10-120 seconds)', () => {
      expect(DEFAULT_TIMEOUT).toBeGreaterThanOrEqual(10000);
      expect(DEFAULT_TIMEOUT).toBeLessThanOrEqual(120000);
    });
  });

  describe('TEXT_TO_VIDEO_MODELS', () => {
    it('should have at least one model defined', () => {
      expect(Object.keys(TEXT_TO_VIDEO_MODELS).length).toBeGreaterThan(0);
    });

    it('should include base model kling-v1', () => {
      expect(TEXT_TO_VIDEO_MODELS).toHaveProperty('kling-v1');
    });

    it('should include latest model kling-v2-6', () => {
      expect(TEXT_TO_VIDEO_MODELS).toHaveProperty('kling-v2-6');
    });

    it('should have capability definitions for each model', () => {
      for (const [, caps] of Object.entries(TEXT_TO_VIDEO_MODELS)) {
        expect(caps).toHaveProperty('supportsCfgScale');
        expect(caps).toHaveProperty('supportsSound');
        expect(caps).toHaveProperty('supportsCameraControl');
        expect(typeof caps.supportsCfgScale).toBe('boolean');
        expect(typeof caps.supportsSound).toBe('boolean');
        expect(typeof caps.supportsCameraControl).toBe('boolean');
      }
    });
  });

  describe('IMAGE_TO_VIDEO_MODELS', () => {
    it('should have at least one model defined', () => {
      expect(Object.keys(IMAGE_TO_VIDEO_MODELS).length).toBeGreaterThan(0);
    });

    it('should include base model kling-v1', () => {
      expect(IMAGE_TO_VIDEO_MODELS).toHaveProperty('kling-v1');
    });

    it('should have capability definitions for each model', () => {
      for (const [, caps] of Object.entries(IMAGE_TO_VIDEO_MODELS)) {
        expect(caps).toHaveProperty('supportsCfgScale');
        expect(caps).toHaveProperty('supportsCameraControl');
        expect(typeof caps.supportsCfgScale).toBe('boolean');
        expect(typeof caps.supportsCameraControl).toBe('boolean');
      }
    });
  });

  describe('VALID_VIDEO_ASPECT_RATIOS', () => {
    it('should contain valid aspect ratio format (width:height)', () => {
      for (const ratio of VALID_VIDEO_ASPECT_RATIOS) {
        expect(ratio).toMatch(/^\d+:\d+$/);
      }
    });

    it('should include common ratios (16:9, 9:16, 1:1)', () => {
      expect(VALID_VIDEO_ASPECT_RATIOS).toContain('16:9');
      expect(VALID_VIDEO_ASPECT_RATIOS).toContain('9:16');
      expect(VALID_VIDEO_ASPECT_RATIOS).toContain('1:1');
    });
  });

  describe('VALID_IMAGE_ASPECT_RATIOS', () => {
    it('should contain valid aspect ratio format (width:height)', () => {
      for (const ratio of VALID_IMAGE_ASPECT_RATIOS) {
        expect(ratio).toMatch(/^\d+:\d+$/);
      }
    });

    it('should include common ratios (16:9, 9:16, 1:1)', () => {
      expect(VALID_IMAGE_ASPECT_RATIOS).toContain('16:9');
      expect(VALID_IMAGE_ASPECT_RATIOS).toContain('9:16');
      expect(VALID_IMAGE_ASPECT_RATIOS).toContain('1:1');
    });

    it('should have more aspect ratios than video (images are more flexible)', () => {
      expect(VALID_IMAGE_ASPECT_RATIOS.length).toBeGreaterThanOrEqual(
        VALID_VIDEO_ASPECT_RATIOS.length
      );
    });
  });
});

describe('loadCredentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.KLING_ACCESS_KEY;
    delete process.env.KLING_SECRET_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return CLI flags when provided', () => {
    process.env.KLING_ACCESS_KEY = 'env-key';
    process.env.KLING_SECRET_KEY = 'env-secret';

    const result = loadCredentials('cli-key', 'cli-secret');

    expect(result.accessKey).toBe('cli-key');
    expect(result.secretKey).toBe('cli-secret');
  });

  it('should return env vars when CLI flags not provided', () => {
    process.env.KLING_ACCESS_KEY = 'env-key';
    process.env.KLING_SECRET_KEY = 'env-secret';

    const result = loadCredentials();

    expect(result.accessKey).toBe('env-key');
    expect(result.secretKey).toBe('env-secret');
  });

  it('should return undefined when no credentials found', async () => {
    // Reset modules and mock fs.existsSync to return false
    // This prevents loadCredentials from reading .env files during test
    vi.resetModules();
    vi.doMock('fs', async (importOriginal) => {
      const actual = await importOriginal<typeof import('fs')>();
      return {
        ...actual,
        existsSync: vi.fn(() => false),
      };
    });

    // Dynamically import to get the mocked version
    const { loadCredentials: isolatedLoadCredentials } = await import('../src/config/loaders.js');

    const result = isolatedLoadCredentials();

    expect(result.accessKey).toBeUndefined();
    expect(result.secretKey).toBeUndefined();

    // Clean up mocks
    vi.doUnmock('fs');
    vi.resetModules();
  });
});

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return empty config when no env vars', () => {
    delete process.env.KLING_OUTPUT_DIR;
    delete process.env.KLING_POLL_INTERVAL;
    delete process.env.KLING_TIMEOUT;

    const config = loadConfig();

    expect(config.outputDir).toBeUndefined();
    expect(config.pollInterval).toBeUndefined();
    expect(config.timeout).toBeUndefined();
  });

  it('should read KLING_OUTPUT_DIR', () => {
    process.env.KLING_OUTPUT_DIR = '/custom/output';

    const config = loadConfig();

    expect(config.outputDir).toBe('/custom/output');
  });

  it('should convert KLING_POLL_INTERVAL to milliseconds', () => {
    process.env.KLING_POLL_INTERVAL = '5'; // 5 seconds

    const config = loadConfig();

    expect(config.pollInterval).toBe(5000);
  });

  it('should convert KLING_TIMEOUT to milliseconds', () => {
    process.env.KLING_TIMEOUT = '60'; // 60 seconds

    const config = loadConfig();

    expect(config.timeout).toBe(60000);
  });
});

describe('validateTextToVideoParams', () => {
  describe('model_name validation', () => {
    it('should accept valid model names', () => {
      for (const model of Object.keys(TEXT_TO_VIDEO_MODELS)) {
        expect(() =>
          validateTextToVideoParams({
            model_name: model as any,
            prompt: 'test prompt',
          })
        ).not.toThrow();
      }
    });

    it('should reject invalid model name', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'invalid-model' as any,
          prompt: 'test prompt',
        })
      ).toThrow(ValidationError);
    });

    it('should default to kling-v1 when not specified', () => {
      expect(() => validateTextToVideoParams({ prompt: 'test prompt' })).not.toThrow();
    });
  });

  describe('prompt validation', () => {
    it('should require prompt', () => {
      expect(() => validateTextToVideoParams({ prompt: '' })).toThrow('Prompt is required');
    });

    it('should reject whitespace-only prompt', () => {
      expect(() => validateTextToVideoParams({ prompt: '   ' })).toThrow('Prompt is required');
    });

    it('should reject prompt exceeding 2500 characters', () => {
      const longPrompt = 'a'.repeat(2501);
      expect(() => validateTextToVideoParams({ prompt: longPrompt })).toThrow(
        'cannot exceed 2500 characters'
      );
    });

    it('should accept prompt at 2500 characters', () => {
      const maxPrompt = 'a'.repeat(2500);
      expect(() => validateTextToVideoParams({ prompt: maxPrompt })).not.toThrow();
    });
  });

  describe('negative_prompt validation', () => {
    it('should accept valid negative prompt', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          negative_prompt: 'bad quality',
        })
      ).not.toThrow();
    });

    it('should reject negative prompt exceeding 2500 characters', () => {
      const longPrompt = 'a'.repeat(2501);
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          negative_prompt: longPrompt,
        })
      ).toThrow('cannot exceed 2500 characters');
    });
  });

  describe('sound validation', () => {
    it('should reject sound for models that do not support it', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v1',
          prompt: 'test',
          sound: 'on',
        })
      ).toThrow('Sound is only supported by kling-v2-6');
    });

    it('should accept sound for kling-v2-6', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v2-6',
          prompt: 'test',
          sound: 'on',
        })
      ).not.toThrow();
    });

    it('should reject invalid sound value', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v2-6',
          prompt: 'test',
          sound: 'invalid' as any,
        })
      ).toThrow('must be one of: on, off');
    });
  });

  describe('cfg_scale validation', () => {
    it('should accept cfg_scale for v1 models', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v1',
          prompt: 'test',
          cfg_scale: 0.5,
        })
      ).not.toThrow();
    });

    it('should reject cfg_scale for v2 models', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v2-master',
          prompt: 'test',
          cfg_scale: 0.5,
        })
      ).toThrow('cfg_scale is not supported');
    });

    it('should reject cfg_scale below 0', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v1',
          prompt: 'test',
          cfg_scale: -0.1,
        })
      ).toThrow('must be between 0 and 1');
    });

    it('should reject cfg_scale above 1', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v1',
          prompt: 'test',
          cfg_scale: 1.1,
        })
      ).toThrow('must be between 0 and 1');
    });

    // Boundary value tests
    it('should accept cfg_scale at exact lower boundary (0.0)', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v1',
          prompt: 'test',
          cfg_scale: 0.0,
        })
      ).not.toThrow();
    });

    it('should accept cfg_scale at exact upper boundary (1.0)', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v1',
          prompt: 'test',
          cfg_scale: 1.0,
        })
      ).not.toThrow();
    });

    it('should reject cfg_scale just below lower boundary (-0.01)', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v1',
          prompt: 'test',
          cfg_scale: -0.01,
        })
      ).toThrow('must be between 0 and 1');
    });

    it('should reject cfg_scale just above upper boundary (1.01)', () => {
      expect(() =>
        validateTextToVideoParams({
          model_name: 'kling-v1',
          prompt: 'test',
          cfg_scale: 1.01,
        })
      ).toThrow('must be between 0 and 1');
    });
  });

  describe('mode validation', () => {
    it('should accept valid modes', () => {
      expect(() => validateTextToVideoParams({ prompt: 'test', mode: 'std' })).not.toThrow();
      expect(() => validateTextToVideoParams({ prompt: 'test', mode: 'pro' })).not.toThrow();
    });

    it('should reject invalid mode', () => {
      expect(() => validateTextToVideoParams({ prompt: 'test', mode: 'invalid' as any })).toThrow(
        'must be one of: std, pro'
      );
    });
  });

  describe('aspect_ratio validation', () => {
    it('should accept valid aspect ratios', () => {
      for (const ratio of VALID_VIDEO_ASPECT_RATIOS) {
        expect(() =>
          validateTextToVideoParams({ prompt: 'test', aspect_ratio: ratio })
        ).not.toThrow();
      }
    });

    it('should reject invalid aspect ratio', () => {
      expect(() =>
        validateTextToVideoParams({ prompt: 'test', aspect_ratio: '4:3' as any })
      ).toThrow('must be one of:');
    });
  });

  describe('duration validation', () => {
    it('should accept valid durations', () => {
      expect(() => validateTextToVideoParams({ prompt: 'test', duration: '5' })).not.toThrow();
      expect(() => validateTextToVideoParams({ prompt: 'test', duration: '10' })).not.toThrow();
    });

    it('should reject invalid duration', () => {
      expect(() => validateTextToVideoParams({ prompt: 'test', duration: '15' as any })).toThrow(
        'must be one of: 5, 10'
      );
    });
  });
});

describe('validateImageGenParams', () => {
  describe('prompt validation', () => {
    it('should require prompt', () => {
      expect(() => validateImageGenParams({ prompt: '' })).toThrow('Prompt is required');
    });
  });

  describe('image_reference validation', () => {
    it('should reject image_reference without model support', () => {
      expect(() =>
        validateImageGenParams({
          model_name: 'kling-v1',
          prompt: 'test',
          image: 'http://example.com/img.jpg',
          image_reference: 'subject',
        })
      ).toThrow('image_reference is only supported by kling-v1-5');
    });

    it('should accept image_reference with kling-v1-5', () => {
      expect(() =>
        validateImageGenParams({
          model_name: 'kling-v1-5',
          prompt: 'test',
          image: 'http://example.com/img.jpg',
          image_reference: 'subject',
        })
      ).not.toThrow();
    });

    it('should require image when using image_reference', () => {
      expect(() =>
        validateImageGenParams({
          model_name: 'kling-v1-5',
          prompt: 'test',
          image_reference: 'subject',
        })
      ).toThrow('image is required when using image_reference');
    });
  });

  describe('n validation', () => {
    it('should accept n between 1 and 9', () => {
      for (let n = 1; n <= 9; n++) {
        expect(() => validateImageGenParams({ prompt: 'test', n })).not.toThrow();
      }
    });

    it('should reject n below 1', () => {
      expect(() => validateImageGenParams({ prompt: 'test', n: 0 })).toThrow(
        'n must be between 1 and 9'
      );
    });

    it('should reject n above 9', () => {
      expect(() => validateImageGenParams({ prompt: 'test', n: 10 })).toThrow(
        'n must be between 1 and 9'
      );
    });

    it('should reject non-integer n', () => {
      expect(() => validateImageGenParams({ prompt: 'test', n: 2.5 })).toThrow(
        'n must be an integer'
      );
    });
  });

  describe('resolution validation', () => {
    it('should accept valid resolutions', () => {
      expect(() => validateImageGenParams({ prompt: 'test', resolution: '1k' })).not.toThrow();
      expect(() => validateImageGenParams({ prompt: 'test', resolution: '2k' })).not.toThrow();
    });

    it('should reject invalid resolution', () => {
      expect(() => validateImageGenParams({ prompt: 'test', resolution: '4k' as any })).toThrow(
        'must be one of: 1k, 2k'
      );
    });
  });

  describe('fidelity validation', () => {
    it('should accept image_fidelity between 0 and 1', () => {
      expect(() => validateImageGenParams({ prompt: 'test', image_fidelity: 0 })).not.toThrow();
      expect(() => validateImageGenParams({ prompt: 'test', image_fidelity: 0.5 })).not.toThrow();
      expect(() => validateImageGenParams({ prompt: 'test', image_fidelity: 1 })).not.toThrow();
    });

    it('should reject image_fidelity outside 0-1', () => {
      expect(() => validateImageGenParams({ prompt: 'test', image_fidelity: 1.5 })).toThrow(
        'must be between 0 and 1'
      );
    });

    it('should require face reference for human_fidelity', () => {
      expect(() =>
        validateImageGenParams({
          prompt: 'test',
          image_reference: 'subject',
          image: 'http://example.com/img.jpg',
          model_name: 'kling-v1-5',
          human_fidelity: 0.5,
        })
      ).toThrow('human_fidelity requires image_reference="face"');
    });
  });
});

describe('validateImageExpandParams', () => {
  // Valid params: (1 + 0.3 + 0.3) * (1 + 0.3 + 0.3) = 1.6 * 1.6 = 2.56 < 3
  const validParams = {
    image: 'http://example.com/img.jpg',
    up_expansion_ratio: 0.3,
    down_expansion_ratio: 0.3,
    left_expansion_ratio: 0.3,
    right_expansion_ratio: 0.3,
  };

  describe('image validation', () => {
    it('should require image', () => {
      expect(() => validateImageExpandParams({ ...validParams, image: '' })).toThrow(
        'Image is required'
      );
    });
  });

  describe('expansion ratio validation', () => {
    it('should accept ratios between 0 and 2', () => {
      expect(() => validateImageExpandParams(validParams)).not.toThrow();
    });

    it('should reject ratio below 0', () => {
      expect(() => validateImageExpandParams({ ...validParams, up_expansion_ratio: -0.1 })).toThrow(
        'must be between 0 and 2'
      );
    });

    it('should reject ratio above 2', () => {
      expect(() => validateImageExpandParams({ ...validParams, up_expansion_ratio: 2.1 })).toThrow(
        'must be between 0 and 2'
      );
    });

    it('should reject total expansion exceeding 3x', () => {
      expect(() =>
        validateImageExpandParams({
          image: 'http://example.com/img.jpg',
          up_expansion_ratio: 1,
          down_expansion_ratio: 1,
          left_expansion_ratio: 1,
          right_expansion_ratio: 1,
        })
      ).toThrow('exceeds maximum of 3x');
    });

    it('should accept expansion at exactly 3x', () => {
      // (1 + 0.5 + 0.5) * (1 + 0.5 + 0.5) = 2 * 1.5 = 3
      expect(() =>
        validateImageExpandParams({
          image: 'http://example.com/img.jpg',
          up_expansion_ratio: 0.5,
          down_expansion_ratio: 0.5,
          left_expansion_ratio: 0.25,
          right_expansion_ratio: 0.25,
        })
      ).not.toThrow();
    });
  });
});

describe('validateAvatarParams', () => {
  describe('image validation', () => {
    it('should require image', () => {
      expect(() =>
        validateAvatarParams({
          image: '',
          audio_id: 'test-audio',
        })
      ).toThrow('Portrait image is required');
    });
  });

  describe('audio validation', () => {
    it('should require either audio_id or sound_file', () => {
      expect(() =>
        validateAvatarParams({
          image: 'http://example.com/img.jpg',
        })
      ).toThrow('Either audio_id or sound_file is required');
    });

    it('should reject both audio_id and sound_file', () => {
      expect(() =>
        validateAvatarParams({
          image: 'http://example.com/img.jpg',
          audio_id: 'test-audio',
          sound_file: 'http://example.com/audio.mp3',
        })
      ).toThrow('Cannot use both audio_id and sound_file');
    });

    it('should accept audio_id alone', () => {
      expect(() =>
        validateAvatarParams({
          image: 'http://example.com/img.jpg',
          audio_id: 'test-audio',
        })
      ).not.toThrow();
    });

    it('should accept sound_file alone', () => {
      expect(() =>
        validateAvatarParams({
          image: 'http://example.com/img.jpg',
          sound_file: 'http://example.com/audio.mp3',
        })
      ).not.toThrow();
    });
  });

  describe('mode validation', () => {
    it('should accept valid modes', () => {
      expect(() =>
        validateAvatarParams({
          image: 'http://example.com/img.jpg',
          audio_id: 'test-audio',
          mode: 'std',
        })
      ).not.toThrow();
      expect(() =>
        validateAvatarParams({
          image: 'http://example.com/img.jpg',
          audio_id: 'test-audio',
          mode: 'pro',
        })
      ).not.toThrow();
    });
  });
});

describe('ValidationError', () => {
  it('should include field name in error', () => {
    const error = new ValidationError('test_field', 'test message');
    expect(error.field).toBe('test_field');
    expect(error.message).toContain('test_field');
    expect(error.message).toContain('test message');
  });

  it('should have correct name', () => {
    const error = new ValidationError('test', 'message');
    expect(error.name).toBe('ValidationError');
  });
});

describe('Camera Control Validation', () => {
  describe('validateTextToVideoParams camera_control', () => {
    it('should reject camera_control on unsupported model', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1-6', // Does not support camera_control
          camera_control: { type: 'simple' },
        })
      ).toThrow('Camera control is not supported by this model');
    });

    it('should accept camera_control on supported model (kling-v1)', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: { type: 'simple' },
        })
      ).not.toThrow();
    });

    it('should reject invalid camera type', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: { type: 'invalid_type' as any },
        })
      ).toThrow('must be one of:');
    });

    it('should accept all valid camera types', () => {
      const validTypes = [
        'simple',
        'down_back',
        'forward_up',
        'right_turn_forward',
        'left_turn_forward',
      ];
      for (const type of validTypes) {
        expect(() =>
          validateTextToVideoParams({
            prompt: 'test',
            model_name: 'kling-v1',
            camera_control: { type: type as any },
          })
        ).not.toThrow();
      }
    });

    it('should reject config when type is not "simple"', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'down_back',
            config: { horizontal: 5 },
          },
        })
      ).toThrow('config is only valid when type="simple"');
    });

    it('should accept config when type is "simple"', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { horizontal: 5 },
          },
        })
      ).not.toThrow();
    });

    it('should accept config when type is not set (defaults to simple)', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            config: { zoom: 3 },
          },
        })
      ).not.toThrow();
    });

    it('should reject invalid config keys', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { invalid_key: 5 } as any,
          },
        })
      ).toThrow('Invalid config key');
    });

    it('should accept all valid config keys', () => {
      const validKeys = ['horizontal', 'vertical', 'pan', 'tilt', 'roll', 'zoom'];
      for (const key of validKeys) {
        expect(() =>
          validateTextToVideoParams({
            prompt: 'test',
            model_name: 'kling-v1',
            camera_control: {
              type: 'simple',
              config: { [key]: 5 } as any,
            },
          })
        ).not.toThrow();
      }
    });

    it('should reject config values below -10', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { horizontal: -11 },
          },
        })
      ).toThrow('must be between -10 and 10');
    });

    it('should reject config values above 10', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { zoom: 11 },
          },
        })
      ).toThrow('must be between -10 and 10');
    });

    it('should accept config values at boundaries (-10 and 10)', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { pan: -10 },
          },
        })
      ).not.toThrow();

      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { tilt: 10 },
          },
        })
      ).not.toThrow();
    });

    it('should reject multiple non-zero config parameters', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { horizontal: 5, vertical: 3 },
          },
        })
      ).toThrow('Only 1 config parameter should be non-zero');
    });

    it('should accept multiple config parameters if only one is non-zero', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { horizontal: 5, vertical: 0, zoom: 0 },
          },
        })
      ).not.toThrow();
    });

    it('should reject three or more non-zero config parameters', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { horizontal: 2, vertical: 3, zoom: 4 },
          },
        })
      ).toThrow('Only 1 config parameter should be non-zero');
    });

    it('should reject all config parameters being non-zero', () => {
      expect(() =>
        validateTextToVideoParams({
          prompt: 'test',
          model_name: 'kling-v1',
          camera_control: {
            type: 'simple',
            config: { horizontal: 1, vertical: 2, pan: 3, tilt: 4, roll: 5, zoom: 6 },
          },
        })
      ).toThrow('Only 1 config parameter should be non-zero');
    });
  });

  describe('validateImageToVideoParams camera_control', () => {
    it('should reject camera_control on unsupported model', () => {
      expect(() =>
        validateImageToVideoParams({
          image: 'https://example.com/img.jpg',
          model_name: 'kling-v1', // Does not support camera_control
          camera_control: { type: 'simple' },
        })
      ).toThrow('Camera control is not supported by this model');
    });

    it('should accept camera_control on supported model (kling-v1-5)', () => {
      expect(() =>
        validateImageToVideoParams({
          image: 'https://example.com/img.jpg',
          model_name: 'kling-v1-5',
          camera_control: { type: 'forward_up' },
        })
      ).not.toThrow();
    });

    it('should accept camera_control on supported model (kling-v1-6)', () => {
      expect(() =>
        validateImageToVideoParams({
          image: 'https://example.com/img.jpg',
          model_name: 'kling-v1-6',
          camera_control: { type: 'left_turn_forward' },
        })
      ).not.toThrow();
    });

    it('should reject config with non-simple type', () => {
      expect(() =>
        validateImageToVideoParams({
          image: 'https://example.com/img.jpg',
          model_name: 'kling-v1-5',
          camera_control: {
            type: 'forward_up',
            config: { roll: 5 },
          },
        })
      ).toThrow('config is only valid when type="simple"');
    });
  });
});

// ============================================================================
// Phase 5: Advanced Feature Validation Tests
// ============================================================================

describe('validateExtendVideoParams', () => {
  describe('video_id validation', () => {
    it('should require video_id', () => {
      expect(() =>
        validateExtendVideoParams({
          video_id: '',
        })
      ).toThrow('Video ID is required');
    });

    it('should accept valid video_id', () => {
      expect(() =>
        validateExtendVideoParams({
          video_id: 'task-123-abc',
        })
      ).not.toThrow();
    });
  });

  describe('prompt validation', () => {
    it('should accept optional prompt', () => {
      expect(() =>
        validateExtendVideoParams({
          video_id: 'task-123',
          prompt: 'Continue the scene',
        })
      ).not.toThrow();
    });

    it('should reject prompt exceeding 2500 characters', () => {
      expect(() =>
        validateExtendVideoParams({
          video_id: 'task-123',
          prompt: 'a'.repeat(2501),
        })
      ).toThrow('cannot exceed 2500 characters');
    });
  });

  describe('cfg_scale validation', () => {
    it('should accept cfg_scale between 0 and 1', () => {
      expect(() =>
        validateExtendVideoParams({
          video_id: 'task-123',
          cfg_scale: 0.5,
        })
      ).not.toThrow();
    });

    it('should reject cfg_scale below 0', () => {
      expect(() =>
        validateExtendVideoParams({
          video_id: 'task-123',
          cfg_scale: -0.1,
        })
      ).toThrow('must be between 0 and 1');
    });

    it('should reject cfg_scale above 1', () => {
      expect(() =>
        validateExtendVideoParams({
          video_id: 'task-123',
          cfg_scale: 1.5,
        })
      ).toThrow('must be between 0 and 1');
    });
  });
});

describe('validateMultiImageToVideoParams', () => {
  describe('image_list validation', () => {
    it('should require at least one image', () => {
      expect(() =>
        validateMultiImageToVideoParams({
          image_list: [],
          prompt: 'Test prompt',
        })
      ).toThrow('At least one image is required');
    });

    it('should reject more than 4 images', () => {
      expect(() =>
        validateMultiImageToVideoParams({
          image_list: [
            { image: 'img1' },
            { image: 'img2' },
            { image: 'img3' },
            { image: 'img4' },
            { image: 'img5' },
          ],
          prompt: 'Test prompt',
        })
      ).toThrow('Maximum 4 images allowed');
    });

    it('should accept 1-4 images', () => {
      expect(() =>
        validateMultiImageToVideoParams({
          image_list: [
            { image: 'https://example.com/img1.jpg' },
            { image: 'https://example.com/img2.jpg' },
          ],
          prompt: 'Test prompt',
        })
      ).not.toThrow();
    });

    it('should require image in each item', () => {
      expect(() =>
        validateMultiImageToVideoParams({
          image_list: [{ image: '' }],
          prompt: 'Test prompt',
        })
      ).toThrow('Image is required');
    });
  });

  describe('prompt validation', () => {
    it('should require prompt', () => {
      expect(() =>
        validateMultiImageToVideoParams({
          image_list: [{ image: 'img1' }],
          prompt: '',
        })
      ).toThrow('Prompt is required');
    });
  });

  describe('model_name validation', () => {
    it('should only accept kling-v1-6', () => {
      expect(() =>
        validateMultiImageToVideoParams({
          image_list: [{ image: 'img1' }],
          prompt: 'Test',
          model_name: 'kling-v1-6',
        })
      ).not.toThrow();
    });
  });
});

describe('validateOmniVideoParams', () => {
  describe('prompt validation', () => {
    it('should require prompt', () => {
      expect(() =>
        validateOmniVideoParams({
          prompt: '',
        })
      ).toThrow('Prompt is required');
    });

    it('should accept valid prompt', () => {
      expect(() =>
        validateOmniVideoParams({
          prompt: 'A video featuring <<<image_1>>>',
        })
      ).not.toThrow();
    });
  });

  describe('image_list validation', () => {
    it('should accept images with type', () => {
      expect(() =>
        validateOmniVideoParams({
          prompt: 'A video featuring <<<image_1>>>',
          image_list: [{ image_url: 'https://example.com/img1.jpg', type: 'first_frame' }],
        })
      ).not.toThrow();
    });

    it('should require first frame when end frame is specified', () => {
      expect(() =>
        validateOmniVideoParams({
          prompt: 'Test video',
          image_list: [{ image_url: 'https://example.com/img.jpg', type: 'end_frame' }],
        })
      ).toThrow('End frame image requires a first frame image');
    });

    it('should reject end frame with more than 2 images', () => {
      expect(() =>
        validateOmniVideoParams({
          prompt: 'Test video',
          image_list: [
            { image_url: 'img1', type: 'first_frame' },
            { image_url: 'img2' },
            { image_url: 'img3', type: 'end_frame' },
          ],
        })
      ).toThrow('End frame is not supported when there are more than 2 images');
    });

    it('should require image_url in each item', () => {
      expect(() =>
        validateOmniVideoParams({
          prompt: 'Test video',
          image_list: [{ image_url: '' }],
        })
      ).toThrow('Image URL is required');
    });
  });

  describe('aspect_ratio validation', () => {
    it('should accept valid video aspect ratios', () => {
      expect(() =>
        validateOmniVideoParams({
          prompt: 'Test video',
          aspect_ratio: '16:9',
        })
      ).not.toThrow();
    });

    it('should reject invalid aspect ratio', () => {
      expect(() =>
        validateOmniVideoParams({
          prompt: 'Test video',
          aspect_ratio: '21:9' as any,
        })
      ).toThrow('must be one of');
    });
  });
});

describe('validateOmniImageParams', () => {
  describe('prompt validation', () => {
    it('should require prompt', () => {
      expect(() =>
        validateOmniImageParams({
          prompt: '',
        })
      ).toThrow('Prompt is required');
    });
  });

  describe('n validation', () => {
    it('should accept n between 1 and 9', () => {
      expect(() =>
        validateOmniImageParams({
          prompt: 'Test image',
          n: 5,
        })
      ).not.toThrow();
    });

    it('should reject n below 1', () => {
      expect(() =>
        validateOmniImageParams({
          prompt: 'Test image',
          n: 0,
        })
      ).toThrow('must be between 1 and 9');
    });

    it('should reject n above 9', () => {
      expect(() =>
        validateOmniImageParams({
          prompt: 'Test image',
          n: 10,
        })
      ).toThrow('must be between 1 and 9');
    });

    it('should reject non-integer n', () => {
      expect(() =>
        validateOmniImageParams({
          prompt: 'Test image',
          n: 2.5,
        })
      ).toThrow('n must be an integer');
    });
  });

  describe('resolution validation', () => {
    it('should accept valid resolutions', () => {
      expect(() =>
        validateOmniImageParams({
          prompt: 'Test image',
          resolution: '2k',
        })
      ).not.toThrow();
    });
  });

  describe('aspect_ratio validation', () => {
    it('should accept auto aspect ratio', () => {
      expect(() =>
        validateOmniImageParams({
          prompt: 'Test image',
          aspect_ratio: 'auto',
        })
      ).not.toThrow();
    });

    it('should accept standard image aspect ratios', () => {
      expect(() =>
        validateOmniImageParams({
          prompt: 'Test image',
          aspect_ratio: '21:9',
        })
      ).not.toThrow();
    });
  });
});

describe('validateMultiImageToImageParams', () => {
  describe('subject_image_list validation', () => {
    it('should require at least one subject image', () => {
      expect(() =>
        validateMultiImageToImageParams({
          subject_image_list: [],
        })
      ).toThrow('At least one subject image is required');
    });

    it('should reject more than 4 subject images', () => {
      expect(() =>
        validateMultiImageToImageParams({
          subject_image_list: [
            { subject_image: 'img1' },
            { subject_image: 'img2' },
            { subject_image: 'img3' },
            { subject_image: 'img4' },
            { subject_image: 'img5' },
          ],
        })
      ).toThrow('Maximum 4 subject images allowed');
    });

    it('should accept 1-4 subject images', () => {
      expect(() =>
        validateMultiImageToImageParams({
          subject_image_list: [
            { subject_image: 'https://example.com/subject1.jpg' },
            { subject_image: 'https://example.com/subject2.jpg' },
          ],
        })
      ).not.toThrow();
    });

    it('should require subject_image in each item', () => {
      expect(() =>
        validateMultiImageToImageParams({
          subject_image_list: [{ subject_image: '' }],
        })
      ).toThrow('Subject image is required');
    });
  });

  describe('model_name validation', () => {
    it('should accept kling-v2', () => {
      expect(() =>
        validateMultiImageToImageParams({
          subject_image_list: [{ subject_image: 'img1' }],
          model_name: 'kling-v2',
        })
      ).not.toThrow();
    });

    it('should accept kling-v2-1', () => {
      expect(() =>
        validateMultiImageToImageParams({
          subject_image_list: [{ subject_image: 'img1' }],
          model_name: 'kling-v2-1',
        })
      ).not.toThrow();
    });
  });

  describe('n validation', () => {
    it('should accept n between 1 and 9', () => {
      expect(() =>
        validateMultiImageToImageParams({
          subject_image_list: [{ subject_image: 'img1' }],
          n: 3,
        })
      ).not.toThrow();
    });

    it('should reject n outside range', () => {
      expect(() =>
        validateMultiImageToImageParams({
          subject_image_list: [{ subject_image: 'img1' }],
          n: 15,
        })
      ).toThrow('must be between 1 and 9');
    });
  });

  describe('aspect_ratio validation', () => {
    it('should accept valid image aspect ratios', () => {
      expect(() =>
        validateMultiImageToImageParams({
          subject_image_list: [{ subject_image: 'img1' }],
          aspect_ratio: '4:3',
        })
      ).not.toThrow();
    });
  });
});
