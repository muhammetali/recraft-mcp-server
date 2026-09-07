# 🎨 Recraft MCP Server

[![npm version](https://img.shields.io/npm/v/recraft-mcp-server.svg)](https://npmjs.org/package/recraft-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue.svg)](https://modelcontextprotocol.io/)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives AI assistants
(Claude, Gemini, or any MCP client) direct access to the [Recraft AI](https://www.recraft.ai/) image
generation API — generate, transform, upscale, and vectorize images without leaving your chat.

> "Generate a set of 8 fantasy game icons in the same art style."
> "Remove the background from this screenshot and upscale it."
> "Create 5 style variations of this logo and put them in a comparison grid."

## Coming from the official server?

Recraft **archived** `@recraft-ai/mcp-recraft-server` in July 2026 and now points
users at a hosted endpoint, `https://mcp.recraft.ai/mcp`. Which of the three you
want depends on what you are doing:

| | Recraft hosted | This server |
|---|---|---|
| Setup | OAuth in a browser, no API key | npm install + API key |
| Tools | 9 | **28** |
| Billing | Subscription credits | API units, and every tool reports what its call cost |
| Local files | No — URLs and base64 only | Reads and writes files on your machine |
| Batch / pipelines | No | Generate → download → background-remove → save, themed sets, comparison grids |
| Style management | Create only | Create, list, inspect, delete |

If you only generate the occasional image, the hosted server is less work and
this one has nothing to offer you. If you are producing assets in bulk, working
from files already on disk, or need to know what a run costs before it runs,
that is what this exists for.

### Tool name mapping

The names are the old ones with a `recraft_` prefix, except where noted:

| Official (archived) | Here |
|---|---|
| `generate_image` | `recraft_generate_image` |
| `image_to_image` | `recraft_image_to_image` |
| `remove_background` | `recraft_remove_background` |
| `replace_background` | `recraft_replace_background` |
| `crisp_upscale` | `recraft_crisp_upscale` |
| `creative_upscale` | `recraft_creative_upscale` |
| `create_style` | `recraft_create_style` |
| `vectorize_image` | `recraft_vectorize` |
| `get_user` | `recraft_check_credits` |

One behavioural difference worth knowing: Recraft's `style` field takes six
broad families, and the specific look (`pixel_art`, `kawaii`, `b_and_w`…) is a
separate `substyle` field. Passing a substyle name as `style` is silently
ignored by the API. This server accepts either and routes it correctly, so
prompts written against the old servers keep working.

## 🌟 Key Features

- 🖼️ **Text-to-image generation** across all Recraft models (V4.1, V4 Styles, V4, V4 Vector/SVG, V4 Pro, V3, V2), with the full style taxonomy — 6 families × 104 substyles, generated from Recraft's own API spec rather than transcribed by hand
- 🔁 **Image transformation** — image-to-image, inpaint, background replace/generate, outpaint (canvas expansion), variations
- ✨ **Enhancement** — background removal, vectorization, crisp/creative upscale, region erase
- 🔎 **Discovery** — open-ended exploration generation, "more like this," and automatic prompt enhancement
- 🧩 **Asset pipelines** — one-call generate → download → background-remove → save, batch generation, themed asset sets with style consistency
- 🎮 **Game-dev extras** — sized generation for sprites/icons, style comparison grids, texture/atlas swapping

## 🛠️ Provided Tools

This MCP server exposes 24 tools to your AI agent — full coverage of the Recraft API.

### Generation
| Tool | Description |
|---|---|
| `recraft_generate_image` | Text-to-image across all Recraft models, 70+ styles, color/text-layout control |
| `recraft_generate_sized` | Generate at any target size (down to 64×64) — ideal for sprites/icons/UI |
| `recraft_batch_generate` | Generate multiple assets in sequence with full pipeline, resilient to per-asset failure |
| `recraft_generate_themed_set` | A hero asset + matching style + all remaining symbols, generated with visual consistency |
| `recraft_compare_styles` | Same prompt across multiple styles, with an optional side-by-side comparison grid |

### Discovery
| Tool | Description |
|---|---|
| `recraft_explore` | Generate a diverse set of images for open-ended exploration of a prompt |
| `recraft_explore_similar` | Generate more images visually similar to a previous `recraft_explore` result |
| `recraft_enhance_prompt` | Expand a short prompt into a richer, more detailed one |

### Transformation
| Tool | Description |
|---|---|
| `recraft_image_to_image` | Transform an existing image from a text prompt (strength-adjustable) |
| `recraft_inpaint` | Regenerate masked regions of an image |
| `recraft_replace_background` | AI-generate a new background while keeping the subject |
| `recraft_generate_background` | Fill masked background areas within the existing canvas |
| `recraft_outpaint` | Expand the canvas beyond the image's original bounds with AI-generated content |
| `recraft_variate_image` | Generate variations of an existing image |
| `recraft_texture_swap` | Replace a region with new AI content — built for Spine atlas / spritesheet swaps |

### Enhancement
| Tool | Description |
|---|---|
| `recraft_remove_background` | Transparent-PNG background removal |
| `recraft_vectorize` | Raster (PNG/JPG/WEBP) → SVG |
| `recraft_crisp_upscale` | Clean upscale for graphics, icons, illustrations |
| `recraft_creative_upscale` | AI-detail upscale with face refinement for photos |
| `recraft_erase_region` | Content-aware removal of a masked region |

### Style management

| Tool | What it does |
| --- | --- |
| `recraft_create_style` | Create a custom style from 1-5 reference images |
| `recraft_list_styles` | List the custom styles on the account — free, reads only |
| `recraft_get_style` | Look up one style by id — free, reads only |
| `recraft_delete_style` | Delete a style permanently |
| `recraft_list_basic_styles` | Recraft's built-in styles per model, live from the API |

### Assets & account
| Tool | Description |
|---|---|
| `recraft_create_style` | Build a custom, reusable style from 1–5 reference images |
| `recraft_generate_asset` | Full pipeline: generate → download → optional bg-removal → save to file |
| `recraft_download_image` | Save an image URL to a local file |
| `recraft_check_credits` | Check account info and remaining API credits |

## ⚙️ Quick Start

Requires Node.js 20.9.0 or newer. Version 1.1.0 upgrades the native image-processing
dependencies to address known libvips vulnerabilities; Node.js 18 is no longer supported.

### 1. Get a Recraft API key
Sign up at [recraft.ai](https://www.recraft.ai/) and grab an API key from your account settings.

### 2. Install & configure

```bash
claude mcp add --scope user recraft \
  -e RECRAFT_API_KEY=your-api-key-here \
  -- npx -y recraft-mcp-server
```

Or add it manually to your MCP client config:

```json
{
  "mcpServers": {
    "recraft": {
      "command": "npx",
      "args": ["-y", "recraft-mcp-server"],
      "env": {
        "RECRAFT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Environment Variables
| Variable | Description |
|----------|-------------|
| `RECRAFT_API_KEY` | Your Recraft AI API key |

### Docker

```bash
docker build -t recraft-mcp-server .
docker run -i --rm -e RECRAFT_API_KEY=your-key recraft-mcp-server
```

In an MCP client config:

```json
{
  "mcpServers": {
    "recraft": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "RECRAFT_API_KEY", "recraft-mcp-server"],
      "env": { "RECRAFT_API_KEY": "your-key" }
    }
  }
}
```

The container talks MCP over stdio and never opens a port, so `-i` is
required and `-p` is not. It runs as an unprivileged user; tools that write
files need the target directory bind-mounted (`-v /path:/path`).

## 🤖 Example AI Prompts

**Game asset pipeline:**
> *"Generate a themed set of 6 fantasy potion icons in the same style, then export a Pixi.js manifest."* → `recraft_generate_themed_set`

**Quick sprite generation:**
> *"Generate a 64x64 pixel-art coin icon."* → `recraft_generate_sized`

**Style exploration:**
> *"Show me this logo prompt in 4 different styles side by side."* → `recraft_compare_styles`

**Photo cleanup:**
> *"Remove the background from this photo and upscale it for print."* → `recraft_remove_background` → `recraft_creative_upscale`

**Asset swapping:**
> *"Swap the texture in this region of the spritesheet with a new design."* → `recraft_texture_swap`

**Canvas expansion:**
> *"Widen this image to a 16:9 banner without cropping the subject."* → `recraft_outpaint`

**Open-ended exploration:**
> *"Explore some ideas for a race car on a track, then give me more like the third one."* → `recraft_explore` → `recraft_explore_similar`

**Prompt polishing:**
> *"Enhance this rough prompt before generating: 'red panda with a sign.'"* → `recraft_enhance_prompt`

## Development

```bash
git clone https://github.com/muhammetali/recraft-mcp-server.git
cd recraft-mcp-server
npm install
npm run build
npm test
npm run audit:security
npm run verify
```

Version 1.2.0 uses the official modular MCP SDK v2 while preserving all 24 tools.
See [security policy](https://github.com/muhammetali/recraft-mcp-server/blob/main/SECURITY.md)
and [dependency review](https://github.com/muhammetali/recraft-mcp-server/blob/main/SECURITY-REVIEW.md)
for release checks, dependency decisions, and necessary runtime capabilities.

## 📄 License
MIT — see [LICENSE](LICENSE).
