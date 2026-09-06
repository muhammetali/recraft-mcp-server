# Security policy

Use the latest published release. Report vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/muhammetali/recraft-mcp-server/security/advisories/new).
Do not attach API keys or sensitive images to reports.

## Required capabilities

This is a local stdio server. It reads `RECRAFT_API_KEY`, connects to the Recraft
API and image URLs, reads user-selected input images, and writes requested output
files with the invoking user's permissions. Run it with an account and filesystem
access appropriate to the intended workspace. MCP tool annotations and input schemas
are not filesystem or network sandboxes.

Native image processing uses the maintained sharp/libvips packages. Platform
detection and optional WebAssembly support in that dependency can still trigger
shell, dynamic-code, native-code, and license alerts in static scanners. Runtime
Zod schema compilation is disabled through its supported `jitless` configuration.
These choices do not imply that every dependency capability is exercised by a tool.

## Release requirements

1. Read [SECURITY-REVIEW.md](https://github.com/muhammetali/recraft-mcp-server/blob/main/SECURITY-REVIEW.md)
   and the dependency decisions before changing dependencies.
2. Prefer maintained official releases and compare stable modular replacements
   before introducing overrides, forks, or bundling. Preserve all documented tools.
3. Review direct **and transitive** production dependencies, including optional
   native packages on other platforms. Keep exact direct versions in `package.json`
   and update `security-policy.json` deliberately with the review rationale.
4. Run `npm run verify`: build, unit/native tests, real stdio compatibility tests,
   package contents and dependency-policy checks, and npm advisory audit. The stdio
   tests run with JavaScript string compilation disabled, check all 24 tool names,
   and exercise invalid inputs without live Recraft calls.
5. Do not bypass `prepublishOnly`, ignore failed checks, hide scanner findings,
   suppress a CVE, remove licenses, or weaken input validation to pass a scan.
6. Check the published npm version and the matching Socket version after release.
   Record new findings and applicability; the old version's report is not a test
   of the new release.

`prepublishOnly` verifies direct `npm publish` as well as CI publication. GitHub
checks run on pushes, pull requests, and weekly; Dependabot proposes updates.
The policy rejects unreviewed production package names and production install
scripts. The source guard flags direct dynamic execution and shell/VM imports.
These are targeted regression checks, not a complete static security analyzer.

An exact direct version does not freeze its transitive ranges in a consumer's npm
installation. The repository lockfile is audited in CI, and newly resolved published
dependencies still require review. No authenticated Socket CI scan is configured;
the public Socket review is a separate release check. No system can promise that
future vulnerabilities will never be discovered or that necessary I/O will have
zero scanner warnings.
