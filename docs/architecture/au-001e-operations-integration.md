# AU-001E — Operations and Integration

AU-001E adds a read-oriented control plane over canonical AU-001A–C facts. It does not schedule, authorize, dispatch, or replay business commands. AU-001D renders server projections; operational policy remains under `src/platform/automations/operations`.

## Boundaries

- Authorization and property filtering occur before aggregation.
- Health uses versioned thresholds and treats unknown, stale, restricted, and incompatible sources explicitly.
- Reconciliation detection is deterministic and non-mutating. Unknown outcomes expose reconciliation, never blind retry.
- The integration registry describes HPM, Execute, Decide, EX-002, LR-001, LR-002, Furnishing, notifications, and identity contracts with safe degradation.
- AU publishes automation facts through HPM's existing Execute-stage source contract. It does not assign HPM rank, lifecycle health, or commands.
- Eight governed reports share canonical operational facts. CSV content has stable ordering and SHA-256 identity.
- No migration is introduced. Durable source facts, attempts, reconciliations, audit events, and notification intents remain in existing AU/Execute persistence.

## Flags and default-safe behavior

`AUTOMATION_OPERATIONS_ENABLED`, `AUTOMATION_HEALTH_ENABLED`, `AUTOMATION_REPORTING_ENABLED`, `AUTOMATION_EXPORTS_ENABLED`, and `AUTOMATION_OPERATOR_COMMANDS_ENABLED` are evaluated on the server and default false. `AUTOMATION_GLOBAL_KILL_SWITCH=true` disables new operator mutations while inspection remains available. Adapter versions and adapter enablement are separately configured.

## Deferrals to AU-001F

Production dashboards/alerts, production cohort configuration, migrated-environment RLS evidence, authenticated smoke testing, rollback rehearsal, stabilization observation, and enablement remain AU-001F work. AU-001E code and routes must not be treated as production enabled merely because they are deployable.
