# Platform Migration Audit

Status: Phase A inventory  
Scope: every top-level feature under `src/features/`  
Platform baseline: `src/platform/{kernel,observations,evidence,claims,evaluations,recommendations,decisions,actions,workflows,automations,outcomes,intelligence,learning,scoring,execution}`

## Executive summary

The repository currently has 11 top-level features:

| Feature | Files | Platform adoption observed | Migration posture |
|---|---:|---|---|
| `action-center` | 16 | Indirectly through execution-engine compatibility exports | Keep as UI/read model; replace legacy boundary over time |
| `analytics` | 25 | None | Keep queries and dashboard projections; migrate facts and insights at boundaries |
| `execution-engine` | 23 | Actions | Compatibility layer already in progress; retire duplicated lifecycle services later |
| `executive-intelligence` | 42 | None | Convert reasoning artifacts to platform policies/artifacts; keep executive projections |
| `hpm` | 8 | None | Keep HPM taxonomy/methodology; adopt platform scoring, Outcomes, and Intelligence |
| `integrations` | 26 | None | Keep provider adapters; express sync execution through Workflow/Automation/Outcome |
| `intelligence` | 9 | None | Generic duplicate of Platform Intelligence; migrate consumers and retire |
| `investment-intelligence` | 197 | Observations (partial) | Largest mixed bounded context; preserve investment math and migrate generic reasoning primitives |
| `market-intelligence` | 178 | Observations (partial) | Preserve market/provider domain; migrate generic observation/evidence/scoring/intelligence artifacts |
| `marketing` | 13 | None | Presentation/content only; no platform migration needed |
| `revenue-intelligence` | 58 | Observations (partial) | Preserve revenue calculations/detectors; emit canonical reasoning and intelligence artifacts |

The main architectural issue is not duplicated business calculations. It is duplicated platform vocabulary: scores, confidence, evidence, findings, recommendations, decisions, actions, opportunities, trends, intelligence reports, execution results, and provenance are represented independently in multiple features.

The intended end state is:

```text
feature observations/providers/calculations/policies
                     ↓
canonical Platform artifacts and sessions
                     ↓
feature-specific read models and UI adapters
```

Feature-specific policies should remain in their feature. The artifacts those policies consume and produce should use Platform contracts.

## Cross-feature duplication inventory

| Duplicated concept | Current feature representations | Canonical destination | Audit conclusion |
|---|---|---|---|
| Score | `InvestmentScore`, investment `Score`, `MarketScore`, HPM scores, raw analytics scores | `platform/scoring` | Use feature scoring policies/components, but canonical score scales and confidence should come from Platform. HPM composite/pillar structures remain feature-specific projections. |
| Confidence | Investment and market `ConfidenceLevel`, market `ConfidenceScore`, `ValuationConfidence`, revenue string confidence, executive string confidence | `platform/scoring` | High-priority migration. Map legacy labels at feature boundaries. |
| Observation | `MarketObservation`, analytics booking/activity facts, revenue/market observation DTOs | `platform/observations` | Provider adapters should emit canonical Observations. Feature query DTOs may remain. |
| Provenance | Market `DataProvenance`, provider metadata, opportunity detector IDs | `platform/observations` / `platform/evidence` | Replace generic provenance containers with canonical source/reference contracts; retain provider-specific IDs as metadata. |
| Evidence | Investment `SupportingEvidence`, decision-report evidence, market analysis evidence, revenue opportunity evidence, Action Center evidence | `platform/evidence` | Canonical Evidence should own fact references. Feature evidence categories and UI formatting remain adapters. |
| Finding/claim | `MarketAnalysisFinding`, investment theses/risks, revenue opportunity assertions | `platform/claims` and `platform/evaluations` | Feature policies should construct canonical Claims and Evaluations instead of standalone generic findings. |
| Recommendation/opportunity | `RevenueOpportunity`, executive priority, investment acquisition recommendation, generic `IntelligenceRecommendation`, market opportunity | `platform/recommendations`; post-Outcome opportunities may use `platform/intelligence/Opportunity` | Classify by lifecycle position. Pre-decision proposals are Recommendations; analytical improvement potential is Intelligence Opportunity. |
| Decision | `InvestmentDecision`, purchase/rental decision reports, executive priority acceptance | `platform/decisions` | Keep feature decision inputs and presentation reports; canonical Decision owns the decision artifact and lineage. |
| Action | Revenue `OpportunityAction`, executive priority action, `ExecutiveAction` | `platform/actions` | `ExecutiveAction` is already a compatibility DTO. Proposed action descriptions remain recommendation payload until a canonical Action is created. |
| Trend | Analytics `MetricTrend`, investment `MarketTrend`, market `TrendDirection`/`MarketTrendIntelligence`, portfolio changes | `platform/intelligence/Trend` | Retain chart/read-model directions; analytical trend artifacts should be canonical. |
| Intelligence report | Generic, revenue, market, executive, investment nested market reports | `platform/intelligence/IntelligenceReport` | Keep feature report/view projections only. Canonical analytical truth should be an IntelligenceReport with explainability. |
| Execution/result | Integration sync status, legacy Action outcome/impact, detector runs | `platform/execution`, `platform/workflows`, `platform/automations`, `platform/outcomes` | Provider-specific result fields remain payload/metadata; execution truth should be canonical. |
| Learning/calibration | Ad hoc confidence utilities and thresholds | `platform/learning` | Future feature strategies should emit proposals rather than mutate thresholds directly. |

Two structural duplicates deserve immediate attention:

1. `src/features/intelligence` is a generic abstraction (`IntelligenceAnalysis`, `IntelligenceHealth`, `IntelligenceRecommendation`) that competes directly with `src/platform/intelligence` and `src/platform/recommendations`.
2. `src/features/investment-intelligence/market-intelligence` is an older nested market model alongside `src/features/market-intelligence`. Both contain `market-profile.ts` and `market-intelligence-report.ts`, with overlapping demand, supply, competition, regulation, seasonality, health, and opportunity concepts.

## Feature audits

### `action-center`

**Domain concepts it owns**

- Action Center record, item, summary, and view projections.
- Decision-context presentation (`ActionDecisionContext`) and formatted evidence rows.
- Queue grouping such as active, recently completed, and recently learned actions.
- Action Center components, badges, and page-level view construction.

**Concepts that now belong in Platform**

- Action identity, status, priority, type, owner, outcome, and lifecycle belong to `platform/actions`.
- Decision lineage belongs to `platform/decisions`.
- Evidence references belong to `platform/evidence`.
- Confidence belongs to `platform/scoring`.
- Learned execution facts should ultimately be sourced from `platform/outcomes` and `platform/learning`, not inferred from Action status alone.

**Concepts that remain feature-specific**

- `ActionCenterView`, `ActionCenterItem`, `ActionCenterSummary`, sorting/grouping for the screen, and display strings.
- Badge colors, labels, queue layout, “why now” copy, and expected-impact formatting.

**Duplicates and migration notes**

- `ActionDecisionContext` duplicates a flattened subset of Decision, Evidence, confidence, and rationale.
- `ActionCenterEvidence` is a UI string pair, not domain Evidence; retain it only as a view adapter output.
- The feature imports Actions through `features/execution-engine`. During the compatibility milestone this is valid, but the target is an explicit Action Center adapter consuming canonical Actions/Outcomes/Decisions.
- `recentlyLearned` currently means measured Actions. That is not equivalent to canonical Learning and should be renamed or backed by `platform/learning` when adopted.

### `analytics`

**Domain concepts it owns**

- Booking and property query projections.
- Date ranges and query parameters.
- Revenue, occupancy, booking-source, stay-length, and daily-activity metrics.
- Dashboard metrics, comparisons, chart data points, trend display values, and performance-insight copy.
- Supabase query and formatting utilities plus dashboard components.

**Concepts that now belong in Platform**

- Raw measured facts can be represented as `platform/observations`.
- Completed measured performance can be recorded as `platform/outcomes`.
- General trend and insight artifacts belong to `platform/intelligence`.
- General scores/confidence belong to `platform/scoring`.

**Concepts that remain feature-specific**

- Analytics query models tied to booking/property persistence.
- Dashboard aggregation windows, chart series, display formatting, comparison copy, and UI components.
- Hospitality metric definitions such as ADR, RevPAR, occupancy, stay length, and booking-source breakdown.

**Duplicates and migration notes**

- `MetricTrend` overlaps canonical Intelligence `Trend`, but should remain as a compact chart/read-model adapter rather than be used as analytical truth.
- `PerformanceInsight` overlaps canonical `Insight`; generate canonical Insights first, then map them to dashboard tone/copy.
- Revenue Intelligence depends heavily on Analytics DTOs, making Analytics an accidental shared domain package. Extract stable observation/query contracts or add adapters so Revenue Intelligence does not own Analytics presentation shapes.
- Booking status constants are persistence/query vocabulary, not Platform lifecycle status.

### `execution-engine`

**Domain concepts it owns**

- Legacy `ExecutiveAction` serialization/view DTO and its source vocabulary.
- Hospitality Action type constants retained for compatibility.
- Feature-specific acceptance of executive priorities.
- Legacy lifecycle functions for start, complete, measure, and archive.

**Concepts that now belong in Platform**

- Action, status, priority, owner, type, outcome, builder, policies, executor, session, collection, and lifecycle behavior belong to `platform/actions`.
- Generic execution sessions and diagnostics belong to `platform/execution`.
- Measured results belong to `platform/outcomes`.

**Concepts that remain feature-specific**

- Mapping Revenue/Executive Intelligence priority types into Action types.
- Legacy ISO-string/property-aware DTO adaptation required by Action Center.
- Hospitality action category constants while consumers still need them.

**Duplicates and migration notes**

- PF-009 already converted status, priority, owner, outcome, and type exports into Platform re-exports and routes lifecycle transitions through canonical Action methods.
- `ExecutiveAction` is documented as a compatibility DTO, not a second entity. It should not gain new domain behavior.
- `ActionMeasuredImpact` duplicates canonical Outcome metrics and should become a feature adapter type or disappear when Action Center consumes Outcomes.
- The lifecycle functions duplicate canonical methods by design for compatibility. Remove them only after all callers migrate.

### `executive-intelligence`

**Domain concepts it owns**

- Executive brief, portfolio health, portfolio snapshot, portfolio changes, revenue-risk summary, executive priorities, and the executive command-center report.
- Portfolio/HPM roll-up builders and executive UI components.

**Concepts that now belong in Platform**

- Executive analytical conclusions should be canonical Insights.
- Portfolio trends should be canonical Trends before projection.
- Revenue risks can be Claims/Evaluations and then Insights/Anomalies depending on lifecycle position.
- Executive priorities are currently a combined Recommendation, Decision state, expected impact, and proposed Action; these responsibilities belong to `platform/recommendations`, `platform/decisions`, and `platform/actions`.
- Confidence belongs to `platform/scoring`; evidence/rationale belongs to Platform lineage.

**Concepts that remain feature-specific**

- Executive report composition, command-center read models, brief tone, portfolio snapshot selection, HPM pillar presentation, and executive copy.
- Business-specific prioritization policies and roll-up logic.
- Revenue-risk and portfolio-health presentation projections after they are backed by canonical artifacts.

**Duplicates and migration notes**

- `ExecutivePriorityStatus` creates a parallel lifecycle (`open`, `accepted`, `dismissed`, `completed`) spanning Recommendation, Decision, and Action. Split rather than map it into one Platform status.
- `ExecutivePriorityImpact` duplicates recommendation impact, Intelligence Opportunity impact, and Outcome metrics.
- `PortfolioChange` overlaps Observations and Trends; classify events as Observations and derive display changes.
- This feature imports Analytics, HPM, and Revenue Intelligence domain types directly. Prefer application adapters consuming their canonical Platform outputs to reduce feature-to-feature coupling.

### `hpm`

**Domain concepts it owns**

- HPM pillars and their hospitality-specific labels/questions.
- HPM performance scope and data coverage.
- Pillar and composite score projections, health labels, contributors, and score change display.

**Concepts that now belong in Platform**

- Score scales, weights, breakdowns, confidence, and confidence assessment belong to `platform/scoring`.
- Contributors can be backed by Claims, Evaluations, Insights, Opportunities, and Anomalies.
- Historical measured performance belongs to Outcomes; interpreted performance reports belong to Intelligence.

**Concepts that remain feature-specific**

- The HPM pillar taxonomy, pillar questions, hospitality health thresholds, coverage rules, composite methodology, and report/read-model structure.
- Feature policies that translate operational Outcomes into HPM scores.

**Duplicates and migration notes**

- `HpmScoreChange` overlaps Analytics `MetricTrend` and Intelligence `Trend`.
- `HpmScoreContributor` is a generic union of strength/risk/opportunity/limitation without canonical lineage. It should become a projection of explainable Platform artifacts.
- Raw numeric confidence and score fields bypass Platform validation and should be adapted to canonical scoring objects internally.

### `integrations`

**Domain concepts it owns**

- Integration provider identity, connection/health status, sync summary/history, and dashboard projections.
- Hospitable API client, provider payloads, reservation/property mappers, authorization, batching, and synchronization services.

**Concepts that now belong in Platform**

- Sync jobs and multi-step import processes can be Workflow definitions/runs.
- Scheduled or event-driven synchronization can be Automation rules/executions.
- Execution status, statistics, and diagnostics belong to `platform/execution`.
- Completed sync facts and records-processed metrics belong to `platform/outcomes`.
- Provider data entering reasoning should be normalized into Observations with provenance.

**Concepts that remain feature-specific**

- Hospitable authentication/API types, client behavior, pagination/batching details, reservation/property mapping, provider error translation, and integration dashboard projections.
- Provider-specific health rules and synchronization policies.

**Duplicates and migration notes**

- `IntegrationSyncRunStatus`, `IntegrationSyncHistoryItem`, and `SyncSummary` duplicate parts of ExecutionSession, AutomationExecution, Workflow history, and Outcome metrics.
- Do not move provider DTOs into Platform. Wrap sync orchestration in Platform artifacts and retain provider payloads behind integration adapters.

### `intelligence`

**Domain concepts it owns**

- Generic `IntelligenceAnalysis`, `IntelligenceHealth`, and `IntelligenceRecommendation` interfaces.
- Generic analyzer, health builder, and recommendation builder contracts used by Investment Intelligence market analysis.

**Concepts that now belong in Platform**

- Analysis scores/confidence belong to `platform/scoring`.
- Strengths/risks/opportunities and conclusions belong to `platform/intelligence` artifacts.
- Recommendations and proposed actions belong to `platform/recommendations` and later Decisions/Actions.
- Health summaries should be feature-specific Insights/reports backed by canonical artifacts, not a generic parallel abstraction.

**Concepts that remain feature-specific**

- None of the current three domain interfaces is sufficiently feature-specific to justify this top-level feature.
- Concrete analyzers for market, investment, revenue, or operations should live with those features as Platform policy implementations.

**Duplicates and migration notes**

- This feature is a direct pre-PF-013 duplicate and should be retired after its seven Investment Intelligence consumers migrate.
- `IntelligenceRecommendation` conflates a Recommendation with string actions, risks, and opportunities and has no lineage.
- `IntelligenceAnalysis.confidence` and `.score` bypass Platform scoring validation.
- The public entry point is `feature-index.ts`, not the conventional `index.ts`, which further indicates an incomplete shared abstraction.

### `investment-intelligence`

**Domain concepts it owns**

- Property and acquisition profiles, purchase/rental-arbitrage assumptions, acquisition type/strategy, scenarios and stress tests.
- Revenue/expense/debt-service projections, purchase and rental financial performance, failure points, risks, market snapshots, comparables, and investment analyses.
- Purchase/rental decision reports and investment recommendations.
- Investment calculators, risk/scoring/decision policies, providers, mappers, reports, and workspace UI.
- A nested legacy market-intelligence implementation covering profile, demand, supply, competition, regulation, seasonality, opportunity, health, and report.

**Concepts that now belong in Platform**

- Generic `Score`, `Rating`, confidence levels, and confidence calculations belong to `platform/scoring`.
- Generic supporting evidence and evidence direction/type belong to `platform/evidence` where the category is not investment-specific.
- Investment theses/assertions should be Claims; risk/viability checks should be Evaluations.
- Acquisition recommendations should be canonical Recommendations produced by investment-owned policies.
- `InvestmentDecision` and report decision state should be backed by canonical Decisions.
- Decision-report opportunities and interpreted risk patterns can be canonical Intelligence Opportunities/Insights/Anomalies.
- Historical realized investment performance should be Outcomes, not embedded only in analysis reports.

**Concepts that remain feature-specific**

- Money calculations and hospitality investment financial semantics: ADR, NOI, cap rate, debt service, cash-on-cash return, expense categories, purchase and rental-arbitrage strategies.
- Property profiles, acquisition assumptions, failure thresholds, stress events, comparable selection, scenario construction, and investment report/UI projections.
- Investment-specific policy implementations, scoring factors, recommendation criteria, and decision rules.
- `Money`, `Percentage`, and `Location` are generic value objects and are candidates for a future shared domain/value package, but they are not covered by the current Platform features. Do not move them opportunistically without a dedicated canonicalization decision.

**Duplicates and migration notes**

- `InvestmentDecision`, `DecisionReport`, and `PurchaseDecisionReport` form three overlapping decision/report representations in the same feature.
- Evidence is represented by `SupportingEvidence`, `DecisionReportEvidence`, `PurchaseDecisionEvidence`, and platform evidence mappers.
- Confidence is represented by an enum, percentages, decision confidence analyses, confidence factors, and Platform confidence mappings.
- Both generic `InvestmentAnalysis` and specialized purchase/rental analyses coexist with multiple report DTOs; clarify aggregate versus presentation boundaries.
- The nested `investment-intelligence/market-intelligence` competes with standalone `market-intelligence`; freeze it and migrate consumers to one canonical Market Intelligence feature.
- Market Intelligence imports investment `Money` and `Percentage`, reversing the expected dependency direction. Extract/adapt shared values before decoupling.
- Partial Observation/Evidence/Recommendation/Decision adoption already exists in application providers, mappers, and policies. Continue at application boundaries rather than rewriting financial domain entities.

### `market-intelligence`

**Domain concepts it owns**

- Property records, comparable subjects/properties/weights/adjustments, similarity, comparable analysis, valuation, and market value ranges.
- Demand, supply, neighborhood, property, comparable, and trend intelligence.
- Market profiles, market confidence, aggregate/report/summary models, findings, evidence, and readiness.
- Provider interfaces/registries/results plus RentCast infrastructure.
- Placeholder bounded-context namespaces for property, STR, demand, competition, location, hospitality, and shared concerns.

**Concepts that now belong in Platform**

- `MarketObservation` and observation-provider results should use `platform/observations`.
- Generic `DataProvenance` should map to canonical Observation/Evidence source information.
- `MarketAnalysisEvidence` belongs in `platform/evidence`.
- `MarketAnalysisFinding` should be a Claim/Evaluation or Intelligence artifact depending on whether it is pre- or post-execution analysis.
- Generic confidence score/level and market score mechanics belong to `platform/scoring`; market-specific rating thresholds can remain policy.
- `MarketTrendIntelligence`, report conclusions, opportunities, and anomalies should be canonical `platform/intelligence` artifacts.
- Reusable analytical methodology belongs in market-owned IntelligencePolicy implementations, not parallel report primitives.

**Concepts that remain feature-specific**

- Market/property/comparable models, RentCast adapters, provider selection, similarity algorithms, valuation calculations, adjustment rules, readiness requirements, and market-specific metric definitions.
- Market report and executive-summary read models used by investment/application consumers.
- Market rating vocabulary when it encodes market-specific interpretation rather than generic score levels.

**Duplicates and migration notes**

- Local `ConfidenceScore` and `ConfidenceLevel` duplicate Platform scoring.
- `TrendDirection` overlaps Analytics trends and Platform Intelligence trends.
- `MarketIntelligenceReport` and `MarketProfile` also exist in nested Investment Intelligence market code.
- The feature imports Investment Intelligence `Money` and `Percentage`; this is a cross-bounded-context value-object dependency.
- `MarketAnalysisReport`, `MarketIntelligenceReport`, `MarketIntelligenceAggregate`, and `ExecutiveMarketSummary` overlap as report/aggregate projections. Keep distinct views only if their consumers and invariants are documented; otherwise consolidate.
- Observation migration is partially implemented through `MarketObservationProvider` and mappers. Older `MarketObservation` should become a compatibility/domain adapter rather than a second canonical observation.

### `marketing`

**Domain concepts it owns**

- HPM marketing page content and presentational sections.
- No operational domain model or application services.

**Concepts that now belong in Platform**

- None.

**Concepts that remain feature-specific**

- Marketing copy, content configuration, visual components, and page composition.

**Duplicates and migration notes**

- The `marketing/hpm` name overlaps the operational `features/hpm` label but not its domain responsibility. The distinction is structural and should be documented; no model migration is required.
- Platform imports would be inappropriate here unless a future UI intentionally renders Platform artifacts.

### `revenue-intelligence`

**Domain concepts it owns**

- Revenue, occupancy, booking, and booking-behavior performance projections.
- Revenue opportunity taxonomy, detectors, registry, deduplication, sorting, summaries, actions, impact, and reports.
- Revenue observation provider/mappers.
- Revenue Intelligence service orchestration and dashboard UI.

**Concepts that now belong in Platform**

- Provider facts belong to `platform/observations`; partial adoption already exists.
- Opportunity evidence belongs to `platform/evidence`.
- Opportunity assertions and severity/confidence assessment should use Claims/Evaluations and Platform scoring.
- Pre-decision `RevenueOpportunity` is primarily a canonical Recommendation with feature-owned category/type/impact metadata.
- Accepted recommendations should flow through Decisions and Actions instead of carrying their own accepted/resolved lifecycle indefinitely.
- Post-execution revenue opportunities, anomalies, and trends should be Platform Intelligence artifacts backed by Outcomes.

**Concepts that remain feature-specific**

- ADR/RevPAR/occupancy/booking performance calculations.
- Revenue opportunity types, detector algorithms, detector registry, deduplication keys, severity mapping, impact estimation, and revenue-specific policy implementations.
- Dashboard/report projections and adapters to Analytics.

**Duplicates and migration notes**

- `OpportunityEvidence` duplicates Platform Evidence and uses untyped string keys.
- `OpportunityConfidence` duplicates Platform confidence; `OpportunitySeverity` overlaps priority/risk levels.
- `OpportunityStatus` spans recommendation review and execution state.
- `OpportunityAction` is a proposed action description, not a canonical Action; it should become Action input only after a Decision.
- `RevenueIntelligenceReport` and `RevenueIntelligence` overlap Platform Intelligence report semantics but remain useful feature read models if backed by canonical artifacts.
- Revenue Intelligence imports Analytics domain/presentation DTOs in services, detectors, domain types, tests, and UI. Introduce a revenue input adapter to prevent Analytics from functioning as shared domain infrastructure.

## Dependency findings

Current feature-to-feature coupling forms two notable clusters:

```text
analytics ← revenue-intelligence ← hpm ← executive-intelligence
                     ↑                 ↓
                action-center ← execution-engine

intelligence ← investment-intelligence ↔ market-intelligence
```

The first cluster is a presentation/reporting pipeline with domain types crossing feature boundaries. It should be inverted around Platform artifacts and explicit read-model adapters.

The second cluster contains shared abstractions and value objects with unclear ownership. Retiring generic `features/intelligence`, choosing one Market Intelligence implementation, and resolving `Money`/`Percentage` ownership will remove the most important cycles.

Platform adoption is currently uneven:

- Execution Engine has adopted canonical Actions through re-exports and adapters.
- Investment, Market, and Revenue Intelligence have partial canonical Observation adoption.
- Most other features still exchange legacy feature DTOs directly.
- None of the audited features yet consumes the new Workflow, Automation, Outcome, Intelligence, or Learning platform capabilities as its authoritative boundary.

## Recommended migration order

This audit does not authorize feature rewrites. A safe migration sequence is:

1. **Freeze competing generic models.** Do not add behavior to `features/intelligence`, nested Investment Market Intelligence, legacy ExecutiveAction, or new feature-specific score/confidence/evidence primitives.
2. **Finish source normalization.** Make Revenue, Market, Investment, and Integrations providers emit canonical Observations and Evidence while retaining existing feature adapters.
3. **Canonicalize reasoning outputs.** Convert revenue opportunities, investment recommendations/decisions, market findings, and executive priorities into feature-owned policies producing Platform Claims, Evaluations, Recommendations, and Decisions.
4. **Adopt execution truth.** Back integration sync and accepted priorities with Actions, Workflows, Automation, and Outcomes.
5. **Adopt analytical truth.** Implement feature-owned IntelligencePolicies for Revenue, Market, Investment, HPM, and Executive Intelligence; keep current reports as view adapters.
6. **Close the feedback loop.** Add feature-owned LearningPolicies only after Outcomes and Intelligence carry sufficient history.
7. **Retire compatibility models.** Remove legacy types only after imports show no consumers and compatibility tests can be deleted intentionally.

## Decisions required before implementation

The following ownership questions should be resolved explicitly before Phase B:

- Should `Money`, `Percentage`, and `Location` become Platform/shared value objects, or live in a separate finance/property domain package?
- Which Market Intelligence implementation is canonical: standalone `features/market-intelligence` or the nested Investment version? The standalone feature is the stronger candidate because it owns providers and infrastructure.
- Are Analytics booking/property DTOs an application query contract or a shared hospitality data domain? They should not remain accidental shared infrastructure.
- Should Executive Priority persist as a read model only, or be replaced entirely by Recommendation → Decision → Action projections?
- Which legacy reports are authoritative domain aggregates versus UI projections? This is particularly important for Investment and Market Intelligence, where multiple report shapes coexist.

## Audit completion criteria

This Phase A audit inventories all top-level features, classifies current concepts by ownership, identifies duplicates, documents cross-feature coupling, and proposes migration sequencing. It intentionally makes no feature migration or runtime behavior changes.
