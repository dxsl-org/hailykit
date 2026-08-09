# shadcn/ui Standards

## Ownership and composition

- Components live in `components/ui`; treat them as local owned code.
- Build on Radix primitives; do not reimplement keyboard nav, focus trap, or ARIA behavior.
- Use composition instead of wrapper-heavy abstractions.
- Use `cva` for reusable variants.
- Keep one-off styling in `className`; promote to a `cva` variant after 3+ uses.

## Theme contract

- Theme with CSS variables and semantic tokens such as `destructive`, `muted`, `background`, `foreground`.
- Pair every color token with a foreground token and verify contrast in both modes.
- Use `darkMode: ["class"]` with a `ThemeProvider`.

## Accessibility contract

- Icon-only controls require `aria-label` or `sr-only` text.
- `<Label htmlFor>` must match the input `id`.
- Use `<FormMessage>` for field errors.
- Dynamic status text uses `aria-live="polite"`.
- Focus styling uses `focus-visible:ring-2`, not outline removal without replacement.
- Motion-sensitive UI uses `motion-reduce:transition-none`.

## Forms

- Standard stack: React Hook Form + Zod.
- Use `FormField > FormItem > FormLabel > FormControl > FormMessage`.
- Validate on blur, not every keystroke, unless the field explicitly needs live validation.
