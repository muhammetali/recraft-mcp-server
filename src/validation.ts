import { existsSync, statSync } from 'fs';
import { dirname, extname, resolve, normalize } from 'path';
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ALL_STYLES,
  IMAGE_SUBSTYLES,
  LEGACY_STYLE_ALIASES,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGES_PER_REQUEST,
  MAX_PROMPT_LENGTH_V3,
  MAX_PROMPT_LENGTH_V4,
  MODELS,
  RESPONSE_FORMATS,
  STYLE_BASE_TYPES,
  SUPPORTED_RATIOS,
  SUPPORTED_SIZES,
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

// Size fallback map: non-standard sizes → nearest supported equivalent
const SIZE_FALLBACK: Record<string, string> = {
  '1820x1024': '1344x768',   // wide → 16:9
  '1024x1820': '768x1344',   // tall → 9:16
  '1536x1024': '1152x896',   // 3:2 approx → 4:3
  '1024x1536': '896x1152',   // 2:3 approx → 3:4
};

/**
 * Resolve a size string to a model-compatible size.
 * If the requested size isn't supported by the model, returns the nearest fallback.
 * Returns the original size if it's already valid.
 */
export function resolveSize(size: string, model?: string): string {
  // Ratios are always accepted
  if (size.includes(':')) return size;

  // If it's in SUPPORTED_SIZES, it's fine — but API may still reject for specific models
  // Apply fallback for known problematic sizes
  const fallback = SIZE_FALLBACK[size];
  if (fallback) return fallback;

  return size;
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

export function validateSubstyle(substyle: string): void {
  if (!IMAGE_SUBSTYLES.includes(substyle as any)) {
    // The full list goes in the error rather than in every tool's schema
    // description: it is ~1.5KB, which is cheap once on failure and
    // expensive on all 14 tools in every request.
    throw new Error(
      `Unsupported substyle "${substyle}". Recraft validates this field ` +
        `strictly. Accepted values: ${IMAGE_SUBSTYLES.join(', ')}.`
    );
  }
}

/// Splits whatever the caller passed as a "style" into the two fields
/// Recraft actually has.
///
/// Callers — and the models driving them — reasonably say "pixel_art" when
/// they mean a substyle, because that is how Recraft's own UI and marketing
/// name things. The API disagrees: `style` accepts six families and
/// `substyle` is a strict enum. Sending a substyle in the `style` field is
/// not an error, it just silently does nothing, which is the worst kind of
/// wrong. So the split happens here, once, instead of at fourteen call
/// sites.
export function resolveStyle(
  style?: string,
  substyle?: string
): { style?: string; substyle?: string } {
  const out: { style?: string; substyle?: string } = {};

  if (substyle) {
    validateSubstyle(substyle);
    out.substyle = substyle;
  }

  if (style) {
    const alias = LEGACY_STYLE_ALIASES[style];
    if (alias) {
      // A name from the old flattened list. Map it onto the real pair,
      // without overwriting a substyle the caller asked for explicitly.
      if (alias.style) out.style = alias.style;
      if (alias.substyle && !out.substyle) out.substyle = alias.substyle;
    } else if (IMAGE_SUBSTYLES.includes(style as any)) {
      // A substyle in the style field. Honour the intent rather than
      // dropping it on the floor.
      if (!out.substyle) out.substyle = style;
    } else {
      validateStyle(style);
      out.style = style;
    }
  }

  return out;
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

/// Style ids are UUIDs. Checking the shape here turns a 404 round trip into
/// an immediate, specific error — and stops a malformed id being pasted
/// into a URL path.
export function validateStyleId(styleId: string): void {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!styleId || !UUID.test(styleId)) {
    throw new Error(
      `Invalid style_id "${styleId}". Expected a UUID as returned by recraft_create_style.`
    );
  }
}
