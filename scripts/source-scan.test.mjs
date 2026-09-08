import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadSyntax, scanSource } from './source-scan.mjs';

/**
 * The release gate in check-security.mjs had no tests for as long as it
 * existed, which is how it came to depend on a compiler API that vanished:
 * nothing exercised it except the release itself, and it only spoke up by
 * failing a Dependabot pull request with "Cannot read properties of undefined
 * (reading 'Latest')".
 *
 * A guard nobody tests is a guard nobody knows the shape of. These pin both
 * halves: what it must catch, and what it must not.
 */

const syntax = await loadSyntax();
const scan = (source) => scanSource(source, syntax);
const rules = (source) => scan(source).map((f) => f.rule);
const details = (source) => scan(source).map((f) => f.detail);

test('the scanner loaded from the installed TypeScript', () => {
  assert.ok(syntax.createScanner, 'no scanner');
  assert.ok([5, 7].includes(syntax.version));
});

test('every token kind the scan needs resolved to a number', () => {
  // The one that mattered: `EndOfFileToken` in 5.x is `EndOfFile` in 7.x.
  // Read through the missing name it is undefined, the scan loop's exit test
  // never holds, and the release gate hangs instead of failing — which is how
  // this was found, by a 20-second test timeout with no output at all.
  //
  // Never assert the numbers themselves: Identifier is 80 in 5.9 and 79 in
  // 7.0. What must hold is that each kind resolved to *something*.
  for (const [name, kind] of Object.entries(syntax.kinds)) {
    assert.equal(typeof kind, 'number', `${name} did not resolve`);
  }
  assert.deepEqual(Object.keys(syntax.kinds).sort(), [
    'endOfFile',
    'identifier',
    'openParen',
    'stringLiteral',
    'templateLiteral',
  ]);
});

test('a renamed token kind fails loudly instead of hanging', () => {
  // Guarding the failure mode, not just the fix. Before this, an unresolved
  // kind produced an infinite loop; now it must throw, and say what to do.
  assert.throws(
    () => scanSource('eval(x);', { ...syntax, kinds: { ...syntax.kinds, endOfFile: undefined } }),
    /did not terminate/,
  );
});

test('catches a shell or VM module by name', () => {
  assert.deepEqual(rules("import cp from 'child_process';"), ['restricted-module']);
  assert.deepEqual(rules("import cp from 'node:child_process';"), ['restricted-module']);
  assert.deepEqual(rules("const vm = require('vm');"), ['restricted-module']);
  assert.deepEqual(rules("await import('node:vm');"), ['restricted-module']);
});

test('catches a module named in a backtick string', () => {
  // The AST version tested `isStringLiteral`, which is false for a template
  // literal — so a backtick walked straight past the guard.
  assert.deepEqual(rules('await import(`node:child_process`);'), ['restricted-module']);
});

test('catches names that turn data into code', () => {
  assert.deepEqual(details('eval(userInput);'), ['eval']);
  assert.deepEqual(details('new Function("return 1")();'), ['Function']);
  assert.deepEqual(details('cp.execSync(cmd);'), ['execSync']);
  assert.deepEqual(details('const child = spawn(bin, args);'), ['spawn']);
});

test('reports the line so the message is actionable', () => {
  const source = ['const a = 1;', 'const b = 2;', 'eval(x);'].join('\n');
  assert.deepEqual(scan(source), [{ rule: 'dynamic-execution', detail: 'eval', line: 3 }]);
});

test('reports every finding rather than stopping at the first', () => {
  const source = ["import 'node:vm';", 'eval(a);', 'exec(b);'].join('\n');
  assert.deepEqual(details(source), ['node:vm', 'eval', 'exec']);
});

test('ignores a mention in a comment', () => {
  // The point of scanning tokens rather than grepping: prose about
  // child_process is not a use of it, and this file and SECURITY.md are both
  // full of such prose.
  assert.deepEqual(scan('// we deliberately avoid child_process and eval here'), []);
  assert.deepEqual(scan('/* exec(), spawn() and vm are banned */'), []);
});

test('ignores a name that is not being called', () => {
  assert.deepEqual(scan('const evaluation = 1;'), []);
  assert.deepEqual(scan('const label = "execution";'), []);
  assert.deepEqual(scan('type Executor = { exec: string };'), []);
});

test('ignores a module whose name merely contains a banned one', () => {
  assert.deepEqual(scan("import x from 'vmware-client';"), []);
  assert.deepEqual(scan("import x from './child_process_notes';"), []);
});

test('does not fire on the sources this repository actually ships', async () => {
  // The end-to-end shape of the gate: a false positive here stops every
  // release, so it is worth asserting and not only observing.
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');

  const src = join(fileURLToPath(new URL('../', import.meta.url)), 'src');
  const findings = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(path);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      findings.push(...scan(readFileSync(path, 'utf8')).map((f) => `${path}:${f.line} ${f.detail}`));
    }
  };
  walk(src);

  assert.deepEqual(findings, []);
});
