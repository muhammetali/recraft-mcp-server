import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth.js', () => ({ getApiKey: () => 'test-key' }));
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-png-data')),
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ size: 1024 }),
}));

import { removeBackground, vectorize, crispUpscale, creativeUpscale, eraseRegion } from '../tools/enhance.js';

describe('tools/enhance', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockSingleImageResponse(url = 'https://cdn.recraft.ai/result.png') {
    return new Response(
      JSON.stringify({ image: { url } }),
      { status: 200 },
    );
  }

  describe('removeBackground', () => {
    it('removes background successfully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockSingleImageResponse());
      const result = await removeBackground('/test/image.png');
      expect(result).toContain('Background Removed');
      expect(result).toContain('cdn.recraft.ai/result.png');
    });

    it('sends multipart form data', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockSingleImageResponse());
      await removeBackground('/test/image.png');
      const [, options] = vi.mocked(fetch).mock.calls[0];
      expect((options as any).body).toBeInstanceOf(FormData);
    });

    it('rejects invalid file extension', async () => {
      await expect(removeBackground('/test/image.gif')).rejects.toThrow('Unsupported file extension');
    });
  });

  describe('vectorize', () => {
    it('converts to SVG', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockSingleImageResponse('https://cdn.recraft.ai/vector.svg'));
      const result = await vectorize('/test/image.png');
      expect(result).toContain('Vectorized (SVG)');
      expect(result).toContain('vector.svg');
    });
  });

  describe('crispUpscale', () => {
    it('upscales image', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockSingleImageResponse());
      const result = await crispUpscale('/test/small.png');
      expect(result).toContain('Crisp Upscale Complete');
    });
  });

  describe('creativeUpscale', () => {
    it('upscales with detail enhancement', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockSingleImageResponse());
      const result = await creativeUpscale('/test/photo.jpg');
      expect(result).toContain('Creative Upscale Complete');
    });
  });

  describe('eraseRegion', () => {
    it('erases region with mask', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockSingleImageResponse());
      const result = await eraseRegion('/test/image.png', '/test/mask.png');
      expect(result).toContain('Region Erased');
    });

    it('rejects non-existent mask file', async () => {
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockImplementation((p) => {
        if (String(p).includes('mask')) return false;
        return true;
      });
      await expect(eraseRegion('/test/image.png', '/test/missing_mask.png')).rejects.toThrow('File not found');
    });
  });
});
