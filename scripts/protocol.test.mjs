import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const expectedTools = [
  'batch_generate',
  'check_credits',
  'compare_styles',
  'create_style',
  'creative_upscale',
  'crisp_upscale',
  'delete_style',
  'download_image',
  'enhance_prompt',
  'erase_region',
  'explore',
  'explore_similar',
  'generate_asset',
  'generate_background',
  'generate_image',
  'generate_sized',
  'generate_themed_set',
  'get_style',
  'image_to_image',
  'inpaint',
  'list_basic_styles',
  'list_styles',
  'outpaint',
  'remove_background',
  'replace_background',
  'texture_swap',
  'variate_image',
  'vectorize',
]
  .map((name) => `recraft_${name}`)
  .sort();

for (const protocolVersion of ['2025-06-18', '2025-11-25']) {
  test(
    `stdio contract ${protocolVersion}, with runtime code generation disabled`,
    { timeout: 15000 },
    async (t) => {
      const child = spawn(
        process.execPath,
        ['--disallow-code-generation-from-strings', 'dist/index.js'],
        {
          cwd: root,
          env: { PATH: process.env.PATH ?? '' },
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      const exited = once(child, 'exit');
      t.after(async () => {
        child.stdin.end();
        child.kill();
        await exited;
      });
      const lines = createInterface({ input: child.stdout });
      const pending = new Map();
      const unexpectedOutput = [];
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      lines.on('line', (line) => {
        try {
          const message = JSON.parse(line);
          const waiter = pending.get(message.id);
          if (waiter) {
            pending.delete(message.id);
            waiter(message);
          } else if (!message.method) {
            unexpectedOutput.push(line);
          }
        } catch {
          unexpectedOutput.push(line);
        }
      });
      let id = 0;
      const request = (method, params = {}) =>
        new Promise((resolve, reject) => {
          const requestId = ++id;
          const timer = setTimeout(
            () => reject(new Error(`Timed out: ${method}; stderr=${stderr}`)),
            5000,
          );
          pending.set(requestId, (response) => {
            clearTimeout(timer);
            resolve(response);
          });
          child.stdin.write(
            `${JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })}\n`,
          );
        });

      const initialized = await request('initialize', {
        protocolVersion,
        clientInfo: { name: 'release-contract-test', version: '1.0.0' },
        capabilities: {},
      });
      assert.equal(initialized.error, undefined);
      assert.equal(initialized.result.protocolVersion, protocolVersion);
      assert.equal(initialized.result.serverInfo.version, pkg.version);
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`,
      );

      const listed = await request('tools/list');
      assert.equal(listed.error, undefined);
      assert.deepEqual(listed.result.tools.map((tool) => tool.name).sort(), expectedTools);
      for (const tool of listed.result.tools) {
        assert.equal(tool.inputSchema.type, 'object', tool.name);
      }
      const generated = listed.result.tools.find((tool) => tool.name === 'recraft_generate_image');
      assert.equal(generated.inputSchema.properties.prompt.type, 'string');
      assert.ok(generated.inputSchema.required.includes('prompt'));

      // Invalid inputs must fail before any network request or local file write.
      const invalid = await request('tools/call', {
        name: 'recraft_generate_image',
        arguments: { prompt: 123 },
      });
      assert.equal(invalid.result.isError, true);
      const unknown = await request('tools/call', { name: 'nonexistent_tool', arguments: {} });
      assert.ok(unknown.error || unknown.result?.isError);
      assert.deepEqual(unexpectedOutput, [], 'stdout must contain only MCP JSON messages');
      assert.equal(stderr, '', 'startup and validation must not print warnings');
    },
  );
}
