# Task 012 — Token Migration: Analytics + Users Pages

## Context

`src/app/admin/analytics/page.tsx` and `src/app/admin/users/page.tsx` still use hardcoded
dark Tailwind classes and have their own header/nav elements that conflict with the AppShell
already provided by `src/app/admin/layout.tsx`.

## Read before starting

- `src/app/admin/analytics/page.tsx` (full file)
- `src/app/admin/users/page.tsx` (full file)
- `src/app/admin/layout.tsx` (confirm AppShell is already wrapping these pages)
- `docs/theme-brand-system.md` section 7 (token mapping)

---

## Part A — Remove Redundant Headers

Both pages likely render their own `<header>` or top nav bar. Since AppShell already
provides the sidebar and top header, remove any self-contained navigation or header
elements from both pages. The page content should start directly with the page heading (`<h1>`).

Also remove any `<Link href="/admin">← Back</Link>` or similar nav that duplicates
what the sidebar already provides.

---

## Part B — Token Migration: analytics/page.tsx

Apply the full token mapping:

| Replace | With |
|---|---|
| `bg-slate-950` | `bg-surface-base` |
| `bg-slate-900` | `bg-surface-raised` |
| `bg-slate-800` | `bg-surface-overlay` |
| `bg-white/5` | `bg-surface-raised` |
| `bg-white/10` | `bg-surface-overlay` |
| `text-slate-100` | `text-text-primary` |
| `text-slate-200` | `text-text-primary` |
| `text-slate-300` | `text-text-secondary` |
| `text-slate-400` | `text-text-secondary` |
| `text-slate-500` | `text-text-tertiary` |
| `text-white` | `text-text-primary` |
| `border-white/10` | `border-border-default` |
| `border-white/20` | `border-border-strong` |
| `border-slate-700` | `border-border-default` |
| `bg-sky-500` | `bg-brand-primary` |
| `bg-sky-600` | `bg-brand-primary` |
| `text-sky-300` | `text-brand-primary` |
| `text-sky-400` | `text-brand-primary` |
| `text-green-400` | `text-status-success` |
| `text-emerald-400` | `text-status-success` |
| `bg-emerald-500/10` | `bg-status-success/10` |
| `text-yellow-400` | `text-status-warning` |
| `text-amber-400` | `text-status-warning` |
| `text-red-400` | `text-status-danger` |
| `text-blue-400` | `text-status-info` |
| `bg-blue-500/10` | `bg-status-info/10` |

Also update the Recharts chart colors — the `COLORS` array currently uses hardcoded hex values.
Replace with semantic equivalents:
```ts
const COLORS = [
  "var(--color-brand-primary)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-danger)",
  "var(--color-info)",
  "var(--color-brand-accent)",
];
```

Update the page heading to match the app style:
```tsx
<h1 className="font-heading text-2xl font-bold text-text-primary">Analytics</h1>
```

---

## Part C — Token Migration: users/page.tsx

Apply the same token mapping from Part B.

Remove any self-contained header or back-link nav.

Update page heading:
```tsx
<h1 className="font-heading text-2xl font-bold text-text-primary">User Management</h1>
```

Update form inputs to use semantic tokens:
- Input backgrounds: `bg-surface-overlay`
- Input borders: `border-border-default focus:border-brand-primary`
- Input text: `text-text-primary`
- Labels: `text-text-secondary`
- Submit buttons: `bg-brand-primary hover:bg-brand-hover text-text-inverse`
- Cancel/secondary buttons: `bg-surface-overlay hover:bg-surface-overlay text-text-secondary`
- Error text: `text-status-danger`
- Success text: `text-status-success`

Update the role badge colors in the user list:
- admin: `bg-brand-primary/10 text-brand-primary`
- pm: `bg-status-info/10 text-status-info`
- customer: `bg-status-success/10 text-status-success`
- other: `bg-surface-overlay text-text-tertiary`

---

## Constraints

- Mechanical migration only — do not change logic, component structure, or non-color classes
- Do not modify `.env.local`
- Run `npm run build` after changes, fix only new errors

---

## Output

Create `codex/task-012-output.md`:

```
## Files modified
- list each

## Redundant headers/nav removed
- describe what was removed from each file

## Token replacements made
- count per file

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```
