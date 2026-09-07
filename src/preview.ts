import sharp from 'sharp';
import { downloadToBuffer } from './client.js';

/// An MCP image content block.
export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

/// The ceiling for a single preview, in bytes of base64.
///
/// An image the model cannot see is a URL it has to take on faith — it can
/// generate ten variations and judge none of them. But an unbounded base64
/// blob is worse: a 4MP PNG is several megabytes of context, and two of
/// them end a conversation. So previews are deliberately small. 700KB of
/// base64 is roughly 512KB of WebP, which is a legible 512px preview with
/// room to spare.
const PREVIEW_BUDGET_BYTES = 700_000;

/// Longest edge to start from. Halved until the result fits the budget.
const PREVIEW_START_EDGE = 768;

/// The smallest edge worth returning. Below this the preview stops being
/// evidence of anything and is just noise in the context.
const PREVIEW_MIN_EDGE = 96;

/// Renders one image as a preview small enough to hand to the model.
///
/// Returns null rather than throwing: a preview is a convenience, and a
/// generation that succeeded should not be reported as a failure because
/// its thumbnail could not be produced.
export async function buildPreview(buffer: Buffer): Promise<ImageContent | null> {
  try {
    let edge = PREVIEW_START_EDGE;

    while (edge >= PREVIEW_MIN_EDGE) {
      const resized = await sharp(buffer)
        // `withoutEnlargement` keeps a small source from being upscaled into
        // a bigger payload than the original.
        .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
        // WebP over PNG: same legibility at a fraction of the bytes, and
        // flattening onto a background would lose the transparency that
        // background removal exists to produce.
        .webp({ quality: 80 })
        .toBuffer();

      const data = resized.toString('base64');
      if (data.length <= PREVIEW_BUDGET_BYTES) {
        return { type: 'image', data, mimeType: 'image/webp' };
      }
      edge = Math.floor(edge / 2);
    }

    return null;
  } catch {
    // Unsupported or truncated image data. The URL is still in the text
    // block; the caller loses the thumbnail, not the result.
    return null;
  }
}

/// Downloads and previews an image URL.
export async function previewFromUrl(url: string): Promise<ImageContent | null> {
  try {
    return await buildPreview(await downloadToBuffer(url));
  } catch {
    return null;
  }
}

/// Previews several URLs, capped.
///
/// A batch of twenty images would blow the context regardless of how small
/// each preview is, so only the first few are rendered and the caller is
/// told the rest were left as URLs. Showing some beats showing none, and
/// beats showing all.
export async function previewFromUrls(
  urls: string[],
  max = 4
): Promise<{ previews: ImageContent[]; omitted: number }> {
  const chosen = urls.slice(0, max);
  const settled = await Promise.all(chosen.map(previewFromUrl));
  return {
    previews: settled.filter((p): p is ImageContent => p !== null),
    omitted: Math.max(0, urls.length - chosen.length),
  };
}
