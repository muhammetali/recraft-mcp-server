export function getApiKey(): string {
  const key = process.env.RECRAFT_API_KEY;
  if (!key) {
    throw new Error(
      'Missing RECRAFT_API_KEY environment variable. Set it in your MCP config or .env file.'
    );
  }
  return key;
}
