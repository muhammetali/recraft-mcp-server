import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { listStyles, getStyle, deleteStyle, listBasicStyles } from '../tools/styles.js';

/// The account could mint custom styles but never see or remove them, and
/// `recraft_generate_themed_set` creates one on every run — so a handful of
/// runs left a pile of paid styles with no way to find them. These four
/// endpoints existed the whole time.
///
/// Every test here asserts the request that actually went out. The rest of
/// this suite almost never does, which is how an endpoint constant could be
/// swapped without anything turning red.
describe('style CRUD', () => {
  let calls: Array<{ url: string; method: string }>;

  function stubFetch(payload: unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, options: any) => {
        calls.push({ url: String(url), method: options?.method ?? 'GET' });
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify(payload),
        };
      })
    );
  }

  beforeEach(() => {
    process.env.RECRAFT_API_KEY = 'test-key';
    calls = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const uuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  describe('listStyles', () => {
    it('GETs /styles', async () => {
      stubFetch({ styles: [] });
      await listStyles();
      expect(calls[0].url).toBe('https://external.api.recraft.ai/v1/styles');
      expect(calls[0].method).toBe('GET');
    });

    it('says so plainly when there are none', async () => {
      stubFetch({ styles: [] });
      expect(await listStyles()).toContain('No custom styles');
    });

    it('reports each style with its id', async () => {
      stubFetch({
        styles: [
          { id: uuid, style: 'digital_illustration', substyle: 'kawaii', creation_time: '2026-09-07T10:00:00Z' },
        ],
      });
      const out = await listStyles();
      expect(out).toContain(uuid);
      expect(out).toContain('digital_illustration / kawaii');
      expect(out).toContain('2026-09-07');
    });

    it('survives a style with no base style', async () => {
      stubFetch({ styles: [{ id: uuid }] });
      expect(await listStyles()).toContain('(no base style)');
    });

    it('survives a response with no styles array at all', async () => {
      // The server has no output validation, so a shape surprise here used
      // to become "Cannot read properties of undefined".
      stubFetch({});
      expect(await listStyles()).toContain('No custom styles');
    });
  });

  describe('getStyle', () => {
    it('GETs /styles/{id}', async () => {
      stubFetch({ id: uuid, style: 'icon' });
      await getStyle(uuid);
      expect(calls[0].url).toBe(`https://external.api.recraft.ai/v1/styles/${uuid}`);
      expect(calls[0].method).toBe('GET');
    });

    it('rejects a malformed id without calling the API', async () => {
      // A 404 round trip costs a request and returns a worse message.
      stubFetch({});
      await expect(getStyle('not-a-uuid')).rejects.toThrow(/Invalid style_id/);
      expect(calls).toHaveLength(0);
    });
  });

  describe('deleteStyle', () => {
    it('DELETEs /styles/{id}', async () => {
      stubFetch({});
      await deleteStyle(uuid);
      expect(calls[0].url).toBe(`https://external.api.recraft.ai/v1/styles/${uuid}`);
      expect(calls[0].method).toBe('DELETE');
    });

    it('rejects a malformed id without calling the API', async () => {
      // Deletion is not reversible; refusing early matters more here.
      stubFetch({});
      await expect(deleteStyle('../../users/me')).rejects.toThrow(/Invalid style_id/);
      expect(calls).toHaveLength(0);
    });
  });

  describe('listBasicStyles', () => {
    it('GETs /styles/basic', async () => {
      stubFetch({ styles: [] });
      await listBasicStyles();
      expect(calls[0].url).toBe('https://external.api.recraft.ai/v1/styles/basic');
    });

    it('groups by model', async () => {
      stubFetch({
        styles: [
          { model: 'recraftv3', style: 'realistic_image' },
          { model: 'recraftv3', style: 'icon' },
          { model: 'recraftv2', style: 'icon' },
        ],
      });
      const out = await listBasicStyles();
      expect(out).toContain('**recraftv3**');
      expect(out).toContain('**recraftv2**');
      expect(out).toContain('3 basic style(s)');
    });
  });
});
