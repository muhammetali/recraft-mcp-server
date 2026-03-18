import { recraftPost } from '../client.js';
import { ENDPOINTS, BATCH_DELAY_MS } from '../constants.js';
import {
  validatePrompt,
  validateSize,
  validateModel,
  validateN,
  validateStyle,
  validateColors,
  validateArtisticLevel,
  validateResponseFormat,
} from '../validation.js';

export interface TextLayout {
  text: string;
  bbox: number[][];
}

export interface GenerateControls {
  colors?: number[][];
  background_color?: { r: number; g: number; b: number };
  artistic_level?: number;
  no_text?: boolean;
}

export interface GenerateImageParams {
  prompt: string;
  model?: string;
  size?: string;
  n?: number;
  style?: string;
  style_id?: string;
  negative_prompt?: string;
  response_format?: string;
  text_layout?: TextLayout[];
  controls?: GenerateControls;
}

interface GenerationResult {
  data: Array<{ image_id: string; url: string }>;
}

export async function generateImage(params: GenerateImageParams): Promise<string> {
  const {
    prompt,
    model = 'recraftv4',
    size = '1024x1024',
    n = 1,
    style,
    style_id,
    negative_prompt,
    response_format = 'url',
    text_layout,
    controls,
  } = params;

  validatePrompt(prompt, model);
  validateModel(model);
  validateSize(size);
  validateN(n);
  if (response_format) validateResponseFormat(response_format);
  if (style) validateStyle(style);
  if (controls?.colors) validateColors(controls.colors);
  if (controls?.artistic_level !== undefined) validateArtisticLevel(controls.artistic_level);

  if (style && style_id) {
    throw new Error('Cannot specify both style and style_id. Use one or the other.');
  }

  const body: Record<string, any> = {
    prompt,
    model,
    size,
    n,
    response_format,
  };

  if (style) body.style = style;
  if (style_id) body.style_id = style_id;
  if (negative_prompt) body.negative_prompt = negative_prompt;
  if (text_layout) body.text_layout = text_layout;
  if (controls) body.controls = controls;

  const result = await recraftPost<GenerationResult>(ENDPOINTS.GENERATIONS, body);

  const lines = [`**Generated ${result.data.length} image(s)**\n`];
  for (let i = 0; i < result.data.length; i++) {
    const img = result.data[i];
    lines.push(`${i + 1}. **ID:** ${img.image_id}`);
    lines.push(`   **URL:** ${img.url}\n`);
  }
  lines.push(`Model: ${model} | Size: ${size}`);

  return lines.join('\n');
}

export interface BatchAsset {
  name: string;
  prompt: string;
  output_dir?: string;
  size?: string;
  model?: string;
  style?: string;
  remove_bg?: boolean;
}

export async function batchGenerate(assets: BatchAsset[]): Promise<string> {
  if (!assets || assets.length === 0) {
    throw new Error('Assets array cannot be empty.');
  }

  const results: Array<{ name: string; status: 'success' | 'error'; url?: string; error?: string }> = [];

  for (const asset of assets) {
    try {
      validatePrompt(asset.prompt, asset.model);
      if (asset.size) validateSize(asset.size);
      if (asset.model) validateModel(asset.model);

      const body: Record<string, any> = {
        prompt: asset.prompt,
        model: asset.model || 'recraftv4',
        size: asset.size || '1024x1024',
        n: 1,
        response_format: 'url',
      };
      if (asset.style) body.style = asset.style;

      const result = await recraftPost<GenerationResult>(ENDPOINTS.GENERATIONS, body);
      results.push({
        name: asset.name,
        status: 'success',
        url: result.data[0]?.url,
      });
    } catch (e) {
      results.push({
        name: asset.name,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Rate limit delay between requests
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
  }

  const success = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'error');

  const lines = [`**Batch Generation Complete**\n`];
  lines.push(`✅ Success: ${success.length} | ❌ Failed: ${failed.length} | Total: ${assets.length}\n`);

  if (success.length > 0) {
    lines.push('**Successful:**');
    for (const r of success) {
      lines.push(`- ${r.name}: ${r.url}`);
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
