# Changelog

## 1.3.1 — 2026-09-08

- Document previews and cost reporting in the README. Both shipped in 1.3.0
  with no mention anywhere — the one feature that lets an agent look at what it
  generated was undiscoverable, and the per-call credit cost equally so.
- Correct the tool count in the README, which still said 24.
- Add a test that fails when a registered tool is missing from the README, or
  when the stated count drifts from the real one. Documentation gaps are quiet:
  nothing breaks, the hole just sits there.

## 1.3.0 — 2026-09-08

### Fixed

- **Style taxonomy.** Recraft's `style` and `substyle` are two separate request
  fields — six broad families and a strict 104-value enum. This server had
  flattened both into one 99-name list, never sent `substyle`, and 25 of those
  names existed in neither enum. A request for `pixel_art` went into the
  free-form `style` field, where the API ignores it: the call succeeded and the
  look was simply missing. Both vocabularies are now generated from Recraft's
  OpenAPI document, and the old names still work — they map onto the real pairs
  rather than being forwarded as-is.
- **Cost was being discarded.** `credits` is a required field on every response;
  every tool now reports what its call cost.
- **`recraft_batch_generate` on a new folder.** It delegated to a step that
  requires the output directory to exist and nothing created it, so every asset
  failed with "Output directory does not exist" — in exactly the case the tool
  is for.

### Added

- `recraft_list_styles`, `recraft_get_style`, `recraft_delete_style`,
  `recraft_list_basic_styles`. The account could mint custom styles but never
  see or remove them, and `recraft_generate_themed_set` creates one per run.
- `substyle` on the ten tools that take a style.
- Inline previews of generated images, downscaled to fit a context budget.
  Optional, on by default, capped at four per call.
- `smithery.yaml` and a verified `Dockerfile` (325MB; the container completes an
  MCP handshake and lists all 28 tools).
- A migration table from the archived official server, whose tool names are
  these minus the `recraft_` prefix.

### Changed

- The endpoint test asserted `Object.keys(ENDPOINTS).length === 17`. It now
  checks each path against the operation set Recraft actually serves — the old
  version went red for additions and could never catch a path that does not
  exist.

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
