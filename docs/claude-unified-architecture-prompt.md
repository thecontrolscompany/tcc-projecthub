# Claude Unified Architecture Prompt

## Purpose

This file is a single handoff prompt for Claude so it can read the necessary project context and then produce the next-level architecture and planning work for TCC ProjectHub.

Use this as the starting prompt for Claude.

---

## Prompt For Claude

```md
You are continuing architecture and planning work for The Controls Company's unified internal platform.

Before doing anything else, read these files fully:

- CLAUDE.md
- docs/mvp-plan.md
- docs/unified-platform-vision.md
- docs/quote-request-estimate-project-workflow.md
- docs/planning-notes-for-claude.md

Also inspect branding assets in:

- Logos etc/

Important context:

- This repo should evolve into the unified internal platform for The Controls Company.
- The existing estimating tool at `internal.thecontrolscompany.com` is the current live production site and is deployed from GitHub.
- That live estimating application should be treated as the likely production trunk or primary codebase during integration planning.
- The PM portal work in this repo should likely be integrated into that existing live internal site, rather than replacing it abruptly.
- The long-term goal is still one unified internal platform, with access controlled by roles and modules instead of separate disconnected apps.
- The current PM portal is only the beginning, not the final product definition.
- Quote Requests should become the front door of the lifecycle.
- The intended business workflow is:
  Quote Request -> Estimate -> Project -> Billing / Closeout -> Feedback into Estimating
- SharePoint is a real architectural direction, not just a vague future idea.
- Customers should not be placed inside the full internal PM/estimating app.
- The UI must support both light mode and dark mode.
- Branding should come from the assets in the Logos etc folder, not from placeholder styling.

I want you to produce a serious architecture package for this repo.

Your task:

1. Read the existing docs and current repo structure.
2. Reframe the product as a unified internal platform rather than just a PM portal.
3. Architect the system around these domains:
   - Quote Requests
   - Estimating
   - Project creation / conversion
   - PM execution
   - Billing
   - Documents / SharePoint
   - Integrations
   - Reporting / analytics
4. Account for:
   - the fact that the current estimating tool is already the live GitHub-deployed internal site
   - the need to integrate this portal work into that live application strategy safely
   - role-based internal access
   - separate limited external/customer workflows
   - quote request numbering, estimate numbering, and job numbering
   - estimate snapshot as immutable project baseline
   - future QuickBooks / QuickBooks Time / Power BI integrations
   - light/dark theme support
   - brand/logo/font usage

Deliverables:

- A recommended route map for the unified app
- A recommended role model beyond the current basic roles
- A domain model / schema outline for the major entities
- A lifecycle and conversion model for Quote Request -> Estimate -> Project
- A recommendation for what data should live in the app DB vs SharePoint
- A UI architecture recommendation for internal vs external users
- A design-system direction covering theme support and branding assets
- A phased implementation roadmap
- A gap analysis of the current repo versus the target direction
- A migration/integration recommendation for how this repo should relate to the existing live GitHub estimating application at `internal.thecontrolscompany.com`

Constraints:

- Do not overwrite or casually remove existing work.
- Prefer writing planning/architecture docs before major code changes.
- If code changes are proposed, explain why they fit the new target architecture.
- Respect the current repo as an in-progress foundation, not a throwaway prototype.
- Do not assume this repo should immediately replace the current live site.
- Explicitly evaluate whether the best path is:
  - merging this repo's PM/billing/admin work into the current live estimating repo
  - creating a monorepo around the live estimating app and this repo
  - or using another staged integration strategy
- Favor a low-risk production migration path.

Output format:

Create or update markdown files in docs/ with a clean architecture package. At minimum, produce:

- docs/architecture-overview.md
- docs/domain-schema-plan.md
- docs/route-role-ui-plan.md
- docs/current-gap-analysis.md

Optional but encouraged:

- docs/sharepoint-strategy.md
- docs/theme-brand-system.md
- docs/implementation-roadmap.md
- docs/live-site-integration-strategy.md

When finished, summarize:

- what you created
- the biggest architecture decisions
- the highest-risk current gaps
- the best next implementation step
```

---

## Intended Outcome

If Claude follows the prompt above well, the next deliverable should be a coherent architecture package that:

- unifies the product vision
- turns the current PM app into a broader internal platform plan
- gives a concrete path for quote requests and estimating
- defines SharePoint's role
- introduces theme and branding planning
- helps future coding happen against a stable blueprint

## Notes

This file is intentionally focused on architecture and planning, not immediate implementation.

The goal is to help Claude spend its effort on:

- product framing
- domain design
- information architecture
- roadmap clarity

rather than jumping straight into code before the vision is aligned.
