---
name: hl-design
description: "Brand identity, logos, CIP mockups, banners, icons, AI images/video/TTS/music, slides. Full visual production studio."
when_to_use: "Invoke when creating brand assets, visual content, AI-generated media, or design deliverables for a project."
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
argument-hint: "[design-type] [context|prompt]"
metadata:
  category: design
  keywords: [brand, logo, CIP, banners, identity, image-generation, video-generation, text-to-speech, music-generation, MiniMax, OpenRouter, AI-media, design-tokens, nano-banana]
  providers: gemini
---

# Design — Brand, AI Media, Visual Production

Full design studio: brand identity, corporate identity mockups, slides, banners, icons, and AI-generated images/video/TTS/music.

**Not for UI code** — framework-shadcn/framework-tailwind standards auto-inject for components; `{skill:hc-cook} --layout <path>` for replicating from mockups.

## Usage

Route by task type:

| Task | Engine | Reference |
|------|--------|-----------|
| Logo creation | Gemini (Nano Banana) | `references/flow-logo.md` |
| CIP mockups, deliverables | Gemini (Flash/Pro) | `references/flow-cip.md` |
| Presentations, pitch decks | HTML/Chart.js | `references/flow-slides.md` |
| Banners, covers | HTML/CSS + AI | `references/tech-banner-formats.md` |
| Social media images | HTML/CSS | `references/flow-social.md` |
| SVG icons | Gemini 3.1 Pro | `references/flow-icon.md` |
| Canvas visual compositions | HTML5 Canvas | `references/tech-canvas-design.md` |
| AI images (creative/product) | MiniMax / OpenRouter | `references/tech-image-generation.md` |
| AI video clips | MiniMax Hailuo | `references/flow-video.md` |
| TTS voiceover | MiniMax speech | — |
| Music / background audio | MiniMax music-2.5 | `references/flow-music.md` |
| 129-prompt style pack | BM25 search | `references/prompt-pack/nano-banana.md` |

## Setup

```bash
export GEMINI_API_KEY="…"       # https://aistudio.google.com/apikey  (logo, CIP, icon)
export MINIMAX_API_KEY="…"      # https://platform.minimax.io          (AI images, video, TTS, music)
export OPENROUTER_API_KEY="…"   # https://openrouter.ai/settings/keys  (optional fallback)
pip install google-genai pillow && pip install -r scripts/media/requirements.txt
python scripts/media/check_setup.py   # verify MiniMax/OpenRouter keys + deps
```

## Logo

55+ styles, 30 palettes, 25 industry guides. Always generate with white background.

```bash
python scripts/logo/search.py "tech startup modern" --design-brief -p "BrandName"
python scripts/logo/generate.py --brand "TechFlow" --style minimalist --industry tech
python scripts/logo/generate.py --prompt "coffee shop vintage badge" --style vintage
```

After generation, offer HTML preview via `AskUserQuestion`; run `scripts/ui-ux/search.py --design-system` for palette/typography grounding if yes.

## CIP

50+ deliverables, 20 styles. Models: `flash` (default `gemini-2.5-flash-image`), `pro` (4K text).

```bash
python scripts/cip/search.py "tech startup" --cip-brief -b "BrandName"
python scripts/cip/generate.py --brand "TopGroup" --logo logo.png --deliverable "business card" --industry "consulting"
python scripts/cip/generate.py --brand "TopGroup" --logo logo.png --industry "consulting" --set   # full set
python scripts/cip/render-html.py --brand "TopGroup" --industry "consulting" --images ./cip-output
```

If no logo provided, run Logo section first.

## AI Images (MiniMax / OpenRouter)

```bash
python scripts/media/minimax_cli.py --task generate --prompt "mountain sunset" --model image-01
python scripts/media/openrouter_generate.py --model google/gemini-3.1-flash-image-preview --prompt "product photo"
python scripts/media/prompt_search.py "<concept>" --domain awesome   # search 129 curated styles
```

**Models:** `image-01` ($0.03/img) · `image-01-live` (enhanced) · OpenRouter `google/imagen-4.0-generate-001` · `black-forest-labs/flux.2-flex`

Style families in prompt pack: Ukiyo-e, Bento grid, vintage patent, cyberpunk, cinematic, vaporwave, Apple showcase, chalkboard, isometric, anime, chibi, comic storyboard.

## AI Video

```bash
python scripts/media/minimax_cli.py --task generate-video --prompt "drone shot over forest" --model MiniMax-Hailuo-2.3
```

**Models:** `MiniMax-Hailuo-2.3` (1080p) · `MiniMax-Hailuo-2.3-Fast` (50% cheaper) · `S2V-01` (subject reference)

## TTS + Music

```bash
python scripts/media/minimax_cli.py --task generate-speech --text "Hello world" --voice female-vivid  # 300+ voices
python scripts/media/minimax_cli.py --task generate-music --prompt "uplifting indie pop" --lyrics "verse\nchorus"
```

Music: `music-2.5`, up to 4-min songs with synced lyrics. TTS: `speech-2.8-hd` (best) / `speech-2.8-turbo` (fast).

## Slides

Strategic HTML presentations with Chart.js + design tokens. Load `references/flow-slides.md`.

## Banner

22 art direction styles. Workflow: requirements → research (`scripts/ui-ux/search.py --design-system` + Pinterest) → design HTML/CSS → export at exact px → present.

Safe zones: critical content in central 70–80%; one CTA per banner (bottom-right, ≥44px); max 2 fonts, ≥32px headline; text <20% for paid ads.

## Icon

15 styles, 12 categories. `gemini-3.1-pro-preview` SVG output.

```bash
python scripts/icon/generate.py --prompt "settings gear" --style outlined
python scripts/icon/generate.py --prompt "cloud upload" --batch 4 --output-dir ./icons
```

## Preflight (resize to API limits)

```bash
python ../hc-docs/scripts/media_optimizer.py <file>
```

## Quick Size Reference

| Platform | Banner | Social Photo |
|----------|--------|-------------|
| Facebook | 820×312 | 1200×630 |
| Twitter/X | 1500×500 | 1200×675 |
| LinkedIn | 1584×396 | 1200×627 |
| Instagram | — | 1080×1080 / 1080×1920 |
| YouTube | 2560×1440 | 1280×720 thumb |

## Workflow Position

**Follows:** `{skill:hc-plan}` — create assets called for in plan; `{skill:hc-new}` — generate logo/CIP for new project
**Precedes:** `{skill:hc-cook}` — assets feed into layout implementation
**Related:** `{skill:hc-cook} --layout` — replicate UI from mockups; `{skill:hl-visualize}` — for diagrams and slide-style explanations

## References

| File | Content |
|------|---------|
| `references/flow-logo.md` | Logo workflow: styles, palette search, generation |
| `references/flow-cip.md` | CIP workflow: deliverables, models, generation |
| `references/flow-cip-deliverables.md` | 50+ deliverable types and industry guides |
| `references/flow-icon.md` | Icon workflow: 15 styles, batch export |
| `references/flow-slides.md` | Slides workflow: HTML/Chart.js presentations |
| `references/tech-image-generation.md` | AI image generation model reference (MiniMax / OpenRouter) |
| `references/flow-video.md` | AI video generation (MiniMax Hailuo) |
| `references/flow-music.md` | Music generation (music-2.5, lyrics sync) |
| `references/flow-social.md` | Social media image design |
| `references/tech-banner-formats.md` | Banner sizes + 22 art direction styles |
| `references/tech-canvas-design.md` | Canvas composition system |
| `references/tech-image-generation.md` | Image generation model reference |
| `references/tech-cip-prompts.md` | CIP prompt engineering |
| `references/tech-logo-prompts.md` | Logo AI prompt engineering |
| `references/tech-logo-colors.md` | Color psychology for logo design |
| `references/tech-slides-template.md` | HTML slide template with Chart.js |
| `references/tech-slides-layouts.md` | 25 slide layout patterns |
| `references/quality-cip-styles.md` | CIP style guide |
| `references/quality-logo-styles.md` | Logo style guide |
| `references/quality-slides-copy.md` | 25 copywriting formulas for slides |
| `references/quality-slides-strategy.md` | 15 proven deck structures |
| `references/lib-minimax.md` | MiniMax API reference |
| `references/prompt-pack/nano-banana.md` | 129-prompt style pack (BM25 searchable) |
| `references/prompt-pack/validation-workflow.md` | Prompt validation workflow |
