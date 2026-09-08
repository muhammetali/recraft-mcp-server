import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/// A tool nobody knows about might as well not ship.
///
/// This exists because it already happened: `preview` went out in a release
/// with no mention anywhere in the README, so the one feature that lets an
/// agent look at what it generated was undiscoverable. Documentation drift
/// is quiet — nothing fails, the gap just sits there — so it gets a test
/// like anything else that can silently rot.
describe('README covers what the server actually exposes', () => {
  const root = join(import.meta.dirname, '../..');
  const source = readFileSync(join(root, 'src/index.ts'), 'utf8');
  const readme = readFileSync(join(root, 'README.md'), 'utf8');

  const registered = [...source.matchAll(/server\.registerTool\(\s*'([a-z_0-9]+)'/g)].map(
    (m) => m[1]
  );

  it('finds every registered tool', () => {
    // Guards the extraction itself: a regex that silently matched nothing
    // would make every assertion below vacuously true.
    expect(registered.length).toBeGreaterThan(20);
  });

  it('documents every tool', () => {
    const undocumented = registered.filter((tool) => !readme.includes(`\`${tool}\``));
    expect(undocumented).toEqual([]);
  });

  it('states the right tool count', () => {
    // The README claimed 24 for a while after the count went to 28.
    const claimed = readme.match(/exposes (\d+) tools/);
    expect(claimed, 'README should state how many tools it exposes').not.toBeNull();
    expect(Number(claimed![1])).toBe(registered.length);
  });

  it('explains the two behaviours that change what an agent can do', () => {
    // Previews and cost reporting are not obvious from a tool list — an
    // agent author has to be told they exist to use them.
    expect(readme).toMatch(/preview/i);
    expect(readme).toMatch(/credits/i);
  });
});
