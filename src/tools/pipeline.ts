import { writeFileSync, unlinkSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { dirname, join, basename } from 'path';
import { recraftPost, recraftPostMultipart, downloadToBuffer } from '../client.js';
import { ENDPOINTS, BATCH_DELAY_MS } from '../constants.js';
import { validatePrompt, validateSize, validateModel, validateOutputPath, getMimeType, resolveSize } from '../validation.js';

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
  const resolvedSize = resolveSize(size, model);
  const body: Record<string, any> = { prompt, model, size: resolvedSize, n: 1, response_format: 'url' };
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
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
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

// ─── Themed Set Generation ──────────────────────────────────────────────────

interface CreateStyleResult {
  id: string;
}

export interface ThemedSetSymbol {
  name: string;
  prompt_detail: string;
}

export interface GenerateThemedSetParams {
  theme: string;
  prompt_suffix: string;
  symbols: ThemedSetSymbol[];
  output_dir: string;
  size?: string;
  remove_bg?: boolean;
  bg_prompt?: string;
  bg_size?: string;
  generate_manifest?: boolean;
}

export async function generateThemedSet(params: GenerateThemedSetParams): Promise<string> {
  const {
    theme,
    prompt_suffix,
    symbols,
    output_dir,
    size = '1024x1024',
    remove_bg = true,
    bg_prompt,
    bg_size = '1344x768',
    generate_manifest = true,
  } = params;

  if (!symbols || symbols.length === 0) {
    throw new Error('Symbols array cannot be empty.');
  }
  if (!theme || theme.trim().length === 0) {
    throw new Error('Theme cannot be empty.');
  }
  validateSize(size);
  if (bg_prompt && bg_size) validateSize(bg_size);

  // Ensure output directories exist
  const symbolsDir = join(output_dir, 'symbols');
  const uiDir = join(output_dir, 'ui');
  mkdirSync(symbolsDir, { recursive: true });
  mkdirSync(uiDir, { recursive: true });

  const steps: string[] = [];
  const assetManifest: Array<{ alias: string; src: string }> = [];
  let styleId: string | undefined;

  // ── Step 1: Generate hero asset (first symbol) to establish visual style ──
  const hero = symbols[0];
  const heroPrompt = `${hero.prompt_detail}${prompt_suffix}`;
  validatePrompt(heroPrompt);

  steps.push(`🎨 Generating hero asset: ${hero.name}...`);

  const heroBody: Record<string, any> = {
    prompt: heroPrompt, model: 'recraftv4', size: resolveSize(size), n: 1, response_format: 'url',
  };
  const heroResult = await recraftPost<GenerationResult>(ENDPOINTS.GENERATIONS, heroBody);
  const heroUrl = heroResult.data[0]?.url;
  if (!heroUrl) throw new Error('Hero generation returned no image URL.');

  const heroBuffer = await downloadToBuffer(heroUrl);
  const heroPath = join(symbolsDir, `${hero.name}.png`);

  if (remove_bg) {
    await removeBgAndSave(heroBuffer, heroPath);
  } else {
    writeFileSync(heroPath, heroBuffer);
  }
  steps.push(`✅ Hero: ${hero.name} saved`);
  assetManifest.push({ alias: `sym_${hero.name}`, src: `symbols/${hero.name}.png` });

  await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

  // ── Step 2: Create custom style from hero asset ──
  steps.push('🎨 Creating custom style from hero asset...');
  try {
    const styleFormData = new FormData();
    styleFormData.append('style', 'any');
    const heroFileBuffer = readFileSync(heroPath);
    const heroBlob = new Blob([new Uint8Array(heroFileBuffer)], { type: 'image/png' });
    styleFormData.append('files', heroBlob, `${hero.name}.png`);

    const styleResult = await recraftPostMultipart<CreateStyleResult>(ENDPOINTS.STYLES, styleFormData);
    styleId = styleResult.id;
    steps.push(`✅ Style created: ${styleId}`);
  } catch (styleError) {
    steps.push(`⚠️ Style creation failed (continuing without style consistency): ${styleError instanceof Error ? styleError.message : String(styleError)}`);
  }

  await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

  // ── Step 3: Generate remaining symbols with the same style ──
  for (let i = 1; i < symbols.length; i++) {
    const sym = symbols[i];
    const symPrompt = `${sym.prompt_detail}${prompt_suffix}`;

    steps.push(`🎨 [${i + 1}/${symbols.length}] Generating: ${sym.name}...`);

    try {
      validatePrompt(symPrompt);

      // Use V3 + style_id for consistency (V4 doesn't support custom styles)
      const symModel = styleId ? 'recraftv3' : 'recraftv4';
      const symBody: Record<string, any> = {
        prompt: symPrompt,
        model: symModel,
        size: resolveSize(size, symModel), n: 1, response_format: 'url',
      };
      if (styleId) symBody.style_id = styleId;

      const symResult = await recraftPost<GenerationResult>(ENDPOINTS.GENERATIONS, symBody);
      const symUrl = symResult.data[0]?.url;
      if (!symUrl) throw new Error(`Generation returned no URL for ${sym.name}`);

      const symBuffer = await downloadToBuffer(symUrl);
      const symPath = join(symbolsDir, `${sym.name}.png`);

      if (remove_bg) {
        await removeBgAndSave(symBuffer, symPath);
      } else {
        writeFileSync(symPath, symBuffer);
      }

      steps.push(`✅ ${sym.name} saved`);
      assetManifest.push({ alias: `sym_${sym.name}`, src: `symbols/${sym.name}.png` });
    } catch (e) {
      steps.push(`❌ ${sym.name} failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
  }

  // ── Step 4: Generate background (optional) ──
  if (bg_prompt) {
    steps.push('🎨 Generating background...');
    try {
      validatePrompt(bg_prompt);
      if (bg_size) validateSize(bg_size);

      const bgBody: Record<string, any> = {
        prompt: bg_prompt, model: 'recraftv4',
        size: resolveSize(bg_size || '1344x768'), n: 1, response_format: 'url',
      };
      const bgResult = await recraftPost<GenerationResult>(ENDPOINTS.GENERATIONS, bgBody);
      const bgUrl = bgResult.data[0]?.url;
      if (bgUrl) {
        const bgBuffer = await downloadToBuffer(bgUrl);
        const bgPath = join(uiDir, 'bg_main.png');
        writeFileSync(bgPath, bgBuffer);
        steps.push(`✅ Background saved (${(bgBuffer.length / 1024).toFixed(0)} KB)`);
        assetManifest.push({ alias: 'bg_main', src: 'ui/bg_main.png' });
      }
    } catch (e) {
      steps.push(`❌ Background failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Step 5: Write asset manifest ──
  if (generate_manifest) {
    const manifest = {
      theme,
      style_id: styleId || null,
      generated_at: new Date().toISOString(),
      assets: assetManifest,
    };
    const manifestPath = join(output_dir, 'asset-manifest.json');
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    steps.push(`✅ Manifest: ${manifestPath}`);
  }

  // ── Summary ──
  const successCount = assetManifest.length;
  const totalExpected = symbols.length + (bg_prompt ? 1 : 0);

  return [
    `**🎮 Themed Set Complete: ${theme}**`,
    '',
    `✅ ${successCount}/${totalExpected} assets | Style ID: ${styleId || 'none'}`,
    '',
    ...steps,
    '',
    generate_manifest ? `**Manifest:** ${join(output_dir, 'asset-manifest.json')}` : '',
  ].join('\n');
}

// ─── Helper: remove bg and save ─────────────────────────────────────────────

async function removeBgAndSave(imageBuffer: Buffer, outputPath: string): Promise<void> {
  const tempPath = join(dirname(outputPath), `_temp_${Date.now()}.png`);
  try {
    writeFileSync(tempPath, imageBuffer);

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' });
    formData.append('file', blob, 'temp.png');
    formData.append('response_format', 'url');

    const bgResult = await recraftPostMultipart<BgRemoveResult>(
      ENDPOINTS.REMOVE_BACKGROUND, formData,
    );

    const transparentBuffer = await downloadToBuffer(bgResult.image.url);
    writeFileSync(outputPath, transparentBuffer);
  } catch {
    // Fallback: save original
    writeFileSync(outputPath, imageBuffer);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
}
