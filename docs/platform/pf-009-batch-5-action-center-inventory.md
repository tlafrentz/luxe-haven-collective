# PF-009 Batch 5 — Action Center inventory

## Before adoption

| Surface | Previous classification | Batch disposition |
| --- | --- | --- |
| `execution-engine/domain` Action DTO, status, priority, owner, type and transition wrappers | Canonical domain — replace | Removed in 5C |
| `execution-engine/application` start, complete, archive and measure services | Obsolete feature domain | Removed in 5C; measurement remains an Outcome concern |
| `execution-engine/compatibility` legacy mappers | Compatibility adapter — temporary | Removed in 5C; no named consumer remained |
| `action-center/domain/ActionCenterRecord` and `PlatformActionCenterRecord` | Compatibility adapter | Removed; it wrapped the legacy `platform/actions` compatibility export |
| `ActionCenterItem`, summary, execution workspace | Application read model | Replaced by `ActionCenterAction`, `ActionCenterQueue`, and a detail projection |
| badges, cards, queue, summary, detail controls | Presentation types/components | Retained and revised for canonical status/priority/owner/assignee/version |
| `buildActionCenterView` grouping/sorting | Queue-building logic | Replaced by the provider-backed projection mapper; presentation sorting remains local |
| `ACTION_CENTER_RECORDS` | Fixture/runtime data loader | Removed; production has no fixture fallback |
| dashboard Action routes | Server-side data boundary | Revised to resolve session/workspace and compose a provider-backed reader |

The old queue filtered archived records, grouped accepted/scheduled/in-progress/blocked as active, and separately grouped completed/measured records. It sorted active records by lifecycle timestamps. Status badges used proposed, accepted, scheduled, in-progress, blocked, completed, measured, and archived; priority badges used critical, high, medium, and low. Owner and assignee were not distinct. Both production routes loaded static fixtures. The detail workflow button was disabled, so no live mutation repository existed.

There were no Action Center filters in the route or UI. No Action Center runtime Supabase loader or feature repository existed. Executive/Revenue dependencies entered indirectly through fixture metadata and the legacy compatibility `Action`; the Action Center had no direct imports from either feature.

## Adopted boundary

`Action Center route → ProviderActionCenterReader → PlatformActionProvider → PlatformActionRepository → Supabase`

The reader translates supported workspace-scoped status, owner, assignee, source, and due filters to provider queries. Priority is filtered after retrieval because the provider query contract does not support it. Grouping, priority sorting, overdue calculation, labels, and available-command policy remain Action Center presentation/application concerns. All eight canonical states and all five priorities are represented without remapping.

The mutation boundary resolves the authenticated user and workspace membership on the server, constructs the actor there, passes the rendered expected version to exactly one provider command, maps typed errors, and revalidates only the list and affected detail paths after success. No production fixture fallback or database auto-seeding remains.

Legacy database tables are not dropped by this batch. Production record-count comparison, rollback planning, and any historical migration must precede a separate cleanup migration.
