# Technical Overview

Quick reference for AI multimodal integration technical considerations.

## File Format Selection

| Format | Use when | Trade-off |
|---|---|---|
| WebP | Web delivery (default) | 25–35% smaller than PNG, wide support |
| AVIF | Cutting edge | 50% smaller than WebP, limited support |
| PNG | Transparency needed | Lossless, large file size |
| JPEG | Photos without transparency | Lossy, smaller than PNG |

## Quick Commands

**Generate** (run from `hd-ai-generation/`):
```bash
python scripts/openrouter_generate.py \
  --model google/imagen-4.0-generate-001 \
  --prompt "[design-driven prompt]" \
  --output docs/assets/[name].png \
  --aspect-ratio 16:9
```

**Analyze:**
Read `docs/assets/[image].png` directly and apply the evaluation criteria.

**Optimize** (run from `hc-docs/`):
```bash
python scripts/media_optimizer.py --input docs/assets/[image].png \
  --output docs/assets/[image].webp --quality 85
```

**Extract colors:**
Read `docs/assets/[image].png` directly and extract 5-8 dominant colors with hex codes; classify as primary/accent/neutral.

## Responsive Variants

```bash
--aspect-ratio 16:9   # Desktop hero
--aspect-ratio 9:16   # Mobile hero
--aspect-ratio 1:1    # Square cards
```

```html
<!-- Art direction (different crops) -->
<picture>
  <source media="(min-width: 768px)" srcset="hero-desktop.webp">
  <img src="hero-mobile.webp" alt="Hero">
</picture>

<!-- Resolution switching (same crop) -->
<img srcset="hero-400w.webp 400w, hero-800w.webp 800w"
     sizes="(max-width: 600px) 400px, 800px" src="hero-800w.jpg" alt="Hero">
```

## Model Selection & Cost

| Phase | Model | Cost | Speed | Use for |
|---|---|---|---|---|
| Exploration (3–5 variations) | `imagen-4.0-fast-generate-001` | ~$0.02/img | 5–10s | Rapid iteration |
| Refinement (1–2 variations) | `imagen-4.0-generate-001` | ~$0.04/img | 10–20s | Production assets |
| Final polish (1 generation) | `imagen-4.0-ultra-generate-001` | ~$0.08/img | 20–30s | Hero, marketing |
| All analysis | Native Read tool | free (no API call) | instant | Vision tasks |

## Budget Guidelines

| Project size | Images | Cost |
|---|---|---|
| Small | 10–20 | ~$2–5 |
| Medium | 50–100 | ~$10–20 |
| Large | 200+ | ~$50+ |

## Optimization Tips

1. **Explore cheap** — use fast model first; commit to production quality only after
2. **Batch analyze** — read multiple variation files directly and compare in one pass
3. **Reuse prompts** — once working, reuse with variations
4. **Responsive on-demand** — only generate mobile variants for assets that need them
5. **Skip ultra unless critical** — standard quality sufficient for most assets

## Detailed References

- `tech-accessibility.md` — WCAG compliance, contrast checks, alt text
- `tech-workflows.md` — complete pipeline examples
- `tech-best-practices.md` — checklists, quality gates
