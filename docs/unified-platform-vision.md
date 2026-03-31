# TCC Unified Internal Platform Vision

## Purpose

This document captures the intended product direction for The Controls Company so future implementation work can be architected against a stable vision instead of isolated feature requests.

The goal is to evolve this project from a PM/billing portal into the unified internal operating platform for estimating, project management, billing, document control, and reporting.

Primary host target:

- `internal.thecontrolscompany.com`

This site should become the main internal application for TCC staff.

## Core Product Direction

The system is intended to unify these business functions:

- Quote intake
- Estimating
- Project creation
- Project management
- Billing and percent complete tracking
- SharePoint / document management
- QuickBooks / QuickBooks Time integrations
- Power BI reporting

The long-term business loop is:

`Quote Request -> Estimate -> Project -> Billing / Closeout -> Feedback into Estimating`

That loop should become the foundation of how TCC manages profitability, execution, and future estimate accuracy.

## Domain Model

The intended operating model is:

`Estimate = baseline`

The estimate should define:

- labor hours
- labor cost
- material cost
- overhead
- profit
- sell price
- system-level scope assumptions
- assembly-level breakdowns where useful

Once a job is awarded, the estimate should become the baseline against which the project is tracked.

The project side should track:

- percent complete
- earned revenue
- billed to date
- labor actuals
- material actuals
- change orders
- forecast cost at completion
- projected profit / margin fade or gain

The future system should continuously compare estimate vs actual and feed that insight back into future estimating.

## Application Positioning

This project should no longer be thought of as only a PM portal.

It should become the internal system of record for workflow and orchestration across:

- estimating
- PM operations
- billing
- internal administration

The existing estimating tool at `internal.thecontrolscompany.com` should eventually be absorbed into this platform as a privileged module or section of the same site, rather than staying as a separate standalone product.

## Brand And UI Direction

The application should not remain dark-mode-only.

The UI direction should support:

- switchable light mode
- switchable dark mode
- branding driven by official company assets

Theme support should be treated as a product requirement, not just a cosmetic enhancement.

### Theme requirement

The platform should support:

- explicit light/dark theme toggle
- theme persistence by user preference
- branded tokens that work in both themes

The design system should avoid building the product around dark backgrounds only. Components, data tables, dashboards, forms, and portals should all be designed to work in both themes from the start.

### Branding assets

Brand assets have been added under:

- `Logos etc/`

This folder contains:

- logos
- color references
- font files
- historical logo variations

Notable assets observed:

- `Logos etc/Logo_Horizontal.png`
- `Logos etc/New Logo.png`
- `Logos etc/Colors.png`
- `Logos etc/Raleway-FontZillion/Fonts/*.ttf`
- `Logos etc/Aharoni Font/Aharoni Font/Aharoni Bold V3/Aharoni Bold V3.ttf`

### Brand guidance

Future UI work should:

- use the provided logos instead of placeholder text-only branding
- use provided fonts where licensing and technical setup allow
- derive shared color tokens from the approved brand palette
- ensure logos have suitable light and dark background treatments

The initial visual system should be built from brand tokens such as:

- primary brand color
- accent color
- neutral surfaces for light theme
- neutral surfaces for dark theme
- typography pairings for headings and body text

### Implementation guidance

Claude or future implementers should plan for:

- CSS custom properties or theme tokens at the app-shell level
- a reusable theme provider
- light/dark logo variants or background-aware logo treatment
- font loading from approved local assets if those assets are chosen for production use

If a provided logo asset only reads clearly on a light or dark background, plan for alternate variants rather than forcing one treatment everywhere.

## User Types And Access Strategy

Internal and external users should not share the same application experience.

### Internal users

Internal users belong in the unified internal app.

Potential roles:

- `admin`
- `estimator`
- `pm`
- `billing`
- `accounting`
- `executive`

Internal users should have permissions driven by roles and assignments rather than separate websites.

### External users

Customers should not be placed inside the full internal PM or estimating experience.

External users should have limited access only to customer-safe workflows such as:

- submitting quote requests
- viewing the status of their own requests
- viewing approved project updates
- viewing approved billing history
- downloading approved deliverables or quote documents

Customer-facing experiences should remain intentionally constrained and never expose:

- internal margins
- labor budgets
- estimating structure
- financial internals
- PM-only notes

## Suggested Route Families

Target route groupings for the unified app:

- `/quotes`
- `/estimating`
- `/projects`
- `/pm`
- `/billing`
- `/admin`
- `/analytics`

Example direction:

- `/quotes` for intake, triage, and opportunity management
- `/estimating` for estimate creation and revision
- `/projects` for awarded/live project records
- `/pm` for execution updates and field management
- `/billing` for earned revenue, invoices, and roll-forward workflows
- `/admin` for users, permissions, master data, and settings
- `/analytics` for dashboards and reporting

## Numbering Strategy

The system should maintain separate numbering systems by entity type.

### Quote requests

- `QR-2026-001`
- `QR-2026-002`

### Estimates

Estimate numbering can remain flexible, but should be distinct from projects.

Examples:

- `EST-2026-014`
- internal estimate UUID or controlled numeric sequence

### Projects / jobs

- `2026-001`
- `2026-041`

Rules for project/job numbers:

- sequential within each calendar year
- auto-generated
- read-only after creation

Derived display name:

- `2026-041 - Mobile Arena Renovation`

## Strategic Integrations

### SharePoint

SharePoint is expected to become a major system component, not just an optional add-on.

Intended uses:

- structured document storage
- standardized folder templates
- project-level document organization
- quote request intake document organization
- future list-backed operational data where appropriate

### QuickBooks

QuickBooks is intended to represent financial truth for:

- invoices
- payments
- accounting-facing financial data

### QuickBooks Time

QuickBooks Time is intended to support:

- labor hour actuals
- employee time by project
- job costing comparisons

### Power BI

Power BI is intended to provide reporting across:

- company overview
- project health
- PM performance
- estimating feedback
- quote activity and win rate

## Architectural Principles

The future architecture should aim for:

- one internal application shell
- one shared auth and role model
- one shared project lifecycle
- estimate as project baseline
- external access separated from internal workflows
- automation over manual duplication
- stable identifiers and status models
- document storage integrated with operational records

## Current Transition Direction

The practical near-term interpretation for this repo is:

1. Keep the current PM/billing functionality as a foundation.
2. Reframe the product as the internal platform.
3. Add quote intake and estimating concepts as first-class domains.
4. Make project creation a conversion step from estimate or awarded opportunity.
5. Treat SharePoint integration as part of the core architecture plan.

## Open Architecture Questions For Claude / Future Design

These are key questions to resolve during architecture work:

- What data belongs in the app database versus SharePoint lists?
- Should customer-facing quote request access live in this repo or a separate external app sharing the same backend?
- How should estimating data be modeled so project baselines remain immutable after award?
- What role model is needed beyond the current `admin`, `pm`, `customer` structure?
- What conversion workflow should exist between quote request, estimate, and project?
- Which entities need yearly sequential numbering and which can use UUIDs internally?
- What integrations should be stubbed first versus fully implemented?

## Summary

This platform is intended to become TCC's unified internal operating system.

The product vision is not:

- a standalone PM portal
- a standalone estimating tool
- a customer-heavy shared portal

The product vision is:

- one internal application
- role-based internal modules
- tightly linked quote, estimate, project, billing, and reporting workflows
- customer-safe external workflows kept intentionally limited
