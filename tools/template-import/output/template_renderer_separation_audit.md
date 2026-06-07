# Template Renderer Separation Audit

Branch: `chore/template-renderer-stabilization`
Question this audit answers: **which functions in the template-rendering path
do too much, and what was (or should be) done about it?**

## What was actually refactored in this pass

### Consolidated duplicated DOM helpers into `templateCleanup.ts`

Before this pass, `ProjectHubTemplateGraphicPanel.tsx` (estimator runtime) and
`system-template-preview.tsx` (internal QA tool) each carried their own copies
of the same DOM-matching/visibility helpers:
`matchesAnySelector`, `findCleanupContainer`, `addMatchedNodes`,
`addAttributeMatchedNodes`, `collectCleanupNodes`, `collectRuleNodes`,
`isVisibleElement`, `appendSelectionIds`.

This is the textbook "one function doing two jobs" problem inverted — not one
function with too many responsibilities, but **one responsibility implemented
twice**, which is just as dangerous: the two copies *will* drift. They already
had: the panel/preview-local `collectCleanupNodes` did not support
`hide_descendants`, while the `templateCleanup.ts` version (used elsewhere)
did — meaning a cleanup rule authored with `hide_descendants: true` behaved
differently depending on which surface rendered it.

**Fix**: both files now import these functions from `templateCleanup.ts`
exclusively. `templateCleanup.ts` already documented its own intent for this
("intentionally framework-agnostic ... so both consumers can share matching
logic instead of maintaining copy-pasted selector code that drifts out of
sync") — the consolidation simply finishes that job. Net effect: ~140 lines of
duplicated logic removed across the two files, and the `hide_descendants`
inconsistency is gone (both surfaces now use the capable version).

Side effect of the consolidation: it surfaced a real bug (see next section).

### Fixed a `MutationObserver` cleanup leak (variable-shadowing bug)

While reconciling the panel's `useLayoutEffect` with the shared helpers, found
that the observer-teardown reference was stored in a way that could never
actually be invoked — a `const` declaration inside the effect's `try` block
was shadowing the outer holder, so the outer reference stayed `null` and
`null?.()` was a silent no-op on unmount/error. TypeScript even flagged this
indirectly (`Type 'never' has no call signatures`, because narrowing a
never-reassigned `let x: T | null = null` to literal `null` makes the callable
part of the union `never`).

**Fix**: the observer reference is now held in a plain mutable object
(`const cleanupObserverRef = { current: null as (() => void) | null }`) that is
assigned to (not redeclared) inside the `try` block and invoked via
`cleanupObserverRef.current?.()` in both the error handler and the effect
cleanup function. This pattern sidesteps the shadowing class of bug entirely
(there is exactly one binding, and `.current` is mutable), and resolves the
`MutationObserver` leak — the observer is now reliably disconnected on
unmount and on render error.

### Fixed an offline-script bug while generalizing it (Part 4)

`generate-point-visibility.mjs`'s `getAttributeValue` used a regex (`id="...")`)
that could match `id="..."` *inside* `jci-id="..."`. The replacement,
`getTagAttributeValue`, requires a preceding whitespace/`<` boundary
(`[\s<]${name}="..."`), so looking up `id` can never accidentally match inside
`jci-id`. This was necessary groundwork for the spatial-matching fix (Part 4)
— `collectGlyphFamilyInstances` depends on correctly distinguishing `id` from
`jci-id` on the same tag.

## What was deliberately *not* refactored, and why

### `ProjectHubTemplateGraphicPanel`'s `useLayoutEffect` is a long, multi-stage pipeline

The effect (roughly lines 432–719) does, in order: rule-node tagging, several
template-specific visibility overrides (`-SP` software points, staged
heat/cool, a hardcoded `mixed_air_single_duct` block), delegation to
`templateCleanup.ts` for the general visibility/cleanup pass, presentation
reconciliation, and debug-state publication. That is a lot of responsibility in
one `useLayoutEffect`.

It was **not** split apart in this pass because:

- It runs as a single synchronous DOM mutation pass, gated by one set of
  dependencies (`packageData`, `activeSelectionIds`, etc.). Splitting it into
  multiple effects risks introducing new ordering bugs (each stage depends on
  DOM state the previous stage produced) — exactly the kind of "add new
  feature behavior" risk the brief asked to avoid.
- The brief's primary refactor ask was about functions "doing too much" in a
  way that caused *duplication and drift* (the helpers above) — that risk is
  now retired. The effect's length is a readability/maintainability concern,
  not a correctness one; reshaping it is a larger, riskier change better done
  as its own reviewed unit of work.

**Recommendation** (non-binding, for a future pass): extract the
template-specific override blocks (`-SP`/staged-heat-cool/`mixed_air_single_duct`
hardcoding — see next section) into named, individually testable functions
that the effect calls in sequence. That alone would cut the effect body
roughly in half without changing its execution order or dependencies.

### Template-specific hardcoding lives inline in the general-purpose panel

Three blocks of `mixed_air_single_duct`-only (or pattern-based but
effectively-template-specific) logic live directly in
`ProjectHubTemplateGraphicPanel`'s effect:

1. `isSoftwarePoint` / `isStagedHeatCoolPoint` / `isStagedHeatCoolText` —
   regex classifiers for `-SP` and `(PH|CLG|RH)\d*-C` points, applied to *every*
   template this panel renders, not just `mixed_air_single_duct`
2. a literal `if (templateId === 'mixed_air_single_duct')` block calling
   `collectManualCleanupNodes` for `RAPLO-A`/`BLDG-P`/`BLDG-SP`
3. `templateCleanup.ts`'s `applyTemplateCleanupRules` carries its own
   `if (options.templateId === 'mixed_air_single_duct')` block
   (`hideExactLabels`/`hideExactSelectors` for `BLDG-P`/`BLDG-SP`/`#svg_616`)

This is a real "doing too much" smell — a component meant to be
template-agnostic (it takes `templateId` as a prop and fetches a generic
package) carries one template's quirks as inline conditionals. It was **not**
refactored in this pass because:

- `mixed_air_single_duct` is the *only* template wired end-to-end today (per
  `template_renderer_architecture_audit.md`). There is no second template to
  generalize against yet — extracting a "per-template override registry" now
  would be designing for a hypothetical, on a single data point, which the
  user's standing engineering guidance explicitly discourages.
- These blocks affect *which nodes get hidden*, i.e. visible behavior. Moving
  them is squarely in "don't change estimator selection/visibility behavior"
  territory unless done with execution-order-preserving care and broader
  testing than a documentation-focused stabilization pass affords.

**Recommendation**: when a second template is wired up, this is exactly the
moment to extract a `templateOverrides: Record<templateId, OverrideConfig>`
(or similar) shape — at that point there will be two real data points to
generalize from, and the extraction can be validated by checking that
`mixed_air_single_duct`'s behavior is unchanged. Doing it now would be
guesswork.

### `sanitizeNotes` / alias-stripping logic duplicated between `templateGraphicPackage.ts` and `system-template-preview/page.tsx`

Both files independently implement the same regex-based note sanitization
(`/source file:/i`, `/program files/i`, `/programdata/i` → placeholder string)
and the same `<text>`/`<tspan>` "Alias" placeholder stripping + dark-theme
recoloring. This is the same "shared responsibility implemented twice" pattern
as the DOM helpers, and carries the same drift risk (if one sanitization regex
is updated and the other isn't, the preview page could start leaking source
paths that the estimator panel correctly hides).

**Not refactored** in this pass because `templateGraphicPackage.ts` is
`server-only` and `system-template-preview/page.tsx` is itself a server
component with different import boundaries — sharing the function cleanly
would mean either moving it to a shared server-safe module (low risk, but is a
net-new module/export surface the brief didn't ask for) or accepting an
awkward import path. Flagging it here is lower-risk than restructuring module
boundaries during a stabilization pass whose explicit goal is *not* to add new
surface area.

**Recommendation**: extract `sanitizeTemplateNotes(notes: string[])` and the
alias-stripping/recoloring transform into `templateGraphicPackage.ts` (already
`server-only`) and import both from `system-template-preview/page.tsx`, which
is also server-side. This is a same-risk-class follow-up to the helper
consolidation already done — same pattern, smaller surface, deferred only
because it touches a second file's import graph and the stabilization brief's
"don't add new behavior" framing argued for scoping this pass to the
DOM-helper duplication that was already known to have caused a real bug
(`hide_descendants`).

## Summary

| Finding | Action taken | Why |
| --- | --- | --- |
| Duplicated DOM helpers (panel + preview) | Consolidated into `templateCleanup.ts` | Known drift risk; already caused a `hide_descendants` inconsistency |
| `MutationObserver` cleanup leak (shadowing) | Fixed via mutable ref-object pattern | Surfaced while consolidating; real latent bug |
| `id`/`jci-id` regex collision in generation script | Fixed via boundary-anchored lookup | Required for the Part 4 spatial-matching fix to be correct |
| Long multi-stage `useLayoutEffect` | Documented, not split | Splitting risks new ordering bugs; length is a readability concern, not correctness |
| Template-specific hardcoding in general-purpose panel | Documented, not extracted | Only one template exists end-to-end; extracting now would be designing for a hypothetical |
| Duplicated note-sanitization / alias-stripping (package vs. preview page) | Documented, not merged | Touches a second file's server/import boundary; deferred to keep this pass scoped |
