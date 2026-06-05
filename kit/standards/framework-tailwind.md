# Tailwind CSS Standards

## Core Rules
- **Utility-first** — apply utilities directly; extract to `@apply` only for truly repeated patterns (3+ times)
- **Mobile-first** — base styles = mobile; breakpoint prefixes add complexity upward (`sm:` `md:` `lg:` `xl:` `2xl:`)
- **Avoid dynamic class names** — Tailwind purges at build time; `bg-${color}-500` won't survive (`bg-red-500` will)
- **Arbitrary values** — use `p-[17px]`, `bg-[#bada55]`, `grid-cols-[1fr_500px_2fr]` for one-offs

## Breakpoints
| Prefix | Min width | Use for |
|--------|-----------|---------|
| `sm:` | 640px | Large phones |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Wide desktop |
| `2xl:` | 1536px | Very wide |

`max-lg:` syntax targets *below* a breakpoint. Container queries: wrap in `@container`, use `@md:` etc.

## Layout Essentials
```html
<!-- Responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">

<!-- Flex stack → row -->
<div class="flex flex-col lg:flex-row gap-4">

<!-- Centered content column -->
<div class="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
```

## Spacing Scale (4pt/8dp base)
`1`=4px · `2`=8px · `3`=12px · `4`=16px · `6`=24px · `8`=32px · `12`=48px · `16`=64px

## Dark Mode
```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
```
- Use `darkMode: ["class"]` in config (class-toggled via shadcn/next-themes)
- Always define both light and dark variants for every colored element
- Dark mode: desaturated/tonal variants, not color inverts

## Custom Tokens (`@theme`)
```css
@import "tailwindcss";
@theme {
  --color-brand-500: oklch(0.55 0.22 264);
  --font-display: "Satoshi", sans-serif;
  --spacing-18: calc(var(--spacing) * 18);
  --breakpoint-3xl: 120rem;
  --shadow-glow: 0 0 20px rgba(139, 92, 246, 0.3);
}
```
Prefer `@theme` CSS over `tailwind.config.ts` `extend` for new projects.

## Layer Organization
```css
@layer base { /* HTML element defaults, typography scale */ }
@layer components { /* Reusable patterns: .btn, .card, .input-field */ }
@layer utilities { /* Custom utilities: .scrollbar-hide, .text-balance */ }
```

## Custom Utilities
```css
@utility glass { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); }
@utility scrollbar-hide { scrollbar-width: none; }
```

## Key Patterns
```html
<!-- Conditional visibility -->
<div class="hidden md:block">Desktop only</div>
<div class="md:hidden">Mobile only</div>

<!-- Aspect ratio -->
<div class="aspect-video">16:9</div>
<div class="aspect-square">1:1</div>

<!-- Responsive text clamping -->
<h1 class="text-2xl md:text-4xl lg:text-6xl font-bold">
<p class="line-clamp-3">Clamped to 3 lines</p>

<!-- Opacity via modifier -->
<div class="bg-black/75 text-white/90">
```

## Typography Defaults
- Body: `text-base leading-relaxed` (1rem / 1.75)
- Min 16px on mobile (`text-base` or larger) to prevent iOS auto-zoom on inputs
- Line length: `max-w-prose` (65ch) for readable paragraphs
- Heading hierarchy: `text-4xl font-bold` → `text-3xl font-semibold` → `text-2xl font-medium`

## Plugins
```bash
npm i -D @tailwindcss/typography   # prose class for article content
npm i -D @tailwindcss/forms        # styled form resets
npm i -D tailwindcss-animate       # required by shadcn/ui animations
```
