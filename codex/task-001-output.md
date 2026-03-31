## Files modified
- `src/app/globals.css`
- `tailwind.config.ts`
- `codex/task-001-output.md`

## Changes made
- Added the full light theme `:root` CSS custom property block to `src/app/globals.css`
- Added the full dark theme `[data-theme="dark"]` CSS custom property block to `src/app/globals.css`
- Added four `@font-face` declarations for Raleway weights 400, 500, 600, and 700 to `src/app/globals.css`
- Added `darkMode: ["class", '[data-theme="dark"]']` to `tailwind.config.ts`
- Added semantic Tailwind color token groups `brand`, `surface`, `border`, `text`, and `status` to `tailwind.config.ts`
- Added `heading` and `body` font families using `["Raleway", "system-ui", "sans-serif"]` to `tailwind.config.ts`

## Build result
- clean
- Existing warning during build: `The "middleware" file convention is deprecated. Please use "proxy" instead.`

## Blockers or questions
- none
