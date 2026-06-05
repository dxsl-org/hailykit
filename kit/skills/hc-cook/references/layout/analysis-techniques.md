# Advanced Analysis Techniques

Advanced strategies for visual analysis and testing.

## Batch Analysis for Rapid Iteration

Analyze multiple generations simultaneously:

```bash
# Generate 3 variations with fast model
for i in {1..3}; do
  python scripts/openrouter_generate.py --model google/imagen-4.0-fast-generate-001 -p "[prompt with variation-$i twist]" --output docs/assets/var-$i --aspect-ratio 16:9  # (run from hd-ai-generation/)
done

# Batch analyze all variations
Read each variation file (docs/assets/var-1.png, var-2.png, var-3.png) directly and rank them 1-3 with scores, identifying the winner.
```

## Contextual Testing

Test assets in actual UI context:

1. **Mock up UI overlay** (use design tool or code)
2. **Capture screenshot** of asset with real UI elements
3. **Analyze integrated version** for readability, hierarchy, contrast

Read `docs/assets/hero-mockup-with-ui.png` directly and evaluate the hero section:
1. Headline readability over image
2. CTA button visibility and contrast
3. Navigation bar integration
4. Overall visual hierarchy effectiveness

Provide WCAG contrast ratio estimates.

## A/B Testing Analysis

Compare design directions objectively:

Read `docs/assets/design-a.png` and `docs/assets/design-b.png` directly and perform an A/B test analysis:

Design A: [minimalist approach]
Design B: [maximalist approach]

Compare for:
1. User attention capture (first 3 seconds)
2. Information hierarchy clarity
3. Emotional impact and brand perception
4. Conversion optimization potential
5. Target audience alignment ([describe audience])

Recommend which to A/B test in production and why.

## Iteration Strategy

When score < 6/10:

1. **Identify top 3 weaknesses** from analysis
2. **Address each in refined prompt**
3. **Regenerate with fast model** first
4. **Re-analyze before committing** to standard model
5. **Iterate until score ≥ 7/10**

Example:
```bash
# First attempt scores 5/10 - "colors too muted, composition unbalanced"

# Refine prompt addressing specific issues
python scripts/openrouter_generate.py --model google/imagen-4.0-fast-generate-001 -p "[original prompt] + vibrant saturated colors, dynamic diagonal composition" --output docs/assets/hero-v2  # (run from hd-ai-generation/)

# Re-analyze
Read docs/assets/hero-v2.png directly and apply the same evaluation criteria.
```

## Documentation Strategy

Save analysis reports for design system documentation:

```
docs/
  assets/
    hero-image.png
    hero-analysis.md       # Analysis report
    hero-color-palette.md  # Extracted colors
  design-guidelines/
    asset-usage.md         # Guidelines derived from analysis
```
