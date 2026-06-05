# Complete Workflow Examples

End-to-end pipeline examples for asset generation and analysis.

## Example 1: Hero Section (Complete Pipeline)

```bash
# 1. Generate hero image with design context
python scripts/openrouter_generate.py --model google/imagen-4.0-generate-001 -p "Minimalist desert landscape, warm beige sand dunes,
  soft morning light, serene and spacious, muted earth tones
  (tan, cream, soft ochre), clean composition for text overlay,
  sophisticated travel aesthetic, 16:9 cinematic" --output docs/assets/hero-desert --aspect-ratio 16:9  # (run from hd-ai-generation/)

# 2. Evaluate aesthetic quality
Read docs/assets/hero-desert.png directly and rate 1-10 for: visual appeal, color harmony,
  suitability for overlaying white text, professional quality.
  List any improvements needed.

# 3. If score ≥ 7/10, optimize for web
python scripts/media_optimizer.py \
  --input docs/assets/hero-desert.png \
  --output docs/assets/hero-desktop.webp \
  --quality 85

# 4. Generate mobile variant (9:16)
python scripts/openrouter_generate.py --model google/imagen-4.0-generate-001 -p "Minimalist desert landscape, warm beige sand dunes,
  soft morning light, serene and spacious, muted earth tones
  (tan, cream, soft ochre), clean composition for text overlay,
  sophisticated travel aesthetic, 9:16 portrait" --output docs/assets/hero-mobile --aspect-ratio 9:16  # (run from hd-ai-generation/)

# 5. Optimize mobile variant
python scripts/media_optimizer.py \
  --input docs/assets/hero-mobile.png \
  --output docs/assets/hero-mobile.webp \
  --quality 85
```

## Example 2: Extract, Generate, Analyze Loop

```bash
# 1. Extract design guidelines from inspiration
Read docs/inspiration/competitor-hero.png directly and apply the extraction prompt from extraction-prompts.md.

# 2. Generate asset based on extracted guidelines
# (Review competitor-analysis.md for color palette, aesthetic)
python scripts/openrouter_generate.py --model google/imagen-4.0-generate-001 -p "[craft prompt using extracted aesthetic and colors]" --output docs/assets/our-hero --aspect-ratio 16:9  # (run from hd-ai-generation/)

# 3. Analyze our generated asset
Read docs/assets/our-hero.png directly and compare to the competitor design. Rate differentiation (1-10):
  are we too similar or successfully distinct?

# 4. Extract colors from our final asset for CSS
Read docs/assets/our-hero.png directly and apply the color extraction prompt from analysis-overview.md.
```

## Example 3: A/B Test Assets

```bash
# Generate 2 design directions
python scripts/openrouter_generate.py --model google/imagen-4.0-fast-generate-001 -p "Minimalist approach: [prompt]" --output docs/assets/variant-a --aspect-ratio 16:9  # (run from hd-ai-generation/)

python scripts/openrouter_generate.py --model google/imagen-4.0-fast-generate-001 -p "Bold approach: [prompt]" --output docs/assets/variant-b --aspect-ratio 16:9  # (run from hd-ai-generation/)

# Compare variants
Read docs/assets/variant-a.png and docs/assets/variant-b.png directly and perform an A/B comparison for [target audience]:
  1. Attention capture
  2. Brand alignment
  3. Conversion potential
  Recommend which to test.

# Generate production version of winner
python scripts/openrouter_generate.py --model google/imagen-4.0-generate-001 -p "[winning approach prompt]" --output docs/assets/final-hero --aspect-ratio 16:9  # (run from hd-ai-generation/)
```

## Batch Analysis for Rapid Iteration

```bash
# Generate 3 variations with fast model
for i in {1..3}; do
  python scripts/openrouter_generate.py --model google/imagen-4.0-fast-generate-001 -p "[prompt with variation-$i twist]" --output docs/assets/var-$i --aspect-ratio 16:9  # (run from hd-ai-generation/)
done

# Batch analyze all variations
Read each variation file (docs/assets/var-1.png, var-2.png, var-3.png) directly and rank them 1-3 with scores, identifying the winner.
```
