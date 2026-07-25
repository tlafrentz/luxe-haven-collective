# Navigation Architecture (NIA-001)

**Version:** 1.0  
**Owner:** Experience Design OS  
**Consumers:** Product, Engineering, Strategy  
**Status:** Implemented foundation

## Mission

Navigation is the table of contents for the Luxe Haven Hospitality Performance Management operating system. It communicates where users are, what each product does, how products relate, and which capabilities belong to the HPM lifecycle, business operations, customer services, or internal Administration.

The governing question is: **Can a hospitality operator understand the Luxe Haven operating system from navigation alone?**

## Canonical mental model

```text
Home
Workspace

HPM lifecycle
├── Observe — What is happening?
│   └── Revenue Intelligence
├── Understand — What does it mean?
│   └── Executive Intelligence
│       └── Portfolio Intelligence
├── Decide — What should I choose?
│   └── Investment Intelligence
├── Execute — What should I do next?
│   └── Action Center
└── Learn — What should improve?
    └── Learning Intelligence

Business
├── Properties
├── Bookings
├── Guest Communications
└── Reports

Services
└── Guidebook Studio

Administration — authorized doorway to the separate Operations Console
```

Lifecycle navigation explains and improves the business. Business navigation operates systems of record and daily work. Services extend customer value. Administration is a separate internal experience and is never mixed with customer configuration. Authorized internal users may see a visually separated Administration link that changes experiences; customer roles never see it.

## Five structural regions

1. Brand and current workspace context
2. Home and Workspace
3. HPM lifecycle
4. Business and Services
5. User controls and an authorized Administration doorway into the separate Operations Console

The sidebar scrolls independently from page content. Brand/workspace context and user controls remain discoverable without pinning so much content that smaller laptop viewports become unusable.

## Core rules

- Organize by operator intent, never by code modules.
- One product has one primary sidebar location.
- A label is routable only when it owns meaningful content.
- No global hierarchy exceeds three visible levels.
- Lifecycle stages remain visible and expanded by default.
- Business and Services remain visible; responsive drawers may condense their presentation.
- The active route is the source of truth.
- Navigation visibility is not authorization.
- Future roadmap entries are hidden unless a user participates in an intentional preview.
- Cross-product relationships appear inside products, not as duplicate sidebar links.

## Landing-page rule

A conceptual group is non-routable until it has a real overview. Observe, Understand, Decide, Execute, Learn, Business, and Services currently organize products rather than linking to placeholders. Products may be limited previews, but a preview entry describes its availability and is not presented as a dead route.

## Workspace and Administration

Workspace owns customer organization, team, property access, connections, notifications, and preferences.

Administration owns internal support, monitoring, platform operations, content/service fulfillment, customer administration, and infrastructure. Guidebook Studio is customer publishing; Guidebook Projects is internal fulfillment. Similar names do not imply shared ownership or shared navigation.

## Command navigation

A future command menu may supplement navigation with products and records through Command-K/Control-K. It cannot replace the sidebar hierarchy or become a second product catalog. NIA-001 reserves this capability conceptually but does not implement it.

## Evaluation tasks

An unfamiliar operator should choose these paths without instruction:

1. Explain portfolio change: Understand → Executive Intelligence → Portfolio Intelligence.
2. Respond to today’s arrival: Business → Guest Communications.
3. Configure a PMS: Workspace → Connected Systems.

Failure indicates hierarchy, naming, or product-page orientation needs correction—not a need for additional duplicate links.
