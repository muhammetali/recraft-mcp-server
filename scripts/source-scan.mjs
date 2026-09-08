/**
 * Lexical scan of TypeScript sources for constructs that require a security
 * review before they land.
 *
 * This used to walk a parsed AST via `ts.createSourceFile` / `ts.forEachChild`.
 * TypeScript 7 — the compiler rewritten in Go — removed both from the package
 * entry point: `typescript` now resolves to `lib/version.cjs` and exports
 * nothing but a version string, so `ts.ScriptTarget` read as `undefined` and
 * the release gate died with "Cannot read properties of undefined (reading
 * 'Latest')". The AST lives under `typescript/unstable/ast` there, but
 * `createSourceFile` is not part of it: parsing now means starting the Go
 * compiler as a project. That is a lot of machinery for two checks, and the
 * path is called `unstable` by the people who own it — an unhappy foundation
 * for something that gates every release.
 *
 * The scanner is a better fit anyway, because both questions this file asks
 * are lexical rather than semantic:
 *
 *   - does any string name a shell or VM module
 *   - is any of a short list of names used as a call
 *
 * `createScanner` exists in both major versions with the same shape, so one
 * implementation covers whichever is installed. What is *not* shared is the
 * token enum, in two ways that both bite:
 *
 *   - the numbers moved (Identifier is 80 in 5.9, 79 in 7.0), so nothing here
 *     may hardcode a `SyntaxKind` value;
 *   - a member was renamed. `EndOfFileToken` in 5.x is `EndOfFile` in 7.x.
 *     Read through the old name on 7 it is `undefined`, the scan loop's exit
 *     condition can never hold, and the gate hangs forever instead of
 *     failing. That is worse than the crash it replaced, so every token this
 *     file depends on is resolved and checked once, up front, by name.
 */

/** Modules whose use has to be argued for, not assumed. */
const RESTRICTED_MODULE = /^(node:)?(child_process|vm)$/;

/** Names that turn data into code. */
const DYNAMIC_EXECUTION = new Set([
  'eval',
  'Function',
  'exec',
  'execSync',
  'spawn',
  'spawnSync',
]);

/**
 * The token kinds this scan needs, and every name a supported TypeScript has
 * used for them. First match wins; a kind that resolves to nothing is a hard
 * error, because each one silently disables part of the check.
 */
const REQUIRED_KINDS = {
  identifier: ['Identifier'],
  stringLiteral: ['StringLiteral'],
  templateLiteral: ['NoSubstitutionTemplateLiteral'],
  openParen: ['OpenParenToken'],
  endOfFile: ['EndOfFileToken', 'EndOfFile'],
};

let cached;

function resolveKinds(SyntaxKind) {
  const kinds = {};
  const missing = [];

  for (const [key, names] of Object.entries(REQUIRED_KINDS)) {
    const name = names.find((candidate) => typeof SyntaxKind?.[candidate] === 'number');
    if (name === undefined) {
      missing.push(`${key} (tried ${names.join(', ')})`);
      continue;
    }
    kinds[key] = SyntaxKind[name];
  }

  if (missing.length > 0) {
    throw new Error(
      `This TypeScript renamed token kinds this scan depends on: ${missing.join('; ')}. ` +
        'Add the new name to REQUIRED_KINDS in scripts/source-scan.mjs.',
    );
  }

  return kinds;
}

/**
 * The scanner and its token kinds, from whichever TypeScript is installed.
 *
 * TypeScript 7 first, since on 7 the old entry point still imports fine and
 * would silently yield an object with no scanner in it.
 */
export async function loadSyntax() {
  if (cached) return cached;

  let ts;
  let version;

  try {
    const ast = await import('typescript/unstable/ast');
    if (ast.createScanner) {
      ts = ast;
      version = 7;
    }
  } catch {
    // Older TypeScript has no such subpath. Fall through.
  }

  if (!ts) {
    const mod = await import('typescript');
    ts = mod.createScanner ? mod : mod.default;
    version = 5;
  }

  if (!ts?.createScanner) {
    throw new Error(
      'No TypeScript scanner found. Neither typescript/unstable/ast (7.x) nor ' +
        'the typescript entry point (<=6.x) exposed createScanner.',
    );
  }

  cached = {
    createScanner: ts.createScanner,
    ScriptTarget: ts.ScriptTarget,
    kinds: resolveKinds(ts.SyntaxKind),
    version,
  };
  return cached;
}

/** 1-based line number of an offset, for a message someone can act on. */
function lineAt(text, position) {
  let line = 1;
  for (let i = 0; i < position && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

/**
 * Returns every construct in `text` that requires a security review.
 *
 * Each finding is `{ rule, detail, line }`. An empty array means the file is
 * clear; this reports everything it finds rather than throwing on the first,
 * so a failing run names all of the work.
 *
 * Deliberately broader than the AST version it replaces, in two ways:
 *
 *   - Backtick strings count. The AST check tested `isStringLiteral`, which is
 *     false for a template literal, so ``import(`node:vm`)`` walked straight
 *     past a guard whose entire purpose was to catch it.
 *   - A banned name followed by `(` is reported wherever it appears, including
 *     at a declaration. The AST version only flagged call sites, so defining
 *     `function exec(...)` was invisible to it. This is a review boundary, and
 *     a file that defines its own `exec` is exactly as worth a look as one
 *     that calls somebody else's.
 */
export function scanSource(text, syntax) {
  const { createScanner, ScriptTarget, kinds } = syntax;
  const findings = [];

  const scanner = createScanner(ScriptTarget.Latest, /* skipTrivia */ true);
  scanner.setText(text);

  // A banned identifier seen on the previous token, waiting to find out
  // whether the next one makes it a call.
  let pending = null;

  // One token per character is already generous; anything past that means the
  // scanner is not advancing and the loop would otherwise spin forever.
  const limit = text.length + 2;
  let steps = 0;

  let token = scanner.scan();
  while (token !== kinds.endOfFile) {
    if (++steps > limit) {
      throw new Error(
        'Token scan did not terminate — the scanner stopped advancing. This ' +
          'usually means the installed TypeScript changed its token kinds.',
      );
    }

    const start = scanner.getTokenStart();

    if (token === kinds.stringLiteral || token === kinds.templateLiteral) {
      const value = scanner.getTokenValue();
      if (RESTRICTED_MODULE.test(value)) {
        findings.push({
          rule: 'restricted-module',
          detail: value,
          line: lineAt(text, start),
        });
      }
    }

    if (pending && token === kinds.openParen) {
      findings.push({
        rule: 'dynamic-execution',
        detail: pending.name,
        line: pending.line,
      });
    }

    pending =
      token === kinds.identifier && DYNAMIC_EXECUTION.has(scanner.getTokenValue())
        ? { name: scanner.getTokenValue(), line: lineAt(text, start) }
        : null;

    token = scanner.scan();
  }

  return findings;
}

export const rules = { RESTRICTED_MODULE, DYNAMIC_EXECUTION, REQUIRED_KINDS };
