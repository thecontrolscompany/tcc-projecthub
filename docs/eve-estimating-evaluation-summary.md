# Eve for TCC Estimating — Decision Brief

Full analysis: [`docs/eve-estimating-evaluation.md`](./eve-estimating-evaluation.md)

**Operating context:** Timothy is currently the sole user of the estimator module. The estimator is explicitly experimental and can tolerate temporary breakage; the rest of ProjectHub (auth, projects, change orders, reports, shared navigation, other Hubs) is live and must not be disrupted. This brief reflects that two-zone posture: move fast inside the estimator boundary, keep the protected zone structurally out of reach.

## What Eve is

An open-source (Apache-2.0), Vercel-built framework for running AI agents in production — "Next.js for agents." An agent is a directory of files: instructions, typed TypeScript tools, on-demand skills, subagents, channels, schedules. It provides durable checkpointed sessions, sandboxed execution, native MCP support, and a first-class human-approval-gate primitive (a tool can pause a session indefinitely, at zero compute cost, until approved). Currently **v0.24.3, public beta**, released about one month before this assessment.

## Does it fit this project?

Conceptually yes — it's the closest match found to "read a drawing package, cross-check it against a spec, cite sources, and pause for sign-off before touching real estimate data," which the current single-shot AI Takeoff feature structurally cannot do. Practically, it's young: an independent reviewer reported silent webhook failures and mid-session breakage from pre-release dependencies, and explicitly recommends piloting before committing.

Given that TCC's estimator currently has exactly one user, that risk is acceptable **inside the estimator boundary** — it is not acceptable if it can reach the live application's build, deploy, or shared data.

## Recommended architecture: isolated sidecar, not embedded

Build the POC as a **separate repository/service** (`tcc-estimator-agent`), not inside `tcc-projecthub`. Eve compiles to its own runtime with its own build step and dependency tree — it is not a lightweight library import — so adding it directly to ProjectHub's single Vercel deployment risks the shared build exactly where disruption is unacceptable. A sidecar gets full Eve capability (durability, approval gates, subagents, MCP) with zero exposure of the protected zone, and its own build failing costs nothing but the POC itself.

The sidecar gets a narrowly-scoped database credential: read access to catalogs/documents, write access only to one new staging table. It never gets ProjectHub's existing broad service-role key, and it never writes to `estimates` directly — promoting an approved finding into a real estimate line item calls the app's existing, already-authenticated `/api/estimates/[id]` route instead of inventing a new write path.

## What it would replace

Nothing that currently works. The Next.js/Supabase app, the `estimates` table, the pricing engine, the assembly resolver, `generateProposal.js`, and the existing single-shot AI Takeoff parser all stay exactly as they are.

## What it would not replace

The estimator's judgment. No agent output becomes a real estimate line item without Timothy reviewing it first — enforced structurally (the sidecar can't write to `estimates`), not just by instruction.

## Simplified approval model (single user, POC 1)

Five states, exactly as specified: **generated → accepted / edited / rejected → promoted.** Every finding preserves the original AI output, any human edit, the accept/reject decision, the source citation, and the promotion timestamp. No approver matrices, no multi-signoff — deferred until (if) there's a second estimator.

## Recommended first experiment

One benchmarked POC against an already-completed, awarded estimate: hide the finished takeoff, give the sidecar only the original documents, generate findings into the staging table, and score against the real completed estimate. Scored on six learning questions, not "looked good":

1. Can it accurately identify equipment and controlled systems?
2. Can it give reliable sheet/page references?
3. Can it detect meaningful conflicts and missing scope?
4. Does Eve's orchestration outperform ordinary application code for this workflow?
5. Does it save meaningful takeoff time?
6. Is it stable enough to keep using?

## Testing priorities

**Mandatory (protected zone):** production build still succeeds, login/navigation/project/change-order access still work, any new migration is additive-only, the sidecar's credential provably cannot touch protected tables, no shared env vars between sidecar and ProjectHub.

**Prioritized, not exhaustive (experimental zone):** estimate-calculation spot checks, finding traceability, valid state transitions, correct promotion into real line items, duplicate-run handling, tool-permission boundaries, clean rollback. Broad ProjectHub test coverage is explicitly not a prerequisite.

## Approximate phases

0. Groundwork: scoped credentials, staging-table migration, sidecar scaffold — no `main` changes.
1. POC 1: sidecar reads real documents/catalogs, generates findings, benchmarked against one completed estimate.
2. Gated on Q1–Q6: wire promotion into the real `/api/estimates/[id]` route, merge any small ProjectHub-side changes after protection checks pass.
3. Add drawing-vs-spec conflict detection and an independent scope-audit subagent.
4. Only after sustained use — and only if a second estimator is imminent — build a polished, multi-user-ready review UI.

## Primary risks

- **Framework immaturity**, contained by the sidecar boundary rather than eliminated by it.
- **No LLM cost controls exist anywhere today** — add a basic spend alert even for solo use.
- **The promotion call-back into `/api/estimates/[id]` is a real integration point** even though it reuses existing, already-hardened code — worth its own protection check before Phase 2, not just at kickoff.
- **Zero test coverage repo-wide** means protected-zone verification for POC 1 is manual (Section 16.1 of the full report), not automated — acceptable for a solo, narrowly-scoped experiment, not indefinitely.

## Recommended next action

Stand up the sidecar (Phase 0), run POC 1 against one real completed estimate entirely outside ProjectHub's write path, and let the six learning questions — not impressions — decide whether to build the promotion path into a real estimate.
