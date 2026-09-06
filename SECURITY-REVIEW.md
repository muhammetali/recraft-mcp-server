# Dependency security review — 2026-09-06

## 1.2.0 follow-up: update and alternative assessment

The stable `@modelcontextprotocol/sdk@1.30.0` was already the newest v1 package,
but the official replacement `@modelcontextprotocol/server@2.0.0` is available as
a stable release. Its only direct dependencies are `@modelcontextprotocol/core`
and Zod. We migrated all 24 tools using the official codemod and explicit schema
objects, preserving the stdio interface. No custom SDK fork, source pruning,
scanner suppression, or application bundling was used.

| Decision | Rationale and result |
| --- | --- |
| SDK v1 → official v2 server | Replaces the monolithic SDK with its maintained successor. The production lock graph drops from 100 dependency entries in 1.1.0 to 36, counting all optional platforms. Express/Hono, cross-spawn, Ajv, old polyfills, and the flagged elicitation example no longer belong to our dependency tree. |
| Socket's eight override suggestions | Their parent SDK dependencies are replaced by the official v2 architecture. No need to add eight third-party forks or rely on root-only npm overrides that consumers may not inherit. |
| dotenv 16.6.1 → 17.4.2 | Use the current stable release; retain quiet startup and existing `.env` behavior. |
| Retain sharp 0.35.4 | It is the current stable release and supplies the tested resize, SVG label rendering, compositing, and native cross-platform behavior. Its required platform detection and optional WASM paths still warrant review. Replacing it just to alter scanner colors would require a separately tested image-processing migration. |
| Zod interpreter mode | Use the supported `jitless` setting before SDK initialization; verify real protocol operations with Node's string-code-generation prohibition enabled. This does not remove dormant code-generation source from third-party packages. |

The public Socket record for the v2 server/core packages was inspected before
migration: no AI security finding, eval, or shell capability was reported for them.
The server still reports network capability. Recheck the published 1.2.0 report
after indexing; capability findings on sharp, detect-libc, and optional WASM
dependencies are not claimed to be eliminated.

The causes of the earlier release's problems were a vulnerable sharp version
range, a stale dependency lockfile, and using the old aggregate SDK without
evaluating its modular successor. Prevention is now recorded in `SECURITY.md`,
`CLAUDE.md`, and `security-policy.json`, with `npm run verify` enforced by the
publication lifecycle and CI. All dependency changes still require review;
the automated controls do not claim to detect every possible future Socket alert.

## Historical 1.0.0 / 1.1.0 assessment

Scope: `recraft-mcp-server@1.0.0`, the local dependency lockfile, and the 1.1.0 update.
The Socket package report resolves published dependency ranges; its dependency versions
can differ from those in the repository lockfile. Both were inspected.

## Confirmed vulnerability

Socket identified `sharp@0.34.5` under **High CVE**, citing
[GHSA-f88m-g3jw-g9cj](https://github.com/lovell/sharp/security/advisories/GHSA-f88m-g3jw-g9cj).
The upstream advisory covers vulnerabilities in libvips affecting sharp before 0.35.0.
This is relevant because `src/tools/advanced.ts` decodes external and local images
for resizing, comparison grids, and texture replacement. Version 1.1.0 requires
`sharp@^0.35.4`, outside the affected range. Installations using a globally installed
libvips must also maintain that system library; updating the npm package alone does
not patch a separately managed native library.

The repository lockfile also contained npm advisory findings in SDK and development
dependencies. Refreshing the dependency tree addresses these separately from the
published package's sharp finding.

## Other Socket findings

| Finding | Evidence and applicability |
| --- | --- |
| AI-detected potential security risk | Socket flags `@modelcontextprotocol/sdk@1.30.0/dist/esm/examples/server/elicitationUrlExample.js` for plaintext API-key logging, unsafe HTML interpolation, permissive CORS, and session-binding concerns. This is an SDK example, not imported or started by this stdio application. Do not deploy that example as a production server. |
| Network, environment, and filesystem access | Our package calls the Recraft API, reads `RECRAFT_API_KEY`, uploads selected images, and writes requested output files. These are advertised capabilities, not evidence of exfiltration. Download requests do not attach the Recraft authorization header. |
| Shell access and install scripts | The report identifies sharp's native installation machinery, `detect-libc` platform detection, and the SDK's `cross-spawn` dependency. Application source does not call a shell or spawn commands. These findings describe dependency capabilities, not proof that tool input reaches a shell. |
| Uses eval / dynamic require / AI code anomalies | Reported in dependency utilities and code generators, including Ajv and Zod. Our tool schemas are defined in source; tool callers supply values, not executable schema definitions. The report also flags Zod's internal code-generation module. These alerts can remain while the dependencies ship such code. |
| Socket optimized override available | A recommendation to substitute Socket-maintained packages, not a CVE. No blanket dependency replacements were applied. |
| Unmaintained / new author / minified code / URL strings | Maintenance and review signals. Their presence alone does not establish an exploitable vulnerability. |
| Copyleft / non-permissive licenses | Native image dependencies carry licenses distinct from this project's MIT license. Updating dependencies does not remove those obligations or justify suppressing the findings. |

The package's own Socket artifact reports network, environment, filesystem, and URL
capabilities, with `eval` and `shell` both false. This review does not certify every
dependency or every possible input as safe. It distinguishes the confirmed advisory
from capabilities and findings in code the application does not execute.

## Rechecking and integration

- [Original Socket report](https://socket.dev/npm/package/recraft-mcp-server/alerts/1.0.0?tab=dependencies)
- [Socket CLI documentation](https://docs.socket.dev/docs/socket-cli): the official npm
  package is `socket`; scan/API commands require the relevant account access and token.
- [Socket MCP documentation](https://docs.socket.dev/docs/guide-to-socket-mcp): hosted
  endpoint `https://mcp.socket.dev/`; authenticated features use the client's sign-in flow.

The public package details were accessible through the existing browser connection,
so no new credentials or MCP installation were needed for this review. No Socket
findings were dismissed or hidden. An old version's report can continue to show its
original vulnerabilities; check the 1.1.0 report after Socket has scanned it.

Run `npm ci`, `npm run build`, `npm test`, and `npm run audit:security` to validate
the locked tree. Publishing workflows run the audit before uploading the package.

Local release validation: TypeScript build passed; all 206 tests across 15 files
passed, including actual native PNG resize and SVG composition. `npm audit --json`
reported zero known vulnerabilities across all severities. A stdio MCP handshake
reported version 1.1.0 and all 24 tools without contacting the Recraft API. The
loaded native versions were sharp 0.35.4 and libvips 8.18.6. `npm pack --dry-run`
confirmed that credentials and test files are excluded from the release archive.
