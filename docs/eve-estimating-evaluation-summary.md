# Eve for TCC Estimating — Decision Brief

Full analysis: [`docs/eve-estimating-evaluation.md`](./eve-estimating-evaluation.md)

## What Eve is

An open-source (Apache-2.0), Vercel-built framework for running AI agents in production — "Next.js for agents." An agent is a directory of files: `instructions.md` (identity), `agent.ts` (model config), `tools/` (typed TypeScript functions), `skills/` (on-demand Markdown playbooks), `subagents/` (delegated child agents with fresh context), `channels/` (entry points — HTTP, Slack, etc.), `schedules/` (cron). It provides durable, checkpointed sessions (built on Vercel Workflows), sandboxed execution (Vercel Sandbox or Docker), native MCP support, and a first-class human-approval-gate primitive (a tool can pause a session indefinitely, at zero compute cost, until a human approves). It is currently **v0.24.3, in public beta**, released about one month before this assessment.

## Does it fit this project?

Conceptually, yes — better than any other option evaluated. TCC's estimating system has exactly one real AI feature today (a single-shot scope-text-to-BOM parser) and needs something categorically different: iterative, multi-document review (drawings + specs + schedules) with citations, conflict detection, and a hard stop for human sign-off before anything touches real estimate data. That's a durable multi-step agent problem, not a prompt-response problem, and Eve's approval-gate and subagent-delegation primitives map directly onto it.

Practically, not yet. Eve is pre-1.0, and an independent reviewer reported silent webhook failures and mid-session breakage from pre-release dependency versions, explicitly recommending "pilot before you commit." TCC ProjectHub has zero automated tests anywhere and no dedicated platform-engineering bench to absorb framework churn on a revenue-critical system.

## What it would replace

Nothing that currently works. It would **not** replace the Next.js/Supabase app, the `estimates` table, the pricing engine (`computeCosts`/`deriveEstimatorCostBuckets`), the assembly-catalog resolver, the proposal generator, or the existing single-shot AI Takeoff scope parser — all of that stays exactly as is.

## What it would not replace

The estimator's judgment. By design, no agent output — Eve or otherwise — should ever become a final estimate line item or final bid price without an explicit human approval step, enforced structurally via a staging table the agent can write to and the live `estimates` table it cannot.

## Recommended first experiment

A benchmarked proof of concept against **one already-completed, awarded estimate**: give the agent only the original project documents (hide the finished takeoff), generate a first-pass equipment inventory + BOM/labor suggestions + assumptions/RFIs, and score it against the real completed estimate on hard metrics — equipment recall/precision, quantity accuracy, source-citation accuracy, false-positive scope additions, and estimator time saved. "The output looked good" is explicitly not a success criterion. Everything the agent produces lands in a new staging table; nothing writes to a real estimate.

## Approximate phases

0. Build read-only lookup tools (approved assembly, labor standard, current cost, document listing) as plain TypeScript — useful with or without Eve.
1. Eve pilot: wrap those tools, add the findings-staging table, run the benchmark proof of concept. No real estimate touched.
2. If metrics clear a bar set in advance: build the estimator review/approval UI, wire staged findings into real estimates through existing, unchanged promotion logic.
3. Add drawing-vs-spec conflict detection and an independent "fresh context" scope-audit subagent.
4. Only after sustained production trust, consider agent-drafted assumptions/RFIs/proposal narrative at scale — largely already covered by existing features today.

## Primary risks

- **Framework immaturity:** beta, ~1 month old, documented breaking-change and silent-failure reports from independent use.
- **No safety net:** the codebase has zero automated tests; any agent-driven feature is being added without a regression harness.
- **No cost controls exist today** anywhere in the codebase — a multi-step agent session costs meaningfully more per run than the current single-shot call.
- **Small team, no platform-engineering bench** to absorb a pre-1.0 framework's operational surprises.
- **Data model gap:** estimate line items live in a single JSONB blob with no relational structure and no price-freshness/confidence fields — the staging/promotion design in the full report is required scaffolding, not optional polish.

## Recommended next action

**Pilot, don't adopt.** Build the Phase 0 tools now (framework-independent, low risk, reusable regardless of outcome). Run the Phase 1 Eve proof of concept against one real completed estimate, entirely outside the production write path, and let the Section 16/17 metrics in the full report — not impressions — decide whether to proceed to Phase 2.
