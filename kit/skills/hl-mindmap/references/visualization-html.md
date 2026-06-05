# Visualization HTML

D3.js inline HTML template for `.agents/mindmaps/{slug}.html`.

---

## Architecture

- Single `.html` file — all CSS and JS inline, no external deps, no server required
- D3.js v7 force-directed graph (`d3.forceSimulation`)
- Graph JSON injected as `const GRAPH_DATA = {...}` — no fetch calls
- Theme toggle button (light/dark) required on every output page

---

## Color Coding

### Node fill by `type`

| Type | Color | Hex |
|------|-------|-----|
| `event` | Blue | `#4A90D9` |
| `concept` | Purple | `#7B68EE` |
| `person` | Green | `#50C878` |
| `org` | Orange | `#FF8C00` |
| `place` | Teal | `#20B2AA` |
| `custom` | Gray | `#A9A9A9` |

Isolated nodes (no edges): same fill color, dashed border stroke.

### Edge stroke by `confidence`

| Confidence | Color | Style |
|------------|-------|-------|
| `CONFIRMED` | Dark green `#2E8B57` | solid |
| `INFERRED` | Goldenrod `#DAA520` | dashed (`stroke-dasharray: 6 3`) |
| `AMBIGUOUS` | Red `#CD5C5C` | dotted (`stroke-dasharray: 2 4`) |

---

## HTML Structure

```html
<!DOCTYPE html>
<html data-theme="dark">
<head>
  <meta charset="UTF-8">
  <title>{topic} — Mindmap</title>
  <style>/* all CSS inline — see CSS section */</style>
</head>
<body>
  <header>
    <h1 id="title">{topic}</h1>
    <div id="controls">
      <span id="stats"></span>
      <button id="theme-toggle" title="Toggle light/dark">☀</button>
    </div>
  </header>
  <div id="graph-container">
    <svg id="graph"></svg>
    <aside id="detail-panel" hidden>
      <button id="panel-close">✕</button>
      <div id="panel-content"></div>
    </aside>
  </div>
  <div id="legend"></div>
  <script>
    const GRAPH_DATA = /* injected JSON */;
    /* D3.js v7 UMD inline + graph rendering code */
  </script>
</body>
</html>
```

---

## D3.js Force Simulation

```js
const simulation = d3.forceSimulation(nodes)
  .force("link", d3.forceLink(edges).id(d => d.id).distance(120))
  .force("charge", d3.forceManyBody().strength(-300))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collision", d3.forceCollide(40));
```

Nodes are draggable (`d3.drag`). SVG has zoom/pan (`d3.zoom`). On tick, update `cx`/`cy` for circles and `x1/y1/x2/y2` for lines.

---

## Interactions

| Action | Behavior |
|--------|----------|
| Node click | Open detail panel: label, type, attrs JSON, list of connected edges |
| Edge hover | Tooltip: type, label, confidence, source_url (clickable if present) |
| Node drag | Repositionable; releases to float in simulation |
| Scroll / pinch | Zoom in/out |
| Click background | Pan |
| Theme button | Toggle `data-theme` on `<html>`; CSS vars switch palette |
| Panel close (✕) | Hide detail panel |

---

## Legend

Always-visible legend at bottom of page:

```
Node types:  ● event  ● concept  ● person  ● org  ● place  ● custom
Edges:       — CONFIRMED  ╌ INFERRED  ··· AMBIGUOUS
```

Render as inline SVG swatches with matching colors.

---

## Stats Line

Populate `#stats` with: `{N} nodes · {M} edges ({K} confirmed, {L} inferred, {J} ambiguous)`

---

## CSS Variables (light/dark)

```css
:root { --bg: #1a1a2e; --surface: #16213e; --text: #e0e0e0; --border: #333; }
[data-theme="light"] { --bg: #f5f5f5; --surface: #ffffff; --text: #1a1a1a; --border: #ddd; }
```

---

## D3.js Source

Use D3.js v7 UMD build inlined from the official release. Minified bundle is ~280KB. Inline the full bundle so the HTML works offline. Alternatively, if the agent cannot inline the full bundle, use a `<script src>` CDN tag with a fallback note — but prefer inline.

```html
<!-- preferred: full inline bundle -->
<script>/* d3 v7 minified UMD */</script>

<!-- fallback if inline is impractical -->
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
```
