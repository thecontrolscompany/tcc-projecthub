# Task 005 — Complete Token Migration: Remaining Admin Classes + BillingTable + PM + Customer + Login Pages

## Context

Task 004 migrated most of `src/app/admin/page.tsx` but left several unmapped classes. This task
finishes admin, then migrates `src/components/billing-table.tsx`, `src/app/pm/page.tsx`,
`src/app/customer/page.tsx`, and `src/app/login/page.tsx` using the same semantic token system.

Semantic token classes available (defined in `tailwind.config.ts` and `globals.css`):
- Surfaces: `bg-surface-base`, `bg-surface-raised`, `bg-surface-overlay`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-inverse`
- Borders: `border-border-default`, `border-border-strong`
- Brand: `bg-brand-primary`, `hover:bg-brand-hover`, `text-brand-primary`, `border-brand-primary`
- Status: `text-status-success`, `text-status-warning`, `text-status-danger`, `text-status-info`
- Status bg variants: `bg-status-success/10`, `bg-status-warning/10`, `bg-status-danger/10`, `bg-status-info/10`

## Read before starting

- `docs/theme-brand-system.md` sections 7 and 8
- Each file listed below before editing it

---

## File 1: `src/app/admin/page.tsx` — finish unmapped classes

Task 004 left these classes unchanged. Migrate them now:

| Replace | With |
|---|---|
| `text-white` | `text-text-primary` |
| `border-white/15` | `border-border-default` |
| `border-white/5` | `border-border-default` |
| `bg-slate-700` | `bg-surface-overlay` |
| `border-sky-400` | `border-brand-primary` |
| `hover:border-sky-400/40` | `hover:border-brand-primary/40` |
| `border-sky-500/20` | `border-brand-primary/20` |
| `border-sky-500/40` | `border-brand-primary/40` |
| `bg-sky-500/5` | `bg-brand-primary/5` |
| `hover:bg-sky-500/20` | `hover:bg-brand-primary/20` |
| `hover:bg-sky-400` | `hover:bg-brand-hover` |
| `hover:text-sky-200` | `hover:text-brand-primary` |

---

## File 2: `src/components/billing-table.tsx` — full token migration

Apply the complete mapping from Task 004 plus the additions above to every className in this file.
This is the billing table component with inline editing — migrate colors only, do not touch logic.

Key patterns likely present:
- Row color coding: cells marked as editable use yellow highlight — map `bg-yellow-500/20` → `bg-status-warning/20`, `bg-yellow-400/10` → `bg-status-warning/10`
- Behind-schedule rows use red — `text-red-400` → `text-status-danger`, `bg-red-500/10` → `bg-status-danger/10`
- Complete rows use muted text — already handled by `text-text-tertiary`
- Input fields: `bg-slate-800` → `bg-surface-overlay`, `border-slate-600` → `border-border-strong`
- Table header: `bg-slate-900` → `bg-surface-raised`, `text-slate-400` → `text-text-secondary`
- Totals footer: same mapping as header

---

## File 3: `src/app/pm/page.tsx` — full token migration

Apply the full mapping table. Key patterns likely present:
- Project cards: `bg-white/5` → `bg-surface-raised`, `border-white/10` → `border-border-default`
- Progress bars: keep the `bg-green-*` / `bg-yellow-*` / `bg-red-*` fill colors as status tokens
  - `bg-green-500` → `bg-status-success`, `bg-yellow-500` → `bg-status-warning`, `bg-red-500` → `bg-status-danger`
- Status badge text: `text-green-400` → `text-status-success`, etc.
- Form inputs: `bg-slate-800` → `bg-surface-overlay`, focus rings `focus:ring-sky-500` → `focus:ring-brand-primary`
- Submit button: `bg-sky-600` → `bg-brand-primary`, `hover:bg-sky-700` → `hover:bg-brand-hover`
- Section headings: `text-slate-100` → `text-text-primary`

---

## File 4: `src/app/customer/page.tsx` — full token migration

Apply the full mapping. Key patterns likely present:
- Project list cards: `bg-white/5` → `bg-surface-raised`
- Tab active/inactive states: active `text-sky-400` → `text-brand-primary`, `border-sky-400` → `border-brand-primary`; inactive `text-slate-400` → `text-text-secondary`
- Billing history table: header `bg-slate-900` → `bg-surface-raised`, row hover `hover:bg-white/5` → `hover:bg-surface-raised`
- Weekly update timeline items: border `border-white/10` → `border-border-default`
- Empty states: `text-slate-500` → `text-text-tertiary`

---

## File 5: `src/app/login/page.tsx` — full token migration

Apply the full mapping. Key patterns likely present:
- Page background: `bg-slate-950` → `bg-surface-base`
- Card/form container: `bg-white/5` → `bg-surface-raised`, `border-white/10` → `border-border-default`
- Input fields: `bg-slate-800` → `bg-surface-overlay`, `border-slate-700` → `border-border-default`
- Microsoft SSO button: `bg-sky-600` → `bg-brand-primary`, `hover:bg-sky-700` → `hover:bg-brand-hover`
- Error text: `text-red-400` → `text-status-danger`
- Link text: `text-sky-400` → `text-brand-primary`
- Labels: `text-slate-300` → `text-text-secondary`
- Heading: `text-slate-100` → `text-text-primary`

---

## Strict constraints

- Mechanical migration only across all five files — do not change logic, JSX structure, component names, or non-color classes
- Do not add or remove features in any file
- If a color class has no clear semantic equivalent, leave it unchanged and note it in the output
- Run `npm run build` once after all five files are done and fix only new errors

---

## Output

Create `codex/task-005-output.md`:

```
## Files modified
- list each

## Unmapped classes left unchanged (per file)
- filename: class list, or "none"

## Build result
- "clean" or paste new errors

## Blockers or questions
- any ambiguity encountered, or "none"
```
