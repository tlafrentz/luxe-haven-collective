# Product Relationships

## HPM operating loop

```text
Workspace configuration
        ↓
Properties + Bookings + Guest Communications
        ↓
Revenue Intelligence
        ↓
Executive Intelligence
        ├── Portfolio Intelligence
        └── Investment Intelligence
                 ↓
            Action Center
                 ↓
        Learning Intelligence
                 └──────── evidence-backed improvements ────────┐
                                                                ↓
                                            Source product human review

Reports ← curated snapshots from every intelligence and business capability
Guidebook Studio ↔ Properties / Reservations / Guest Communications
Guidebook Studio observations → Learning Intelligence → reviewed improvements
```

Arrows mean typed inputs, references, or published projections—not ownership transfer.

## Input and output contracts

| Product | Consumes | Produces | Principal consumers |
|---|---|---|---|
| Workspace | Customer configuration commands | Organization, access, connection, and preference projections | Every customer product |
| Revenue Intelligence | Booking and property observations | Revenue metrics, trends, opportunities, evidence | Executive, Portfolio, Reports |
| Executive Intelligence | Revenue, portfolio, learning, and action projections | Executive health, priorities, synthesis | Home, Reports, leaders |
| Portfolio Intelligence | Property performance, investments, learning | Portfolio health, allocation and concentration findings | Executive, Investment, Reports |
| Investment Intelligence | Opportunity assumptions, market evidence, portfolio context | Analysis, scenarios, risks, recommendation | Action Center, Portfolio, Reports |
| Action Center | Approved recommendations and operator commitments | Execution status and outcomes | Home, Executive, Learning, Reports |
| Learning Intelligence | Outcomes, actions, recommendations, observations | Effectiveness evaluations and improvement evidence | All intelligence products, Guidebook Studio |
| Properties | Workspace ownership/access references | Authoritative property projections | Bookings, intelligence, Reports, Guidebook Studio |
| Bookings | Property and guest references | Reservation and stay projections | Revenue, Communications, Guidebooks |
| Guest Communications | Guest, reservation, property, guidebook references | Conversation state, response history, communication observations | Actions, Reports, Learning |
| Reports | Versioned projections from source products | Audience-specific report snapshots and distributions | Owners and external stakeholders |
| Guidebook Studio | Property, reservation, communication, local and learning references | Published guidebook versions and guest-use observations | Guests, Communications, Learning |

## Relationship rules

### Identity and lineage

Cross-product references use stable IDs and public projections. Derived outputs retain source IDs, “as of” timestamps, policy versions, and evidence lineage where decisions depend on them.

### Freshness

Operational screens may use current projections. Reports always pin a point-in-time snapshot. Historical analysis and published guidebook/report versions must not silently refresh.

### Commands

A consumer does not write another product’s records directly. It issues an authorized command through the owning product’s application boundary. For example, Learning can recommend a guidebook change but Guidebook Studio owns review and publication.

### Failure and absence

Missing optional inputs lower confidence or hide dependent features; they do not invite duplicated calculations. A product explains which connection or source is missing and links the user to the owning product.

## High-value improvement loops

### Revenue to execution

Revenue observations become opportunities; executive synthesis establishes priority; operators approve actions; Action Center records execution; Learning evaluates the result.

### Guest communications

Bookings establish journey context; Guest Communications captures guest needs and response outcomes; Action Center receives explicit operational escalations; Learning evaluates communication patterns.

### Guidebook learning

Guidebook views, searches, repeated opens, questions, and feedback become structured observations. Learning evaluates their relationship to guest outcomes. Guidebook Studio surfaces evidence-backed suggestions for explicit human review and publication.

### Reporting

Reports selects audience first, then curates versioned outputs from source products. Distribution never changes the source data or transforms a snapshot into a live dashboard.
