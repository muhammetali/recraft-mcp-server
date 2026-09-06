# Changelog

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
