import { recraftPost } from '../client.js';
import { ENDPOINTS } from '../constants.js';
import { validatePrompt, validateModel, validateResponseFormat, validateSize } from '../validation.js';
import type { GenerationResult } from '../types.js';
import type { GenerateControls } from './generate.js';

// ─── Explore ────────────────────────────────────────────────────────────────

export interface ExploreParams {
  prompt: string;
  model?: string;
  size?: string;
  response_format?: string;
  controls?: GenerateControls;
}

export async function explore(params: ExploreParams): Promise<string> {
  const {
    prompt,
    model = 'recraftv4_1',
    size = '1:1',
    response_format = 'url',
    controls,
  } = params;

  validatePrompt(prompt, model);
  validateModel(model);
  validateSize(size);
  if (response_format) validateResponseFormat(response_format);

  const body: Record<string, any> = { prompt, model, size, response_format };
  if (controls) body.controls = controls;

  const result = await recraftPost<GenerationResult>(ENDPOINTS.EXPLORE, body);

  const lines = [`**Explore — ${result.data.length} image(s)**\n`];
  for (let i = 0; i < result.data.length; i++) {
    const img = result.data[i];
    lines.push(`${i + 1}. **ID:** ${img.image_id}`);
    lines.push(`   **URL:** ${img.url}\n`);
  }
  lines.push('Use an image ID above with recraft_explore_similar to generate visually similar variations.');
  return lines.join('\n');
}

// ─── Explore Similar ────────────────────────────────────────────────────────

export interface ExploreSimilarParams {
  source_image_id: string;
  similarity: number;
  response_format?: string;
}

export async function exploreSimilar(params: ExploreSimilarParams): Promise<string> {
  const { source_image_id, similarity, response_format = 'url' } = params;

  if (!source_image_id || source_image_id.trim().length === 0) {
    throw new Error('source_image_id cannot be empty.');
  }
  if (!Number.isInteger(similarity) || similarity < 1 || similarity > 5) {
    throw new Error(`similarity must be an integer between 1 and 5 (got ${similarity}).`);
  }
  if (response_format) validateResponseFormat(response_format);

  const body: Record<string, any> = { source_image_id, similarity, response_format };

  const result = await recraftPost<GenerationResult>(ENDPOINTS.EXPLORE_SIMILAR, body);

  const lines = [`**Explore Similar — ${result.data.length} image(s)**\n`];
  for (let i = 0; i < result.data.length; i++) {
    const img = result.data[i];
    lines.push(`${i + 1}. **ID:** ${img.image_id}`);
    lines.push(`   **URL:** ${img.url}\n`);
  }
  return lines.join('\n');
}

// ─── Enhance Prompt ─────────────────────────────────────────────────────────

const MAX_ENHANCE_PROMPT_LENGTH = 2000;

export async function enhancePrompt(prompt: string): Promise<string> {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error('Prompt cannot be empty.');
  }
  if (prompt.length > MAX_ENHANCE_PROMPT_LENGTH) {
    throw new Error(`Prompt exceeds maximum length of ${MAX_ENHANCE_PROMPT_LENGTH} characters (got ${prompt.length}).`);
  }

  const result = await recraftPost<{ enhanced_prompt: string }>(ENDPOINTS.ENHANCE_PROMPT, { prompt });

  return ['**Enhanced Prompt**', result.enhanced_prompt].join('\n\n');
}
