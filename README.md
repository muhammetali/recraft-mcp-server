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

## 🌟 Key Features

- 🖼️ **Text-to-image generation** across all Recraft models (V4.1, V4 Styles, V4, V4 Vector/SVG, V4 Pro, V3, V2), 70+ styles
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

### Styles, assets & account
| Tool | Description |
|---|---|
| `recraft_create_style` | Build a custom, reusable style from 1–5 reference images |
| `recraft_generate_asset` | Full pipeline: generate → download → optional bg-removal → save to file |
| `recraft_download_image` | Save an image URL to a local file |
| `recraft_check_credits` | Check account info and remaining API credits |

## ⚙️ Quick Start

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
```

## 📄 License
MIT — see [LICENSE](LICENSE).
