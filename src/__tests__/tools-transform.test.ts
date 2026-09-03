import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../auth.js', () => ({ getApiKey: () => 'test-key' }));
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

import { readFileSync, existsSync, statSync } from 'fs';
import { imageToImage, inpaint, replaceBackground, generateBackground, variateImage, outpaint } from '../tools/transform.js';

describe('tools/transform', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(readFileSync).mockReturnValue(Buffer.from('fake-png-data'));
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as any);
  });

  function mockTransformResponse(n = 1) {
    const data = Array.from({ length: n }, (_, i) => ({
      image_id: `tf-${i}`,
      url: `https://cdn.recraft.ai/tf-${i}.png`,
    }));
    return new Response(JSON.stringify({ data }), { status: 200 });
  }

  describe('imageToImage', () => {
    it('transforms image with prompt', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      const result = await imageToImage({
        file_path: '/test/input.png',
        prompt: 'make it golden',
      });
      expect(result).toContain('Image-to-Image Complete');
      expect(result).toContain('tf-0');
    });

    it('passes strength parameter', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      await imageToImage({
        file_path: '/test/input.png',
        prompt: 'test',
        strength: 0.8,
      });
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = (options as any).body as FormData;
      expect(body.get('strength')).toBe('0.8');
    });

    it('rejects invalid strength', async () => {
      await expect(imageToImage({
        file_path: '/test/input.png',
        prompt: 'test',
        strength: 1.5,
      })).rejects.toThrow('between 0 and 1');
    });

    it('rejects non-existent file', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      await expect(imageToImage({
        file_path: '/missing.png',
        prompt: 'test',
      })).rejects.toThrow('File not found');
    });
  });

  describe('inpaint', () => {
    it('inpaints with mask', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      const result = await inpaint({
        file_path: '/test/image.png',
        mask_path: '/test/mask.png',
        prompt: 'add a crown',
      });
      expect(result).toContain('Inpaint Complete');
    });

    it('sends both image and mask in formdata', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      await inpaint({
        file_path: '/test/image.png',
        mask_path: '/test/mask.png',
        prompt: 'test',
      });
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = (options as any).body as FormData;
      expect(body.has('image')).toBe(true);
      expect(body.has('mask')).toBe(true);
    });
  });

  describe('replaceBackground', () => {
    it('replaces background', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      const result = await replaceBackground({
        file_path: '/test/image.png',
        prompt: 'a sunset beach',
      });
      expect(result).toContain('Replace Background Complete');
    });
  });

  describe('generateBackground', () => {
    it('generates background with mask', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      const result = await generateBackground({
        file_path: '/test/image.png',
        mask_path: '/test/mask.png',
        prompt: 'ancient temple',
      });
      expect(result).toContain('Generate Background Complete');
    });
  });

  describe('variateImage', () => {
    it('creates variations', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse(3));
      const result = await variateImage({
        file_path: '/test/image.png',
        size: '1024x1024',
        n: 3,
      });
      expect(result).toContain('Variate Image Complete');
      expect(result).toContain('3 image(s)');
    });

    it('passes random_seed', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      await variateImage({
        file_path: '/test/image.png',
        size: '1024x1024',
        random_seed: 42,
      });
      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = (options as any).body as FormData;
      expect(body.get('random_seed')).toBe('42');
    });

    it('rejects invalid size', async () => {
      await expect(variateImage({
        file_path: '/test/image.png',
        size: '100x100',
      })).rejects.toThrow('Unsupported size');
    });
  });

  describe('outpaint', () => {
    it('extends canvas with expand_* params', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      const result = await outpaint({
        file_path: '/test/image.png',
        prompt: 'a mountain landscape',
        expand_left: 200,
        expand_right: 200,
      });
      expect(result).toContain('Outpaint Complete');
    });

    it('extends canvas with a target size', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      const result = await outpaint({
        file_path: '/test/image.png',
        prompt: 'a mountain landscape',
        size: '16:9',
      });
      expect(result).toContain('Outpaint Complete');
    });

    it('accepts zoom_out_percentage alone', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockTransformResponse());
      const result = await outpaint({
        file_path: '/test/image.png',
        prompt: 'a mountain landscape',
        zoom_out_percentage: 25,
      });
      expect(result).toContain('Outpaint Complete');
    });

    it('rejects size combined with expand_*', async () => {
      await expect(outpaint({
        file_path: '/test/image.png',
        prompt: 'test',
        size: '16:9',
        expand_left: 100,
      })).rejects.toThrow('Cannot combine size');
    });

    it('rejects when no expansion method is specified', async () => {
      await expect(outpaint({
        file_path: '/test/image.png',
        prompt: 'test',
      })).rejects.toThrow('At least one of size, expand_left');
    });

    it('rejects zoom_out_percentage out of range', async () => {
      await expect(outpaint({
        file_path: '/test/image.png',
        prompt: 'test',
        zoom_out_percentage: 100,
      })).rejects.toThrow('zoom_out_percentage must be in range');
    });

    it('rejects out-of-range expand value', async () => {
      await expect(outpaint({
        file_path: '/test/image.png',
        prompt: 'test',
        expand_left: 5000,
      })).rejects.toThrow('expand_left must be an integer');
    });
  });
});
