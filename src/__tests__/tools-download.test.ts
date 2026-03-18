import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { existsSync } from 'fs';
import { downloadImage } from '../tools/download.js';

describe('tools/download', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(existsSync).mockReturnValue(true);
  });

  it('downloads and saves image', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(Buffer.from('fake-image-data'), { status: 200 }),
    );

    const result = await downloadImage('https://cdn.recraft.ai/img.png', '/output/image.png');
    expect(result).toContain('Image Downloaded');
    expect(result).toContain('/output/image.png');
    expect(result).toContain('KB');
  });

  it('reports file size correctly', async () => {
    const buf = Buffer.alloc(2048, 'x');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(buf, { status: 200 }),
    );

    const result = await downloadImage('https://cdn.recraft.ai/img.png', '/output/test.png');
    expect(result).toContain('2.0 KB');
  });

  it('rejects empty URL', async () => {
    await expect(downloadImage('', '/output/test.png')).rejects.toThrow('URL cannot be empty');
  });

  it('rejects empty output path', async () => {
    await expect(downloadImage('https://example.com/img.png', '')).rejects.toThrow('cannot be empty');
  });

  it('rejects non-existent output directory', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    await expect(
      downloadImage('https://example.com/img.png', '/nonexistent/dir/out.png'),
    ).rejects.toThrow('Output directory does not exist');
  });

  it('throws on download failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Not Found', { status: 404 }));
    await expect(
      downloadImage('https://cdn.recraft.ai/gone.png', '/output/test.png'),
    ).rejects.toThrow('Failed to download');
  });
});
