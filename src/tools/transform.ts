import { readFileSync } from 'fs';
import { basename } from 'path';
import { recraftPostMultipart } from '../client.js';
import { ENDPOINTS, UPLOAD_TIMEOUT_MS, MAX_DIMENSION_PX } from '../constants.js';
import {
  validatePrompt,
  validateFilePath,
  validateSize,
  validateModel,
  validateN,
  validateStyle,
  validateStrength,
  validateResponseFormat,
  getMimeType,
} from '../validation.js';
import type { GenerateControls, TextLayout } from './generate.js';

interface TransformResult {
  data: Array<{ image_id: string; url: string }>;
}

function buildMultipartForm(
  filePath: string,
  fieldName: string,
  params: Record<string, any>,
  maskPath?: string,
): FormData {
  const formData = new FormData();

  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: getMimeType(filePath) });
  formData.append(fieldName, blob, basename(filePath));

  if (maskPath) {
    const maskBuffer = readFileSync(maskPath);
    const maskBlob = new Blob([new Uint8Array(maskBuffer)], { type: getMimeType(maskPath) });
    formData.append('mask', maskBlob, basename(maskPath));
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  }

  return formData;
}

function formatTransformResult(result: TransformResult, operation: string): string {
  const lines = [`**${operation} Complete — ${result.data.length} image(s)**\n`];
  for (let i = 0; i < result.data.length; i++) {
    const img = result.data[i];
    lines.push(`${i + 1}. **ID:** ${img.image_id}`);
    lines.push(`   **URL:** ${img.url}\n`);
  }
  return lines.join('\n');
}

// ─── Image to Image (V3 only) ──────────────────────────────────────────────

export interface ImageToImageParams {
  file_path: string;
  prompt: string;
  strength?: number;
  model?: string;
  n?: number;
  style?: string;
  style_id?: string;
  negative_prompt?: string;
  response_format?: string;
  text_layout?: TextLayout[];
  controls?: GenerateControls;
}

export async function imageToImage(params: ImageToImageParams): Promise<string> {
  const {
    file_path,
    prompt,
    strength = 0.5,
    model = 'recraftv3',
    n = 1,
    style,
    style_id,
    negative_prompt,
    response_format = 'url',
    text_layout,
    controls,
  } = params;

  validateFilePath(file_path);
  validatePrompt(prompt, model);
  validateStrength(strength);
  validateModel(model);
  validateN(n);
  if (response_format) validateResponseFormat(response_format);
  if (style) validateStyle(style);

  const formParams: Record<string, any> = {
    prompt,
    strength,
    model,
    n,
    response_format,
  };
  if (style) formParams.style = style;
  if (style_id) formParams.style_id = style_id;
  if (negative_prompt) formParams.negative_prompt = negative_prompt;
  if (text_layout) formParams.text_layout = text_layout;
  if (controls) formParams.controls = controls;

  const formData = buildMultipartForm(file_path, 'image', formParams);
  const result = await recraftPostMultipart<TransformResult>(ENDPOINTS.IMAGE_TO_IMAGE, formData, UPLOAD_TIMEOUT_MS);
  return formatTransformResult(result, 'Image-to-Image');
}

// ─── Inpaint (V3 only) ────────────────────────────────────────────────────

export interface InpaintParams {
  file_path: string;
  mask_path: string;
  prompt: string;
  model?: string;
  n?: number;
  style?: string;
  style_id?: string;
  negative_prompt?: string;
  response_format?: string;
  text_layout?: TextLayout[];
  controls?: GenerateControls;
}

export async function inpaint(params: InpaintParams): Promise<string> {
  const {
    file_path,
    mask_path,
    prompt,
    model = 'recraftv3',
    n = 1,
    style,
    style_id,
    negative_prompt,
    response_format = 'url',
    text_layout,
    controls,
  } = params;

  validateFilePath(file_path);
  validateFilePath(mask_path);
  validatePrompt(prompt, model);
  validateModel(model);
  validateN(n);
  if (response_format) validateResponseFormat(response_format);
  if (style) validateStyle(style);

  const formParams: Record<string, any> = {
    prompt, model, n, response_format,
  };
  if (style) formParams.style = style;
  if (style_id) formParams.style_id = style_id;
  if (negative_prompt) formParams.negative_prompt = negative_prompt;
  if (text_layout) formParams.text_layout = text_layout;
  if (controls) formParams.controls = controls;

  const formData = buildMultipartForm(file_path, 'image', formParams, mask_path);
  const result = await recraftPostMultipart<TransformResult>(ENDPOINTS.INPAINT, formData, UPLOAD_TIMEOUT_MS);
  return formatTransformResult(result, 'Inpaint');
}

// ─── Replace Background (V3 only) ──────────────────────────────────────────

export interface ReplaceBackgroundParams {
  file_path: string;
  prompt: string;
  model?: string;
  n?: number;
  style?: string;
  style_id?: string;
  negative_prompt?: string;
  response_format?: string;
  text_layout?: TextLayout[];
  controls?: GenerateControls;
}

export async function replaceBackground(params: ReplaceBackgroundParams): Promise<string> {
  const {
    file_path,
    prompt,
    model = 'recraftv3',
    n = 1,
    style,
    style_id,
    negative_prompt,
    response_format = 'url',
    text_layout,
    controls,
  } = params;

  validateFilePath(file_path);
  validatePrompt(prompt, model);
  validateModel(model);
  validateN(n);
  if (response_format) validateResponseFormat(response_format);
  if (style) validateStyle(style);

  const formParams: Record<string, any> = {
    prompt, model, n, response_format,
  };
  if (style) formParams.style = style;
  if (style_id) formParams.style_id = style_id;
  if (negative_prompt) formParams.negative_prompt = negative_prompt;
  if (text_layout) formParams.text_layout = text_layout;
  if (controls) formParams.controls = controls;

  const formData = buildMultipartForm(file_path, 'image', formParams);
  const result = await recraftPostMultipart<TransformResult>(ENDPOINTS.REPLACE_BACKGROUND, formData, UPLOAD_TIMEOUT_MS);
  return formatTransformResult(result, 'Replace Background');
}

// ─── Generate Background (V3 only) ─────────────────────────────────────────

export interface GenerateBackgroundParams {
  file_path: string;
  mask_path: string;
  prompt: string;
  model?: string;
  n?: number;
  style?: string;
  style_id?: string;
  negative_prompt?: string;
  response_format?: string;
  text_layout?: TextLayout[];
  controls?: GenerateControls;
}

export async function generateBackground(params: GenerateBackgroundParams): Promise<string> {
  const {
    file_path,
    mask_path,
    prompt,
    model = 'recraftv3',
    n = 1,
    style,
    style_id,
    negative_prompt,
    response_format = 'url',
    text_layout,
    controls,
  } = params;

  validateFilePath(file_path);
  validateFilePath(mask_path);
  validatePrompt(prompt, model);
  validateModel(model);
  validateN(n);
  if (response_format) validateResponseFormat(response_format);
  if (style) validateStyle(style);

  const formParams: Record<string, any> = {
    prompt, model, n, response_format,
  };
  if (style) formParams.style = style;
  if (style_id) formParams.style_id = style_id;
  if (negative_prompt) formParams.negative_prompt = negative_prompt;
  if (text_layout) formParams.text_layout = text_layout;
  if (controls) formParams.controls = controls;

  const formData = buildMultipartForm(file_path, 'image', formParams, mask_path);
  const result = await recraftPostMultipart<TransformResult>(ENDPOINTS.GENERATE_BACKGROUND, formData, UPLOAD_TIMEOUT_MS);
  return formatTransformResult(result, 'Generate Background');
}

// ─── Outpaint (V3 only) — canvas expansion, distinct from Generate Background ─

export interface OutpaintParams {
  file_path: string;
  prompt: string;
  size?: string;
  expand_left?: number;
  expand_right?: number;
  expand_top?: number;
  expand_bottom?: number;
  zoom_out_percentage?: number;
  model?: string;
  n?: number;
  style?: string;
  style_id?: string;
  negative_prompt?: string;
  response_format?: string;
  text_layout?: TextLayout[];
  controls?: GenerateControls;
}

export async function outpaint(params: OutpaintParams): Promise<string> {
  const {
    file_path,
    prompt,
    size,
    expand_left,
    expand_right,
    expand_top,
    expand_bottom,
    zoom_out_percentage,
    model = 'recraftv3',
    n = 1,
    style,
    style_id,
    negative_prompt,
    response_format = 'url',
    text_layout,
    controls,
  } = params;

  validateFilePath(file_path);
  validatePrompt(prompt, model);
  validateModel(model);
  validateN(n);
  if (response_format) validateResponseFormat(response_format);
  if (style) validateStyle(style);
  if (size) validateSize(size);

  const expandFields = { expand_left, expand_right, expand_top, expand_bottom };
  const hasExpand = Object.values(expandFields).some((v) => v !== undefined);
  if (size && hasExpand) {
    throw new Error('Cannot combine size with expand_left/expand_right/expand_top/expand_bottom. Use one or the other.');
  }
  if (!size && !hasExpand && zoom_out_percentage === undefined) {
    throw new Error('At least one of size, expand_left/right/top/bottom, or zoom_out_percentage must be specified.');
  }
  for (const [name, value] of Object.entries(expandFields)) {
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > MAX_DIMENSION_PX)) {
      throw new Error(`${name} must be an integer between 0 and ${MAX_DIMENSION_PX} (got ${value}).`);
    }
  }
  if (zoom_out_percentage !== undefined && (zoom_out_percentage < 0 || zoom_out_percentage >= 100)) {
    throw new Error(`zoom_out_percentage must be in range [0, 100) (got ${zoom_out_percentage}).`);
  }

  const formParams: Record<string, any> = {
    prompt, model, n, response_format,
  };
  if (size) formParams.size = size;
  if (expand_left !== undefined) formParams.expand_left = expand_left;
  if (expand_right !== undefined) formParams.expand_right = expand_right;
  if (expand_top !== undefined) formParams.expand_top = expand_top;
  if (expand_bottom !== undefined) formParams.expand_bottom = expand_bottom;
  if (zoom_out_percentage !== undefined) formParams.zoom_out_percentage = zoom_out_percentage;
  if (style) formParams.style = style;
  if (style_id) formParams.style_id = style_id;
  if (negative_prompt) formParams.negative_prompt = negative_prompt;
  if (text_layout) formParams.text_layout = text_layout;
  if (controls) formParams.controls = controls;

  const formData = buildMultipartForm(file_path, 'image', formParams);
  const result = await recraftPostMultipart<TransformResult>(ENDPOINTS.OUTPAINT, formData, UPLOAD_TIMEOUT_MS);
  return formatTransformResult(result, 'Outpaint');
}

// ─── Variate Image ─────────────────────────────────────────────────────────

export interface VariateImageParams {
  file_path: string;
  size: string;
  n?: number;
  random_seed?: number;
  response_format?: string;
  image_format?: 'png' | 'webp';
}

export async function variateImage(params: VariateImageParams): Promise<string> {
  const {
    file_path,
    size,
    n = 1,
    random_seed,
    response_format = 'url',
    image_format,
  } = params;

  validateFilePath(file_path);
  validateSize(size);
  validateN(n);
  if (response_format) validateResponseFormat(response_format);

  const formParams: Record<string, any> = {
    size, n, response_format,
  };
  if (random_seed !== undefined) formParams.random_seed = random_seed;
  if (image_format) formParams.image_format = image_format;

  const formData = buildMultipartForm(file_path, 'image', formParams);
  const result = await recraftPostMultipart<TransformResult>(ENDPOINTS.VARIATE_IMAGE, formData, UPLOAD_TIMEOUT_MS);
  return formatTransformResult(result, 'Variate Image');
}
