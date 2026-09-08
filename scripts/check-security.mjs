import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSyntax, scanSource } from './source-scan.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const policy = readJson('security-policy.json');
assert.equal(pkg.version, lock.version, 'package/lock release versions differ');
assert.equal(pkg.version, lock.packages[''].version, 'lock root version differs');
assert.deepEqual(
  pkg.dependencies,
  policy.reviewedDirectDependencies,
  'Dependency changes require a security review and policy update',
);
for (const hook of ['preinstall', 'install', 'postinstall']) {
  assert.equal(pkg.scripts?.[hook], undefined, `Unexpected lifecycle hook: ${hook}`);
}
const allowed = new Set(policy.allowedProductionPackages);
let count = 0;
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev) continue;
  count++;
  const name = path.split('node_modules/').at(-1);
  assert.ok(allowed.has(name), `Unreviewed production dependency: ${name}`);
  assert.ok(!entry.hasInstallScript, `Production install script introduced: ${name}`);
  assert.match(
    entry.resolved ?? '',
    /^https:\/\/registry\.npmjs\.org\//,
    `Non-registry dependency: ${name}`,
  );
  assert.match(entry.integrity ?? '', /^sha512-/, `Missing integrity: ${name}`);
}

// Review new executable code, not comments or tool descriptions. This is a
// regression guard for direct uses, not a general-purpose malware detector.
// The scan itself lives in source-scan.mjs, which has its own tests — this
// gate had none for as long as it existed.
const syntax = await loadSyntax();

function checkSource(directory) {
  const problems = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') walk(path);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      for (const finding of scanSource(readFileSync(path, 'utf8'), syntax)) {
        problems.push(
          finding.rule === 'restricted-module'
            ? `Shell/VM module requires security review: ${finding.detail} at ${path}:${finding.line}`
            : `Dynamic execution requires security review: ${finding.detail} at ${path}:${finding.line}`,
        );
      }
    }
  };
  walk(directory);

  // Report every file at once. Failing on the first hides how much there is
  // to review, which matters when a dependency update rewrites several.
  assert.deepEqual(problems, [], `\n${problems.join('\n')}`);
}
checkSource(join(root, 'src'));

// Inspect the actual npm archive file list. --ignore-scripts prevents recursive
// lifecycle execution; no archive is written by --dry-run.
const npmCli = process.env.npm_execpath;
assert.ok(npmCli, 'Run with npm run check:security');
const packed = JSON.parse(
  execFileSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: root,
    encoding: 'utf8',
  }),
)[0];
const files = packed.files.map((file) => file.path);
for (const path of policy.requiredReleaseFiles) {
  assert.ok(files.includes(path), `Missing release file: ${path}`);
}
for (const path of files) {
  assert.ok(
    /^(dist\/|README\.md$|LICENSE$|SECURITY\.md$|CHANGELOG\.md$|package\.json$)/.test(path),
    `Unexpected release file: ${path}`,
  );
  assert.ok(
    !/(^|\/)(\.env(?:\.|$)|\.npmrc$|__tests__\/|examples\/)|\.(p8|pem|key)$/.test(path),
    `Sensitive/test/example file in release: ${path}`,
  );
}
console.log(`Security policy passed: ${count} production packages; ${files.length} release files.`);
