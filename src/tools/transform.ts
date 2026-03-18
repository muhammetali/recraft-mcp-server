import { readFileSync } from 'fs';
import { basename } from 'path';
import { recraftPostMultipart } from '../client.js';
import { ENDPOINTS, UPLOAD_TIMEOUT_MS } from '../constants.js';
import {
  validatePrompt,
  validateFilePath,
  validateSize,
  validateModel,
  validateN,
  validateStyle,
  validateStrength,
  validateResponseFormat,
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
  const blob = new Blob([fileBuffer], { type: 'image/png' });
  formData.append(fieldName, blob, basename(filePath));

  if (maskPath) {
    const maskBuffer = readFileSync(maskPath);
    const maskBlob = new Blob([maskBuffer], { type: 'image/png' });
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
