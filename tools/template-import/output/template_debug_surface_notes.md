# Template Debug Surface Notes

Branch: `chore/template-renderer-stabilization`
Scope: `window.__projecthubTemplateDebug` / `window.__hideTemplateGlyphTest`
in `ProjectHubTemplateGraphicPanel.tsx` — the only debug surfaces in the
template-rendering path that publish to a global, ambient scope (the
`system-template-preview` "Debug metadata" panel is a normal React-rendered UI
element, scoped to its own page, and is out of scope here).

This is the one deliverable in this pass that **required a code edit** rather
than only documentation — see "What changed" below.

## The problem

`runtime_neutrality_audit.md` (Part 2, finding 5) confirmed the *payloads*
published by these globals contain no vendor/source identifiers — only
generated node ids (`svg_123_6`) and point short names (`RA-SD`) that already
appear in the visible UI. But **exposure scope** is a separate property from
**payload cleanliness**, and on that axis these two globals had a real gap:
they were installed **unconditionally**, on every render of the panel, in
every environment — including production.

That's inconsistent with how the codebase already treats this exact class of
concern. `ProjectHubTemplateGraphicPanel.tsx` already had an established,
working pattern for "this is a development/QA aid, not a production feature":

```ts
// line 725 (pre-existing, unchanged)
const showTemplatePreviewBadge = process.env.NODE_ENV !== 'production' && previewFlagEnabled;
```

The debug-globals installation block (formerly lines 626–687) simply hadn't
been brought in line with that pattern — it read `if (typeof window !==
'undefined') { ... }` with no environment check, while a few dozen lines later
the exact same component correctly gated its preview badge.

Left as-is, this meant:
- Any code running in a production browser tab could call
  `window.__projecthubTemplateDebug()` or
  `window.__hideTemplateGlyphTest('RA-SD')` and get live internals of the
  estimator's template-rendering state — not a vendor-data leak, but an
  unintended production-facing API surface with no access control, version
  contract, or owner.
- `__hideTemplateGlyphTest` doesn't just *read* state — it calls
  `setVisibility(node, false, 'hide_when_unselected')`, i.e. it **mutates the
  rendered DOM** of a production page when invoked. That's a debug tool that
  can alter what an estimator user sees, reachable from any script with page
  access, in production.

## What changed

Both the installation block and its corresponding teardown in the effect
cleanup were gated behind the same condition the existing preview-badge flag
uses, `process.env.NODE_ENV !== 'production'`:

```ts
// installation — was: if (typeof window !== 'undefined') {
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  const debugGetter = () => debugStateRef.current ?? { /* ... */ };
  (window as Window & { __projecthubTemplateDebug?: () => unknown }).__projecthubTemplateDebug = debugGetter;
  root.setAttribute('data-template-debug-mounted', 'true');
  // ...
  (window as Window & { __hideTemplateGlyphTest?: (sourceShortName: string) => unknown }).__hideTemplateGlyphTest = (sourceShortName: string) => { /* ... */ };
}
```

```ts
// effect cleanup — was: if (typeof window !== 'undefined') {
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  delete (window as Window & { __projecthubTemplateDebug?: () => unknown }).__projecthubTemplateDebug;
  delete (window as Window & { __hideTemplateGlyphTest?: (sourceShortName: string) => unknown }).__hideTemplateGlyphTest;
}
```

This also gates the four `data-template-debug-*` attributes that were being
written to the rendered SVG root (`data-template-debug-mounted`,
`-template-id`, `-selected-source-short-names`, `-cleanup-mode`,
`-selection-ids`) — those attributes are themselves debug breadcrumbs in the
DOM and shouldn't be present in a production page's markup either.

`process.env.NODE_ENV` is a build-time constant in Next.js — this is not a
runtime branch that adds a code path to the production bundle; the dead branch
is eliminated at build time, identically to how `showTemplatePreviewBadge`
already works two screens down in the same file.

### Why gate the *cleanup* too, not just the installation

`NODE_ENV` cannot change between mount and unmount within a single running
app, so gating the cleanup branch is not strictly required for correctness —
`delete window.__projecthubTemplateDebug` on a property that was never
assigned is a harmless no-op. It was gated anyway for two reasons:
1. **Symmetry with intent.** The comment-level statement "these globals should
   not exist outside development" is best expressed by making *both* halves of
   their lifecycle (install/teardown) conditional on the same flag — a reader
   scanning the cleanup function shouldn't have to reason about whether the
   delete is reachable in production.
2. **No behavior change risk.** Since the delete is a no-op either way in
   production, gating it cannot alter runtime behavior in any environment —
   it's a pure clarity improvement, consistent with the brief's "no new
   behavior" constraint.

## What was *not* changed, and why

- **The `system-template-preview` "Debug metadata" panel** is not a `window`
  global — it's a normal conditionally-rendered React tree on an internal QA
  page (`/system-template-preview`), gated by the page's own access pattern
  (see `runtime_neutrality_audit.md` and the architecture audit's note on
  `isDevPreviewRoute`/`publicPaths` in `src/lib/supabase/middleware.ts`, which
  is flagged separately as a pre-existing, out-of-scope risk in the final
  stabilization notes). It does not need the `NODE_ENV` treatment because it
  isn't ambient — a user has to navigate to that specific page to see it.
- **`describeTemplateNode`, `collectVisibilityGlyphNodes`, `setVisibility`**
  (the helpers `__hideTemplateGlyphTest` calls) were left as ordinary module
  functions. They have other, non-debug callers in the same effect (general
  visibility application), so they cannot be gated — only the *globally
  exposed entry points* to debug-only behavior needed gating.
- **No new logging, telemetry, or replacement debug mechanism was added.**
  The brief's "clean up... to be dev-only with no vendor leaks" was read as
  "ensure these tools only exist where they're useful and intended (local/dev
  builds)" — not as "replace them with something else." The tools remain
  fully available to developers running `npm run dev` (where `NODE_ENV ===
  'development'`); only their presence in production builds changes.

## Verification performed

- `npx tsc --noEmit` — clean, no new errors.
- `npx eslint src/modules/hvac-estimator/shared/ProjectHubTemplateGraphicPanel.tsx` — clean.
- Confirmed by inspection that `process.env.NODE_ENV` is the same build-time
  constant already relied on at line 725 (`showTemplatePreviewBadge`) — no new
  environment-detection mechanism introduced.
- Confirmed the gated block's only side effects are: assigning to `window`,
  setting `data-template-debug-*` attributes on the SVG root, and (in
  `__hideTemplateGlyphTest`) calling `setVisibility` — none of which are
  reachable from elsewhere in the component once the `if` is false, so no
  other code path depends on these globals existing.

## Net effect

| Before | After |
| --- | --- |
| `window.__projecthubTemplateDebug` / `__hideTemplateGlyphTest` installed unconditionally, in every environment including production | Installed only when `process.env.NODE_ENV !== 'production'` — eliminated from production bundles at build time |
| `data-template-debug-*` attributes written to the SVG root in every environment | Written only in non-production builds |
| `__hideTemplateGlyphTest` (a DOM-mutating function) reachable from any script on a production page | Not present in production builds at all |
| Debug-surface gating pattern existed (badge) but wasn't applied consistently | Both debug mechanisms in this component now use the same `process.env.NODE_ENV !== 'production'` gate |

This closes the one open item from `runtime_neutrality_audit.md` finding 5
("payload is clean, but exposure mechanism is broader than necessary") without
touching the payload contents, the helper functions other code depends on, or
any visibility/selection behavior.
