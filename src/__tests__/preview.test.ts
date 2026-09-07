import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { buildPreview } from '../preview.js';

/// Previews run against real sharp, not a stub.
///
/// A stubbed sharp would make these tests assert that a mock returns what
/// the mock was told to return — the downscale loop, the budget check and
/// the transparency handling would all go unexercised, which is exactly the
/// logic that matters here.
describe('buildPreview', () => {
  async function png(width: number, height: number, alpha = 1) {
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 200, g: 40, b: 90, alpha },
      },
    })
      .png()
      .toBuffer();
  }

  it('returns a webp image block', async () => {
    const preview = await buildPreview(await png(1024, 1024));
    expect(preview).not.toBeNull();
    expect(preview!.type).toBe('image');
    expect(preview!.mimeType).toBe('image/webp');
    expect(preview!.data.length).toBeGreaterThan(0);
  });

  it('produces something a context window can actually hold', async () => {
    // The point of the whole file. A 4MP PNG returned inline is megabytes
    // of base64; two of them end the conversation.
    const preview = await buildPreview(await png(2048, 2048));
    expect(preview!.data.length).toBeLessThan(700_000);
  });

  it('fits the longest edge inside the preview size', async () => {
    const preview = await buildPreview(await png(2048, 1024));
    const meta = await sharp(Buffer.from(preview!.data, 'base64')).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(768);
  });

  it('keeps the aspect ratio', async () => {
    const preview = await buildPreview(await png(1600, 400));
    const meta = await sharp(Buffer.from(preview!.data, 'base64')).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(4, 1);
  });

  it('does not enlarge an image that is already small', async () => {
    // Upscaling a 64px icon to 768px would spend context to add nothing.
    const preview = await buildPreview(await png(64, 64));
    const meta = await sharp(Buffer.from(preview!.data, 'base64')).metadata();
    expect(meta.width).toBe(64);
  });

  it('preserves transparency', async () => {
    // Background removal exists to produce transparency; flattening it in
    // the preview would misrepresent the result the tool just produced.
    const preview = await buildPreview(await png(256, 256, 0));
    const meta = await sharp(Buffer.from(preview!.data, 'base64')).metadata();
    expect(meta.hasAlpha).toBe(true);
  });

  it('returns null rather than throwing on data that is not an image', async () => {
    // A generation that succeeded must not be reported as failed because
    // its thumbnail could not be made.
    expect(await buildPreview(Buffer.from('not an image'))).toBeNull();
  });

  it('returns null on an empty buffer', async () => {
    expect(await buildPreview(Buffer.alloc(0))).toBeNull();
  });
});
