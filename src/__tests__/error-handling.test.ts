import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth.js', () => ({ getApiKey: () => 'test-key' }));

import { RecraftClientError, recraftPost, recraftGet } from '../client.js';

describe('error handling', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RecraftClientError', () => {
    it('has correct name property', () => {
      const err = new RecraftClientError(400, { code: 400, message: 'bad' });
      expect(err.name).toBe('RecraftClientError');
    });

    it('includes status in message', () => {
      const err = new RecraftClientError(500, { code: 500, message: 'server error' });
      expect(err.message).toContain('500');
      expect(err.message).toContain('server error');
    });

    it('exposes status and error properties', () => {
      const err = new RecraftClientError(403, { code: 403, message: 'forbidden' });
      expect(err.status).toBe(403);
      expect(err.error.code).toBe(403);
      expect(err.error.message).toBe('forbidden');
    });
  });

  describe('API error responses', () => {
    it('handles 402 insufficient credits', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 402 }));
      try {
        await recraftPost('/images/generations', { prompt: 'test' });
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(RecraftClientError);
        expect((e as RecraftClientError).status).toBe(402);
        expect((e as RecraftClientError).message).toContain('Insufficient credits');
      }
    });

    it('handles 400 bad request with JSON error body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid prompt' } }), { status: 400 }),
      );
      try {
        await recraftPost('/images/generations', { prompt: '' });
        expect.fail('should have thrown');
      } catch (e) {
        expect((e as RecraftClientError).status).toBe(400);
        expect((e as RecraftClientError).message).toContain('Invalid prompt');
      }
    });

    it('handles 500 with plain text body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 }),
      );
      try {
        await recraftGet('/users/me');
        expect.fail('should have thrown');
      } catch (e) {
        expect((e as RecraftClientError).status).toBe(500);
        expect((e as RecraftClientError).message).toContain('Internal Server Error');
      }
    });

    it('handles 204 no content', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(null, { status: 204 }),
      );
      const result = await recraftGet('/some/path');
      expect(result).toEqual({});
    });

    it('handles rate limit (429) with retry', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '1' } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      const result = await recraftGet('/test');
      expect(result).toEqual({ ok: true });
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    });

    it('propagates error after retry failure', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(new Response('{}', { status: 429 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'still limited' } }), { status: 429 }));

      await expect(recraftGet('/test')).rejects.toThrow(RecraftClientError);
    });
  });

  describe('timeout handling', () => {
    it('uses AbortSignal.timeout', async () => {
      // This verifies that signal is passed to fetch
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ credits: 1 }), { status: 200 }),
      );

      await recraftGet('/users/me');

      const [, options] = vi.mocked(fetch).mock.calls[0];
      expect((options as any).signal).toBeDefined();
    });
  });
});
