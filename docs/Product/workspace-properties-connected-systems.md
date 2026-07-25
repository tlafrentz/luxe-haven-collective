# Workspace Properties & Connected Systems

Workspace Properties configures canonical assets: ownership, inclusion, provider linkage, inherited defaults, access summary, and operational readiness. It is deliberately separate from Operational Properties, which serves current stays and daily work.

Connected Systems reports the health of external sources. A connection can be healthy while a listing is unlinked, and a disconnected source never removes canonical properties or last-known operational data.

## Product states

- No properties directs an administrator to the secure provider connection flow.
- Setup required identifies missing linkage or configuration.
- Attention needed identifies conflicts or partial results.
- Degraded and disconnected states retain last-known data with freshness warnings.
- Members without management permission receive a readable summary without mutation controls.
- Unexpected read or write failures use explicit error boundaries.

Inclusion is `included`, `excluded`, or `archived`. Exclusion removes an asset from operational summaries without deleting history; archive preserves lineage. Weak name or address similarity never confirms a provider link.

## Ownership

All reads begin with authenticated workspace membership. Canonical properties retain their existing IDs and belong to `owners.id`, the current workspace persistence boundary. Provider listings are references, never replacement property records.

