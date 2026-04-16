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

Approved customers should be able to submit quote requests through a lightweight external `Opportunity Hub` experience.

Internal users should then be able to:

- review
- triage
- request missing info
- assign an estimator
- track bid activity by customer
- enter bid prices, proposal dates, and bid dates
- track progress
- track won / lost outcomes and reasons
- convert the request into an estimate opportunity
- eventually convert an awarded estimate into a project

## Opportunity Hub

Quote requests and bids should behave like a lightweight internal opportunity pipeline rather than a one-time intake form.

That means the system should support:

- a `Pursuit -> Opportunity` hierarchy
- a customer-level history of all bids and quote requests
- one active record that follows the opportunity from intake through estimating and award/loss
- internal bid fields such as bid price, bid date, proposal date, assigned estimator, stage, outcome, and loss reason
- customer win/loss reporting over time
- future handoff into the estimating module without re-entering the same opportunity data

The quote request should be the front door, but once internal work begins it should also function as the bid/opportunity record.

`Opportunity Hub` is the shared product name for that pipeline so it matches `ProjectHub` and keeps naming consistent for both internal users and customers.

### Pursuit -> Opportunity hierarchy

The official model should be:

- `Pursuit` = the real-world project or job being chased
- `Opportunity` = one customer/vendor-specific bid under that pursuit

This is important because the same project often appears under multiple competing customers or vendors.

Examples:

- Pursuit: `Andalusia ES Addition`
- Opportunities:
  - `Trane - Andalusia ES Addition`
  - `Mechanical GC - Andalusia ES Addition`
  - `Another Vendor - Andalusia ES Addition`

Rules:

- one pursuit can have many opportunities
- each opportunity keeps its own scope, pricing, proposal package, estimate path, and won/lost outcome
- opportunities under the same pursuit must not be assumed to have the same price
- opportunities under the same pursuit may have slightly different scope definitions, exclusions, addenda, and proposal dates
- the awarded project should be created from the winning opportunity, while still preserving the shared pursuit context

## Customer Experience

Customers should not enter the full internal PM or estimating app.

Instead, they should get a constrained `Opportunity Hub` portal or intake flow.

### Customer capabilities

- log in
- land in `Opportunity Hub`
- see a clear `Submit Quote Request` action
- submit a quote request
- save draft
- upload files
- drag and drop files into a Dropbox-style request area
- provide scope notes
- set requested due date
- track status
- track quote progress
- potentially add comments later
- add more files later if the estimator requests more information

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

The upload experience should feel more like a shared Dropbox request than a rigid form attachment field:

- drag-and-drop first
- multiple files per request
- room for later addenda uploads
- visible history of what was uploaded and when
- eventual status visibility tied to the quote request progress

## Internal Workflow

Internal users should manage quote requests through a dedicated intake dashboard.

### Intake dashboard functions

- view new requests
- sort by due date
- filter by customer
- filter by estimator
- filter by bid stage / won / lost
- see missing info
- assign estimator
- update status
- enter bid price and dates
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
- bid date
- bid price
- status
- assigned estimator
- date received
- won/lost
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
- bid price
- bid date
- proposal submitted date
- won/lost outcome
- loss reason
- next action

Suggested actions:

- request more info
- assign estimator
- convert quote request to opportunity
- create estimate in `hvac-estimator`
- use legacy Excel estimating path
- mark lost
- archive

### 3. Opportunity conversion workflow

One-click or guided conversion should first turn the quote request into a managed opportunity record.

From that point, internal users should be able to choose the estimating path:

- create estimate in `hvac-estimator`
- use the legacy Excel workbook flow

The opportunity should remain the parent lifecycle record either way.

If the project already exists as a pursuit because another customer/vendor is bidding the same real-world job, the new opportunity should attach to that existing pursuit instead of creating a duplicate pursuit.

Internal users should be able to:

- create a new pursuit
- match the quote request to an existing pursuit
- create a new opportunity under that pursuit

### 4. Estimate conversion workflow

For the `hvac-estimator` path, one-click or guided conversion should create or link an estimate shell from the approved opportunity.

That estimate should inherit:

- customer
- project name
- location
- source documents
- notes
- due date context
- bid context
- relevant request metadata

Once the estimating tool is fully developed, the same lifecycle record should continue into the estimating module rather than starting over in a disconnected estimate entry flow.

For the legacy Excel path, the opportunity should still store:

- the uploaded `.xlsm`
- extracted summary values
- proposal package
- bid outcome
- eventual project conversion link

## Proposal And Estimate File Intake

Each opportunity should support a document package that can be uploaded and parsed.

Recommended upload set:

- proposal `.docx`
- proposal `.pdf`
- estimate `.xlsm`

Recommended system behavior:

- use the `.docx` proposal as the primary extraction source for structured text, scope sections, exclusions, references, and pricing rows
- archive the `.pdf` proposal as the customer-issued version that was actually sent
- use the `.pdf` as a cross-check for customer-facing date and final rendered pricing values
- use the `.xlsm` estimate workbook as the source for estimate summary numbers, especially from the `Summary` tab

The system should store both the original files and the normalized values extracted from them.

### Proposal fields to extract

From the proposal package, the system should aim to extract:

- proposal date
- customer / recipient
- project name
- references and addenda
- pricing rows
- scope summary
- equipment groups and tag ranges
- clarifications
- exclusions
- warranty text

### Estimate summary fields to extract

From the estimate workbook, the system should aim to extract:

- labor hours
- labor cost
- material cost
- direct / indirect cost
- overhead rate and value
- profit rate and value
- vendor fee rate and value
- total cost
- marked-up value / base bid value
- bond value
- final total

### 4. Project creation from estimate

The New Project flow should include a clear path to pull from an existing estimate page.

Instead of retyping core data, users should be able to start project creation from the estimate context and prefill:

- customer
- project name
- site/location
- source estimate ID
- contract / awarded price
- relevant notes and documents

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

`/Bids/QR-2026-001 - Customer Name - Project Name`

Suggested subfolders:

- `/01 Customer Uploads`
- `/02 Internal Review`
- `/03 Estimate Working`
- `/04 Submitted Quote`

Recommended file placement inside the opportunity folder:

- proposal `.docx` → `/03 Estimate Working`
- estimate `.xlsm` → `/03 Estimate Working`
- final customer-issued proposal `.pdf` → `/04 Submitted Quote`
- optional locked `.docx` that exactly matches the issued proposal → `/04 Submitted Quote`

On new internal opportunity creation, the system should also pre-populate the working folder from SharePoint master templates:

- copy `Electrical Budgeting Tool v15.xlsm` from the root templates area into `/03 Estimate Working`
- copy `HVAC Control Installation Proposal-Template.docx` from the root templates area into `/03 Estimate Working`
- rename the copied proposal file so `Template` becomes the project name
  - example: `HVAC Control Installation Proposal-Andalusia ES Addition.docx`

Recommended master-template location:

- `/_Templates/Opportunity Master Templates/`

Important behavior:

- the estimate workbook should keep whatever the current versioned filename is, such as `v15`
- the master files in `/_Templates/Opportunity Master Templates/` should remain editable so TCC can update the source templates over time
- each opportunity keeps the specific template copies that were dropped when that opportunity was created

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

Recommended award workflow:

- create project record and job number
- create project SharePoint folder under `/Active Projects/YYYY-NNN - Project Name`
- copy final proposal `.pdf`, proposal `.docx`, and estimate `.xlsm` into `/01 Estimate Baseline`
- keep the original opportunity folder in `/Bids/...` as the pre-award history

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
- customer upload activity feed
- customer-facing quote progress timeline
- document extraction confidence / review queue

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
