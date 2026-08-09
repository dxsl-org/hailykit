# Social Photos Design Guide

Design social images through HTML/CSS rendering plus screenshot export. This reference covers static social-photo assets only.

## Platform Dimensions

| Platform | Type | Size (px) | Aspect |
|---|---|---:|---|
| Instagram | Post | 1080 x 1080 | 1:1 |
| Instagram | Story / Reel | 1080 x 1920 | 9:16 |
| Instagram | Carousel | 1080 x 1350 | 4:5 |
| Facebook | Post | 1200 x 630 | 1.91:1 |
| Facebook | Story | 1080 x 1920 | 9:16 |
| Twitter/X | Post | 1200 x 675 | 16:9 |
| Twitter/X | Card | 800 x 418 | 1.91:1 |
| LinkedIn | Post | 1200 x 627 | 1.91:1 |
| LinkedIn | Article | 1200 x 644 | 1.86:1 |
| Pinterest | Pin | 1000 x 1500 | 2:3 |
| YouTube | Thumbnail | 1280 x 720 | 16:9 |
| TikTok | Cover | 1080 x 1920 | 9:16 |
| Threads | Post | 1080 x 1080 | 1:1 |

Default outputs when the user does not specify sizes: Instagram Post `1080x1080` and Instagram Story `1080x1920`.

## Workflow

1. Parse the brief: subject, target platforms, visual style, content elements, and quantity.
2. Load brand guidance from `docs/brand-guidelines.md` when it exists.
3. Run `scripts/ui-ux/search.py --design-system` to extract brand colors, typography, spacing, and layout cues.
4. Generate 3-5 idea directions that vary composition and typography while staying on-brief.
5. Present those ideas for user approval before producing final HTML variants.
6. For each approved idea and target size, create one self-contained HTML file under `output/social-photos/`.
7. Export PNGs from those HTML files at exact viewport size, then run the visual QA loop until clean.
8. Save the summary report under `.agents/reports/`.

## HTML Contract

- **Viewport**: set exact pixel dimensions for the target platform.
- **Self-contained**: inline CSS; if fonts are remote, load only what the page needs.
- **No scroll**: `html` and `body` must fit one viewport with `overflow: hidden`.
- **Safe zones**: keep critical text and logos inside the central 80%.
- **Readability**: thumbnail-safe contrast and hierarchy; keep body copy minimal.
- **Typography floor**: at `1080px` width, headline >= `24px`, body >= `16px`.
- **Accessibility**: text/background contrast must meet WCAG AA `4.5:1`.

Suggested output naming:

```text
output/social-photos/
  idea-1-instagram-post-1080x1080.html
  idea-1-instagram-story-1080x1920.html
  exports/
    idea-1-instagram-post-1080x1080.png
```

## Export Contract

Use an exact-size browser capture flow such as Chrome headless or Playwright.

- Wait `3-5s` after load so fonts and images finish rendering before capture.
- Hide scrollbars in the capture path.
- Export PNGs into `output/social-photos/exports/`.

Example Chrome headless pattern:

```bash
google-chrome \
  --headless \
  --hide-scrollbars \
  --window-size="${WIDTH},${HEIGHT}" \
  --virtual-time-budget=5000 \
  --screenshot="output/social-photos/exports/output.png" \
  "file:///absolute/path/to/file.html"
```

## Visual QA Loop

Inspect each PNG and repeat until all checks pass:

1. Fonts, images, and colors rendered as intended.
2. No overflow, clipping, or accidental scrollbars.
3. Safe zones respected and hierarchy remains legible at thumbnail size.
4. Contrast stays at or above WCAG AA `4.5:1`.
5. If any check fails: fix the HTML source, re-export, and verify again.

## Report Output

Write the delivery report to `.agents/reports/` and include:

- original prompt
- target platforms and sizes
- approved idea names
- output file list
- concise rationale for palette, typography, and composition
- remaining follow-up notes if the user requested more variants

## Platform Notes

- Instagram: visual-first, low text density, strong focal point.
- LinkedIn: cleaner, more professional hierarchy.
- Pinterest: vertical, text-overlay-friendly.
- YouTube thumbnails: prioritize small-size readability and a single dominant focal element.

## Scope Exclusions

This reference does not cover:

- video or animation
- motion graphics
- print production files
- direct social posting or scheduling
- AI image generation workflows
