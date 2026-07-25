# Navigation Route Map

## Customer workspace

| Label | ID | Level / parent | Current canonical route | Future route family | Visibility | Capability | Badge definition | Local navigation |
|---|---|---|---|---|---|---|---|---|
| Home | `home` | 1 | `/dashboard` | `/dashboard` | Available | `view_home` | None | Product-owned dashboard |
| Workspace | `workspace` | 1 | `/dashboard/workspace` | Same | Available | `manage_workspace` | Unfinished setup | Seven configuration sections |
| Observe | `observe` | 1 group | — | — | Descendant-driven | — | None | — |
| Revenue Intelligence | `revenue-intelligence` | 2 / Observe | `/dashboard/insights` | `/dashboard/revenue` | Available | `view_observations` | Source attention | Product controls |
| Understand | `understand` | 1 group | — | `/dashboard/executive` when a real overview exists | Descendant-driven | — | None | — |
| Executive Intelligence | `executive-intelligence` | 2 / Understand | No current landing route | `/dashboard/executive` | Limited preview | `view_executive_intelligence` | Critical business attention | Dashboard-to-detail |
| Portfolio Intelligence | `portfolio-intelligence` | 3 / Executive Intelligence | `/dashboard/portfolio` | `/dashboard/executive/portfolio` | Available | `view_executive_intelligence` | None | Overview/workspace |
| Decide | `decide` | 1 group | — | — | Descendant-driven | — | None | — |
| Investment Intelligence | `investment-intelligence` | 2 / Decide | `/dashboard/investments` | Same | Available | `view_investment_workspace` | Stale/unfinished analysis | Investment product navigation |
| Execute | `execute` | 1 group | — | — | Descendant-driven | — | None | — |
| Action Center | `action-center` | 2 / Execute | `/dashboard/actions` | Same | Available | `view_actions` | Actions due | Queue and detail |
| Learn | `learn` | 1 group | — | — | Descendant-driven | — | None | — |
| Learning Intelligence | `learning-intelligence` | 2 / Learn | `/dashboard/learning` | Same | Available | `view_executive_intelligence` | Evidence attention | Overview/workspace |
| Properties | `properties` | 2 / Business | `/properties` | `/dashboard/properties` | Available | `view_properties` | None | Record navigation |
| Bookings | `bookings` | 2 / Business | `/bookings` | `/dashboard/bookings` | Available | `view_observations` | Arrival/operational attention | Calendar/list/detail |
| Guest Communications | `messages` | 2 / Business | `/messages` | `/dashboard/communications` | Available | `view_actions` | Urgent conversations | Six peer sections + records |
| Reports | `reports` | 2 / Business | `/reports` | `/dashboard/reports` | Available | `view_observations` | Delivery attention | Editions and generation steps |
| Guidebook Studio | `guidebook-studio` | 2 / Services | `/guidebooks` | `/dashboard/guidebooks` | Available | `view_properties` | Incomplete guidebook | Six peer sections |
| Administration | `administration` | 1 / Administration | `/admin` | `/admin` | Internal capability only | `view_internal_operations` | None | Separate Operations Console |

`/dashboard/workspace` is the canonical Workspace route. The earlier
`/dashboard/settings` route remains a compatibility surface while callers move
to the canonical section routes. Other future route families describe direction,
not active aliases.

## Internal Operations Console

| Label | Primary route | Visibility | Capability | Customer equivalent |
|---|---|---|---|---|
| Operations Console | `/admin` | Internal only | `view_internal_operations` | None |
| Customers | `/admin/owners` | Internal only | `view_internal_operations` | Workspace organization/team remains customer-owned |
| Properties | `/admin/properties` | Internal only | `view_internal_operations` | Customer Properties |
| Support | `/admin/inquiries` | Internal only | `view_internal_operations` | None |
| Integrations | `/admin/integrations` | Internal only | `view_integrations` | Workspace connected-system configuration |
| Guidebook Projects | Future `/admin/guidebooks` | Internal preview | `view_internal_operations` | Guidebook Studio |

Operations configuration uses the same typed `NavigationItem` contract but a separate canonical array and capability set. Items are never merged into customer navigation.

## Breadcrumb policy

- Primary products: breadcrumbs optional; shell title and active navigation normally suffice.
- Record depth: `Properties / River District Loft`.
- Workflow depth: `Reports / Executive Report / June 2026`.
- Nested product depth: `Guidebook Studio / River District Loft / Arrival`.
- Do not repeat Home → HPM lifecycle → group → product when the sidebar already communicates it.
