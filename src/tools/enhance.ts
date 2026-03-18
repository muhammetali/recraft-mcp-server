import { readFileSync } from 'fs';
import { basename } from 'path';
import { recraftPostMultipart } from '../client.js';
import { ENDPOINTS, UPLOAD_TIMEOUT_MS } from '../constants.js';
import { validateFilePath, validateResponseFormat, getMimeType } from '../validation.js';

interface SingleImageResult {
  image: { url: string };
}

function buildFileForm(filePath: string, fieldName: string, extraParams?: Record<string, string>): FormData {
  const formData = new FormData();
  const fileBuffer = readFileSync(filePath);
  const blob = new Blob([new Uint8Array(fileBuffer)], { type: getMimeType(filePath) });
  formData.append(fieldName, blob, basename(filePath));
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      formData.append(k, v);
    }
  }
  return formData;
}

// ─── Remove Background ─────────────────────────────────────────────────────

export async function removeBackground(
  filePath: string,
  responseFormat: string = 'url',
): Promise<string> {
  validateFilePath(filePath);
  validateResponseFormat(responseFormat);

  const formData = buildFileForm(filePath, 'file', { response_format: responseFormat });
  const result = await recraftPostMultipart<SingleImageResult>(
    ENDPOINTS.REMOVE_BACKGROUND, formData, UPLOAD_TIMEOUT_MS,
  );

  return [
    '**Background Removed**',
    `**URL:** ${result.image.url}`,
  ].join('\n');
}

// ─── Vectorize ──────────────────────────────────────────────────────────────

export async function vectorize(
  filePath: string,
  responseFormat: string = 'url',
): Promise<string> {
  validateFilePath(filePath);
  validateResponseFormat(responseFormat);

  const formData = buildFileForm(filePath, 'file', { response_format: responseFormat });
  const result = await recraftPostMultipart<SingleImageResult>(
    ENDPOINTS.VECTORIZE, formData, UPLOAD_TIMEOUT_MS,
  );

  return [
    '**Vectorized (SVG)**',
    `**URL:** ${result.image.url}`,
  ].join('\n');
}

// ─── Crisp Upscale ──────────────────────────────────────────────────────────

export async function crispUpscale(
  filePath: string,
  responseFormat: string = 'url',
): Promise<string> {
  validateFilePath(filePath);
  validateResponseFormat(responseFormat);

  const formData = buildFileForm(filePath, 'file', { response_format: responseFormat });
  const result = await recraftPostMultipart<SingleImageResult>(
    ENDPOINTS.CRISP_UPSCALE, formData, UPLOAD_TIMEOUT_MS,
  );

  return [
    '**Crisp Upscale Complete**',
    `**URL:** ${result.image.url}`,
  ].join('\n');
}

// ─── Creative Upscale ───────────────────────────────────────────────────────

export async function creativeUpscale(
  filePath: string,
  responseFormat: string = 'url',
): Promise<string> {
  validateFilePath(filePath);
  validateResponseFormat(responseFormat);

  const formData = buildFileForm(filePath, 'file', { response_format: responseFormat });
  const result = await recraftPostMultipart<SingleImageResult>(
    ENDPOINTS.CREATIVE_UPSCALE, formData, UPLOAD_TIMEOUT_MS,
  );

  return [
    '**Creative Upscale Complete**',
    `**URL:** ${result.image.url}`,
  ].join('\n');
}

// ─── Erase Region ───────────────────────────────────────────────────────────

export async function eraseRegion(
  filePath: string,
  maskPath: string,
  responseFormat: string = 'url',
): Promise<string> {
  validateFilePath(filePath);
  validateFilePath(maskPath);
  validateResponseFormat(responseFormat);

  const formData = new FormData();

  const fileBuffer = readFileSync(filePath);
  formData.append('image', new Blob([new Uint8Array(fileBuffer)], { type: getMimeType(filePath) }), basename(filePath));

  const maskBuffer = readFileSync(maskPath);
  formData.append('mask', new Blob([new Uint8Array(maskBuffer)], { type: getMimeType(maskPath) }), basename(maskPath));

  formData.append('response_format', responseFormat);

  const result = await recraftPostMultipart<SingleImageResult>(
    ENDPOINTS.ERASE_REGION, formData, UPLOAD_TIMEOUT_MS,
  );

  return [
    '**Region Erased**',
    `**URL:** ${result.image.url}`,
  ].join('\n');
}
