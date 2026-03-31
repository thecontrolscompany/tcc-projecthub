# Planning Notes For Claude

## Intent

These notes are meant to help future architecture work align with the owner's intended business direction.

Read these documents together:

- `docs/unified-platform-vision.md`
- `docs/quote-request-estimate-project-workflow.md`
- existing `CLAUDE.md`
- existing `docs/mvp-plan.md`

Also review branding assets in:

- `Logos etc/`

## High-Level Direction

The owner's current direction is:

- this repo should evolve into the unified internal platform
- the existing estimating system should become part of this platform rather than stay separate
- customer-facing quote intake should exist, but should remain limited and isolated from internal PM/estimating data
- SharePoint is part of the long-term architecture vision, not just a vague future possibility
- the UI should support switchable light and dark themes
- branding should use the provided logos, fonts, and palette assets rather than generic placeholders

## Suggested Architecture Framing

When planning architecture, think in terms of product domains instead of only current screens:

- quote requests
- opportunities / estimates
- projects
- PM execution
- billing
- documents
- integrations
- reporting

## Important Separation

Maintain a clear separation between:

- internal modules for staff
- external/customer-safe workflows

Avoid treating customer users as if they belong in the same experience as internal PMs or estimators.

## UI / Design Constraints

The current dark-only UI should not be treated as the final visual direction.

Future architecture and design work should assume:

- a theme system is required
- light mode and dark mode must both be supported
- branding assets from `Logos etc/` should be incorporated into the eventual design system

Plan for:

- app-level theme state
- reusable semantic color tokens
- logo treatment for both light and dark backgrounds
- branded typography choices from the supplied font assets where appropriate

## Likely Role Expansion

The current role model is likely too small for the target product.

Future planning should consider at least:

- admin
- estimator
- pm
- billing
- accounting
- executive
- customer or external requestor

## Product Lifecycle To Design Around

Primary lifecycle:

`Quote Request -> Estimate -> Project -> Billing / Closeout -> Feedback`

Design the schema and routing so records can convert forward through lifecycle stages without duplication or lossy handoffs.

## Near-Term Planning Goal

A useful next architecture step would be a proposal covering:

- route map
- expanded role model
- domain schema outline
- conversion flows between quote request, estimate, and project
- SharePoint touchpoints
- theme and branding system approach
- phased implementation roadmap
