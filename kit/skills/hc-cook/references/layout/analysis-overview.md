# Analysis Overview

Entry point for using `{skill:hl-design}` (generation) and the native Read tool (analysis) on visual assets in layout mode.

## When to Use

**Asset Generation:**
- Generate hero images, background assets, decorative elements
- Create placeholder images with specific aesthetic qualities
- Generate icon sets, illustrations, graphic elements, texture overlays

**Visual Analysis:**
- Verify generated assets meet design standards (score ≥ 7/10)
- Compare multiple variations objectively with ratings
- Extract exact color palettes with hex codes

**Design Extraction:**
- Reverse-engineer design systems from inspiration screenshots
- Analyze competitor designs to understand their approach
- Establish consistent aesthetic direction from references

## Core Principles

1. **Design-driven generation** — never generic AI imagery; every asset must align with the chosen aesthetic, typography, and color system.
2. **Analysis is mandatory** — score quality (1–10), extract specific values (hex codes, px sizes), test with UI overlays.
3. **Learn from excellence** — analyze 3–5 screens minimum; document with CSS-ready specs; adapt principles, don't copy.

## Quick Start

**Comprehensive analysis:**
Read `docs/assets/generated-hero.png` directly and apply the detailed prompt from `analysis-prompts.md` to analyze the asset.

**Compare variations:**
Read `docs/assets/option-1.png` and `docs/assets/option-2.png` directly and apply the comparison prompt from `analysis-prompts.md`.

**Extract color palette:**
Read `docs/assets/final-asset.png` directly and extract 5-8 dominant colors with hex codes; classify as primary/accent/neutral and suggest CSS variable names.

**Generate asset** (run from `hd-ai-generation/`):
```bash
python scripts/openrouter_generate.py --model google/imagen-4.0-generate-001 \
  -p "[design-driven prompt]" --output docs/assets/[name] --aspect-ratio 16:9
```

## Score-Based Decision Framework

| Score | Decision | Actions |
|---|---|---|
| ≥ 8/10 | Proceed to integration | Optimize for web, create responsive variants, extract CSS palette |
| 6–7/10 | Minor refinements | Use `{skill:hd:media-processing}` for brightness/contrast; proceed with caution |
| < 6/10 | Major iteration | Analyze failure points, refine prompt, regenerate |

## Models

| Task | Model | Cost |
|---|---|---|
| Image generation (iteration) | `imagen-4.0-fast-generate-001` | ~$0.02/image |
| Image generation (production) | `imagen-4.0-generate-001` | ~$0.04/image |
| Image generation (hero/critical) | `imagen-4.0-ultra-generate-001` | ~$0.08/image |
| Visual analysis | Native Read tool | free (no API call) |

## References

- `analysis-prompts.md` — prompt templates for analysis and comparison
- `analysis-techniques.md` — advanced analysis strategies
- `analysis-best-practices.md` — quality guidelines and common pitfalls
- `lib-asset-gen.md` — complete asset generation workflow
