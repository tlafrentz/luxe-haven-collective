# Operational Data Quality

**ID:** OP-003  
**Version:** 1.0  
**Owner:** Engineering OS  
**Status:** Implemented

Operational Data Quality is the shared fitness-for-use capability for synchronized hospitality records. It answers: **Can the platform and its users trust the operational data they are seeing?**

## Product contract

Every evaluation reports Freshness, Completeness, Consistency, Uniqueness, and Provenance independently. Overall status is Trusted, Usable with Gaps, Attention Needed, Degraded, Unusable, or Unknown. No universal numeric score is produced.

Each dimension supplies evidence, operational impact, and an action. Typed issues use stable codes while customer copy may evolve independently.

```text
Provider Observation → Canonical Record → Versioned Quality Policy
  → Quality Evaluation → Trusted Operational Projection
```

## Product behavior

Bookings displays bounded data health, record indicators, partial/stale states, and a detail section explaining source quality. Non-blocking gaps do not hide bookings. Last-known-good records remain visible after failure or disconnection with reduced trust.

Workspace, Properties, Guest Communications, Reports, Executive Intelligence, and Learning Intelligence consume summaries or quality-aware evidence rather than recomputing policy.

## Boundaries

OP-003 does not edit, merge, delete, or automatically correct canonical records. Reconciliation, destructive merges, repair tools, and provider support workflows remain outside this capability.
