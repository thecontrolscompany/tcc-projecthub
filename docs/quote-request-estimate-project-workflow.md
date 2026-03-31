# Quote Request To Estimate To Project Workflow

## Purpose

This document describes the desired front-of-funnel workflow that should sit ahead of estimating and project execution.

The intent is to standardize how opportunities enter the business and create a cleaner bridge into estimating and project delivery.

Core lifecycle:

`Quote Request -> Estimate -> Project`

## Business Problem

Today quote requests may arrive through inconsistent channels such as:

- email
- texts
- phone calls
- partial attachments
- incomplete scope descriptions

This creates intake chaos and slows down estimating.

The quote request feature should standardize every opportunity around:

- customer identity
- due date
- document package
- scope description
- assignment
- status

## Product Goal

Approved customers should be able to submit quote requests through a lightweight external experience.

Internal users should then be able to:

- review
- triage
- request missing info
- assign an estimator
- track progress
- convert the request into an estimate opportunity
- eventually convert an awarded estimate into a project

## Customer Experience

Customers should not enter the full internal PM or estimating app.

Instead, they should get a constrained quote request portal or intake flow.

### Customer capabilities

- log in
- submit a quote request
- save draft
- upload files
- provide scope notes
- set requested due date
- track status
- potentially add comments later

### Customer limitations

Customers should not see:

- internal margin targets
- labor budgets
- internal estimating breakdowns
- PM financial information
- internal notes

## Recommended Customer-Facing Fields

Minimum useful intake fields:

- customer name
- company
- email
- phone
- project name
- project location
- requested due date
- bid date
- scope description
- notes / special instructions
- attachments

Optional but valuable:

- GC
- engineer
- controls vendor
- job type
- budget range
- site walk required
- new construction vs retrofit
- occupied building yes/no

## Uploads

Supported customer uploads should include:

- plans
- specs
- addenda
- photos
- equipment schedules
- existing control drawings

## Internal Workflow

Internal users should manage quote requests through a dedicated intake dashboard.

### Intake dashboard functions

- view new requests
- sort by due date
- filter by customer
- filter by estimator
- see missing info
- assign estimator
- update status
- open detail page
- convert to estimate

### Suggested statuses

- `new`
- `under_review`
- `waiting_on_info`
- `assigned`
- `estimating`
- `submitted`
- `won`
- `lost`
- `archived`

## Recommended Internal Screens

### 1. Quote request dashboard

Suggested columns:

- request ID
- customer
- project name
- due date
- status
- assigned estimator
- date received
- files attached

### 2. Quote request detail page

Should show:

- request summary
- due date
- files
- customer notes
- internal notes
- communication log
- assignment
- next action

Suggested actions:

- request more info
- assign estimator
- create estimate
- mark lost
- archive

### 3. Estimate conversion workflow

One-click or guided conversion should create an estimate shell from the approved request.

That estimate should inherit:

- customer
- project name
- location
- source documents
- notes
- due date context
- relevant request metadata

## Numbering Strategy

Quote requests should have their own ID series.

Examples:

- `QR-2026-001`
- `QR-2026-014`

This numbering should remain separate from:

- estimate IDs
- project/job numbers

Example relationship:

- Quote Request: `QR-2026-014`
- Estimate: `EST-2026-022`
- Project: `2026-041`

## SharePoint / Document Strategy

This workflow fits naturally with SharePoint-backed document storage.

Recommended folder pattern:

`/Quote Requests/QR-2026-001 - Customer Name - Project Name`

Suggested subfolders:

- `/01 Customer Uploads`
- `/02 Internal Review`
- `/03 Estimate Working`
- `/04 Submitted Quote`

System behavior on submission:

- create quote request record
- generate quote request number
- create SharePoint folder
- upload files into `01 Customer Uploads`
- notify internal staff

If the request proceeds into estimating, the record should continue to link to:

- estimate record
- working folder
- internal notes
- customer communication history

If awarded later, the system should support conversion into the standard project structure.

## Relationship To The Unified Platform

This workflow belongs at the front of the broader system lifecycle.

Target lifecycle:

`Quote Request -> Estimate -> Project -> Billing / Closeout`

This means quote requests should not be designed as a one-off feature. They should be architected as the entry point into the rest of the internal platform.

## MVP Recommendation

The first useful version should include:

- customer submission form
- file uploads
- internal intake queue
- status changes
- assignment to estimator
- detail page
- convert-to-estimate action

That MVP alone would already create major operational value.

## Future Enhancements

Possible later upgrades:

- acknowledgment email on submission
- automatic notifications to admin or estimator
- due-date reminders
- request-more-info workflow
- customer/internal message thread
- versioned addenda uploads
- customer-specific permission rules
- request templates by opportunity type

Examples of request templates:

- DDC retrofit
- service request
- plan/spec bid
- design-build budgeting

## Internal-Only Opportunity Fields

Internal-only fields that may become useful later:

- assigned estimator
- target margin
- opportunity value
- probability
- bid type
- lead source
- competitors
- internal notes

## Reporting Value

When connected to reporting, quote requests can support metrics such as:

- requests received
- average turnaround time
- win rate
- quotes by customer
- quotes by estimator
- quotes by job type

This makes the feature strategically valuable beyond intake alone.

## Summary

Quote requests should be treated as the first formal stage in the TCC system.

This is not just a form. It is the front door to the operational pipeline:

`Quote Request -> Estimate -> Project`

Design it so the intake record can cleanly evolve into estimating work and then into execution without re-entering the same information multiple times.

