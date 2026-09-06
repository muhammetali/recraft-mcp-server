import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

// Exercise the actual native binaries; the advanced tool tests mock sharp.
describe('native image processing', () => {
  it('resizes a PNG into a transparent canvas and composites an SVG label', async () => {
    const source = await sharp({
      create: {
        width: 16,
        height: 8,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    }).png().toBuffer();

    const resized = await sharp(source)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer();

    const { data, info } = await sharp(resized)
      .composite([{
        input: Buffer.from('<svg width="4" height="4"><rect width="4" height="4" fill="blue"/></svg>'),
        left: 0,
        top: 0,
      }])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(info).toMatchObject({ width: 32, height: 32, channels: 4 });
    expect([...data.subarray(0, 4)]).toEqual([0, 0, 255, 255]);
    expect(data[(0 * 32 + 16) * 4 + 3]).toBe(0);
    expect([...data.subarray((16 * 32 + 16) * 4, (16 * 32 + 16) * 4 + 4)])
      .toEqual([255, 0, 0, 255]);
  });

  it('rejects invalid image data', async () => {
    await expect(sharp(Buffer.from('not an image')).png().toBuffer())
      .rejects.toThrow();
  });
});
