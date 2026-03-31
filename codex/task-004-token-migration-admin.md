# Task 004 — Migrate Admin Page to Semantic Token Classes

## Context

Tasks 001–003 are complete:
- Semantic Tailwind token classes are live (`bg-surface-base`, `text-text-primary`, etc.)
- AppShell wraps the admin layout — the page no longer needs its own header or background setup
- ThemeToggle is in the shell header

## Read before starting

- `docs/theme-brand-system.md` section 7 (the migration mapping table)
- `src/app/admin/page.tsx` (the file to migrate)
- `src/components/billing-table.tsx` (read only — do NOT modify it in this task)

## Work to do

### `src/app/admin/page.tsx` — mechanical token migration only

Apply this find-and-replace mapping to every className string in the file:

| Replace this | With this |
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
| `text-slate-600` | `text-text-tertiary` |
| `border-slate-700` | `border-border-default` |
| `border-slate-600` | `border-border-strong` |
| `border-white/10` | `border-border-default` |
| `border-white/20` | `border-border-strong` |
| `bg-sky-500` | `bg-brand-primary` |
| `bg-sky-600` | `bg-brand-primary` |
| `hover:bg-sky-600` | `hover:bg-brand-hover` |
| `text-sky-300` | `text-brand-primary` |
| `text-sky-400` | `text-brand-primary` |
| `text-sky-500` | `text-brand-primary` |
| `text-green-400` | `text-status-success` |
| `text-green-500` | `text-status-success` |
| `text-yellow-400` | `text-status-warning` |
| `text-amber-400` | `text-status-warning` |
| `text-red-400` | `text-status-danger` |
| `text-red-500` | `text-status-danger` |
| `text-blue-400` | `text-status-info` |
| `bg-green-500/10` | `bg-status-success/10` |
| `bg-yellow-500/10` | `bg-status-warning/10` |
| `bg-red-500/10` | `bg-status-danger/10` |
| `bg-blue-500/10` | `bg-status-info/10` |

## Strict constraints

- This is a **mechanical migration only** — do not refactor logic, rename variables, reorder JSX, or change component structure
- Do not modify `src/components/billing-table.tsx` — that is a separate task
- Do not add or remove any features
- If a class is not in the table above, leave it unchanged
- Run `npm run build` after the migration and fix only errors caused by your edits

## Output

Create `codex/task-004-output.md`:

```
## Files modified
- list each

## Token replacements made
- count of replacements per token (e.g. "bg-slate-950 → bg-surface-base: 7 replacements")

## Unmapped classes found (left unchanged)
- any slate/sky/white classes not in the table above

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity, or "none"
```
