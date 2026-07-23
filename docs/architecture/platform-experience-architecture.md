# Platform Experience Architecture v1 (PEA-001)

## Product model

Luxe Haven has two authenticated experiences over one shared shell foundation:

```text
Client / Partner Workspace                 Internal Operations Console
Home → Observe → Understand → Decide      Operations / Platform / Content
          → Execute → Learn               Internal Settings
Properties · Investments · Bookings
Messages · Reports · Services
Workspace Settings
```

HPM stages answer why an operator is working; business workspaces answer what they are working on. Investments therefore appears primarily under Decide and secondarily as a business shortcut. Action Center belongs under Execute. Learn remains an explicit emerging state instead of being filled with unrelated Reports.

## Experience boundary

`ClientWorkspaceShell` serves authenticated owners, administrators, managers, contributors, viewers, and eligible partners on `/dashboard` and the existing portal routes `/properties`, `/bookings`, and `/messages`. `OperationsConsoleShell` serves internal administrators on `/admin`. The two configurations, route exposure, capability sets, and language are separate even though they share application-frame behavior, responsive navigation, active-state logic, breadcrumbs, and accessibility primitives.

The customer destination is called Workspace Settings. Internal tooling is called Operations Console. Customer navigation never links to provider health, sync history, audit, repair, internal notes, or customer-management tools.

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
| `/messages` | Client | Messages | Limited preview |
| `/dashboard/settings` | Client | Workspace Settings | Available |
| `/admin` | Operations | Operations → Dashboard | Available |
| `/admin/properties` and detail/editor routes | Operations | Operations → Properties | Available |
| `/admin/owners` | Operations | Operations → Customers | Available |
| `/admin/inquiries` | Operations | Operations → Support | Available |
| `/admin/integrations` | Operations | Platform → Integrations | Available |

Services, Reports, Learn, Sync History, Provider Health, Audit, Service Catalog, and Internal Settings are represented as explicit non-navigable emerging destinations. No duplicate page implementations or route aliases are needed in v1.

Dynamic opportunity and action labels remain feature-owned. The shell supplies stable stage/workspace breadcrumbs and page context; feature pages can add resource names later through public projections. Current breadcrumbs never link to themselves, and query parameters do not affect active matching.

## Shared shell behavior

The shared shell supports expanded and collapsed desktop sidebars, a mobile drawer with escape close, body-scroll control, focus restoration, active parent/child states, availability badges, environment indication, responsive header, and semantic navigation landmarks. The client workspace uses a warm premium workspace treatment; Operations retains a related dark operational identity without customer-facing hierarchy.

The global scope selector and search are intentionally deferred. No nonfunctional selector is presented. Feature filters and sticky primary actions remain feature-owned. Breadcrumbs preserve parent return paths without making the shell query feature databases.

## Analytics and future evolution

The typed IDs and route definitions provide safe dimensions for future `platform_navigation_item_selected`, group expansion, drawer, redirect, availability-interest, and denied-navigation events. Dynamic resource names and sensitive financial values are excluded. Future `/dashboard/decide/...` aliases can redirect to the preserved investment routes without changing navigation contracts. Services can later become native workspaces without changing HPM categories.
