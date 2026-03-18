import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth.js', () => ({ getApiKey: () => 'test-key' }));
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ size: 1024 }),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-data')),
  mkdirSync: vi.fn(),
}));

vi.mock('sharp', () => {
  const instance = {
    metadata: vi.fn().mockResolvedValue({ width: 1024, height: 1024, channels: 4 }),
    resize: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    ensureAlpha: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    composite: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockImplementation((opts?: any) => {
      if (opts?.resolveWithObject) {
        return Promise.resolve({
          data: Buffer.alloc(1024 * 1024 * 4, 255),
          info: { width: 1024, height: 1024, channels: 4 },
        });
      }
      return Promise.resolve(Buffer.from('resized-image-data'));
    }),
    toFile: vi.fn().mockResolvedValue(undefined),
  };
  const sharpFn = vi.fn().mockReturnValue(instance);
  (sharpFn as any).kernel = { lanczos3: 'lanczos3' };
  return { default: sharpFn };
});

import { generateSized, compareStyles, textureSwap } from '../tools/advanced.js';
// Re-export findBestApiSize indirectly through behavior tests
import { SUPPORTED_SIZES } from '../constants.js';

describe('tools/advanced', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockGenerationResponse() {
    return new Response(
      JSON.stringify({ data: [{ image_id: 'gen-1', url: 'https://cdn.recraft.ai/gen.png' }] }),
      { status: 200 },
    );
  }

  function mockImageDownload() {
    return new Response(Buffer.from('fake-png-bytes'), { status: 200 });
  }

  function mockBgRemoveResponse() {
    return new Response(
      JSON.stringify({ image: { url: 'https://cdn.recraft.ai/transparent.png' } }),
      { status: 200 },
    );
  }

  // ─── generateSized ─────────────────────────────────────────────────────────

  describe('generateSized', () => {
    it('generates and resizes to target dimensions', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateSized({
        prompt: 'a game coin icon',
        width: 128,
        height: 128,
        output_path: '/assets/coin.png',
      });

      expect(result).toContain('Generate Sized Complete');
      expect(result).toContain('128x128');
      expect(result).toContain('Resized');
      expect(result).toContain('/assets/coin.png');
    });

    it('selects best API size for non-square aspect ratio', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateSized({
        prompt: 'wide banner',
        width: 256,
        height: 64,
        output_path: '/assets/banner.png',
      });

      expect(result).toContain('Generate Sized Complete');
      // 256/64 = 4:1, closest API size should be 1824x608 (ratio ~3:1)
      expect(result).toContain('API size: 1824x608');
    });

    it('selects square API size for square targets', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateSized({
        prompt: 'icon',
        width: 64,
        height: 64,
        output_path: '/assets/icon.png',
      });

      expect(result).toContain('API size: 1024x1024');
    });

    it('selects tall API size for portrait targets', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateSized({
        prompt: 'tall card',
        width: 64,
        height: 192,
        output_path: '/assets/card.png',
      });

      // 64/192 = 0.333, closest is 608x1824 (ratio 0.333)
      expect(result).toContain('API size: 608x1824');
    });

    it('removes background before resize when requested', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateSized({
        prompt: 'sprite icon',
        width: 64,
        height: 64,
        output_path: '/assets/sprite.png',
        remove_bg: true,
      });

      expect(result).toContain('Background removed');
      expect(result).toContain('Resized');
    });

    it('handles bg removal failure gracefully', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(new Response('{}', { status: 500 }));

      const result = await generateSized({
        prompt: 'test',
        width: 64,
        height: 64,
        output_path: '/assets/test.png',
        remove_bg: true,
      });

      expect(result).toContain('BG removal failed');
      expect(result).toContain('Resized');
    });

    it('creates output directory if it does not exist', async () => {
      const { mkdirSync } = await import('fs');
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      await generateSized({
        prompt: 'test',
        width: 64,
        height: 64,
        output_path: '/new/deep/dir/test.png',
      });

      expect(mkdirSync).toHaveBeenCalledWith('/new/deep/dir', { recursive: true });
    });

    it('rejects invalid width', async () => {
      await expect(generateSized({
        prompt: 'test',
        width: 0,
        height: 64,
        output_path: '/assets/test.png',
      })).rejects.toThrow('width must be 1-4096');
    });

    it('rejects invalid height', async () => {
      await expect(generateSized({
        prompt: 'test',
        width: 64,
        height: 5000,
        output_path: '/assets/test.png',
      })).rejects.toThrow('height must be 1-4096');
    });

    it('rejects empty prompt', async () => {
      await expect(generateSized({
        prompt: '',
        width: 64,
        height: 64,
        output_path: '/assets/test.png',
      })).rejects.toThrow('cannot be empty');
    });

    it('rejects empty output path', async () => {
      await expect(generateSized({
        prompt: 'test',
        width: 64,
        height: 64,
        output_path: '',
      })).rejects.toThrow('Output path cannot be empty');
    });

    it('passes style correctly', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      await generateSized({
        prompt: 'test',
        width: 128,
        height: 128,
        output_path: '/assets/test.png',
        model: 'recraftv3',
        style: 'pixel_art',
      });

      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body.style).toBe('pixel_art');
    });

    it('passes style_id correctly', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      await generateSized({
        prompt: 'test',
        width: 128,
        height: 128,
        output_path: '/assets/test.png',
        style_id: 'custom-uuid-123',
      });

      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body.style_id).toBe('custom-uuid-123');
    });

    it('rejects both style and style_id', async () => {
      await expect(generateSized({
        prompt: 'test',
        width: 64,
        height: 64,
        output_path: '/assets/test.png',
        style: 'pixel_art',
        style_id: 'abc-123',
      })).rejects.toThrow('Cannot specify both');
    });

    it('supports different fit modes', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateSized({
        prompt: 'test',
        width: 128,
        height: 64,
        output_path: '/assets/test.png',
        fit: 'cover',
      });

      expect(result).toContain('fit: cover');
    });
  });

  // ─── compareStyles ──────────────────────────────────────────────────────────

  describe('compareStyles', () => {
    it('generates images for each style', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await compareStyles({
        prompt: 'a golden coin',
        styles: ['pixel_art', 'illustration'],
        output_dir: '/comparison',
      });

      expect(result).toContain('Style Comparison Complete');
      expect(result).toContain('pixel_art saved');
      expect(result).toContain('illustration saved');
      expect(result).toContain('Generated: 2/2');
    });

    it('creates a comparison grid', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await compareStyles({
        prompt: 'test',
        styles: ['pixel_art', 'illustration'],
        output_dir: '/comparison',
        grid: true,
      });

      expect(result).toContain('Grid saved');
    });

    it('skips grid when grid=false', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await compareStyles({
        prompt: 'test',
        styles: ['pixel_art', 'illustration'],
        output_dir: '/comparison',
        grid: false,
      });

      expect(result).not.toContain('Grid saved');
    });

    it('handles individual API failures gracefully', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(new Response('{}', { status: 500 }));

      const result = await compareStyles({
        prompt: 'test',
        styles: ['pixel_art', 'illustration'],
        output_dir: '/comparison',
      });

      expect(result).toContain('pixel_art saved');
      expect(result).toContain('illustration failed');
      expect(result).toContain('Generated: 1/2');
    });

    it('rejects empty styles array', async () => {
      await expect(compareStyles({
        prompt: 'test',
        styles: [],
        output_dir: '/comparison',
      })).rejects.toThrow('cannot be empty');
    });

    it('rejects more than 10 styles', async () => {
      const styles = Array.from({ length: 11 }, (_, i) => `style_${i}`);
      await expect(compareStyles({
        prompt: 'test',
        styles,
        output_dir: '/comparison',
      })).rejects.toThrow('Maximum 10');
    });

    it('fails validation for invalid style names without making API calls', async () => {
      const result = await compareStyles({
        prompt: 'test',
        styles: ['nonexistent_style_a', 'nonexistent_style_b'],
        output_dir: '/comparison',
      });

      // Both should fail at validation stage, no fetch calls made
      expect(result).toContain('nonexistent_style_a failed');
      expect(result).toContain('nonexistent_style_b failed');
      expect(result).toContain('Generated: 0/2');
      expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    });

    it('mixes successful and validation-failed styles correctly', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await compareStyles({
        prompt: 'test',
        styles: ['pixel_art', 'nonexistent_style'],
        output_dir: '/comparison',
      });

      expect(result).toContain('pixel_art saved');
      expect(result).toContain('nonexistent_style failed');
      expect(result).toContain('Generated: 1/2');
      // Only 2 fetch calls (generate + download for pixel_art), none for invalid style
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });

    it('skips grid when only 1 image succeeds', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await compareStyles({
        prompt: 'test',
        styles: ['pixel_art', 'nonexistent_style'],
        output_dir: '/comparison',
        grid: true,
      });

      // Grid needs >= 2 images
      expect(result).not.toContain('Grid saved');
    });
  });

  // ─── textureSwap ────────────────────────────────────────────────────────────

  describe('textureSwap', () => {
    it('replaces a region in an image', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await textureSwap({
        image_path: '/assets/atlas.png',
        region: { x: 100, y: 100, width: 256, height: 256 },
        prompt: 'a fire spell icon',
        output_path: '/assets/atlas_updated.png',
      });

      expect(result).toContain('Texture Swap Complete');
      expect(result).toContain('256x256');
      expect(result).toContain('Replacement content generated');
      expect(result).toContain('Resized replacement');
    });

    it('clamps region to image bounds', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await textureSwap({
        image_path: '/assets/atlas.png',
        region: { x: 900, y: 900, width: 500, height: 500 },
        prompt: 'test',
        output_path: '/assets/out.png',
      });

      expect(result).toContain('Texture Swap Complete');
      // Region should be clamped: x=900, w=min(500, 1024-900)=124
      expect(result).toContain('Region: 124x124');
    });

    it('applies feather blending', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await textureSwap({
        image_path: '/assets/atlas.png',
        region: { x: 0, y: 0, width: 256, height: 256 },
        prompt: 'test',
        output_path: '/assets/out.png',
        feather: 8,
      });

      expect(result).toContain('8px feather blend');
    });

    it('rejects missing source image', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValueOnce(false);

      await expect(textureSwap({
        image_path: '/nonexistent.png',
        region: { x: 0, y: 0, width: 100, height: 100 },
        prompt: 'test',
        output_path: '/out.png',
      })).rejects.toThrow('not found');
    });

    it('rejects invalid region dimensions', async () => {
      await expect(textureSwap({
        image_path: '/assets/atlas.png',
        region: { x: 0, y: 0, width: 0, height: 100 },
        prompt: 'test',
        output_path: '/out.png',
      })).rejects.toThrow('must be positive');
    });

    it('rejects feather out of range', async () => {
      await expect(textureSwap({
        image_path: '/assets/atlas.png',
        region: { x: 0, y: 0, width: 100, height: 100 },
        prompt: 'test',
        output_path: '/out.png',
        feather: 100,
      })).rejects.toThrow('Feather must be 0-64');
    });

    it('rejects both style and style_id', async () => {
      await expect(textureSwap({
        image_path: '/assets/atlas.png',
        region: { x: 0, y: 0, width: 100, height: 100 },
        prompt: 'test',
        output_path: '/out.png',
        style: 'pixel_art',
        style_id: 'abc-123',
      })).rejects.toThrow('Cannot specify both');
    });

    it('selects correct API size based on region aspect ratio', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await textureSwap({
        image_path: '/assets/atlas.png',
        region: { x: 0, y: 0, width: 512, height: 256 },
        prompt: 'wide texture',
        output_path: '/assets/out.png',
      });

      expect(result).toContain('Texture Swap Complete');
      // 512/256 = 2:1, should pick a wide API size
      expect(result).toMatch(/API size: \d+x\d+/);
    });

    it('passes negative_prompt to API', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      await textureSwap({
        image_path: '/assets/atlas.png',
        region: { x: 0, y: 0, width: 100, height: 100 },
        prompt: 'test',
        output_path: '/out.png',
        negative_prompt: 'no text, no watermark',
      });

      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body.negative_prompt).toBe('no text, no watermark');
    });
  });
});
