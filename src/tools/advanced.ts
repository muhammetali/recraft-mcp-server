import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import sharp from 'sharp';
import { recraftPost, recraftPostMultipart, downloadToBuffer } from '../client.js';
import { ENDPOINTS, BATCH_DELAY_MS, SUPPORTED_SIZES } from '../constants.js';
import {
  validatePrompt, validateSize, validateModel, validateStyle,
  validateFilePath, validateOutputPath, resolveSize,
} from '../validation.js';

import type { GenerationResult, BgRemoveResult } from '../types.js';

type ResizeFit = 'contain' | 'cover' | 'fill';

// ─── Helper: find best API size for target aspect ratio ─────────────────────

function findBestApiSize(targetWidth: number, targetHeight: number): string {
  const targetRatio = targetWidth / targetHeight;
  let bestSize = '1024x1024';
  let bestDiff = Infinity;

  for (const size of SUPPORTED_SIZES) {
    const [w, h] = size.split('x').map(Number);
    const ratio = w / h;
    const diff = Math.abs(ratio - targetRatio);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSize = size;
    }
  }

  return bestSize;
}

// ─── Helper: remove background from buffer ──────────────────────────────────

async function removeBgFromBuffer(imageBuffer: Buffer): Promise<Buffer> {
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
  formData.append('file', blob, 'temp.png');
  formData.append('response_format', 'url');

  const bgResult = await recraftPostMultipart<BgRemoveResult>(
    ENDPOINTS.REMOVE_BACKGROUND, formData,
  );

  return downloadToBuffer(bgResult.image.url);
}

// =============================================================================
// 1. GENERATE SIZED — Generate + resize to any target size
// =============================================================================

export interface GenerateSizedParams {
  prompt: string;
  width: number;
  height: number;
  output_path: string;
  fit?: ResizeFit;
  model?: string;
  style?: string;
  style_id?: string;
  negative_prompt?: string;
  remove_bg?: boolean;
}

export async function generateSized(params: GenerateSizedParams): Promise<string> {
  const {
    prompt,
    width,
    height,
    output_path,
    fit = 'contain',
    model = 'recraftv4',
    style,
    style_id,
    negative_prompt,
    remove_bg = false,
  } = params;

  // Validate
  if (width < 1 || width > 4096) throw new Error(`width must be 1-4096 (got ${width}).`);
  if (height < 1 || height > 4096) throw new Error(`height must be 1-4096 (got ${height}).`);
  if (!output_path || output_path.trim().length === 0) throw new Error('Output path cannot be empty.');
  validatePrompt(prompt, model);
  validateModel(model);
  if (style) validateStyle(style);
  if (style && style_id) throw new Error('Cannot specify both style and style_id.');

  const steps: string[] = [];

  // Step 1: Pick the best API size for the target aspect ratio
  const apiSize = findBestApiSize(width, height);
  steps.push(`📐 Target: ${width}x${height} → API size: ${apiSize}`);

  // Step 2: Generate at API size
  const resolvedSize = resolveSize(apiSize, model);
  const body: Record<string, any> = {
    prompt, model, size: resolvedSize, n: 1, response_format: 'url',
  };
  if (style) body.style = style;
  if (style_id) body.style_id = style_id;
  if (negative_prompt) body.negative_prompt = negative_prompt;

  const genResult = await recraftPost<GenerationResult>(ENDPOINTS.GENERATIONS, body);
  const imageUrl = genResult.data[0]?.url;
  if (!imageUrl) throw new Error('Generation returned no image URL.');
  steps.push('✅ Image generated');

  // Step 3: Download
  let imageBuffer = await downloadToBuffer(imageUrl);
  steps.push(`✅ Downloaded (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

  // Step 4: Optional background removal (before resize for better quality)
  if (remove_bg) {
    try {
      imageBuffer = await removeBgFromBuffer(imageBuffer);
      steps.push('✅ Background removed');
    } catch (bgErr) {
      steps.push(`⚠️ BG removal failed: ${bgErr instanceof Error ? bgErr.message : String(bgErr)}`);
    }
  }

  // Step 5: Resize with sharp (transparent background for contain to avoid black letterbox)
  const resizedBuffer = await sharp(imageBuffer)
    .resize(width, height, {
      fit,
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Ensure output directory exists
  const dir = dirname(output_path);
  mkdirSync(dir, { recursive: true });

  writeFileSync(output_path, resizedBuffer);
  steps.push(`✅ Resized to ${width}x${height} (fit: ${fit})`);
  steps.push(`✅ Saved: ${output_path} (${(resizedBuffer.length / 1024).toFixed(1)} KB)`);

  return [
    '**Generate Sized Complete**',
    '',
    ...steps,
  ].join('\n');
}

// =============================================================================
// 2. COMPARE STYLES — Generate same prompt in multiple styles side by side
// =============================================================================

export interface CompareStylesParams {
  prompt: string;
  styles: string[];
  output_dir: string;
  size?: string;
  model?: string;
  grid?: boolean;
  grid_columns?: number;
}

export async function compareStyles(params: CompareStylesParams): Promise<string> {
  const {
    prompt,
    styles,
    output_dir,
    size = '1024x1024',
    model = 'recraftv3',
    grid = true,
    grid_columns = 3,
  } = params;

  if (!styles || styles.length === 0) throw new Error('Styles array cannot be empty.');
  if (styles.length > 10) throw new Error('Maximum 10 styles per comparison.');

  validatePrompt(prompt, model);
  validateModel(model);
  validateSize(size);

  // Ensure output dir exists
  mkdirSync(output_dir, { recursive: true });

  const steps: string[] = [];
  const resolvedSize = resolveSize(size, model);
  const generatedImages: Array<{ style: string; buffer: Buffer; path: string }> = [];

  // Generate each style
  for (let i = 0; i < styles.length; i++) {
    const styleName = styles[i];
    steps.push(`🎨 [${i + 1}/${styles.length}] Generating: ${styleName}...`);

    try {
      validateStyle(styleName);

      const body: Record<string, any> = {
        prompt, model, size: resolvedSize, n: 1, response_format: 'url',
        style: styleName,
      };

      const result = await recraftPost<GenerationResult>(ENDPOINTS.GENERATIONS, body);
      const url = result.data[0]?.url;
      if (!url) throw new Error('No URL returned');

      const buffer = await downloadToBuffer(url);
      const filePath = join(output_dir, `${styleName}.png`);
      writeFileSync(filePath, buffer);

      generatedImages.push({ style: styleName, buffer, path: filePath });
      steps.push(`✅ ${styleName} saved`);
    } catch (e) {
      steps.push(`❌ ${styleName} failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Rate limiting
    if (i < styles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Build comparison grid
  if (grid && generatedImages.length >= 2) {
    try {
      const gridPath = join(output_dir, '_comparison_grid.png');
      await buildComparisonGrid(generatedImages, gridPath, grid_columns);
      steps.push(`✅ Grid saved: ${gridPath}`);
    } catch (gridErr) {
      steps.push(`⚠️ Grid creation failed: ${gridErr instanceof Error ? gridErr.message : String(gridErr)}`);
    }
  }

  return [
    '**Style Comparison Complete**',
    '',
    `✅ Generated: ${generatedImages.length}/${styles.length} | Prompt: "${prompt.slice(0, 80)}..."`,
    '',
    ...steps,
  ].join('\n');
}

function escapeSvgText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function buildComparisonGrid(
  images: Array<{ style: string; buffer: Buffer }>,
  outputPath: string,
  columns: number,
): Promise<void> {
  // Get dimensions from first image
  const firstMeta = await sharp(images[0].buffer).metadata();
  const cellW = firstMeta.width || 512;
  const cellH = firstMeta.height || 512;

  const labelHeight = 40;
  const padding = 4;

  const cols = Math.min(columns, images.length);
  const rows = Math.ceil(images.length / cols);

  const gridW = cols * (cellW + padding) - padding;
  const gridH = rows * (cellH + labelHeight + padding) - padding;

  // Create base canvas
  const composites: sharp.OverlayOptions[] = [];

  for (let i = 0; i < images.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * (cellW + padding);
    const y = row * (cellH + labelHeight + padding);

    // Create label
    const labelSvg = `<svg width="${cellW}" height="${labelHeight}">
      <rect width="${cellW}" height="${labelHeight}" fill="#1a1a2e"/>
      <text x="${cellW / 2}" y="${labelHeight / 2 + 5}"
            text-anchor="middle" font-family="Arial,sans-serif" font-size="14"
            font-weight="bold" fill="#e0e0e0">${escapeSvgText(images[i].style)}</text>
    </svg>`;

    // Resize image to cell size
    const resized = await sharp(images[i].buffer)
      .resize(cellW, cellH, { fit: 'contain', background: { r: 26, g: 26, b: 46, alpha: 1 } })
      .png()
      .toBuffer();

    composites.push({ input: Buffer.from(labelSvg), left: x, top: y });
    composites.push({ input: resized, left: x, top: y + labelHeight });
  }

  await sharp({
    create: {
      width: gridW,
      height: gridH,
      channels: 4,
      background: { r: 26, g: 26, b: 46, alpha: 255 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

// =============================================================================
// 3. TEXTURE SWAP — Replace a region in an image with AI content
// =============================================================================

export interface TextureSwapParams {
  image_path: string;
  region: { x: number; y: number; width: number; height: number };
  prompt: string;
  output_path: string;
  model?: string;
  style?: string;
  style_id?: string;
  negative_prompt?: string;
  feather?: number;
}

export async function textureSwap(params: TextureSwapParams): Promise<string> {
  const {
    image_path,
    region,
    prompt,
    output_path,
    model = 'recraftv4',
    style,
    style_id,
    negative_prompt,
    feather = 0,
  } = params;

  // Validate inputs
  validateFilePath(image_path);
  validatePrompt(prompt, model);
  validateModel(model);
  validateOutputPath(output_path);
  if (style) validateStyle(style);
  if (style && style_id) throw new Error('Cannot specify both style and style_id.');
  if (region.width < 1 || region.height < 1) throw new Error('Region width and height must be positive.');
  if (feather < 0 || feather > 64) throw new Error('Feather must be 0-64 pixels.');

  const steps: string[] = [];

  // Step 1: Read original image metadata
  const originalBuffer = readFileSync(image_path);
  const meta = await sharp(originalBuffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error(`Could not read image dimensions from: ${image_path}`);
  }
  const imgW = meta.width;
  const imgH = meta.height;

  // Clamp region to image bounds
  const rx = Math.max(0, Math.min(region.x, imgW - 1));
  const ry = Math.max(0, Math.min(region.y, imgH - 1));
  const rw = Math.min(region.width, imgW - rx);
  const rh = Math.min(region.height, imgH - ry);

  steps.push(`📐 Image: ${imgW}x${imgH} | Region: ${rw}x${rh} at (${rx},${ry})`);

  // Step 2: Generate replacement content at API-compatible size
  const apiSize = findBestApiSize(rw, rh);
  steps.push(`📐 Generating replacement at API size: ${apiSize}`);

  const resolvedSize = resolveSize(apiSize, model);
  const body: Record<string, any> = {
    prompt, model, size: resolvedSize, n: 1, response_format: 'url',
  };
  if (style) body.style = style;
  if (style_id) body.style_id = style_id;
  if (negative_prompt) body.negative_prompt = negative_prompt;

  const genResult = await recraftPost<GenerationResult>(ENDPOINTS.GENERATIONS, body);
  const genUrl = genResult.data[0]?.url;
  if (!genUrl) throw new Error('Generation returned no image URL.');
  steps.push('✅ Replacement content generated');

  // Step 3: Download and resize replacement to region size
  const genBuffer = await downloadToBuffer(genUrl);
  const resizedReplacement = await sharp(genBuffer)
    .resize(rw, rh, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  steps.push(`✅ Resized replacement to ${rw}x${rh}`);

  // Step 4: Composite onto original
  let compositeInput: Buffer = resizedReplacement;

  // Optional feathering: apply alpha gradient at edges
  if (feather > 0) {
    compositeInput = await applyFeather(resizedReplacement, rw, rh, feather);
    steps.push(`✅ Applied ${feather}px feather blend`);
  }

  const result = await sharp(originalBuffer)
    .composite([{
      input: compositeInput,
      left: rx,
      top: ry,
    }])
    .png()
    .toBuffer();

  writeFileSync(output_path, result);
  steps.push(`✅ Saved: ${output_path} (${(result.length / 1024).toFixed(1)} KB)`);

  return [
    '**Texture Swap Complete**',
    '',
    ...steps,
  ].join('\n');
}

async function applyFeather(
  imageBuffer: Buffer,
  width: number,
  height: number,
  featherPx: number,
): Promise<Buffer> {
  // Create an alpha mask with feathered edges
  const raw = Buffer.alloc(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distLeft = x;
      const distRight = width - 1 - x;
      const distTop = y;
      const distBottom = height - 1 - y;
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      const alpha = minDist >= featherPx ? 255 : Math.round((minDist / featherPx) * 255);
      raw[y * width + x] = alpha;
    }
  }

  // Extract channels from image, replace alpha with feathered mask
  const { data, info } = await sharp(imageBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Apply mask to alpha channel
  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 3] = raw[i];
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}
