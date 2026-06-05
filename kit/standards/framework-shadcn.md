# shadcn/ui Standards

## Setup
```bash
npx shadcn@latest init                           # prompts framework, TS, paths, theme
npx shadcn@latest add button card dialog form    # install to components/ui/
```

## Component Model
- **Copy-paste distribution** — components live in your codebase (`components/ui/`); modify directly
- **Radix primitives** — keyboard nav, focus trapping, ARIA built-in; never recreate these manually
- **Composition** — build complex UIs from simple primitives; avoid wrapping components unnecessarily
- **TypeScript-first** — use full type safety; prefer `cva` for variant definitions

## Theming (CSS Variables)
```css
/* globals.css — HSL without hsl() wrapper for opacity control */
:root { --primary: 222.2 47.4% 11.2%; --background: 0 0% 100%; /* … */ }
.dark { --primary: 210 40% 98%; --background: 222.2 84% 4.9%; /* … */ }
```
```ts
// tailwind.config.ts — map CSS vars to Tailwind tokens
colors: { primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' } }
```
- Use `darkMode: ["class"]` + `next-themes` ThemeProvider
- Semantic naming: `destructive` not `red`, `muted` not `gray`
- Pair every color with a foreground color; test contrast in both modes
- Change theme by updating CSS variables in `globals.css`; use https://ui.shadcn.com/themes

## Adding Variants
```tsx
const buttonVariants = cva("...", {
  variants: { variant: { gradient: "bg-gradient-to-r from-purple-500 to-pink-500 text-white" } }
})
```
Use `className` prop for one-off overrides; extract to `cva` variant only when reused 3+ times.

## Accessibility (Radix handles most of this — don't reinvent)
- Dialog/Sheet: focus trapped automatically; Esc closes; focus returns to trigger on close
- DropdownMenu/Select: arrow keys navigate; Enter/Space activates; Esc closes
- Tabs: arrow keys navigate between triggers; Enter activates
- **Always** pair icon-only buttons with `aria-label` or `<span className="sr-only">`
- **Always** link `<Label htmlFor>` to input `id`; use `<FormMessage>` for errors
- Use `aria-live="polite"` for dynamic status announcements
- Focus rings: use `focus-visible:ring-2` not `focus:outline-none`
- Reduced motion: wrap animations in `motion-reduce:transition-none`

## Form Pattern (React Hook Form + Zod)
```tsx
const form = useForm({ resolver: zodResolver(schema), defaultValues })
// Always use FormField > FormItem > FormLabel > FormControl > FormMessage
// Validate on blur (not keystroke); FormMessage auto-announces errors to screen readers
```

## Dark Mode Toggle
```tsx
const { setTheme, theme } = useTheme()
// <Sun> + <Moon> icons toggled via dark:-rotate-90 dark:scale-0 / dark:rotate-0 dark:scale-100
```
