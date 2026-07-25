# Hospitality Performance Reports

## Product mission

Reports is the publishing layer of Luxe Haven. It packages Hospitality Performance Management intelligence into curated, decision-ready narratives for owners, investors, operators, lenders, partners, and advisors.

The guiding question is: **What does this audience need to understand in order to make better hospitality decisions?**

Reports are not live dashboards or raw exports. Every published report is a versioned point-in-time snapshot combining trusted metrics, insights, recommendations, supporting evidence, and executive narrative.

## Flagship publishing architecture

The canonical product is the **Hospitality Performance Report (HPR)**, published in specialized editions:

- Executive Edition
- Owner Edition
- Investment Edition
- Portfolio Edition
- Operations Edition
- Future: Learning Edition

Every edition shares Luxe Haven Press branding, narrative structure, scorecards, recommendation language, evidence standards, and version semantics. This avoids a catalog of unrelated exports while allowing each audience to receive an appropriately curated story.

## Ownership and boundaries

Reports owns report definitions, templates, generation orchestration, review state, publishing, snapshots, version history, scheduling definitions, exports, sharing, distribution, and archival.

Reports references Revenue Intelligence, Executive Intelligence, Portfolio Intelligence, Investment Intelligence, Learning Intelligence, Properties, Bookings, Guest Communications, and Actions. It never recalculates their metrics, health assessments, recommendations, or learning. Published reports retain source references and “as of” timestamps.

## Report lifecycle

1. Select the audience.
2. Select the HPR edition.
3. Configure properties and reporting period.
4. Generate from existing intelligence.
5. Review narrative and evidence.
6. Publish an immutable versioned snapshot.
7. Share or export that snapshot.
8. Archive without deletion.

Audience selection always precedes data scope and file format.

## Primary sections

### Executive Reports

**Mission:** Summarize the current state of the hospitality business.  
**Audience:** Owner, CEO, and executive team.  
**Business question:** How is the business doing?  
**Workflow:** Select the executive audience and period; curate Executive Intelligence, portfolio and learning health, revenue, recommendations, priorities, and action progress; review; publish.  
**Future roadmap:** AI executive summaries, board packages, and quarterly business reviews.

### Owner Reports

**Mission:** Communicate property performance clearly and credibly.  
**Audience:** Property owner.  
**Business question:** How is my property performing?  
**Workflow:** Select owner and properties; curate revenue, occupancy, ADR, expenses, NOI, payout context, guest satisfaction, and recommendations; review; publish and distribute.  
**Future roadmap:** Owner statements, owner portal delivery, custom branding, and commentary workflows.

### Investment Reports

**Mission:** Package acquisition intelligence for a capital decision.  
**Audience:** Investor, partner, and lender.  
**Business question:** Should we make this investment?  
**Workflow:** Select opportunity and audience; curate investment analysis, market evidence, comparables, risks, financial model, scenarios, and recommendation; review evidence; publish.  
**Future roadmap:** Lender packages, due-diligence appendices, digital deal rooms, and partner approvals.

### Portfolio Reports

**Mission:** Explain portfolio health and capital priorities.  
**Audience:** Portfolio operator, investor, and board.  
**Business question:** How healthy is the portfolio?  
**Workflow:** Select portfolio and period; curate portfolio health, allocation, learning, diversification, concentration, and opportunities; review; publish.  
**Future roadmap:** Board packages, benchmarking, capital planning editions, and investor portal delivery.

### Operations Reports

**Mission:** Summarize the quality and consistency of operational execution.  
**Audience:** Operations, property management, and guest services.  
**Business question:** How well are we operating?  
**Workflow:** Select operating audience and scope; curate action completion, maintenance, guest communications, cleaning, execution, and bottlenecks; review priorities; publish.  
**Future roadmap:** Team scorecards, service-level reporting, vendor editions, and post-stay delivery.

### Exports

**Mission:** Produce portable information from a defined report snapshot.  
**Audience:** External stakeholders, finance teams, analysts, and connected systems.  
**Business question:** How do I share this?  
**Workflow:** Select a published report version; choose PDF, CSV, or Excel; preserve report identity, period, version, and source context in the output.  
**Future roadmap:** Google Sheets, API delivery, interactive reports, and white-label packages.

## Templates

Initial template concepts include Monthly Executive Report, Owner Statement, Investment Package, Portfolio Health Review, Quarterly Business Review, and Hospitality Performance Review. Each template defines its audience, purpose, sections, recommended frequency, and delivery intent.

## Scheduling and distribution

Scheduling and automated distribution are future capabilities. Planned triggers include weekly, monthly, quarterly, after checkout, end of month, and investor meetings. Planned channels include email, download, secure share link, owner portal, and investor portal. Each delivery must publish a new snapshot rather than exposing a mutable live view.

## Empty states

When no reports exist, invite the user to generate the first Hospitality Performance Report by choosing an audience. Do not present an empty export list.

## Acceptance criteria

- Reports is presented as a decision-support publishing product rather than an export utility.
- Executive, Owner, Investment, Portfolio, Operations, and Exports are visible primary sections.
- Every edition declares its audience, purpose, and primary business question.
- The primary generation workflow begins with audience and report type before property, period, or format.
- Published reports are represented as versioned point-in-time snapshots.
- Reports consumes platform intelligence without duplicating calculations or source ownership.
- Templates, lifecycle, recent snapshots, planned scheduling, sharing, and archive concepts are represented.
- Initial empty states invite generation of a decision-ready HPR.
- Future portals, scheduled delivery, AI summaries, interactive formats, and white labeling remain documented but outside initial runtime scope.
