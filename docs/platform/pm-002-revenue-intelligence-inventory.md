# PM-002 — Revenue Intelligence Migration Audit

## Baseline

Before PM-002, Revenue Intelligence had 40 production files, 6 Platform Observation imports across 6 files, 15% direct adoption, and 20% effective adoption. It directly imported Analytics from detector, domain, calculation, service, adapter, and UI files.

After PM-002 responsibility separation, it has 47 production files, 22 Platform imports across 9 files, 19% direct adoption, and 74% effective adoption. The increased file count makes compatibility, normalized input, canonical reasoning, and lifecycle adapter responsibilities explicit.

## Detector inventory

| Detector | Opportunity policy | Revenue-owned methodology |
| --- | --- | --- |
| `weekend-pricing` | Underpriced/high-demand weekend | Weekend occupancy, available-night minimums, weekday comparison, pricing uplift |
| `low-weekday-occupancy` | Low weekday/upcoming occupancy | Weekday segmentation, occupancy gaps, discount thresholds |
| `gap-nights` | Short orphan gaps | Stay adjacency, gap length, urgency, estimated recovery |
| `cancellations` | Elevated cancellation rate | Cancellation thresholds and historical comparison |
| `booking-source-concentration` | Source concentration | Booking volume, share, diversity, concentration thresholds |
| `payments` | Uncaptured/unpaid reservations | Active reservation and payment-state rules, revenue at risk |

The detector registry, sorter, deduplicator, summarizer, thresholds, calculations, and impact methodology remain feature-owned.

## Opportunity field lifecycle classification

| Existing field | Canonical owner | Compatibility disposition |
| --- | --- | --- |
| `id`, `detectorId`, `type`, `category` | Recommendation metadata and feature policy identity | Retained in read model |
| `propertyId`, `dateRange`, `detectedAt` | Observation subject/time and Decision context | Retained for projection |
| `title`, `summary` | Claim statement and Recommendation presentation | Retained for dashboard |
| `evidence[]` | Observation plus Evidence | Deprecated compatibility projection |
| `severity` | Evaluation inputs and Recommendation priority | Retained feature vocabulary |
| `confidence` | Evaluation and Platform Scoring | Deprecated compatibility projection |
| `status: open` | Recommendation exists | No canonical status value |
| `status: accepted/dismissed` | Decision outcome | Projected by `projectOpportunityStatus` |
| `status: resolved` | Outcome exists | Projected by `projectOpportunityStatus` |
| `action` | Recommendation proposal before approval; Platform Action after accepted Decision | Deprecated compatibility projection |
| `impact` estimated values | Recommendation rationale/metadata | Remains revenue estimation methodology |
| measured impact | Outcome metrics | Canonical Platform Outcome |

## Input boundary

`domain/revenue-input.ts` owns normalized booking, property, range, occupancy, breakdown, source, stay-length, and trend contracts. `adapters/analytics-input-adapter.ts` is the sole query/calculation gateway from Analytics into Revenue services. Analytics presentation conversion remains isolated in `adapters/to-dashboard-analytics.ts`, and Analytics UI components remain isolated in the Revenue dashboard projection.

No Revenue domain or detector imports Analytics DTOs directly.

## Canonical reasoning output

`toRevenueReasoningArtifacts` converts detector policy results into immutable Platform collections:

```text
Revenue detector policy
  → ObservationCollection
  → EvidenceCollection
  → ClaimCollection
  → EvaluationCollection + Platform Scoring
  → RecommendationCollection
```

Every Recommendation traces to its Evaluation, Claim, Evidence, and Observations. `RevenueIntelligence.reasoning` carries these canonical artifacts while `OpportunityReport` remains the existing compatibility/report projection.

## Decision, Action, and Outcome integration

`decideRevenueRecommendation` records accepted or dismissed Recommendations as Platform Decisions. Accepted Decisions create Platform Actions through `ActionBuilder`; dismissed Decisions create no work. `recordRevenueOutcome` records measured financial truth as a Platform Outcome with Action and Decision lineage.

The overloaded `OpportunityStatus` is no longer used for canonical state. `projectOpportunityStatus` recombines separated artifacts only for compatibility views.

## Consumers

Production consumers are the Insights page, HPM, Executive Intelligence, and the Execution Engine executive-priority mapper. These continue through the documented `RevenueOpportunity`, `RevenueIntelligence`, and report projections until their migrations. Action Center no longer imports Revenue Intelligence.

## Remaining compatibility and non-eligible files

`compatibility/revenue-opportunity.ts` contains the behavior-free dashboard/downstream DTO and deprecated evidence, confidence, status, and proposed-action vocabulary. Detector implementations, revenue calculations, registry, sorting, deduplication, summarization, UI components, and report projections are not required to import Platform directly. Eligible orchestration and lifecycle boundaries consume Platform packages; effective adoption is 74% across all files and higher across eligible files.
