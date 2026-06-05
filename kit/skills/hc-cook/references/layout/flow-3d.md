# 3D Design Workflow

Create immersive interactive 3D designs with Three.js.

## Prerequisites
- Activate `hd:ui-ux` skill first
- Activate `hd:threejs` skill for 3D and WebGL expertise
- Use the native Read tool for visual analysis of generated assets

## Initial Research
Run `hd:ui-ux` searches:
```bash
python3 .claude/skills/hd-ui-ux/scripts/search.py "<product-type>" --domain product
python3 .claude/skills/hd-ui-ux/scripts/search.py "immersive 3d" --domain style
python3 .claude/skills/hd-ui-ux/scripts/search.py "animation" --domain ux
```

## Workflow Steps

### 1. Create Implementation Plan
Use `haily-designer` + `haily-researcher` subagents:
- Create plan directory (use `## Naming` pattern)
- Write `plan.md` (<80 lines overview)
- Add `phase-XX-name.md` files
- Keep research reports under 150 lines

### 2. Implement with Three.js
Use `haily-designer` subagent to build:
- Three.js scene setup
- Custom GLSL shaders
- GPU particle systems
- Cinematic camera controls
- Post-processing effects
- Interactive elements

### 3. Generate 3D Assets
Use `hl:design` skill for:
- Textures and materials
- Skyboxes and environment maps
- Particle sprites
- Video backgrounds

Use `hd:media-processing` skill for:
- Texture optimization for WebGL
- Normal/height map generation
- Sprite sheet creation
- Background removal
- Asset optimization

### 4. Verify & Report
- Test across devices
- Optimize for 60fps
- Report to user
- Request approval

### 5. Document
Update `./docs/design-guidelines.md` with:
- 3D design patterns
- Shader libraries
- Reusable components

## Technical Requirements

### Three.js Implementation
- Proper scene optimization
- Efficient draw calls
- LOD (Level of Detail) where needed
- Responsive canvas behavior
- Memory management

### Shader Development
- Custom vertex shaders
- Custom fragment shaders
- Uniform management
- Performance optimization

### Particle Systems
- GPU-accelerated rendering
- Efficient buffer geometry
- Point sprite optimization

### Post-Processing
- Render pipeline setup
- Effect composition
- Performance budgeting

## Implementation Stack
- Three.js - 3D rendering
- GLSL - Custom shaders
- HTML/CSS/JS - UI integration
- WebGL - GPU graphics

## Performance Targets
- 60fps minimum
- < 100ms initial load
- Responsive to viewport
- Mobile-friendly fallbacks

## Related
- `lib-animejs.md` - UI animation patterns
- `tech-overview.md` - Performance tips
- `lib-asset-gen.md` - Asset creation
