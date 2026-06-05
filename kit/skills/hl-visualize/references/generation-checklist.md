# Pre-Delivery Quality Checklist

Run this checklist before delivering any output. Incomplete = regenerate.

---

## All Modes

- [ ] **Completeness:** every content item from the source/topic appears somewhere in the output — nothing silently dropped
- [ ] **No placeholder text:** no `[INSERT]`, `TODO`, `...`, or `Lorem ipsum` in final output
- [ ] **Output saved:** file written to disk (`.html`, `.xlsx`, `.pdf`, etc.), not just printed to terminal

---

## Mermaid Diagrams (any mode that includes Mermaid)

### Visual self-review (MANDATORY before delivery)

After generating the Mermaid code, verify it renders correctly:

```bash
# Write diagram to temp file and render (cross-platform)
echo '<diagram-code>' > diagram-check.mmd && npx mmdc -i diagram-check.mmd -o diagram-check.svg 2>&1; rm -f diagram-check.mmd diagram-check.svg
```

If rendering in an HTML page, open it in a browser and visually inspect.

### Checklist

- [ ] Diagram renders without error (no `parse error`, `undefined`, `NaN`)
- [ ] No node overlap — every node label is fully visible
- [ ] No crossed arrows obscuring content — if present, adjust layout direction (TD → LR or vice versa) or use `layout: 'elk'`
- [ ] All labels fit within their node shapes — long labels use `<br/>` not `\n`
- [ ] Special characters quoted — labels with `/`, `(`, `{`, `:` are wrapped in `"double quotes"`
- [ ] Node count ≤ 12 — if larger, summarize/group into clusters
- [ ] Uses `theme: 'base'` with `themeVariables` — never `theme: 'default'` which breaks dark mode
- [ ] `classDef` does not set `color:` directly — uses semi-transparent fill only

---

## HTML Pages (`--html` + any generation flag)

- [ ] **Theme toggle present** — `<button class="theme-toggle">` is the first child of `<body>`; `data-theme` attribute toggles correctly
- [ ] **Both themes tested** — page looks correct in both light and dark mode (not just one)
- [ ] **All CSS/JS inlined** — no external script/link tags; file opens offline
- [ ] **No forbidden patterns:**
  - No Inter, Roboto, or Arial as the only font
  - No Tailwind indigo/violet/fuchsia accents
  - No gradient text on headings
  - No emoji icons in section headers
  - No perfectly-uniform card grid on every section
- [ ] **Font loaded from Google Fonts** — uses `display=swap`, one of the 12 approved pairings
- [ ] **Responsive** — page is usable at 375px (mobile) and 1440px (desktop)

---

## Slide Decks (`--html --slides`)

- [ ] **All content items appear** — inventory source, map to slides; nothing dropped
- [ ] **Content density limits respected:**
  - Text slides: ≤ 5–6 bullets
  - Table slides: ≤ 8 rows
  - Diagram slides: ≤ 8–10 nodes
  - Quote slides: single quote, max 3 lines
- [ ] **Each slide fits 100dvh** — no in-slide scrolling required
- [ ] **Composition varied** — not every slide centered with icon + title + bullets; alternates between layouts (split, full-bleed, left-heavy, etc.)
- [ ] **Navigation works** — arrow keys, swipe (mobile), progress bar, slide counter all functional
- [ ] **≥ 2 images for 10+ slide decks** — title slide or full-bleed slide has an image

---

## Excel Outputs (`--excel`)

- [ ] Workbook opens without error in Excel/LibreOffice
- [ ] All worksheets populated with correct data
- [ ] Charts render with correct data references
- [ ] Named tables defined where applicable
- [ ] File opens automatically after save (cross-platform command)

---

## PDF Outputs (`--pdf`)

- [ ] PDF renders all text without garbled characters or missing glyphs
- [ ] For form filling: all field names matched and values filled; `pdftk flatten` applied
- [ ] File size reasonable (< 20MB for typical reports; if larger, optimize images)
- [ ] File opens automatically after save
