import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getApiKey } from '../auth.js';

describe('auth', () => {
  const originalEnv = process.env.RECRAFT_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.RECRAFT_API_KEY = originalEnv;
    } else {
      delete process.env.RECRAFT_API_KEY;
    }
  });

  it('returns API key when set', () => {
    process.env.RECRAFT_API_KEY = 'test-key-123';
    expect(getApiKey()).toBe('test-key-123');
  });

  it('throws when RECRAFT_API_KEY is missing', () => {
    delete process.env.RECRAFT_API_KEY;
    expect(() => getApiKey()).toThrow('Missing RECRAFT_API_KEY');
  });

  it('throws when RECRAFT_API_KEY is empty string', () => {
    process.env.RECRAFT_API_KEY = '';
    // Empty string is falsy, should throw
    expect(() => getApiKey()).toThrow('Missing RECRAFT_API_KEY');
  });
});
