import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validatePrompt, validateSize, validateModel, validateN,
  validateStyle, validateStyleBaseType, validateResponseFormat,
  validateFilePath, validateOutputPath, validateColors,
  validateStrength, validateArtisticLevel,
} from '../validation.js';
import { existsSync, statSync } from 'fs';

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

describe('validation', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validatePrompt', () => {
    it('accepts valid prompt', () => {
      expect(() => validatePrompt('a golden cat')).not.toThrow();
    });

    it('rejects empty prompt', () => {
      expect(() => validatePrompt('')).toThrow('cannot be empty');
    });

    it('rejects whitespace-only prompt', () => {
      expect(() => validatePrompt('   ')).toThrow('cannot be empty');
    });

    it('rejects prompt exceeding V4 limit', () => {
      const longPrompt = 'a'.repeat(10_001);
      expect(() => validatePrompt(longPrompt)).toThrow('exceeds maximum');
    });

    it('enforces V3 limit (1000 chars)', () => {
      const prompt = 'a'.repeat(1001);
      expect(() => validatePrompt(prompt, 'recraftv3')).toThrow('exceeds maximum length of 1000');
    });

    it('allows up to 10000 chars for V4', () => {
      const prompt = 'a'.repeat(10_000);
      expect(() => validatePrompt(prompt, 'recraftv4')).not.toThrow();
    });
  });

  describe('validateSize', () => {
    it('accepts valid pixel size', () => {
      expect(() => validateSize('1024x1024')).not.toThrow();
      expect(() => validateSize('1344x768')).not.toThrow();
    });

    it('accepts valid ratio', () => {
      expect(() => validateSize('16:9')).not.toThrow();
      expect(() => validateSize('1:1')).not.toThrow();
    });

    it('rejects invalid size', () => {
      expect(() => validateSize('999x999')).toThrow('Unsupported size');
    });
  });

  describe('validateModel', () => {
    it('accepts all valid models', () => {
      expect(() => validateModel('recraftv4')).not.toThrow();
      expect(() => validateModel('recraftv4_vector')).not.toThrow();
      expect(() => validateModel('recraftv3')).not.toThrow();
      expect(() => validateModel('recraftv2')).not.toThrow();
    });

    it('rejects invalid model', () => {
      expect(() => validateModel('dall-e')).toThrow('Unsupported model');
    });
  });

  describe('validateN', () => {
    it('accepts 1-6', () => {
      expect(() => validateN(1)).not.toThrow();
      expect(() => validateN(6)).not.toThrow();
    });

    it('rejects 0', () => {
      expect(() => validateN(0)).toThrow();
    });

    it('rejects 7', () => {
      expect(() => validateN(7)).toThrow();
    });

    it('rejects non-integer', () => {
      expect(() => validateN(1.5)).toThrow();
    });
  });

  describe('validateStyle', () => {
    it('accepts valid styles', () => {
      expect(() => validateStyle('photorealism')).not.toThrow();
      expect(() => validateStyle('vector_art')).not.toThrow();
      expect(() => validateStyle('icon')).not.toThrow();
    });

    it('rejects invalid style', () => {
      expect(() => validateStyle('nonexistent')).toThrow('Unsupported style');
    });
  });

  describe('validateStyleBaseType', () => {
    it('accepts valid types', () => {
      expect(() => validateStyleBaseType('any')).not.toThrow();
      expect(() => validateStyleBaseType('realistic_image')).not.toThrow();
    });

    it('rejects invalid type', () => {
      expect(() => validateStyleBaseType('fantasy')).toThrow('Unsupported style base type');
    });
  });

  describe('validateResponseFormat', () => {
    it('accepts url and b64_json', () => {
      expect(() => validateResponseFormat('url')).not.toThrow();
      expect(() => validateResponseFormat('b64_json')).not.toThrow();
    });

    it('rejects invalid format', () => {
      expect(() => validateResponseFormat('base64')).toThrow('Unsupported response_format');
    });
  });

  describe('validateFilePath', () => {
    it('accepts valid file', () => {
      expect(() => validateFilePath('/path/to/image.png')).not.toThrow();
    });

    it('rejects empty path', () => {
      expect(() => validateFilePath('')).toThrow('cannot be empty');
    });

    it('rejects non-existent file', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      expect(() => validateFilePath('/nofile.png')).toThrow('File not found');
    });

    it('rejects unsupported extension', () => {
      expect(() => validateFilePath('/file.gif')).toThrow('Unsupported file extension');
    });

    it('rejects file exceeding 5MB', () => {
      vi.mocked(statSync).mockReturnValue({ size: 6 * 1024 * 1024 } as any);
      expect(() => validateFilePath('/big.png')).toThrow('exceeds maximum of 5MB');
    });

    it('accepts jpg, jpeg, webp', () => {
      expect(() => validateFilePath('/img.jpg')).not.toThrow();
      expect(() => validateFilePath('/img.jpeg')).not.toThrow();
      expect(() => validateFilePath('/img.webp')).not.toThrow();
    });
  });

  describe('validateOutputPath', () => {
    it('accepts path with existing directory', () => {
      expect(() => validateOutputPath('/existing/dir/output.png')).not.toThrow();
    });

    it('rejects empty path', () => {
      expect(() => validateOutputPath('')).toThrow('cannot be empty');
    });

    it('rejects path with non-existent directory', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      expect(() => validateOutputPath('/nonexistent/dir/file.png')).toThrow('Output directory does not exist');
    });
  });

  describe('validateColors', () => {
    it('accepts valid RGB arrays', () => {
      expect(() => validateColors([[255, 0, 0], [0, 255, 0]])).not.toThrow();
    });

    it('rejects non-array color', () => {
      expect(() => validateColors([[255, 0]] as any)).toThrow('array of 3 numbers');
    });

    it('rejects out-of-range value', () => {
      expect(() => validateColors([[256, 0, 0]])).toThrow('0-255');
    });

    it('rejects negative value', () => {
      expect(() => validateColors([[-1, 0, 0]])).toThrow('0-255');
    });
  });

  describe('validateStrength', () => {
    it('accepts 0-1 range', () => {
      expect(() => validateStrength(0)).not.toThrow();
      expect(() => validateStrength(0.5)).not.toThrow();
      expect(() => validateStrength(1)).not.toThrow();
    });

    it('rejects out of range', () => {
      expect(() => validateStrength(-0.1)).toThrow();
      expect(() => validateStrength(1.1)).toThrow();
    });
  });

  describe('validateArtisticLevel', () => {
    it('accepts 0-5', () => {
      expect(() => validateArtisticLevel(0)).not.toThrow();
      expect(() => validateArtisticLevel(5)).not.toThrow();
    });

    it('rejects 6', () => {
      expect(() => validateArtisticLevel(6)).toThrow();
    });

    it('rejects non-integer', () => {
      expect(() => validateArtisticLevel(2.5)).toThrow();
    });
  });
});
