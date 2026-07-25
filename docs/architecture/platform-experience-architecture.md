# Platform Experience Architecture v1 (PEA-001)

## Product model

Luxe Haven has two authenticated experiences over one shared shell foundation:

```text
Client / Partner Workspace                 Internal Operations Console
Home · Workspace                           Operations / Infrastructure
Observe → Understand → Decide              Internal service delivery
        → Execute → Learn                  Internal administration
Properties · Bookings
Guest Communications · Reports
Guidebook Studio
```

HPM stages answer why an operator is working; business workspaces answer what operational records they are working on. Investment Intelligence therefore appears under Decide. Action Center belongs under Execute. Reports belongs under Business as the publishing layer and does not calculate intelligence. Portfolio Intelligence is nested beneath Executive Intelligence within Understand because it is a deeper health diagnostic, not a separate lifecycle stage.

## Experience boundary

`ClientWorkspaceShell` serves authenticated owners, administrators, managers, contributors, viewers, and eligible partners on `/dashboard` and the customer portal routes `/properties`, `/bookings`, `/messages`, `/reports`, and `/guidebooks`. `OperationsConsoleShell` serves internal administrators on `/admin`. The two configurations, route exposure, capability sets, and language are separate even though they share application-frame behavior, responsive navigation, active-state logic, breadcrumbs, and accessibility primitives.

The customer configuration product is called Workspace. Internal tooling is called Operations Console. Customer navigation never links to provider health, sync history, audit, repair, internal notes, customer-management tools, or internal service-delivery projects.

## Typed navigation and authorization

`src/platform/experience` owns `PlatformExperience`, navigation groups, availability, active-match policies, route metadata, breadcrumbs, capability IDs, and capability filtering. Navigation receives a resolved capability set; it never infers permission from route, email, or raw role checks. Direct route guards and server actions remain authoritative. The current role projection maps the repository’s `owner`, `cleaner`, and `admin` roles to capability sets, while the architecture remains ready for the longer-term organization roles.

Available, limited-preview, and coming-soon are distinct. Coming-soon entries are non-navigable and visibly labeled. Limited previews must communicate their scope. Permission denial is never represented as coming soon.

## Route preservation and inventory

PEA-001 preserves the current physical routes and adds no high-risk migration:

| Route | Experience | Placement | Availability |
|---|---|---|---|
| `/dashboard` | Client | Home | Available |
| `/dashboard/insights` | Client | Observe → Revenue Intelligence | Available |
| `/dashboard/investments` | Client | Decide → Investments → New Analysis | Available |
| `/dashboard/investments/portfolio` | Client | Decide → Investments → Portfolio | Available |
| `/dashboard/investments/portfolio/[id]` | Client | Decide → Investments → Opportunity | Available |
| `/dashboard/investments/portfolio/compare` | Client | Decide → Investments → Comparison | Available |
| `/dashboard/investments/portfolio/[id]/analyses/[analysisId]` | Client | Decide → Investments → Historical Analysis | Available |
| `/dashboard/actions` and `/dashboard/actions/[id]` | Client | Execute → Action Center | Available |
| `/properties` | Client | Properties | Available |
| `/bookings` | Client | Bookings | Available |
| `/messages` | Client | Business → Guest Communications | Available |
| `/reports` | Client | Business → Reports | Available |
| `/guidebooks` | Client | Services → Guidebook Studio | Available |
| `/dashboard/workspace` | Client | Workspace | Available |
| `/admin` | Operations | Operations → Dashboard | Available |
| `/admin/properties` and detail/editor routes | Operations | Operations → Properties | Available |
| `/admin/owners` | Operations | Operations → Customers | Available |
| `/admin/inquiries` | Operations | Operations → Support | Available |
| `/admin/integrations` | Operations | Platform → Integrations | Available |

Executive Intelligence remains a limited preview. Sync History, Provider Health, Audit, internal Guidebook Projects, Design Projects, and Service Catalog remain explicit non-navigable emerging Operations Console destinations. No duplicate page implementations or route aliases are needed in v1.

Dynamic opportunity and action labels remain feature-owned. The shell supplies stable stage/workspace breadcrumbs and page context; feature pages can add resource names later through public projections. Current breadcrumbs never link to themselves, and query parameters do not affect active matching.

## Shared shell behavior

The shared shell supports expanded and collapsed desktop sidebars, explicit parent/child hierarchy, a mobile drawer with escape close, body-scroll control, focus restoration, active states, availability badges, environment indication, responsive header, and semantic navigation landmarks. The client workspace uses a warm premium workspace treatment; Operations retains a related dark operational identity without customer-facing hierarchy.

The global scope selector and search are intentionally deferred. No nonfunctional selector is presented. Feature filters and sticky primary actions remain feature-owned. Breadcrumbs preserve parent return paths without making the shell query feature databases.

## Analytics and future evolution

The typed IDs and route definitions provide safe dimensions for future `platform_navigation_item_selected`, group expansion, drawer, redirect, availability-interest, and denied-navigation events. Dynamic resource names and sensitive financial values are excluded. Future `/dashboard/decide/...` aliases can redirect to preserved investment routes without changing navigation contracts. New capabilities must pass the canonical review in `docs/Product/navigation-review-checklist.md`.
