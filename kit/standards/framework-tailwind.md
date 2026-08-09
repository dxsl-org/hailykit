# Tailwind CSS Standards

## Core rules

- Utility-first; extract to `@apply` only for patterns repeated 3+ times.
- Mobile-first: base styles are mobile, breakpoint prefixes add complexity upward.
- Do not use dynamic class names such as `bg-${color}-500`; build purge cannot see them.
- Arbitrary values are valid for one-offs: `p-[17px]`, `bg-[#bada55]`, `grid-cols-[1fr_500px_2fr]`.

## Responsive contract

- Breakpoints: `sm:` `md:` `lg:` `xl:` `2xl:`
- `max-lg:` targets below the breakpoint.
- Use `@container` with `@md:` style container-query variants when component width matters.

## Theme and layers

- Use `darkMode: ["class"]`.
- Every colored element defines both light and dark variants.
- Prefer `@theme` CSS tokens for project tokens.
- Keep structure clear with `@layer base`, `@layer components`, and `@layer utilities`.
- Custom one-off helpers belong in `@utility`.

```css
@import "tailwindcss";
@theme { --color-brand-500: oklch(0.55 0.22 264); }
@layer base {}
@layer components {}
@layer utilities {}
@utility glass { backdrop-filter: blur(10px); }
```

## Layout and typography

- Use responsive grids and flex layouts; keep mobile spacing tighter than desktop spacing.
- Inputs stay at least `16px` on mobile to avoid iOS auto-zoom.
- Long-form text stays near `max-w-prose`.
- Maintain readable heading hierarchy and line length.

## shadcn compatibility

- Install `tailwindcss-animate`; shadcn motion depends on it.
