# Platform Actions (PF-009)

This capability is the canonical model for committed business work. The
`PlatformAction` aggregate owns workspace-scoped identity, optimistic version,
status, priority, ownership, assignment, schedule, provenance, Outcome
references, and append-only change history.

Feature code defines action types and policies. The platform model deliberately
does not know about properties, hospitality, dashboards, or Action Center.

Outcome contents, measurements, execution history, and Learning remain in their
own Platform capabilities. Completing an Action does not create or measure an
Outcome.

During migration, the package exposes a deprecated `Action` compatibility DTO
for existing Execution Engine and Action Center consumers. It retains the old
status, priority, and embedded-result shape only to avoid runtime changes in
PF-009 Batch 2. It is not a canonical aggregate. New code uses
`PlatformAction`, `PlatformActionCollection`, and the Provider contracts.

See `docs/platform/platform-action-provider-domain-audit.md` for the canonical
boundary and migration decisions.

## Persistence

The Batch 3 Supabase adapter persists aggregate state and append-oriented child
records through transactional PostgreSQL functions. Reads are always scoped by
workspace. Replacements compare the persisted version, require exactly one
version increment, append history, and reject stale writers explicitly.

The repository is an infrastructure adapter only. It does not perform lifecycle
transitions or wire current feature consumers to the canonical Provider.
