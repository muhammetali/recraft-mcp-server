import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock auth
vi.mock('../auth.js', () => ({
  getApiKey: () => 'test-api-key',
}));

import { recraftGet, recraftPost, recraftPostMultipart, downloadToBuffer, RecraftClientError } from '../client.js';

describe('client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('recraftGet', () => {
    it('makes GET request with auth header', async () => {
      const mockResponse = new Response(JSON.stringify({ credits: 100 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await recraftGet('/users/me');
      expect(result).toEqual({ credits: 100 });

      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(url).toContain('/users/me');
      expect((options as any).headers.Authorization).toBe('Bearer test-api-key');
    });

    it('throws RecraftClientError on non-200 response', async () => {
      const mockResponse = new Response(
        JSON.stringify({ error: { message: 'Not found' } }),
        { status: 404 },
      );
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      await expect(recraftGet('/nonexistent')).rejects.toThrow(RecraftClientError);
    });

    it('throws specific error on 402 (insufficient credits)', async () => {
      const mockResponse = new Response('{}', { status: 402 });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      await expect(recraftGet('/images/generations')).rejects.toThrow('Insufficient credits');
    });
  });

  describe('recraftPost', () => {
    it('makes POST request with JSON body', async () => {
      const mockResponse = new Response(
        JSON.stringify({ data: [{ image_id: 'abc', url: 'https://cdn.recraft.ai/img.png' }] }),
        { status: 200 },
      );
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const result = await recraftPost('/images/generations', { prompt: 'a cat', model: 'recraftv4' });
      expect(result.data[0].url).toBe('https://cdn.recraft.ai/img.png');

      const [, options] = vi.mocked(fetch).mock.calls[0];
      expect((options as any).method).toBe('POST');
      expect((options as any).headers['Content-Type']).toBe('application/json');
    });

    it('retries once on 429 rate limit', async () => {
      const rateLimitResponse = new Response('{}', {
        status: 429,
        headers: { 'retry-after': '1' },
      });
      const successResponse = new Response(
        JSON.stringify({ data: [{ image_id: 'xyz', url: 'https://cdn.recraft.ai/ok.png' }] }),
        { status: 200 },
      );
      vi.mocked(fetch)
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse);

      const result = await recraftPost('/images/generations', { prompt: 'test' });
      expect(result.data[0].url).toBe('https://cdn.recraft.ai/ok.png');
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });

    it('handles non-JSON error response', async () => {
      const mockResponse = new Response('Internal Server Error', { status: 500 });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      await expect(recraftPost('/test', {})).rejects.toThrow(RecraftClientError);
    });
  });

  describe('recraftPostMultipart', () => {
    it('makes multipart POST without Content-Type header', async () => {
      const mockResponse = new Response(
        JSON.stringify({ image: { url: 'https://cdn.recraft.ai/transparent.png' } }),
        { status: 200 },
      );
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.png');

      const result = await recraftPostMultipart('/images/removeBackground', formData);
      expect(result.image.url).toBe('https://cdn.recraft.ai/transparent.png');

      const [, options] = vi.mocked(fetch).mock.calls[0];
      expect((options as any).headers['Content-Type']).toBeUndefined();
      expect((options as any).headers.Authorization).toBe('Bearer test-api-key');
    });
  });

  describe('downloadToBuffer', () => {
    it('downloads URL to buffer', async () => {
      const mockResponse = new Response(Buffer.from('fake-image-data'), { status: 200 });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      const buffer = await downloadToBuffer('https://cdn.recraft.ai/image.png');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('throws on download failure', async () => {
      const mockResponse = new Response('Not Found', { status: 404 });
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

      await expect(downloadToBuffer('https://cdn.recraft.ai/gone.png')).rejects.toThrow('Failed to download');
    });
  });

  describe('RecraftClientError', () => {
    it('formats error message correctly', () => {
      const error = new RecraftClientError(400, { code: 400, message: 'Bad request' });
      expect(error.name).toBe('RecraftClientError');
      expect(error.status).toBe(400);
      expect(error.message).toContain('400');
      expect(error.message).toContain('Bad request');
    });
  });
});
