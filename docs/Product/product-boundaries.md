# Product Boundaries

## Boundary policy

Each product owns one capability and one authoritative business record or decision boundary. Referencing another product’s projections does not transfer ownership. A consuming product may curate, display, or link source information, but must not silently recalculate, mutate, or duplicate the source model.

## Customer product boundaries

| Product | Owns | References | Intentionally does not own |
|---|---|---|---|
| Home | Cross-product orientation and attention projection | All customer products | Source records, recommendations, configuration |
| Workspace | Organization, brand, team, permissions, connected-system configuration, notifications, preferences | Properties, integrations | Property records, provider health, internal support |
| Revenue Intelligence | Revenue observations, performance projections, revenue opportunities | Properties, bookings | Reservation records, executive health, actions |
| Executive Intelligence | Executive synthesis, business-health narrative, priority framing | Revenue, portfolio, learning, actions | Source metrics, action execution, reports |
| Portfolio Intelligence | Portfolio health, concentration, capital-allocation analysis | Properties, revenue, learning, investments | Property records, acquisition records, reports |
| Investment Intelligence | Opportunities, analyses, assumptions, acquisition recommendations | Market evidence, portfolio context, learning | Property operations, portfolio health, action execution |
| Action Center | Actions, commitments, assignments, status, execution history | Recommendations and source products | Recommendations, source evidence, learning policy |
| Learning Intelligence | Outcomes, evaluated effectiveness, portfolio learning, improvement evidence | Actions, recommendations, observations | Source operations, automatic changes to other products |
| Properties | Property records and property lifecycle | Workspace access, bookings, guidebooks | Portfolio analysis, owner reports, provider configuration |
| Bookings | Reservations, calendars, stay state | Guests, properties, messages | Guest conversations, property records, revenue calculations |
| Guest Communications | Conversations, threads, messages, drafts, templates, schedules, communication timeline | Guests, bookings, properties, guidebooks, actions | Guest identity, reservations, property records |
| Reports | Definitions, templates, generation orchestration, snapshots, versions, sharing, distribution | All intelligence and business products | Source calculations, live dashboards, source mutations |
| Guidebook Studio | Guidebooks, journey content, guidebook media, branding, versions, guest presentation, QR codes | Properties, reservations, messages, local businesses, learning | Property records, reservations, conversations, learning conclusions |

## Internal Operations Console boundary

The Operations Console owns internal customer support, customer-account operations, provider monitoring, sync history, internal audits, infrastructure administration, content/service delivery, and platform intervention. It does not own customer business configuration.

Names that appear similar still represent different responsibilities:

| Customer capability | Internal counterpart | Boundary |
|---|---|---|
| Workspace connected systems | Provider monitoring | Customer connection intent vs platform/provider operations |
| Properties | Operations property inventory | Customer asset management vs internal support and intervention |
| Guidebook Studio | Guidebook Projects | Customer guest-experience publishing vs internal service delivery |
| Guest Communications | Support | Guest operations vs customer-to-Luxe-Haven support |

## Collision tests

Before assigning a feature:

1. Which record or decision does it mutate?
2. Which product is authoritative for that record?
3. Is the proposed product consuming a projection or creating a duplicate?
4. Would two products give conflicting answers after one update?
5. Does the capability serve a customer business workflow or an internal platform workflow?

If ownership remains ambiguous, the feature does not proceed until a single authoritative product is named.

## Boundary invariants

- Reports consumes published intelligence; it never recalculates it.
- Home aggregates attention; it never becomes a second Action Center.
- Workspace configures property inclusion and access; Properties owns property records.
- Executive Intelligence synthesizes; Portfolio and Revenue Intelligence retain their domain analysis.
- Action Center executes recommendations; intelligence products produce recommendations.
- Learning Intelligence proposes evidence-backed improvement; source products require human-approved changes.
- Archived business records are retained by their owning product, not moved to Reports or Administration.
