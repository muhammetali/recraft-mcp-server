import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth.js', () => ({ getApiKey: () => 'test-key' }));

import { explore, exploreSimilar, enhancePrompt } from '../tools/explore.js';

describe('tools/explore', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockGenerationResponse(n = 1) {
    const data = Array.from({ length: n }, (_, i) => ({
      image_id: `exp-${i}`,
      url: `https://cdn.recraft.ai/exp-${i}.png`,
    }));
    return new Response(JSON.stringify({ data }), { status: 200 });
  }

  describe('explore', () => {
    it('explores a prompt with defaults', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockGenerationResponse(2));
      const result = await explore({ prompt: 'race car on a track' });
      expect(result).toContain('Explore — 2 image(s)');
      expect(result).toContain('exp-0');
      expect(result).toContain('recraft_explore_similar');
    });

    it('rejects empty prompt', async () => {
      await expect(explore({ prompt: '' })).rejects.toThrow('Prompt cannot be empty');
    });

    it('rejects invalid size', async () => {
      await expect(explore({ prompt: 'test', size: '100x100' })).rejects.toThrow('Unsupported size');
    });
  });

  describe('exploreSimilar', () => {
    it('generates similar images', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockGenerationResponse(3));
      const result = await exploreSimilar({
        source_image_id: 'c18a1988-45e7-4c00-82c4-4ad7d3dbce3a',
        similarity: 5,
      });
      expect(result).toContain('Explore Similar — 3 image(s)');
    });

    it('rejects missing source_image_id', async () => {
      await expect(exploreSimilar({
        source_image_id: '',
        similarity: 3,
      })).rejects.toThrow('source_image_id cannot be empty');
    });

    it('rejects out-of-range similarity', async () => {
      await expect(exploreSimilar({
        source_image_id: 'abc',
        similarity: 6,
      })).rejects.toThrow('similarity must be an integer between 1 and 5');
    });
  });

  describe('enhancePrompt', () => {
    it('enhances a prompt', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ enhanced_prompt: 'a sleek red race car speeding around a sunlit asphalt track' }), { status: 200 }),
      );
      const result = await enhancePrompt('race car on a track');
      expect(result).toContain('Enhanced Prompt');
      expect(result).toContain('sleek red race car');
    });

    it('rejects empty prompt', async () => {
      await expect(enhancePrompt('')).rejects.toThrow('Prompt cannot be empty');
    });

    it('rejects prompt over 2000 characters', async () => {
      await expect(enhancePrompt('a'.repeat(2001))).rejects.toThrow('exceeds maximum length');
    });
  });
});
