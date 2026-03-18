import { writeFileSync } from 'fs';
import { downloadToBuffer } from '../client.js';
import { validateOutputPath } from '../validation.js';

export async function downloadImage(url: string, outputPath: string): Promise<string> {
  if (!url || url.trim().length === 0) {
    throw new Error('URL cannot be empty.');
  }
  validateOutputPath(outputPath);

  const buffer = await downloadToBuffer(url);
  writeFileSync(outputPath, buffer);

  const sizeKB = (buffer.length / 1024).toFixed(1);
  return [
    '**Image Downloaded**',
    `**Path:** ${outputPath}`,
    `**Size:** ${sizeKB} KB`,
  ].join('\n');
}
