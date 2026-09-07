import { readFileSync } from 'fs';
import { basename } from 'path';
import { recraftDelete, recraftGet, recraftPostMultipart } from '../client.js';
import { ENDPOINTS, UPLOAD_TIMEOUT_MS } from '../constants.js';
import { getMimeType, validateFilePath, validateStyleBaseType, validateStyleId } from '../validation.js';

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

/// A style as Recraft stores it.
export interface StyleRecord {
  id: string;
  style?: string;
  substyle?: string;
  is_private?: boolean;
  creation_time?: string;
}

function formatStyleRow(s: StyleRecord): string {
  const bits = [s.style, s.substyle].filter(Boolean).join(' / ') || '(no base style)';
  const when = s.creation_time ? ` — created ${s.creation_time.slice(0, 10)}` : '';
  const vis = s.is_private === false ? ' — public' : '';
  return `- \`${s.id}\` — ${bits}${vis}${when}`;
}

/// Lists the custom styles on the account.
///
/// Until now this server could mint styles but never see them. Worse,
/// `recraft_generate_themed_set` creates one on every invocation, so a few
/// runs left a pile of paid styles with no way to find or remove them. The
/// endpoint existed the whole time.
export async function listStyles(): Promise<string> {
  const result = await recraftGet<{ styles: StyleRecord[] }>(ENDPOINTS.STYLES);
  const styles = result.styles ?? [];

  if (styles.length === 0) {
    return 'No custom styles on this account.';
  }

  return [
    `**${styles.length} custom style(s)**\n`,
    ...styles.map(formatStyleRow),
    '\nUse a style with `style_id` on any generation tool, or remove one with `recraft_delete_style`.',
  ].join('\n');
}

/// Looks up one style by id.
export async function getStyle(styleId: string): Promise<string> {
  validateStyleId(styleId);
  const s = await recraftGet<StyleRecord>(`${ENDPOINTS.STYLES}/${styleId}`);
  return [
    `**Style \`${s.id}\`**\n`,
    `- Base: ${[s.style, s.substyle].filter(Boolean).join(' / ') || '(none)'}`,
    `- Visibility: ${s.is_private === false ? 'public' : 'private'}`,
    s.creation_time ? `- Created: ${s.creation_time}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/// Deletes a custom style. Not reversible — the id stops resolving and any
/// saved reference to it breaks.
export async function deleteStyle(styleId: string): Promise<string> {
  validateStyleId(styleId);
  await recraftDelete(`${ENDPOINTS.STYLES}/${styleId}`);
  return `Deleted style \`${styleId}\`.`;
}

/// Lists Recraft's own built-in styles, per model.
///
/// This is the live version of the hardcoded style tables every MCP server
/// in this space carries — including, until now, this one, whose list had
/// drifted far enough to contain 25 names the API does not define.
export async function listBasicStyles(): Promise<string> {
  const result = await recraftGet<{ styles: Array<{ model?: string; style?: string; style_id?: string }> }>(
    ENDPOINTS.STYLES_BASIC
  );
  const styles = result.styles ?? [];

  if (styles.length === 0) return 'No basic styles returned.';

  const byModel = new Map<string, string[]>();
  for (const s of styles) {
    const model = s.model ?? 'unknown';
    if (!byModel.has(model)) byModel.set(model, []);
    byModel.get(model)!.push(`${s.style ?? '?'}${s.style_id ? ` (\`${s.style_id}\`)` : ''}`);
  }

  const lines = [`**${styles.length} basic style(s)**\n`];
  for (const [model, names] of byModel) {
    lines.push(`**${model}**`, names.map((n) => `- ${n}`).join('\n'), '');
  }
  return lines.join('\n');
}
