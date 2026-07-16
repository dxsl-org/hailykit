# Quick Design Workflow

Rapid design creation with minimal planning overhead.

## Prerequisites
- Activate `{skill:hl-design}` skill first

## Initial Research
Run `{skill:hl-design}` searches:
```bash
python3 .claude/skills/hl-design/scripts/ui-ux/search.py "<product-type>" --domain product
python3 .claude/skills/hl-design/scripts/ui-ux/search.py "<style-keywords>" --domain style
python3 .claude/skills/hl-design/scripts/ui-ux/search.py "<mood>" --domain typography
python3 .claude/skills/hl-design/scripts/ui-ux/search.py "<industry>" --domain color
```

## Workflow Steps

### 1. Start Design Process
Use `haily-designer` subagent directly:
- Skip extensive planning
- Move to implementation quickly
- Make design decisions on-the-fly

### 2. Implement
- Default to HTML/CSS/JS if unspecified
- Focus on core functionality
- Maintain quality despite speed

### 3. Generate Assets
- Generate required visuals using `{skill:hl-design}`
- Read generated files directly to verify quality
- Use `imagemagick`/`ffmpeg` for adjustments

### 4. Report & Approve
- Summarize changes briefly
- Request user approval
- Update `./docs/design-guidelines.md` if approved

## When to Use
- Simple components
- Prototypes and MVPs
- Time-constrained projects
- Iterative exploration
- Single-page designs

## Quality Shortcuts
While moving fast, maintain:
- Semantic HTML
- CSS variables for consistency
- Basic accessibility
- Clean code structure

## Related
- `flow-immersive.md` - For comprehensive designs
- `tech-overview.md` - Quick reference
