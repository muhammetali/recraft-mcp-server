import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth.js', () => ({ getApiKey: () => 'test-key' }));

import { generateImage, batchGenerate } from '../tools/generate.js';

describe('tools/generate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockGenerationResponse(n = 1) {
    const data = Array.from({ length: n }, (_, i) => ({
      image_id: `img-${i}`,
      url: `https://cdn.recraft.ai/img-${i}.png`,
    }));
    return new Response(JSON.stringify({ data }), { status: 200 });
  }

  describe('generateImage', () => {
    it('generates a single image with defaults', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockGenerationResponse(1));

      const result = await generateImage({ prompt: 'a golden scarab' });
      expect(result).toContain('Generated 1 image(s)');
      expect(result).toContain('img-0');
      expect(result).toContain('cdn.recraft.ai');
    });

    it('generates multiple images', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockGenerationResponse(3));

      const result = await generateImage({ prompt: 'a cat', n: 3 });
      expect(result).toContain('Generated 3 image(s)');
    });

    it('passes model and size to API', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockGenerationResponse(1));

      await generateImage({ prompt: 'test', model: 'recraftv4_vector', size: '1:1' });

      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body.model).toBe('recraftv4_vector');
      expect(body.size).toBe('1:1');
    });

    it('passes style and negative_prompt', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockGenerationResponse(1));

      await generateImage({
        prompt: 'test',
        model: 'recraftv3',
        style: 'photorealism',
        negative_prompt: 'no blur',
      });

      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body.style).toBe('photorealism');
      expect(body.negative_prompt).toBe('no blur');
    });

    it('passes controls with colors', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockGenerationResponse(1));

      await generateImage({
        prompt: 'test',
        controls: { colors: [[255, 0, 0], [0, 255, 0]] },
      });

      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body.controls.colors).toEqual([[255, 0, 0], [0, 255, 0]]);
    });

    it('passes text_layout', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockGenerationResponse(1));

      await generateImage({
        prompt: 'logo',
        text_layout: [{ text: 'HELLO', bbox: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.3], [0.1, 0.3]] }],
      });

      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body.text_layout[0].text).toBe('HELLO');
    });

    it('rejects empty prompt', async () => {
      await expect(generateImage({ prompt: '' })).rejects.toThrow('cannot be empty');
    });

    it('rejects invalid size', async () => {
      await expect(generateImage({ prompt: 'test', size: '500x500' })).rejects.toThrow('Unsupported size');
    });

    it('rejects invalid model', async () => {
      await expect(generateImage({ prompt: 'test', model: 'dalle3' })).rejects.toThrow('Unsupported model');
    });

    it('rejects both style and style_id', async () => {
      await expect(generateImage({
        prompt: 'test',
        model: 'recraftv3',
        style: 'photorealism',
        style_id: 'some-uuid',
      })).rejects.toThrow('Cannot specify both');
    });

    it('rejects n > 6', async () => {
      await expect(generateImage({ prompt: 'test', n: 7 })).rejects.toThrow();
    });

    it('rejects invalid colors', async () => {
      await expect(generateImage({
        prompt: 'test',
        controls: { colors: [[300, 0, 0]] },
      })).rejects.toThrow('0-255');
    });
  });

  describe('batchGenerate', () => {
    it('generates multiple assets', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse(1))
        .mockResolvedValueOnce(mockGenerationResponse(1));

      const result = await batchGenerate([
        { name: 'cat', prompt: 'a cat' },
        { name: 'dog', prompt: 'a dog' },
      ]);
      expect(result).toContain('Success: 2');
      expect(result).toContain('Failed: 0');
    });

    it('handles partial failures gracefully', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse(1))
        .mockResolvedValueOnce(new Response('{}', { status: 500 }));

      const result = await batchGenerate([
        { name: 'ok', prompt: 'a cat' },
        { name: 'fail', prompt: 'a dog' },
      ]);
      expect(result).toContain('Success: 1');
      expect(result).toContain('Failed: 1');
    });

    it('rejects empty assets array', async () => {
      await expect(batchGenerate([])).rejects.toThrow('cannot be empty');
    });

    it('validates each asset prompt', async () => {
      const result = await batchGenerate([
        { name: 'bad', prompt: '' },
      ]);
      expect(result).toContain('Failed: 1');
      expect(result).toContain('cannot be empty');
    });
  });
});
