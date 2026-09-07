/// Shared trailer for tool output.
///
/// Every Recraft response carries the exact credit cost of the call it just
/// served, and the previous version discarded it — leaving the model with no
/// way to know that a creative upscale costs 62 times what a crisp upscale
/// does. Reporting it is the difference between an agent that can budget and
/// one that finds out at the invoice.
export function formatUsage(
  model: string | undefined,
  size: string | undefined,
  style: { style?: string; substyle?: string } | undefined,
  credits: number | undefined
): string {
  const parts: string[] = [];
  if (model) parts.push(`Model: ${model}`);
  if (size) parts.push(`Size: ${size}`);
  if (style?.style) parts.push(`Style: ${style.style}`);
  if (style?.substyle) parts.push(`Substyle: ${style.substyle}`);
  if (credits !== undefined) parts.push(`Cost: ${credits} credits`);
  return parts.join(' | ');
}

/// [formatUsage] for the single-image transform endpoints, which have no
/// model or size of their own.
export function formatCost(credits: number | undefined): string {
  return credits === undefined ? '' : `\nCost: ${credits} credits`;
}
