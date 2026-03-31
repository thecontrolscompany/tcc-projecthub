# Task 002 — ThemeProvider + ThemeToggle Components

## Context

Task 001 is complete. `globals.css` now has CSS custom property tokens for light and dark themes
controlled by `[data-theme="dark"]` on the root element. Tailwind is configured with semantic
token classes (`bg-surface-base`, `text-text-primary`, etc.).

## Read before starting

- `docs/theme-brand-system.md` (sections 6 and 7)
- `src/app/globals.css` (to see the token names already defined)

## Work to do

### 1. Create `src/components/theme-provider.tsx`

Implement exactly as shown in `docs/theme-brand-system.md` section 6:

- `"use client"`
- `type Theme = "light" | "dark" | "system"`
- `ThemeContext` with `{ theme, resolvedTheme, setTheme }`
- `ThemeProvider` component:
  - On mount: read `localStorage.getItem("theme")` and set state
  - When `theme` changes: resolve to "light" or "dark" (system uses `window.matchMedia`), call `document.documentElement.setAttribute("data-theme", resolved)`, write to `localStorage`
  - Handle SSR: wrap `document` and `localStorage` access in `typeof window !== "undefined"` checks
- Export `ThemeProvider` and `useTheme`

### 2. Create `src/components/theme-toggle.tsx`

- `"use client"`
- Import `useTheme` from `./theme-provider`
- Button that toggles between `"light"` and `"dark"` (no system option in the toggle UI)
- When `resolvedTheme === "dark"`: show a sun SVG icon
- When `resolvedTheme === "light"`: show a moon SVG icon
- Use inline SVG only — no icon library
- Sun icon: a circle with 8 short lines radiating outward (standard sun symbol)
- Moon icon: a crescent shape
- className on button: `"rounded-lg p-2 text-text-secondary hover:bg-surface-overlay hover:text-text-primary transition-colors"`
- `aria-label="Toggle theme"`

### 3. Update `src/app/layout.tsx`

- Import `ThemeProvider` from `../components/theme-provider` (adjust path as needed)
- Wrap `{children}` with `<ThemeProvider>`
- Add `font-body` to the `<body>` className (this is the Tailwind font token added in task 001)
- Do not change anything else in layout.tsx

## Constraints

- Do not modify any page files
- Do not add ThemeToggle to any layout yet — that is task 003
- Run `npm run build` after changes and fix any new errors

## Output

Create `codex/task-002-output.md`:

```
## Files created or modified
- list each

## Changes made
- brief description per file

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```
