# Changelog

## 1.2.0 — 2026-09-06

- Upgrade to the official modular MCP SDK v2, preserving all 24 stdio tools and
  removing the old SDK's HTTP, shell-helper, Ajv, and example-server dependencies.
- Upgrade dotenv to 17.4.2 and pin reviewed direct dependency versions.
- Disable Zod runtime code generation with its supported interpreter mode.
- Add stdio compatibility tests with string code generation disabled.
- Require dependency-policy, package-content, protocol, native-image, and npm
  advisory checks before every publication.
- Add security decisions, regression rules, scheduled CI checks, Dependabot, and
  a development roadmap. Necessary network/filesystem/native dependency alerts
  remain subject to documented review.

## 1.1.0 — 2026-09-06

- Upgrade sharp from 0.34.5 to 0.35.4 to address the libvips vulnerabilities
  described in GHSA-f88m-g3jw-g9cj.
- Require Node.js 20.9.0 or newer, matching the updated native image dependency.
- Refresh the MCP SDK and dependency lockfile, and declare Zod as a direct dependency.
- Remove the obsolete `@types/sharp` package; sharp provides its own types.
- Keep dotenv startup messages off stdout so they cannot corrupt the stdio MCP protocol.
- Check npm security advisories before publishing from GitHub or GitLab.
- Exercise real native image resizing and compositing in the test suite.

See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for the Socket findings and their applicability.
