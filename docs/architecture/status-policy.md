# Status Policy

Status: Canonical  
Sprint: PI-UX-002A

## Standard capability states

Every production capability maps to one of:

- `Healthy`: current and usable.
- `Partial`: usable with named limitations.
- `Unavailable`: cannot be used; state the cause.
- `Preview`: illustrative and not connected to production behavior.
- `Degraded`: last-known data is usable but a named fault reduces trust.
- `Loading`: evaluation is in progress.
- `Error`: an attempted operation failed.

Generic `Pending`, `Needs Attention`, `Open Issues`, and `Unavailable` labels are not complete status messages.

## Required status content

Non-healthy states identify:

1. the failing or waiting capability;
2. the observed reason;
3. the effect on the operator;
4. a recommended action or the responsible administrator;
5. the last successful synchronization when relevant.

Examples:

- `Awaiting market data` rather than `Pending`.
- `Revenue data has not synchronized` rather than `$0`.
- `1 booking requires attention — missing checkout confirmation` rather than `Open Issues`.

## Derivation

Status is derived from canonical capability facts, never visual preference. A connected provider alone does not prove data health, and an incomplete optional setup item does not imply operational degradation.

Workspace Health is the authoritative composition of configuration, provider connection, synchronization, and data quality. Every degraded operational-quality result must produce a visible issue with reason and recovery guidance.

## Unavailable causes

Unavailable capability messaging distinguishes:

- required data missing;
- provider disconnected or authorization expired;
- feature not enabled;
- current user not authorized;
- analysis or synchronization failed.

