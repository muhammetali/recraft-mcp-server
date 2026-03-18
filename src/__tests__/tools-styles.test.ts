import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../auth.js', () => ({ getApiKey: () => 'test-key' }));
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue(Buffer.from('fake-png-data')),
  existsSync: vi.fn().mockReturnValue(true),
  statSync: vi.fn().mockReturnValue({ size: 1024 }),
}));

import { createStyle } from '../tools/styles.js';

describe('tools/styles', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a custom style', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'style-uuid-123' }), { status: 200 }),
    );

    const result = await createStyle('digital_illustration', ['/ref1.png', '/ref2.png']);
    expect(result).toContain('Custom Style Created');
    expect(result).toContain('style-uuid-123');
    expect(result).toContain('digital_illustration');
    expect(result).toContain('2');
  });

  it('sends files as multipart form', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'abc' }), { status: 200 }),
    );

    await createStyle('any', ['/ref.png']);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const body = (options as any).body as FormData;
    expect(body.get('style')).toBe('any');
  });

  it('rejects invalid style base type', async () => {
    await expect(createStyle('fantasy', ['/ref.png'])).rejects.toThrow('Unsupported style base type');
  });

  it('rejects empty file list', async () => {
    await expect(createStyle('any', [])).rejects.toThrow('At least one');
  });

  it('rejects more than 5 files', async () => {
    const paths = Array.from({ length: 6 }, (_, i) => `/ref${i}.png`);
    await expect(createStyle('any', paths)).rejects.toThrow('Maximum 5');
  });
});
