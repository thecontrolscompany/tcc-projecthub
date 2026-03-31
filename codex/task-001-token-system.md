# Task 001 — CSS Token System + Tailwind Config

## Instructions for Codex

Read these files before starting:
- `docs/theme-brand-system.md` (sections 3, 4, and 9)
- `src/app/globals.css` (current contents)
- `tailwind.config.ts` (current contents)

## Work to do

### 1. `src/app/globals.css`

Add the following blocks **after** any existing content — do not remove anything:

- The full `:root { }` light theme CSS custom property block from `docs/theme-brand-system.md` section 3
- The full `[data-theme="dark"] { }` dark theme block from the same section
- Four `@font-face` declarations for Raleway at weights 400, 500, 600, 700:
  - `src: url('/fonts/raleway-{weight}.woff2') format('woff2'), url('/fonts/raleway-{weight}.ttf') format('truetype')`
  - Use `font-display: swap`
  - Font files do not exist yet — write the declarations anyway, they will 404 gracefully until fonts are copied

### 2. `tailwind.config.ts`

Merge the following into the existing config — do not overwrite the whole file:

- `darkMode: ["class", '[data-theme="dark"]']`
- Under `theme.extend.colors`: add `brand`, `surface`, `border`, `text`, `status` token groups from `docs/theme-brand-system.md` section 3 (Tailwind Integration block)
- Under `theme.extend.fontFamily`: add `heading` and `body` both set to `["Raleway", "system-ui", "sans-serif"]`

## Constraints

- Do not modify any page or component files
- Do not remove existing Tailwind config or CSS
- Run `npm run build` after changes and fix any errors introduced by your edits (not pre-existing ones)

## Output

When done, create the file `codex/task-001-output.md` and write:

```
## Files modified
- List each file changed

## Changes made
- Brief description of what was added to each file

## Build result
- "clean" or paste any new errors

## Blockers or questions
- Any ambiguity encountered, or "none"
```
