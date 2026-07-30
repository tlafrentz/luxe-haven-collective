# ADR-001 — STR Intelligence Provider Strategy

## Status

**Proposed — blocked pending MI-002 evidence gates**

This ADR is not approved. It records the decision shape and current hypothesis so
the proof of concept can confirm or reject it without changing the decision
criteria after results are known.

## Context

Investment Intelligence requires attributable, decision-grade ADR, occupancy,
RevPAR, revenue, comparable, confidence, and historical evidence. RentCast is the
current property, sale-comparable, and long-term-rental baseline, but it is not an
authoritative source for STR ADR or occupancy.

The provider decision must preserve this boundary:

```text
Provider adapters
  → Canonical Observations
  → immutable Canonical Market Snapshot
  → Investment Intelligence
```

Provider DTOs, confidence labels, selection rules, and completed underwriting
conclusions do not cross into Investment Intelligence.

## Decision

No production provider has been selected.

The hypothesis to test is a bounded multi-provider strategy:

| Responsibility | Current candidate |
|---|---|
| Property resolution, physical facts, sale and LTR evidence | RentCast |
| Primary STR ADR, occupancy, RevPAR, revenue, history, and comparables | AirROI, subject to POC gates |
| Premium methodology and accuracy benchmark | AirDNA |
| Optional discovery and origin-specific listing metadata | RealtyAPI |
| Combined-provider alternative | Mashvisor |
| Independent decision benchmark only | BNBCalc |
| Actual-performance calibration | Internal Portfolio |

AirROI is not selected by this hypothesis. It becomes the primary STR provider
only if it passes the common-property accuracy, methodology, reliability, legal,
commercial, and authoritative-source gates defined by MI-002. AirDNA or Mashvisor
may replace it, and the result may be no production selection.

## Required evidence before approval

- identical urban, suburban, and vacation-market property POC runs;
- sanitized provider fixtures and canonical mapping-loss reports;
- repeat-call stability, latency, error, rate-limit, and schema tests;
- comparison with aligned Internal Portfolio actuals where authorized;
- normalized development, launch, growth, and enterprise costs;
- production usage, caching, attribution, retention, and derived-data rights;
- completed weighted scorecard and all non-negotiable gates;
- documented responsibility by observation, geography, and time horizon;
- security, vendor, source, and exit-risk review.

## Consequences

- Sprint 1 must not couple Investment Intelligence to a candidate provider.
- Provider adapters and selection remain inside Market Intelligence.
- Missing evidence remains an explicit gap; fallback never fabricates a value.
- Historical Observations and Market Snapshots retain their original provider,
  mapping version, effective period, and evidence lineage.
- BNBCalc conclusions may expose variance but never become canonical facts or
  platform decisions.
- Internal Portfolio actuals calibrate future confidence and do not rewrite
  immutable historical snapshots.

## Rejected alternatives

None are rejected until MI-002 completes. Options under evaluation are a single
qualified STR provider, RentCast plus a specialist STR provider, RealtyAPI alone,
a hybrid discovery/STR/internal strategy, and retention of the current baseline.

## Migration outline

1. Add the selected adapter behind Market Intelligence ports.
2. Map provider responses into versioned Canonical Observations.
3. Shadow-run against current underwriting without changing decisions.
4. Compare snapshots, disagreements, latency, reliability, and cost.
5. Enable by capability and geography behind a feature flag.
6. Retain bounded fallback and rollback to the last approved strategy.

## Approval record

| Role | Reviewer | Decision | Date |
|---|---|---|---|
| Market Intelligence | Pending | Pending | — |
| Investment Intelligence | Pending | Pending | — |
| Architecture | Pending | Pending | — |
| Product | Pending | Pending | — |
| Legal/commercial | Pending | Pending | — |

## References

- [MI-002 investigation](../investigations/MI-002-market-data-strategy-evaluation.md)
- [Market Intelligence boundary](../Architecture/market-intelligence-boundary.md)
- [Live Market Snapshot integration](../implementation/ma-001-live-market-snapshot-integration.md)
