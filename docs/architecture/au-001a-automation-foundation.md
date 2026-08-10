# AU-001A — Automation Foundation

## Release boundary

AU-001A is a local-only foundation. It adds canonical, declarative automation definitions, immutable definition versions, lifecycle and authorization policy, persistence contracts, tenant/property RLS, append-only activity, notification intents, safe telemetry ports, and an inert production composition factory.

It does **not** add routes, feature flags, navigation, a scheduler, trigger intake/evaluation, trigger occurrences, runs, steps, approvals, command dispatch, retries, reconciliation, workers, or workspace UI. The production composition is not invoked by any runtime entry point. The migration must not be applied until HPM-001F receives final release approval and AU-001 reaches its migrated-environment gate.

The existing PF-011 `AutomationRule` and `AutomationExecutor` API remains backward compatible. AU-001A extends that same platform package with the governed definition aggregate. It does not introduce another automation domain. PF-011 execution is legacy library behavior and is not wired to the AU-001 production composition.

## Responsibility boundaries

| Layer | Responsibility |
|---|---|
| Domain | Definition configuration, immutable version snapshot, lifecycle, validation, tenant/property management rules |
| Application | Authorization orchestration, stable results, optimistic concurrency, activity and notification-intent creation |
| Repository | RLS-scoped reads and one atomic persistence RPC |
| PostgreSQL RPC | Definition/version/activity/outbox all-or-nothing mutation and version lock |
| RLS | Final workspace and property boundary using authenticated-user context |
| Composition | Injected authenticated Supabase client, actor, clock, IDs, and telemetry; no service-role fallback |

## Security and integrity

- Ordinary commands use the caller's authenticated Supabase client; no service-role client is constructed.
- `save_automation_definition` is `security invoker`, rechecks workspace role and every selected property, locks the current aggregate version, and writes the version, activity, and optional outbox intent in one transaction.
- Definition versions and activity are append-only. Activated history cannot be hard-deleted through normal operations.
- Definitions hold command contract metadata only. They store no credentials, provider payloads, or executable code.
- The notification outbox is reused. No external delivery occurs in the persistence transaction.

## HPM adapter classification recorded before AU-001A

Production composition is explicit in `src/features/hpm-workspace/application/hpm-workspace-composition.ts`: Observations uses the Analytics/Revenue projection; the other six capabilities receive `createUnavailableHpmSourcePort(..., "not-configured")`.

| Adapter | Classification | Evidence and qualification |
|---|---|---|
| Intelligence | **Not implemented as an HPM production source adapter** | Intelligence-related domains exist, but no HPM `HpmSourcePort` adapter maps them into the lifecycle projection. This is not a credential or feature-flag issue. |
| Decisions | **Not implemented as an HPM production source adapter** | Canonical Decision code exists, but no production projection adapter is registered. This is not a credential or feature-flag issue. |
| Execute | **Not implemented as an HPM production source adapter** | Execute/Action persistence and application code exist, but no HPM production adapter is implemented or registered. This is not a credential or feature-flag issue. |
| Outcomes | **Not implemented as an HPM production source adapter** | EX-002 domain and persistence exist, but no HPM production adapter is implemented or registered. This is not a credential or feature-flag issue. |
| Learning | **Not implemented as an HPM production source adapter** | LR-001 domain and persistence exist, but no HPM production adapter is implemented or registered. This is not a credential or feature-flag issue. |
| Recommendations | **Not implemented as an HPM production source adapter** | LR-002 domain and persistence exist, but no HPM production adapter is implemented or registered. This is not a credential or feature-flag issue. |

All six are therefore accurately reported by production as `not-configured`, but the root condition is missing integration implementation/registration—not missing secrets, a disabled per-adapter flag, or incomplete authenticated testing. Once implemented, each adapter will still require authenticated production verification before its classification can become current.

## Rollout gate

Do not apply or activate AU-001A in production until HPM-001F completes:

1. All required lifecycle adapter verification.
2. PostgreSQL cross-tenant and cross-property RLS verification.
3. Telemetry dashboards, alert thresholds, and kill-switch validation.
4. The defined stabilization observation window.
5. Recorded final release approval.

AU-001B and later slices must preserve this foundation and add behavior through explicit ports rather than placing scheduling or command logic in React, SQL projections, or this composition root.
