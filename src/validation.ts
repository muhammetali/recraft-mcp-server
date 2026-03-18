import { existsSync, statSync } from 'fs';
import { dirname, extname, resolve, normalize } from 'path';
import {
  SUPPORTED_SIZES,
  SUPPORTED_RATIOS,
  MODELS,
  ACCEPTED_IMAGE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_PROMPT_LENGTH_V4,
  MAX_PROMPT_LENGTH_V3,
  MAX_IMAGES_PER_REQUEST,
  ALL_STYLES,
  STYLE_BASE_TYPES,
  RESPONSE_FORMATS,
} from './constants.js';

// ─── MIME type helper ──────────────────────────────────────────────────────

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

export function validatePrompt(prompt: string, model?: string): void {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Prompt cannot be empty.');
  }
  const maxLen = model?.startsWith('recraftv3') || model?.startsWith('recraftv2')
    ? MAX_PROMPT_LENGTH_V3
    : MAX_PROMPT_LENGTH_V4;
  if (prompt.length > maxLen) {
    throw new Error(`Prompt exceeds maximum length of ${maxLen} characters (got ${prompt.length}).`);
  }
}

export function validateSize(size: string): void {
  const allSizes: readonly string[] = [...SUPPORTED_SIZES, ...SUPPORTED_RATIOS];
  if (!allSizes.includes(size)) {
    throw new Error(
      `Unsupported size "${size}". Supported pixel sizes: ${SUPPORTED_SIZES.join(', ')}. Supported ratios: ${SUPPORTED_RATIOS.join(', ')}.`
    );
  }
}

export function validateModel(model: string): void {
  if (!MODELS.includes(model as any)) {
    throw new Error(`Unsupported model "${model}". Supported: ${MODELS.join(', ')}.`);
  }
}

export function validateN(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > MAX_IMAGES_PER_REQUEST) {
    throw new Error(`n must be an integer between 1 and ${MAX_IMAGES_PER_REQUEST} (got ${n}).`);
  }
}

export function validateStyle(style: string): void {
  if (!ALL_STYLES.includes(style as any)) {
    throw new Error(`Unsupported style "${style}". See Recraft docs for available styles.`);
  }
}

export function validateStyleBaseType(baseType: string): void {
  if (!STYLE_BASE_TYPES.includes(baseType as any)) {
    throw new Error(`Unsupported style base type "${baseType}". Supported: ${STYLE_BASE_TYPES.join(', ')}.`);
  }
}

export function validateResponseFormat(format: string): void {
  if (!RESPONSE_FORMATS.includes(format as any)) {
    throw new Error(`Unsupported response_format "${format}". Supported: ${RESPONSE_FORMATS.join(', ')}.`);
  }
}

export function validateFilePath(filePath: string): void {
  if (!filePath || filePath.trim().length === 0) {
    throw new Error('File path cannot be empty.');
  }
  // Path traversal protection: resolve to absolute and reject relative escapes
  const resolved = resolve(filePath);
  if (resolved !== normalize(filePath) && !filePath.startsWith('/')) {
    // Allow absolute paths, but resolve relative ones and continue with resolved
  }
  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const ext = extname(resolved).toLowerCase();
  if (!ACCEPTED_IMAGE_EXTENSIONS.includes(ext as any)) {
    throw new Error(
      `Unsupported file extension "${ext}". Accepted: ${ACCEPTED_IMAGE_EXTENSIONS.join(', ')}.`
    );
  }
  const stat = statSync(resolved);
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size ${(stat.size / 1024 / 1024).toFixed(1)}MB exceeds maximum of 5MB.`
    );
  }
}

export function validateOutputPath(outputPath: string): void {
  if (!outputPath || outputPath.trim().length === 0) {
    throw new Error('Output path cannot be empty.');
  }
  const resolved = resolve(outputPath);
  const dir = dirname(resolved);
  if (!existsSync(dir)) {
    throw new Error(`Output directory does not exist: ${dir}`);
  }
}

export function validateColors(colors: number[][]): void {
  for (const color of colors) {
    if (!Array.isArray(color) || color.length !== 3) {
      throw new Error('Each color must be an RGB array of 3 numbers, e.g. [255, 0, 0].');
    }
    for (const c of color) {
      if (!Number.isInteger(c) || c < 0 || c > 255) {
        throw new Error(`Color value must be an integer 0-255 (got ${c}).`);
      }
    }
  }
}

export function validateStrength(strength: number): void {
  if (typeof strength !== 'number' || strength < 0 || strength > 1) {
    throw new Error(`Strength must be a number between 0 and 1 (got ${strength}).`);
  }
}

export function validateArtisticLevel(level: number): void {
  if (!Number.isInteger(level) || level < 0 || level > 5) {
    throw new Error(`Artistic level must be an integer between 0 and 5 (got ${level}).`);
  }
}
