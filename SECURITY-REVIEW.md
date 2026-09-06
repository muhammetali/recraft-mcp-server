# Dependency security review — 2026-09-06

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
