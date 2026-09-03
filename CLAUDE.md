# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run build          # TypeScript → dist/ (tsc)
npm run dev            # Run with tsx (hot reload)
npm start              # Production: node dist/index.js
npm test               # Run all tests (vitest)
npm run test:watch     # Watch mode
npx vitest run src/__tests__/tools-advanced.test.ts  # Single test file
```

## Architecture

This is an MCP (Model Context Protocol) server exposing 24 tools for AI image generation via the Recraft API. It communicates over stdio.

### Core Flow

`index.ts` registers all 24 tools on a `McpServer` instance. Each tool validates inputs → calls Recraft API → returns markdown-formatted text.

### Module Responsibilities

- **client.ts** — HTTP layer: JSON POST, multipart POST (file uploads), GET, download-to-buffer. Handles 429 retry, timeouts, error parsing via `RecraftClientError`.
- **validation.ts** — Input validation (prompt length, sizes, models, styles, file paths, colors). `resolveSize()` maps non-standard sizes to supported equivalents.
- **constants.ts** — API endpoints, timeouts, supported models/sizes/ratios/styles. Source of truth for all enums. `MODELS` covers the full V2/V3/V4/V4 Styles/V4.1 family — cross-check against Recraft's `endpoints.md` (`model` parameter compatibility table) whenever Recraft ships a new model family, since a model missing here fails validation even though the API itself would accept it.
- **tools/** — Tool implementations grouped by domain:
  - `generate.ts` — Text-to-image generation, batch generation
  - `transform.ts` — Image-to-image, inpaint, replace/generate background, outpaint (canvas expansion — distinct from generate background's same-canvas mask fill), variate
  - `enhance.ts` — Background removal, vectorize, crisp/creative upscale, erase region
  - `explore.ts` — Discovery-oriented generation (explore, explore similar) and prompt enhancement
  - `pipeline.ts` — Multi-step workflows: asset pipeline (generate→download→bg-remove→save), batch assets, themed set generation with style consistency
  - `advanced.ts` — Small-size generation (generate→resize with sharp), style comparison (A/B grid), texture swap (region replace with feathering)
  - `styles.ts` — Custom style creation from reference images
  - `download.ts` — URL-to-file download
  - `user.ts` — Account/credit check

### A note on endpoint parity with Recraft's docs

As of 2026-09-03, `endpoints.md` on Recraft's docs site lists these operations; everything except the
raster/vector-constrained generation variants (`/images/generations/raster`, `/images/generations/vector`
— redundant with picking a raster/vector model directly on `recraft_generate_image`) is implemented here:
Generate image, Create style, Image to image, Image inpainting, Image **outpainting** (canvas expansion),
Replace background, Generate background (mask fill, same canvas), Vectorize, Remove background, Crisp/Creative
upscale, Erase region, Remix image (`/images/variateImage` — this is `recraft_variate_image`; "Remix" is
just its marketing name in the docs), **Explore**, **Explore similar**, **Enhance prompt**, Get user info.
When Recraft adds a new endpoint, fetch `https://www.recraft.ai/docs/api-reference/endpoints.md` (raw
markdown) directly rather than trusting a search-summarized version — exact paths and field names are
easy for a summarizer to get subtly wrong.

### Key Patterns

- **ESM with `.js` extensions**: All imports use `.js` suffix (`import { foo } from './bar.js'`). Required by Node16 module resolution.
- **Zod schemas** in `index.ts` are reused across tool registrations (modelSchema, sizeSchema, nSchema, etc.).
- **Pipeline tools** compose lower-level operations (generate + download + bg-remove + save) with fallback behavior on partial failures.
- **Rate limiting**: 300ms delay between batch requests (`BATCH_DELAY_MS`), plus automatic 429 retry in client.

## Testing

Tests are in `src/__tests__/*.test.ts` using Vitest. All tests mock the auth module and `fs`, then use `vi.stubGlobal('fetch', vi.fn())` to mock API calls. Response mocks use `new Response(JSON.stringify({...}))`.

For `sharp` mocking (in `tools-advanced.test.ts`), the entire mock must be defined inside the `vi.mock()` factory to avoid hoisting issues — no top-level variables referenced inside.

## Environment

Requires `RECRAFT_API_KEY` set in `.env` or environment. The `.env` is loaded from the package root directory.
