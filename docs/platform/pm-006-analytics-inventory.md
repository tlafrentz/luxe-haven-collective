# PM-006 Analytics Inventory

Status: factual boundaries implemented; interpreted insight copy retained as compatibility  
Scope: `src/features/analytics`  
Recorded: 2026-07-19

## Boundary decision

Analytics is a historical measurement and reporting bounded context. It owns normalized facts, deterministic calculations, periods, comparisons, series, queries, and projections. It does not own reasoning or lifecycle artifacts.

```text
Supabase rows → source query adapters → Analytics facts → calculations/projections
                                                     ├→ Platform Observations → reasoning engines
Platform Outcomes → read-only outcome adapter ──────┘→ historical reporting
```

Analytics facts remain optimized for calculation. Platform Observations are created only at the interoperability boundary.

## Export classification

| Export or area | Classification | Ownership and disposition |
| --- | --- | --- |
| `getAnalyticsProperties` | Source query | Analytics; Supabase is contained in `lib/queries.ts` |
| `getAnalyticsBookings` | Source query | Analytics; returns normalized `AnalyticsBooking` facts |
| `getRecentAnalyticsBookings` | Source query | Analytics |
| `getBookingActivity` | Source query + Analytics projection | Analytics factual activity only |
| `AnalyticsBooking` | Normalized fact | Analytics; database column names do not escape query mapper |
| `AnalyticsProperty` | Normalized fact | Analytics |
| `AnalyticsDateRange`, `AnalyticsQueryParams` | Normalized fact/query contract | Analytics |
| `BookingActivity` | Analytics projection | Factual created/arrival/departure records |
| `calculateDashboardMetrics` | Metric calculation | Analytics |
| `differenceInNights`, `getOverlappingNights` | Metric calculation | Analytics |
| `calculateTrend` | Period comparison | Analytics; mathematical direction only |
| `buildDailyRevenueSeries` | Time-series aggregation | Analytics |
| `buildDailyOccupancySeries` | Time-series aggregation | Analytics |
| date-range helpers | Time-window calculation | Analytics |
| `DashboardMetrics`, `DashboardComparison`, `DashboardAnalytics` | Analytics projection | Analytics read models, never lifecycle truth |
| revenue/occupancy data points | Time-series facts | Analytics |
| booking-source and stay-length metrics | Aggregated facts | Analytics |
| `buildPerformanceSummaries` | Analytics projection | Canonical descriptive copy only |
| `generatePerformanceInsights` | Misplaced reasoning / compatibility | Deprecated; contains Revenue thresholds and advice |
| `PerformanceInsight`, `InsightTone` | Compatibility surface | Old dashboard presentation DTO |
| `buildAnalyticsMetricProjections` | Analytics projection | Stable factual boundary with calculation version |
| `toPlatformObservations` | Platform Observation adapter | Canonical reasoning handoff |
| `projectOutcomeHistory` | Platform Outcome adapter | Read-only historical reporting |
| `getAnalyticsDashboardProjection` | Analytics projection service | Single factual dashboard boundary |
| formatting helpers | Presentation helper | Analytics/UI |
| Analytics React components | UI consumer | Presentation only |

No Analytics Recommendation, Decision, Action, Outcome, or Intelligence entity exists. None is introduced by PM-006.

## Source and normalized facts

`lib/queries.ts` is the source boundary. `RawBookingRow` is private and maps snake-case Supabase columns and nullable/string numeric values into `AnalyticsBooking`. Downstream features receive Analytics-owned contracts rather than database rows.

Current durable sources:

- `properties`: active property identity and display name;
- `bookings`: reservation dates, guest count, rates, fees, total, lifecycle status, payment status, source, and creation time.

Payment information is currently embedded as booking `paymentStatus`; there is no separate Analytics payment query. Operations sources and persisted outcome indexes do not yet exist.

## Calculation ownership

Analytics retains:

- gross and room revenue plus fee/tax/service breakdown;
- occupied and available nights;
- occupancy, ADR, and RevPAR;
- average stay and booking lead time;
- cancellation rate and booking counts;
- booking-source concentration as a measured distribution;
- stay-length distribution;
- daily occupancy and revenue series;
- current/prior period variance.

These calculations state measured values. Revenue Intelligence owns whether a value is materially high, low, risky, or actionable.

## `generatePerformanceInsights` classification

The legacy function mixes two responsibilities:

| Output | Classification | Target |
| --- | --- | --- |
| “Revenue increased/decreased X%” | Descriptive fact | `buildPerformanceSummaries` |
| “ADR increased by $X” | Descriptive fact | `buildPerformanceSummaries` |
| “Occupancy is strong/healthy/has room to improve” | Threshold interpretation | Revenue Intelligence |
| “Consider reviewing rates” | Recommendation | Revenue Intelligence / Platform Recommendation |
| “Pricing or listing optimization may help” | Recommendation | Revenue Intelligence / Platform Recommendation |
| payment awaiting capture/unpaid needs attention | Operational interpretation | Revenue detector and canonical reasoning artifacts |

`generatePerformanceInsights` remains deprecated for compatibility. New production development must use factual summaries or canonical Revenue artifacts.

## Platform Observation boundary

`AnalyticsMetricProjection` contains metric identity, scope, period, value, unit, measured time, and calculation version. `toPlatformObservations` converts these facts into immutable Platform Observations with source, provenance, period metadata, traceable identity, and units.

Platform Observations are not Analytics storage or calculation inputs.

## Outcome history boundary

`projectOutcomeHistory` consumes an `OutcomeCollection` and returns behavior-free `AnalyticsOutcomeProjection` records. It preserves status, timing, duration, metrics, and Action/Decision lineage references. It never creates or transitions an Outcome.

This enables future realized-versus-projected reports and post-action metric trends without duplicating execution truth.

## Consumers

| Consumer | Current relationship | Target boundary |
| --- | --- | --- |
| Revenue Intelligence | Explicit `revenueAnalyticsGateway` imports queries/calculations | Analytics facts or Platform Observations through documented adapter |
| Executive compatibility | Date ranges, activity, projections, UI metric types | Deprecated compatibility pipeline; canonical Executive consumes Platform artifacts |
| HPM | Indirectly through Revenue/Executive | Future factual projections and Outcomes |
| Luxe Insights | Revenue Intelligence dashboard composed from Analytics facts | `getAnalyticsDashboardProjection` is the one factual Analytics service; Recommendations remain Revenue-owned |
| Portal Executive Dashboard | Date-range helper plus Executive projection adapter | Compatibility only |
| Analytics components | Analytics projections | Correct presentation dependency |

The Luxe Insights page is a Revenue Intelligence experience rather than an Analytics-owned reasoning UI. Its factual data must enter through the Analytics projection/gateway; its recommendations remain Revenue-owned.

## Persistence and caching

Current behavior:

- raw property and booking source records are persisted in Supabase;
- normalized Analytics facts are mapped at query time;
- all metrics, comparisons, and series are recalculated deterministically;
- no Analytics cache, materialized reporting view, warehouse, or persisted projection was identified;
- no Platform artifacts are persisted by Analytics;
- Outcome history is currently projected on demand.

Initial persistence rule: persist durable source records and measured facts; calculate deterministic projections on demand. Add caching or materialized views only after measured performance requires them.

## Compatibility register

- `generatePerformanceInsights`, `PerformanceInsight`, and `InsightTone`: deprecated mixed interpretation/UI surface.
- `DashboardAnalytics`: existing cross-feature report DTO; factual but broad. Prefer `AnalyticsDashboardProjection` for new consumers.
- direct Analytics type imports in Executive Intelligence: documented PM-005 compatibility projection.
- Revenue's `revenueAnalyticsGateway`: approved adapter boundary during migration; raw Supabase types do not cross it.

## Adoption interpretation

Most Analytics files should not import Platform. Calculations, queries, normalized facts, time series, and UI are intentionally ineligible. Platform adoption is required only in the Observation and Outcome adapters. Effective adoption should therefore be measured by boundary coverage, not raw file percentage.

## Completion evidence

PM-006 validation covers factual-summary separation, Observation provenance, Outcome-history preservation, architecture lint, adoption reporting, lint, typecheck, relevant and full Vitest suites, production build, and diff validation.
