import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { recraftPost, recraftPostMultipart, downloadToBuffer } from '../client.js';
import { ENDPOINTS, BATCH_DELAY_MS } from '../constants.js';
import { validatePrompt, validateSize, validateModel, validateOutputPath } from '../validation.js';

interface GenerationResult {
  data: Array<{ image_id: string; url: string }>;
}

interface BgRemoveResult {
  image: { url: string };
}

export interface GenerateAssetParams {
  prompt: string;
  output_path: string;
  size?: string;
  model?: string;
  remove_bg?: boolean;
  style?: string;
  negative_prompt?: string;
}

export async function generateAsset(params: GenerateAssetParams): Promise<string> {
  const {
    prompt,
    output_path,
    size = '1024x1024',
    model = 'recraftv4',
    remove_bg = true,
    style,
    negative_prompt,
  } = params;

  validatePrompt(prompt, model);
  validateSize(size);
  validateModel(model);
  validateOutputPath(output_path);

  const steps: string[] = [];

  // Step 1: Generate
  const body: Record<string, any> = { prompt, model, size, n: 1, response_format: 'url' };
  if (style) body.style = style;
  if (negative_prompt) body.negative_prompt = negative_prompt;

  const genResult = await recraftPost<GenerationResult>(ENDPOINTS.GENERATIONS, body);
  const imageUrl = genResult.data[0]?.url;
  if (!imageUrl) throw new Error('Generation returned no image URL.');
  steps.push('✅ Image generated');

  // Step 2: Download
  const imageBuffer = await downloadToBuffer(imageUrl);
  steps.push(`✅ Downloaded (${(imageBuffer.length / 1024).toFixed(1)} KB)`);

  if (remove_bg) {
    // Step 3: Remove background
    const tempPath = join(dirname(output_path), `_temp_${Date.now()}.png`);
    try {
      writeFileSync(tempPath, imageBuffer);

      const formData = new FormData();
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      formData.append('file', blob, 'temp.png');
      formData.append('response_format', 'url');

      const bgResult = await recraftPostMultipart<BgRemoveResult>(
        ENDPOINTS.REMOVE_BACKGROUND, formData,
      );

      const transparentBuffer = await downloadToBuffer(bgResult.image.url);
      writeFileSync(output_path, transparentBuffer);
      steps.push(`✅ Background removed (${(transparentBuffer.length / 1024).toFixed(1)} KB)`);
    } catch (bgError) {
      // Fallback: save original
      writeFileSync(output_path, imageBuffer);
      steps.push(`⚠️ BG removal failed, saved original: ${bgError instanceof Error ? bgError.message : String(bgError)}`);
    } finally {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }
  } else {
    writeFileSync(output_path, imageBuffer);
  }

  steps.push(`✅ Saved to: ${output_path}`);

  return [
    '**Asset Pipeline Complete**',
    '',
    ...steps,
  ].join('\n');
}

export interface BatchAssetItem {
  name: string;
  prompt: string;
  output_dir: string;
  size?: string;
  model?: string;
  remove_bg?: boolean;
  style?: string;
  negative_prompt?: string;
}

export async function batchGenerateAssets(assets: BatchAssetItem[]): Promise<string> {
  if (!assets || assets.length === 0) {
    throw new Error('Assets array cannot be empty.');
  }

  const results: Array<{ name: string; status: 'success' | 'error'; path?: string; error?: string }> = [];

  for (const asset of assets) {
    try {
      const outputPath = join(asset.output_dir, `${asset.name}.png`);
      await generateAsset({
        prompt: asset.prompt,
        output_path: outputPath,
        size: asset.size,
        model: asset.model,
        remove_bg: asset.remove_bg ?? true,
        style: asset.style,
        negative_prompt: asset.negative_prompt,
      });
      results.push({ name: asset.name, status: 'success', path: outputPath });
    } catch (e) {
      results.push({
        name: asset.name,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }

    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
  }

  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');

  const lines = [
    '**Batch Asset Pipeline Complete**',
    '',
    `✅ Success: ${success.length} | ❌ Failed: ${failed.length} | Total: ${assets.length}`,
    '',
  ];

  if (success.length > 0) {
    lines.push('**Successful:**');
    for (const r of success) {
      lines.push(`- ${r.name} → ${r.path}`);
    }
  }

  if (failed.length > 0) {
    lines.push('\n**Failed:**');
    for (const r of failed) {
      lines.push(`- ${r.name}: ${r.error}`);
    }
  }

  return lines.join('\n');
}
