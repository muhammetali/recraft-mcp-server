#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from the package directory
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

// Tool implementations
import { checkCredits } from './tools/user.js';
import { generateImage, batchGenerate } from './tools/generate.js';
import {
  imageToImage, inpaint, replaceBackground,
  generateBackground, variateImage,
} from './tools/transform.js';
import {
  removeBackground, vectorize, crispUpscale,
  creativeUpscale, eraseRegion,
} from './tools/enhance.js';
import { createStyle } from './tools/styles.js';
import { downloadImage } from './tools/download.js';
import { generateAsset, batchGenerateAssets } from './tools/pipeline.js';

import { RecraftClientError } from './client.js';
import { MODELS, SUPPORTED_SIZES, SUPPORTED_RATIOS, ALL_STYLES, STYLE_BASE_TYPES } from './constants.js';

const server = new McpServer({
  name: 'recraft-mcp-server',
  version: '1.0.0',
  description: 'Recraft AI Image Generation MCP Server — Generate, transform, vectorize, upscale images with 16 tools.',
});

// ─── Error handling ─────────────────────────────────────────────────────────

function handleError(error: unknown): string {
  if (error instanceof RecraftClientError) {
    return `**Recraft API Error (${error.status}):** ${error.message}`;
  }
  if (error instanceof Error) {
    return `**Error:** ${error.message}`;
  }
  return `**Error:** ${String(error)}`;
}

// ─── Zod schemas for reuse ──────────────────────────────────────────────────

const modelSchema = z.string().default('recraftv4')
  .describe(`Model: ${MODELS.join(', ')}`);

const sizeSchema = z.string().default('1024x1024')
  .describe('Image size (e.g., 1024x1024, 1344x768) or ratio (e.g., 16:9, 1:1 for vector models)');

const nSchema = z.number().int().min(1).max(6).default(1)
  .describe('Number of images to generate (1-6)');

const responseFormatSchema = z.enum(['url', 'b64_json']).default('url')
  .describe('Response format');

const textLayoutSchema = z.array(z.object({
  text: z.string().describe('Text to render (single word)'),
  bbox: z.array(z.array(z.number().min(0).max(1))).length(4)
    .describe('4-point polygon with relative coordinates [0-1]'),
})).optional().describe('Text placement on image');

const controlsSchema = z.object({
  colors: z.array(z.array(z.number().int().min(0).max(255))).optional()
    .describe('Preferred color palette, e.g. [[255,0,0],[0,255,0]]'),
  background_color: z.object({
    r: z.number().int().min(0).max(255),
    g: z.number().int().min(0).max(255),
    b: z.number().int().min(0).max(255),
  }).optional().describe('Background color RGB (0-255)'),
  artistic_level: z.number().int().min(0).max(5).optional()
    .describe('Artistic level 0-5 (V3 only)'),
  no_text: z.boolean().optional()
    .describe('Exclude text layouts (V3 only)'),
}).optional().describe('Generation controls');

// =============================================================================
// 1. CHECK CREDITS
// =============================================================================

server.tool(
  'recraft_check_credits',
  'Check your Recraft account info and remaining API credits',
  {},
  async () => {
    try {
      const result = await checkCredits();
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 2. GENERATE IMAGE
// =============================================================================

server.tool(
  'recraft_generate_image',
  'Generate images from text prompt. Supports all Recraft models (V4, V4 Vector/SVG, V4 Pro, V3, V2), 70+ styles, color palette control, text layout, and multiple sizes. V4 Vector models produce SVG output.',
  {
    prompt: z.string().describe('Image description (max 10,000 chars for V4, 1,000 for V3/V2)'),
    model: modelSchema,
    size: sizeSchema,
    n: nSchema,
    style: z.string().optional()
      .describe('Style name (V3/V2 only). E.g., photorealism, illustration, vector_art, pixel_art, icon'),
    style_id: z.string().optional()
      .describe('Custom style UUID (from recraft_create_style). Cannot combine with style.'),
    negative_prompt: z.string().optional()
      .describe('What to exclude from the image'),
    response_format: responseFormatSchema,
    text_layout: textLayoutSchema,
    controls: controlsSchema,
  },
  async (params) => {
    try {
      const result = await generateImage(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 3. IMAGE TO IMAGE (V3 only)
// =============================================================================

server.tool(
  'recraft_image_to_image',
  'Transform an existing image with a text prompt. Adjustable strength controls how much the original is preserved. V3/V3 Vector models only.',
  {
    file_path: z.string().describe('Local path to source image (PNG/JPG/WEBP, max 5MB)'),
    prompt: z.string().describe('How to transform the image'),
    strength: z.number().min(0).max(1).default(0.5)
      .describe('Transform strength: 0=keep original, 1=fully regenerate'),
    model: z.string().default('recraftv3').describe('Model (V3 only)'),
    n: nSchema,
    style: z.string().optional().describe('Style name (V3 only)'),
    style_id: z.string().optional().describe('Custom style UUID'),
    negative_prompt: z.string().optional().describe('What to exclude'),
    response_format: responseFormatSchema,
    text_layout: textLayoutSchema,
    controls: controlsSchema,
  },
  async (params) => {
    try {
      const result = await imageToImage(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 4. INPAINT (V3 only)
// =============================================================================

server.tool(
  'recraft_inpaint',
  'Edit specific regions of an image using a mask. White mask areas are regenerated, black areas are preserved. V3/V3 Vector only.',
  {
    file_path: z.string().describe('Local path to source image'),
    mask_path: z.string().describe('Local path to mask image (white=inpaint, black=preserve)'),
    prompt: z.string().describe('What to generate in the masked region'),
    model: z.string().default('recraftv3').describe('Model (V3 only)'),
    n: nSchema,
    style: z.string().optional().describe('Style name'),
    style_id: z.string().optional().describe('Custom style UUID'),
    negative_prompt: z.string().optional().describe('What to exclude'),
    response_format: responseFormatSchema,
    text_layout: textLayoutSchema,
    controls: controlsSchema,
  },
  async (params) => {
    try {
      const result = await inpaint(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 5. REPLACE BACKGROUND (V3 only)
// =============================================================================

server.tool(
  'recraft_replace_background',
  'Replace the background of an image with AI-generated content. Keeps the subject, changes the scene. V3/V3 Vector only.',
  {
    file_path: z.string().describe('Local path to source image'),
    prompt: z.string().describe('Description of the new background'),
    model: z.string().default('recraftv3').describe('Model (V3 only)'),
    n: nSchema,
    style: z.string().optional().describe('Style name'),
    style_id: z.string().optional().describe('Custom style UUID'),
    negative_prompt: z.string().optional().describe('What to exclude'),
    response_format: responseFormatSchema,
    text_layout: textLayoutSchema,
    controls: controlsSchema,
  },
  async (params) => {
    try {
      const result = await replaceBackground(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 6. GENERATE BACKGROUND (V3 only)
// =============================================================================

server.tool(
  'recraft_generate_background',
  'Fill/expand the background of an image using a mask (outpainting). White mask = fill area, black = preserve. V3/V3 Vector only.',
  {
    file_path: z.string().describe('Local path to source image'),
    mask_path: z.string().describe('Local path to mask (white=fill, black=preserve)'),
    prompt: z.string().describe('Description of background to generate'),
    model: z.string().default('recraftv3').describe('Model (V3 only)'),
    n: nSchema,
    style: z.string().optional().describe('Style name'),
    style_id: z.string().optional().describe('Custom style UUID'),
    negative_prompt: z.string().optional().describe('What to exclude'),
    response_format: responseFormatSchema,
    text_layout: textLayoutSchema,
    controls: controlsSchema,
  },
  async (params) => {
    try {
      const result = await generateBackground(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 7. VARIATE IMAGE
// =============================================================================

server.tool(
  'recraft_variate_image',
  'Generate variations of an existing image. Produces similar but different versions.',
  {
    file_path: z.string().describe('Local path to source image'),
    size: z.string().describe('Output size (WxH format, required)'),
    n: nSchema,
    random_seed: z.number().int().optional().describe('Random seed for reproducibility'),
    response_format: responseFormatSchema,
    image_format: z.enum(['png', 'webp']).optional().describe('Output format'),
  },
  async (params) => {
    try {
      const result = await variateImage(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 8. REMOVE BACKGROUND
// =============================================================================

server.tool(
  'recraft_remove_background',
  'Remove the background from an image, producing a transparent PNG.',
  {
    file_path: z.string().describe('Local path to image (PNG/JPG/WEBP, max 5MB, 256-4096px)'),
    response_format: responseFormatSchema,
  },
  async ({ file_path, response_format }) => {
    try {
      const result = await removeBackground(file_path, response_format);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 9. VECTORIZE
// =============================================================================

server.tool(
  'recraft_vectorize',
  'Convert a raster image (PNG/JPG/WEBP) to SVG vector format.',
  {
    file_path: z.string().describe('Local path to raster image'),
    response_format: responseFormatSchema,
  },
  async ({ file_path, response_format }) => {
    try {
      const result = await vectorize(file_path, response_format);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 10. CRISP UPSCALE
// =============================================================================

server.tool(
  'recraft_crisp_upscale',
  'Upscale an image with sharp, clean enhancement. Best for graphics, icons, illustrations.',
  {
    file_path: z.string().describe('Local path to image (max 4MP, 32-4096px)'),
    response_format: responseFormatSchema,
  },
  async ({ file_path, response_format }) => {
    try {
      const result = await crispUpscale(file_path, response_format);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 11. CREATIVE UPSCALE
// =============================================================================

server.tool(
  'recraft_creative_upscale',
  'Upscale an image with AI-generated detail enhancement and face refinement. Best for photos and realistic images.',
  {
    file_path: z.string().describe('Local path to image (max 16MP, 256-4096px)'),
    response_format: responseFormatSchema,
  },
  async ({ file_path, response_format }) => {
    try {
      const result = await creativeUpscale(file_path, response_format);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 12. ERASE REGION
// =============================================================================

server.tool(
  'recraft_erase_region',
  'Content-aware removal of a region in an image using a mask. White mask areas are erased and filled naturally.',
  {
    file_path: z.string().describe('Local path to source image (max 4MP)'),
    mask_path: z.string().describe('Local path to mask (white=erase, black=preserve, same dimensions)'),
    response_format: responseFormatSchema,
  },
  async ({ file_path, mask_path, response_format }) => {
    try {
      const result = await eraseRegion(file_path, mask_path, response_format);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 13. CREATE STYLE (V3 only)
// =============================================================================

server.tool(
  'recraft_create_style',
  'Create a custom style from 1-5 reference images. Returns a style_id for use in generation tools. V3/V3 Vector only.',
  {
    style_base: z.enum(['any', 'realistic_image', 'digital_illustration', 'vector_illustration', 'icon'])
      .describe('Base style type'),
    file_paths: z.array(z.string()).min(1).max(5)
      .describe('Array of local paths to reference images (1-5 images)'),
  },
  async ({ style_base, file_paths }) => {
    try {
      const result = await createStyle(style_base, file_paths);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 14. DOWNLOAD IMAGE
// =============================================================================

server.tool(
  'recraft_download_image',
  'Download an image from a URL and save it to a local file. Useful for saving generated images.',
  {
    url: z.string().describe('Image URL to download'),
    output_path: z.string().describe('Local file path to save the image'),
  },
  async ({ url, output_path }) => {
    try {
      const result = await downloadImage(url, output_path);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 15. GENERATE ASSET (PIPELINE)
// =============================================================================

server.tool(
  'recraft_generate_asset',
  'Full asset pipeline: generate image → download → optionally remove background → save to file. Perfect for game assets, icons, and UI elements.',
  {
    prompt: z.string().describe('Image description'),
    output_path: z.string().describe('Where to save the final image'),
    size: sizeSchema,
    model: modelSchema,
    remove_bg: z.boolean().default(true).describe('Remove background after generation (default: true)'),
    style: z.string().optional().describe('Style name (V3/V2 only)'),
    negative_prompt: z.string().optional().describe('What to exclude'),
  },
  async (params) => {
    try {
      const result = await generateAsset(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// 16. BATCH GENERATE ASSETS (PIPELINE)
// =============================================================================

server.tool(
  'recraft_batch_generate',
  'Generate multiple assets in sequence with full pipeline (generate → bg remove → save). Each asset failure does not stop others. Includes 300ms rate limit delay between assets.',
  {
    assets: z.array(z.object({
      name: z.string().describe('Asset filename (without extension)'),
      prompt: z.string().describe('Image description'),
      output_dir: z.string().describe('Directory to save the asset'),
      size: z.string().optional().describe('Image size'),
      model: z.string().optional().describe('Model to use'),
      remove_bg: z.boolean().optional().describe('Remove background (default: true)'),
      style: z.string().optional().describe('Style name'),
      negative_prompt: z.string().optional().describe('What to exclude'),
    })).min(1).describe('Array of assets to generate'),
  },
  async ({ assets }) => {
    try {
      const result = await batchGenerateAssets(assets);
      return { content: [{ type: 'text', text: result }] };
    } catch (e) {
      return { content: [{ type: 'text', text: handleError(e) }], isError: true };
    }
  },
);

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
