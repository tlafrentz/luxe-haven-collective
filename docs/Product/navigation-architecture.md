# HPM Navigation Architecture

## Status and purpose

This document is the canonical information architecture for the Luxe Haven customer workspace. Navigation is the table of contents for the Hospitality Performance Management operating system. It mirrors how hospitality operators configure, understand, run, and improve their businesses—not how application code or databases are organized.

The governing test is: **Can a customer understand how Luxe Haven helps operate their business simply by exploring the navigation?**

## Canonical customer navigation

```text
Home
Workspace

HPM lifecycle
├── Observe
│   └── Revenue Intelligence
├── Understand
│   └── Executive Intelligence
│       └── Portfolio Intelligence
├── Decide
│   └── Investment Intelligence
├── Execute
│   └── Action Center
└── Learn
    └── Learning Intelligence

Business
├── Properties
├── Bookings
├── Guest Communications
└── Reports

Services
└── Guidebook Studio
```

Administration is a separate authenticated experience—the Operations Console—and is never a customer navigation group. Its separation is architectural, not merely visual. Customer configuration belongs to Workspace; internal operations, support, provider health, platform administration, and service delivery belong to the Operations Console.

## Navigation grammar

- **Home** answers “What needs my attention across the business?”
- **Workspace** answers “How is my hospitality business configured?”
- **Lifecycle stages** describe why the operator is working: Observe, Understand, Decide, Execute, Learn.
- **Lifecycle products** describe the capability used at that stage.
- **Business** contains operational systems of record used in daily work.
- **Services** contains customer-facing value extensions.
- **Administration** is isolated in the internal Operations Console.

The order progresses from strategic orientation to tactical operation. Availability and authorization are different concepts: unavailable products use a preview status; unauthorized products are omitted. Direct route guards remain authoritative.

## Destination catalog

| Destination | Mission | Primary business question | Primary user | Evolution without navigation change |
|---|---|---|---|---|
| Home | Orient the operator across priorities and business condition | What needs my attention? | Owner, operator | Personalized command center |
| Workspace | Configure the hospitality business | How is my business configured? | Owner, portfolio operator | Onboarding, security, billing |
| Revenue Intelligence | Explain revenue performance and opportunity | What is happening? | Owner, revenue operator | Forecasting, pricing context |
| Executive Intelligence | Synthesize business performance and health | How is the business performing? | Owner, executive | Executive planning and scenarios |
| Portfolio Intelligence | Diagnose portfolio health and capital priorities | How healthy is my portfolio? | Portfolio operator, investor | Allocation and concentration tooling |
| Investment Intelligence | Support acquisition decisions | Should I acquire this opportunity? | Owner, investor | Diligence and financing workflows |
| Action Center | Coordinate committed execution | What should I do next? | Operator, manager | Assignments, dependencies, automation |
| Learning Intelligence | Turn outcomes into organizational learning | What should the business improve over time? | Owner, leader | Evidence policies and improvement loops |
| Properties | Maintain property records | What assets am I managing? | Owner, property manager | Groups and ownership structures |
| Bookings | Operate reservations and calendars | What reservations am I operating? | Operator, guest services | Calendar and stay operations |
| Guest Communications | Manage unified guest conversations | Which guests require attention? | Guest services, operator | Shared inbox and approvals |
| Reports | Publish decision-ready business narratives | What should I communicate to this audience? | Owner, asset manager | Portals, scheduled delivery |
| Guidebook Studio | Publish and improve guest experiences | How do I prepare guests for a successful stay? | Property manager, experience manager | Learning-led optimization |

## Understand hierarchy

Executive Intelligence is the primary Understand destination. Portfolio Intelligence is its nested diagnostic workspace because portfolio health is a deeper explanation of executive business condition, not a separate lifecycle stage. The route remains independently addressable and permission-controlled.

## Naming rules

Names describe business capabilities, not technologies:

- Use **Guest Communications**, not Inbox or Email.
- Use **Reports** in compact navigation and **Hospitality Performance Reports** as the product heading.
- Use **Workspace**, not Workspace Settings.
- Use **Guidebook Studio** for customer creation and **Guidebook Projects** only for internal service delivery.
- Use stable capability names even as internal implementations change.

## Scale rules

A new top-level item requires a new operator responsibility, not merely a feature. Prefer extending an existing product’s internal information architecture when the feature shares its mission, question, owner, and system of record. New lifecycle stages require an HPM model change and architecture review. New internal tools never enter customer navigation.

## Source contracts

Typed navigation lives in `src/platform/experience/navigation`; typed routes live in `src/platform/experience/routing`. Navigation items use stable IDs for authorization, active matching, analytics, and tests. `parentId` expresses hierarchy without coupling routes to visual components.
