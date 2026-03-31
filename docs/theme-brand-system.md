# TCC — Theme and Brand System

**Date:** 2026-03-30

---

## 1. Current State (Problem)

The current UI uses hardcoded Tailwind dark theme classes throughout:
```
bg-slate-950, bg-white/5, text-slate-100, border-white/10
```

There are no CSS custom properties, no semantic tokens, and no light/dark toggle. The entire app is dark-mode only and uses generic Tailwind gray as its color palette.

This is not the target state.

---

## 2. Brand Assets Available

Located in `Logos etc/` in this repo:

| Asset | Path | Notes |
|-------|------|-------|
| Current logo (horizontal) | `Logos etc/Logo_Horizontal.png` | Best for header use |
| Current logo with email | `Logos etc/TCC_w-email_horizontal.png` | Has contact info |
| New logo variants | `Logos etc/New Logo.png`, `New Logo_2.png`, `New Logo_3.png` | Review with Timothy |
| TCC versions | `Logos etc/TCC_v4.png` through `TCC_v7.pdn` | Multiple iterations |
| Brand color reference | `Logos etc/Colors.png` | Windows color picker screenshot |
| Raleway font | `Logos etc/Raleway-FontZillion/Fonts/*.ttf` | Full weight range: thin → heavy |
| Aharoni Bold | `Logos etc/Aharoni Font/Aharoni Font/Aharoni Bold V3/Aharoni Bold V3.ttf` | May be used in logo |
| Safety logo | `Logos etc/Safety/TCC_SafeWorks_logo.svg` | SafeWorks sub-brand |

**Color from brand image (Colors.png):**
The brand color extracted from the color picker reference is approximately:
- Hue 116, Sat 236, Lum 58 → **RGB(1, 122, 111)** — a dark teal/green

This is the primary brand accent color. It should drive the token system.

---

## 3. Brand Token System

Design the theme around semantic tokens at the CSS custom property level. Tailwind reads these tokens via its theme configuration.

### Color Tokens

```css
/* Light theme (default) */
:root {
  /* Brand */
  --color-brand-primary:     #017a6f;  /* TCC teal — buttons, links, active states */
  --color-brand-primary-hover: #019487;
  --color-brand-accent:      #00b4a0;  /* lighter teal for highlights */

  /* Surfaces */
  --color-surface-base:      #ffffff;  /* page background */
  --color-surface-raised:    #f8fafc;  /* card background */
  --color-surface-overlay:   #f1f5f9;  /* subtle grouping */

  /* Borders */
  --color-border-default:    #e2e8f0;
  --color-border-strong:     #cbd5e1;

  /* Text */
  --color-text-primary:      #0f172a;  /* headings, data */
  --color-text-secondary:    #475569;  /* labels, supporting */
  --color-text-tertiary:     #94a3b8;  /* placeholders, captions */
  --color-text-inverse:      #ffffff;  /* on brand-colored backgrounds */

  /* Status */
  --color-success:           #16a34a;
  --color-warning:           #d97706;
  --color-danger:            #dc2626;
  --color-info:              #0284c7;
}

/* Dark theme */
[data-theme="dark"] {
  /* Brand — same primary, adapted for dark bg */
  --color-brand-primary:     #00c4b0;  /* brighter teal on dark */
  --color-brand-primary-hover: #00d9c4;
  --color-brand-accent:      #017a6f;

  /* Surfaces */
  --color-surface-base:      #0f172a;  /* slate-950 — matches current dark */
  --color-surface-raised:    #1e293b;  /* slate-800 */
  --color-surface-overlay:   #334155;  /* slate-700 */

  /* Borders */
  --color-border-default:    rgba(255,255,255,0.1);
  --color-border-strong:     rgba(255,255,255,0.2);

  /* Text */
  --color-text-primary:      #f1f5f9;
  --color-text-secondary:    #94a3b8;
  --color-text-tertiary:     #475569;
  --color-text-inverse:      #0f172a;

  /* Status — same as light, dark backgrounds make these pop */
  --color-success:           #4ade80;
  --color-warning:           #fbbf24;
  --color-danger:            #f87171;
  --color-info:              #38bdf8;
}
```

### Tailwind Integration

```typescript
// tailwind.config.ts
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--color-brand-primary)",
          hover: "var(--color-brand-primary-hover)",
          accent: "var(--color-brand-accent)",
        },
        surface: {
          base: "var(--color-surface-base)",
          raised: "var(--color-surface-raised)",
          overlay: "var(--color-surface-overlay)",
        },
        border: {
          default: "var(--color-border-default)",
          strong: "var(--color-border-strong)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
          inverse: "var(--color-text-inverse)",
        },
        status: {
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          danger: "var(--color-danger)",
          info: "var(--color-info)",
        },
      },
      fontFamily: {
        heading: ["Raleway", "system-ui", "sans-serif"],
        body: ["Raleway", "system-ui", "sans-serif"],
      },
    },
  },
};
```

---

## 4. Typography

**Primary font: Raleway**
- Available in the repo: `Logos etc/Raleway-FontZillion/Fonts/*.ttf`
- Weights available: Thin, ExtraLight, Light, Regular, Medium, SemiBold, Bold, ExtraBold, Heavy
- Suggested usage:
  - Headings: Raleway SemiBold (600) or Bold (700)
  - Body/labels: Raleway Regular (400) or Medium (500)
  - Numeric data: Raleway Medium (500) — tabular-nums feature
  - UI chrome: Raleway Regular (400)

**Secondary font (fallback):** `system-ui, -apple-system, sans-serif`

**Font loading setup:**
```css
/* globals.css — self-hosted from public/fonts/ */
@font-face {
  font-family: 'Raleway';
  src: url('/fonts/raleway-regular.woff2') format('woff2'),
       url('/fonts/raleway-regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
/* Repeat for 500, 600, 700 weights */
```

**Action:** Copy TTF files from `Logos etc/Raleway-FontZillion/Fonts/` to `public/fonts/`, convert to woff2 for production (use a tool like `ttf2woff2` or the Google Fonts API).

---

## 5. Logo Usage

**Current header:** Text-only "TCC ProjectHub" label. Should use the actual logo.

**Logo placement rules:**
- In the app header (sidebar layout): use horizontal logo variant
- Light mode: use logo on white/light background — verify it reads clearly
- Dark mode: may need a white/inverted version of the logo
- Minimum clear space: equal to the height of the "T" in the logo
- Never stretch or distort the logo
- Provide SVG version if possible (resolution-independent at all sizes)

**Logo variants to prepare:**
1. Full horizontal logo — light background (already exists: `Logo_Horizontal.png`)
2. Full horizontal logo — dark background (may need a white/inverted version created)
3. Icon-only version for favicon and collapsed sidebar (crop from horizontal logo)

**Action:** Review `New Logo.png`, `New Logo_2.png`, `New Logo_3.png` with Timothy. Confirm which version is current and whether a dark-bg variant exists.

---

## 6. Theme Toggle Implementation

### App-Level Theme Provider

```typescript
// src/components/theme-provider.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const ThemeContext = createContext<{
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}>({ theme: "system", resolvedTheme: "light", setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) setThemeState(stored);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const resolved = theme === "system" ? (mediaQuery.matches ? "dark" : "light") : theme;
    setResolvedTheme(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("theme", t);
    // Persist to Supabase profiles.theme_pref (debounced)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Theme Toggle Button (header)
```tsx
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      className="rounded-lg p-2 text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
    >
      {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
```

### Theme Persistence
- Store preference in `localStorage` for immediate application on page load
- Also persist in `profiles.theme_pref` in Supabase for cross-device consistency
- Apply preference on login: read from profile, write to localStorage and `data-theme`

---

## 7. Component Color Convention

Migrate existing hardcoded dark classes to semantic tokens:

| Before (dark-only) | After (semantic) |
|-------------------|-----------------|
| `bg-slate-950` | `bg-surface-base` |
| `bg-white/5` | `bg-surface-raised` |
| `text-slate-100` | `text-text-primary` |
| `text-slate-400` | `text-text-secondary` |
| `border-white/10` | `border-border-default` |
| `bg-sky-500` (brand action) | `bg-brand-primary` |
| `text-sky-300` (brand link) | `text-brand-primary` |

**Migration approach:** Do not attempt to convert all components at once. Convert page-by-page starting with the app shell, then each major page. This is a planned refactor, not an emergency.

---

## 8. Status Color System

Use consistent status colors across all domains (quote status, project status, billing status):

| Status category | Color token | Example use |
|----------------|-------------|-------------|
| Active / On Track / Won | `status-success` (green) | Project active, quote won |
| Pending / In Review | `status-info` (blue) | Under review, estimating |
| Warning / At Risk | `status-warning` (amber) | Behind schedule, waiting on info |
| Critical / Lost / Error | `status-danger` (red) | % complete < prev billed%, lost |
| Neutral / Complete / Archived | `text-text-tertiary` (gray) | 100% complete, archived |

These map directly to the legacy Excel conditional formatting rules already implemented in the billing table.

---

## 9. Implementation Order

1. Copy font files → `public/fonts/`, add `@font-face` to `globals.css`
2. Add CSS custom property tokens to `globals.css`
3. Update `tailwind.config.ts` with semantic color references
4. Create `ThemeProvider` component
5. Wrap `layout.tsx` with `ThemeProvider`
6. Add theme toggle to app header
7. Copy logo to `public/logo.png` (and `public/logo-dark.png` if available)
8. Update `layout.tsx` and login page to use logo image
9. Migrate app shell (header + sidebar) to semantic tokens
10. Migrate page-by-page as they are rebuilt
