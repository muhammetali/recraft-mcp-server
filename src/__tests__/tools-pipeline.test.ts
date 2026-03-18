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

import { generateAsset, batchGenerateAssets, generateThemedSet } from '../tools/pipeline.js';

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

  describe('generateThemedSet', () => {
    // Each symbol in themed set: generate(1) + download(1) + bgRemove(1) + downloadTransparent(1) = 4
    // Plus: style creation (1 multipart call) = 1
    // Hero: generate + download + bgRemove + downloadTransparent = 4
    // Style: 1 multipart call
    // Second symbol: generate + download + bgRemove + downloadTransparent = 4

    function mockStyleResponse() {
      return new Response(JSON.stringify({ id: 'style-abc-123' }), { status: 200 });
    }

    it('generates a complete themed set with style consistency', async () => {
      vi.mocked(fetch)
        // Hero: generate
        .mockResolvedValueOnce(mockGenerationResponse())
        // Hero: download
        .mockResolvedValueOnce(mockImageDownload())
        // Hero: bg remove
        .mockResolvedValueOnce(mockBgRemoveResponse())
        // Hero: download transparent
        .mockResolvedValueOnce(mockImageDownload())
        // Style creation
        .mockResolvedValueOnce(mockStyleResponse())
        // Symbol 2: generate
        .mockResolvedValueOnce(mockGenerationResponse())
        // Symbol 2: download
        .mockResolvedValueOnce(mockImageDownload())
        // Symbol 2: bg remove
        .mockResolvedValueOnce(mockBgRemoveResponse())
        // Symbol 2: download transparent
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateThemedSet({
        theme: 'Egyptian',
        prompt_suffix: ', 3D render, black background, no text',
        symbols: [
          { name: 'scarab', prompt_detail: 'A golden scarab beetle' },
          { name: 'ankh', prompt_detail: 'A golden ankh symbol' },
        ],
        output_dir: '/assets/egyptian',
      });

      expect(result).toContain('Themed Set Complete: Egyptian');
      expect(result).toContain('scarab');
      expect(result).toContain('ankh');
      expect(result).toContain('style-abc-123');
      expect(result).toContain('asset-manifest.json');
    });

    it('generates background when bg_prompt is provided', async () => {
      vi.mocked(fetch)
        // Hero
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload())
        // Style
        .mockResolvedValueOnce(mockStyleResponse())
        // Background
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateThemedSet({
        theme: 'Viking',
        prompt_suffix: ', dramatic lighting',
        symbols: [{ name: 'axe', prompt_detail: 'A Viking battle axe' }],
        output_dir: '/assets/viking',
        bg_prompt: 'Ancient Norse temple interior, dark moody atmosphere',
      });

      expect(result).toContain('Background saved');
    });

    it('continues without style if style creation fails', async () => {
      vi.mocked(fetch)
        // Hero
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload())
        // Style creation FAILS
        .mockResolvedValueOnce(new Response('{}', { status: 500 }))
        // Symbol 2 (without style, uses V4)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload());

      const result = await generateThemedSet({
        theme: 'Test',
        prompt_suffix: ', test',
        symbols: [
          { name: 'hero', prompt_detail: 'Hero' },
          { name: 'sym2', prompt_detail: 'Second' },
        ],
        output_dir: '/assets/test',
      });

      expect(result).toContain('Style creation failed');
      expect(result).toContain('sym2 saved');
    });

    it('handles individual symbol failures gracefully', async () => {
      vi.mocked(fetch)
        // Hero
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload())
        // Style
        .mockResolvedValueOnce(mockStyleResponse())
        // Symbol 2 FAILS
        .mockResolvedValueOnce(new Response('{}', { status: 500 }));

      const result = await generateThemedSet({
        theme: 'Fail',
        prompt_suffix: ', test',
        symbols: [
          { name: 'ok', prompt_detail: 'Works' },
          { name: 'broken', prompt_detail: 'Fails' },
        ],
        output_dir: '/assets/fail',
      });

      expect(result).toContain('ok saved');
      expect(result).toContain('broken failed');
    });

    it('writes asset manifest with correct structure', async () => {
      const { writeFileSync } = await import('fs');
      vi.mocked(writeFileSync).mockClear();

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockStyleResponse());

      await generateThemedSet({
        theme: 'Manifest Test',
        prompt_suffix: ', test',
        symbols: [{ name: 'gem', prompt_detail: 'A gem' }],
        output_dir: '/assets/manifest',
      });

      // Find the writeFileSync call that wrote the manifest
      const manifestCall = vi.mocked(writeFileSync).mock.calls.find(
        call => String(call[0]).includes('asset-manifest.json')
      );
      expect(manifestCall).toBeDefined();

      const manifest = JSON.parse(String(manifestCall![1]));
      expect(manifest.theme).toBe('Manifest Test');
      expect(manifest.style_id).toBe('style-abc-123');
      expect(manifest.assets).toEqual([
        { alias: 'sym_gem', src: 'symbols/gem.png' },
      ]);
    });

    it('skips manifest when generate_manifest is false', async () => {
      const { writeFileSync } = await import('fs');
      vi.mocked(writeFileSync).mockClear();

      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockStyleResponse());

      await generateThemedSet({
        theme: 'No Manifest',
        prompt_suffix: ', test',
        symbols: [{ name: 'x', prompt_detail: 'An X' }],
        output_dir: '/assets/nomanifest',
        generate_manifest: false,
      });

      const manifestCall = vi.mocked(writeFileSync).mock.calls.find(
        call => String(call[0]).includes('asset-manifest.json')
      );
      expect(manifestCall).toBeUndefined();
    });

    it('rejects empty symbols array', async () => {
      await expect(generateThemedSet({
        theme: 'Empty',
        prompt_suffix: ', test',
        symbols: [],
        output_dir: '/assets',
      })).rejects.toThrow('cannot be empty');
    });

    it('rejects empty theme', async () => {
      await expect(generateThemedSet({
        theme: '',
        prompt_suffix: ', test',
        symbols: [{ name: 'x', prompt_detail: 'test' }],
        output_dir: '/assets',
      })).rejects.toThrow('Theme cannot be empty');
    });

    it('uses V3 with style_id for non-hero symbols', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockStyleResponse())
        .mockResolvedValueOnce(mockGenerationResponse())
        .mockResolvedValueOnce(mockImageDownload())
        .mockResolvedValueOnce(mockBgRemoveResponse())
        .mockResolvedValueOnce(mockImageDownload());

      await generateThemedSet({
        theme: 'V3 Test',
        prompt_suffix: ', test',
        symbols: [
          { name: 'hero', prompt_detail: 'Hero item' },
          { name: 'follower', prompt_detail: 'Follow item' },
        ],
        output_dir: '/assets/v3test',
      });

      // The 6th fetch call is for the second symbol generation
      const [, options] = vi.mocked(fetch).mock.calls[5];
      const body = JSON.parse((options as any).body);
      expect(body.model).toBe('recraftv3');
      expect(body.style_id).toBe('style-abc-123');
    });
  });
});
