import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth.js', () => ({ getApiKey: () => 'test-key' }));
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ size: 1024 }),
  readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-data')),
}));

import { generateAsset, batchGenerateAssets } from '../tools/pipeline.js';

describe('tools/pipeline', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
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

  describe('generateAsset', () => {
    it('runs full pipeline: generate → download → bg remove → save', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())  // generate
        .mockResolvedValueOnce(mockImageDownload())         // download generated
        .mockResolvedValueOnce(mockBgRemoveResponse())      // bg remove
        .mockResolvedValueOnce(mockImageDownload());         // download transparent

      const result = await generateAsset({
        prompt: 'a golden scarab',
        output_path: '/assets/scarab.png',
      });

      expect(result).toContain('Asset Pipeline Complete');
      expect(result).toContain('Image generated');
      expect(result).toContain('Background removed');
      expect(result).toContain('/assets/scarab.png');
    });

    it('skips bg removal when remove_bg is false', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateAsset({
        prompt: 'a background image',
        output_path: '/assets/bg.png',
        remove_bg: false,
      });

      expect(result).toContain('Asset Pipeline Complete');
      expect(result).not.toContain('Background removed');
      // Should only have 2 fetch calls (generate + download)
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });

    it('falls back to original on bg removal failure', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(new Response('{}', { status: 500 })); // bg remove fails

      const result = await generateAsset({
        prompt: 'test',
        output_path: '/assets/fallback.png',
      });

      expect(result).toContain('BG removal failed');
      expect(result).toContain('saved original');
    });

    it('cleans up temp file after bg removal', async () => {
      const { unlinkSync, existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload());

      await generateAsset({
        prompt: 'test',
        output_path: '/assets/test.png',
      });

      expect(unlinkSync).toHaveBeenCalled();
    });

    it('rejects empty prompt', async () => {
      await expect(generateAsset({
        prompt: '',
        output_path: '/assets/test.png',
      })).rejects.toThrow('cannot be empty');
    });

    it('rejects invalid size', async () => {
      await expect(generateAsset({
        prompt: 'test',
        output_path: '/assets/test.png',
        size: '100x100',
      })).rejects.toThrow('Unsupported size');
    });

    it('passes style and negative_prompt', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload());

      await generateAsset({
        prompt: 'test',
        output_path: '/assets/test.png',
        model: 'recraftv3',
        style: 'photorealism',
        negative_prompt: 'no text',
      });

      const [, options] = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse((options as any).body);
      expect(body.style).toBe('photorealism');
      expect(body.negative_prompt).toBe('no text');
    });
  });

  describe('batchGenerateAssets', () => {
    it('generates multiple assets', async () => {
      // Each asset: generate + download + bg remove + download transparent = 4 calls
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await batchGenerateAssets([
        { name: 'scarab', prompt: 'scarab beetle', output_dir: '/assets' },
        { name: 'ankh', prompt: 'golden ankh', output_dir: '/assets' },
      ]);

      expect(result).toContain('Batch Asset Pipeline Complete');
      expect(result).toContain('Success: 2');
      expect(result).toContain('scarab');
      expect(result).toContain('ankh');
    });

    it('handles partial failures', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(new Response('{}', { status: 500 })); // second asset fails

      const result = await batchGenerateAssets([
        { name: 'ok', prompt: 'good', output_dir: '/assets' },
        { name: 'fail', prompt: 'bad', output_dir: '/assets' },
      ]);

      expect(result).toContain('Success: 1');
      expect(result).toContain('Failed: 1');
    });

    it('rejects empty assets array', async () => {
      await expect(batchGenerateAssets([])).rejects.toThrow('cannot be empty');
    });

    it('uses correct output path format', async () => {
      const { writeFileSync } = await import('fs');
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await batchGenerateAssets([
        { name: 'cat', prompt: 'a cat', output_dir: '/output' },
      ]);

      expect(result).toContain('/output/cat.png');
    });
  });
});
