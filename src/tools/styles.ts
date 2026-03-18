import { readFileSync } from 'fs';
import { basename } from 'path';
import { recraftPostMultipart } from '../client.js';
import { ENDPOINTS, UPLOAD_TIMEOUT_MS } from '../constants.js';
import { validateFilePath, validateStyleBaseType, getMimeType } from '../validation.js';

interface CreateStyleResult {
  id: string;
}

export async function createStyle(
  styleBase: string,
  filePaths: string[],
): Promise<string> {
  validateStyleBaseType(styleBase);

  if (!filePaths || filePaths.length === 0) {
    throw new Error('At least one reference image is required.');
  }
  if (filePaths.length > 5) {
    throw new Error('Maximum 5 reference images allowed.');
  }

  for (const fp of filePaths) {
    validateFilePath(fp);
  }

  const formData = new FormData();
  formData.append('style', styleBase);

  for (const fp of filePaths) {
    const buf = readFileSync(fp);
    const blob = new Blob([new Uint8Array(buf)], { type: getMimeType(fp) });
    formData.append('files', blob, basename(fp));
  }

  const result = await recraftPostMultipart<CreateStyleResult>(
    ENDPOINTS.STYLES, formData, UPLOAD_TIMEOUT_MS,
  );

  return [
    '**Custom Style Created**',
    `**Style ID:** ${result.id}`,
    `**Base Type:** ${styleBase}`,
    `**Reference Images:** ${filePaths.length}`,
    '',
    'Use this style_id in generate_image or other tools to apply your custom style.',
  ].join('\n');
}
