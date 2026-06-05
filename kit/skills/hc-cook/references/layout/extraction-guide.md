# Extraction Guide

Reverse-engineer design principles from existing images or videos to establish design guidelines.

## When to Use

- Analyze competitor websites or apps
- Extract design systems from inspiration (Dribbble, Awwwards, Mobbin)
- Reverse-engineer successful interfaces
- Create design documentation from visual references

## Quick Workflows

**Single image:**
Read `docs/inspiration/reference.png` directly and apply the extraction prompt from `extraction-prompts.md`.

**Multi-screen system:**
Read `docs/inspiration/home.png` and `docs/inspiration/about.png` directly and apply the multi-screen extraction prompt from `extraction-prompts.md`.

**Video motion analysis:**
Read `docs/inspiration/demo.mp4` directly and apply the motion analysis prompt from `extraction-prompts.md`.

After extraction, use guidelines with `lib-asset-gen.md` for generating design-aligned assets.

---

## Capture Quality Guidelines

### Screenshot Requirements
- High-resolution (minimum 1920px wide for desktop)
- Disable browser extensions that alter colors
- Actual viewport size, not full-page scrolls
- Device-specific: desktop 1920×1080, mobile 390×844
- Multiple states: default, hover, active, responsive breakpoints

### Multiple Examples
- Analyze 3–5 screens minimum for pattern recognition
- Include different page types (home, product, about, contact)
- Single screenshots miss patterns

## Analysis Best Practices

### 1. Demand Specifics
```
❌ "Uses blue and gray colors"
✓ "Primary: #1E40AF, Secondary: #6B7280, Accent: #F59E0B"

❌ "Modern sans-serif font"
✓ "Inter, weight 600, 48px for h1, tracking -0.02em"
```

### 2. Create Actionable Output
```css
:root {
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'Inter', sans-serif;
  --color-primary-600: #1E40AF;
  --color-accent-500: #F59E0B;
  --spacing-md: 16px;
  --radius-md: 8px;
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}
```

### 3. Cross-Reference
- Validate fonts against Google Fonts; use WhatFont/Font Ninja for accuracy
- Manually verify colors with eyedropper tools

### 4. Iterate
- Run initial comprehensive analysis → identify gaps → run focused follow-up queries

## Advanced Techniques

**Design system mining (10+ screens):**
Read the brand screenshot files under `docs/inspiration/brand/` directly and extract the complete production-ready design system: all color tokens, typography specs, spacing tokens, component variants, animation timings — output as CSS variables.

**Trend analysis:**
Read the reference screenshot files under `docs/inspiration/awwwards-*.png` directly and analyze: dominant aesthetic movements, color strategies, typography trends, layout innovations, animation patterns across these designs.

## Common Pitfalls

| ❌ Pitfall | ✓ Fix |
|---|---|
| Surface-level: "uses blue colors" | Demand specifics — hex codes, font names, px values |
| Missing context | Research brand/audience before analysis |
| Blind copying | Extract principles, adapt to your unique context |
| Single source | Analyze 3–5 examples to identify patterns vs anomalies |

## References

- `extraction-prompts.md` — all extraction prompt templates
- `extraction-templates.md` — documentation format templates
