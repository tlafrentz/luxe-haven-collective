# Market Intelligence Boundary

## Status

RMI-001 current-state audit and architecture decision, completed 2026-07-21. This document records existing behavior; target-state names are decisions for subsequent implementation batches, not claims that those services already exist.

## Decision Summary

Market Intelligence is a provider-neutral capability. It owns property resolution, comparable discovery and normalization, comparable analysis, valuation, market observations, confidence, and explicit data gaps. It must expose one future orchestration boundary, `runMarketAnalysis(command, context)`, returning one stable `MarketAnalysisResult`.

Provider APIs terminate in Infrastructure. Application services depend on provider ports and canonical Market models, never on RentCast response types. Infrastructure adapters implement those ports and map provider payloads before returning. Provider selection and environment construction belong to the application composition root, not to Investment Intelligence.

Investment Intelligence may consume Market output through exactly one sanctioned adapter, provisionally named `adaptMarketAnalysisToInvestmentInput`. That adapter belongs on the Investment side of the boundary so Market never imports Investment contracts. It maps canonical Market facts, estimates, confidence, data gaps, and lineage into Investment input candidates; Investment retains authority over underwriting assumptions, precedence, revenue projections, cash flow, financing, and recommendations.

The repository does not yet implement either target boundary. The live workspace currently has **zero** Market-to-Investment integrations and instead constructs placeholder market data directly. That is the highest-priority integration gap for RMI-002; it must not be mistaken for a second sanctioned path.

## Responsibilities

### Market owns

- property identity and address resolution;
- provider-neutral property facts and provenance;
- comparable discovery, normalization, similarity, weighting, exclusion, and valuation;
- market-level ADR, occupancy, rental/value estimates, supply, demand, neighborhood, and trend observations when supported by evidence;
- valuation and market confidence methodology;
- explicit missing, weak, substituted, or stale-data gaps;
- provider ports, provider result semantics, normalization versions, and provider lineage;
- Market read reports and canonical Platform reasoning projections.

### Investment owns

- acquisition route selection;
- underwriting assumption precedence and approved-Learning application;
- revenue and expense projections;
- financing, debt service, cash flow, returns, scenarios, and failure points;
- investment risk, evidence, score, confidence, and recommendation policy;
- operator commitment, execution, Outcomes, Learning, and reanalysis.

Market estimates are evidence for Investment assumptions. They are not Investment decisions and must not silently overwrite explicit operator input.

## RMI-001A Capability Inventory

Status meanings: **Complete** means implemented and characterized in isolation; **Partial** means useful behavior exists but its orchestration or contract is incomplete; **Disconnected** means no non-test production caller; **Duplicated** means another implementation owns materially equivalent behavior; **Experimental** means its current contract should not be treated as permanent; **Deprecated** is explicitly marked compatibility code; **Missing** means no implementation exists.

| Capability | Status | Production use | Findings |
| --- | --- | --- | --- |
| Property lookup | Complete / Disconnected | No | `lookupProperty` uses a provider registry and returns canonical `PropertyRecord`; only tests call it. |
| Comparable lookup | Complete / Disconnected | No | `lookupComparables` returns canonical Market `ComparableProperty[]`; only tests call it. |
| Property provider registry | Complete / Disconnected | No | Supports keyed provider registration; default lookup still names RentCast. |
| Comparable provider registry | Complete / Disconnected | No | Mirrors property registry; only tests/factories use it. |
| Provider factories | Partial | No | Work for RentCast, but Application imports concrete Infrastructure and environment variables, reversing the desired port/adapter dependency. |
| Provider results/errors | Complete | Internal/tests | Provider-neutral success/failure contract and stable provider errors exist. |
| Canonical provider Observations | Partial / Disconnected | No | Converts successful canonical records into Platform Observations; failures produce no explicit gap Observation and timestamps default to the clock. |
| RentCast property client/adapter | Complete | No production caller | HTTP client, response DTOs, mapper, and provider adapter exist. |
| RentCast comparable/AVM adapter | Complete | No production caller | AVM response is normalized to Market comparables; invalid individual records are silently dropped. |
| Future MLS/Zillow/Regrid providers | Missing | No | Ports can support them, but no adapters exist. |
| Future STR performance provider | Missing | No | No canonical provider for ADR, occupancy, or STR revenue evidence exists. |
| Comparable similarity | Complete / Disconnected | No | Characterized policy with configuration and validation. |
| Comparable weighting | Complete / Disconnected | No | Similarity-derived normalized weights exist. |
| Comparable outlier detection | Complete / Disconnected | No | Used by valuation, but valuation itself is not in a production orchestration path. |
| Comparable analysis | Complete / Disconnected | No | Coherent `ComparableSubject → WeightedComparable[] → ComparableAnalysis` graph. |
| Market valuation | Complete / Disconnected | No | Weighted estimate, range, price-per-square-foot, exclusions, and valuation confidence are characterized. |
| Valuation confidence | Complete / Disconnected | No | Specific comparable-count/similarity/dispersion confidence model. |
| Market analysis report | Complete / Disconnected | No | `MarketAnalysisReport` assembles valuation summary, findings, evidence, and timestamp. |
| Canonical Market analysis finalizer | Partial / Disconnected | No | `buildCanonicalMarketAnalysis` creates report plus Platform artifacts, but accepts already-built analysis and valuation; it is not end-to-end orchestration. |
| Platform Observation provider | Complete / Disconnected | Indirect only | Used by `mapMarketPlatformArtifacts`, accepts `MarketAnalysisReport`. |
| Platform reasoning mapping | Experimental | No | Produces observations through recommendations, but also auto-creates Decision, completed Action, Outcome, and Intelligence in one mapper. |
| Rich Market aggregate | Partial / Disconnected | No | Property/comparable/neighborhood/supply/demand/trend/confidence/summary models and aggregate are well tested but not fed by providers or the valuation report path. |
| Aggregate-to-Intelligence mapping | Partial / Disconnected | No | Requires an externally supplied Outcome and is separate from `MarketAnalysisReport` mapping. |
| Legacy observation report | Deprecated / Disconnected | No | `buildMarketIntelligence` returns deprecated `MarketIntelligenceReport`. |
| Legacy `MarketObservation` / `MarketProfile` | Deprecated | No | Compatibility/provider read models; Platform Observations are canonical reasoning artifacts. |
| Market findings/evidence read models | Deprecated projection | Indirect | Explicitly marked projections; Claims/Evaluations/Evidence are canonical Platform artifacts. |
| `PropertyComparable` | Deprecated alias | Tests/internal | Alias for canonical Market `ComparableProperty`. |
| Demand/competition/location/property/STR/shared packages | Missing placeholders | No | Barrels contain only `export {}`. Hospitality lacks an infrastructure placeholder as well. |
| Investment-local market package | Duplicated / Disconnected | No | A separate `features/investment-intelligence/market-intelligence` graph and score policy exists with no production caller. |
| Workspace Market wiring | Missing | No | Workspace supplies fixed medians/confidence and synthetic comparables instead of calling Market. |
| Presentation package | Missing | No | No Market presentation/workspace exists. |
| Persistence/cache | Missing | No | No provider response, canonical record, report, or lineage persistence path. |

The isolated Market suite is healthy: 45 test files and 124 tests passed during this audit. Test maturity is substantially ahead of runtime integration maturity.

## RMI-001B Public API Inventory

No production file outside the capability imports `@/features/market-intelligence`, and no non-test caller invokes the principal services. “Caller” below therefore describes current internal composition; all public boundaries are runtime-disconnected.

| Public boundary | Input / return | Current dependencies | Current caller | Canonical decision |
| --- | --- | --- | --- | --- |
| `lookupProperty` / `LookupProperty` | address/provider → `ProviderResult<PropertyRecord>` | `PropertyProviderRegistry` | Tests only | Retain as property-resolution application service behind future orchestration. Remove provider defaulting from domain decisions. |
| `lookupComparables` / `LookupComparables` | address/subject hints/provider → `ProviderResult<ComparableProperty[]>` | `ComparableProviderRegistry` | Tests only | Retain as comparable-discovery service behind future orchestration. |
| `buildWeightedComparables` | subject + canonical comparables → weighted comparables | similarity + normalization policies | Tests only | Canonical internal policy. |
| `calculateComparableSimilarity` | subject/comparable/config → similarity | config | Weighted builder/tests | Canonical internal policy, not primary capability entry point. |
| `normalizeComparableWeights` | scores/threshold → weights | none | Weighted builder/tests | Canonical internal policy. |
| `detectComparableOutliers` | weighted comparables → included/excluded | deviation policy | valuation/tests | Canonical internal policy. |
| `calculateValuationConfidence` | comparables/value → confidence | none | valuation/tests | Canonical valuation policy. |
| `calculateMarketValuation` | comparable analysis → valuation | outliers + confidence | Tests only | Canonical internal valuation service. |
| `buildMarketAnalysisReport` | analysis + valuation + time → report | summary/findings/evidence | canonical finalizer/tests | Retain as projection assembler, not orchestration. |
| `buildCanonicalMarketAnalysis` | analysis + valuation → report + artifacts | report + Platform mapper | Tests only | Transitional finalizer. Future `runMarketAnalysis` becomes the authoritative boundary. |
| `buildMarketAnalysisSummary` | analysis + valuation → text | report policy | report/tests | Projection-only helper. |
| `buildMarketAnalysisFindings` | analysis + valuation → finding projections | thresholds | report/tests | Compatibility projection; canonical output is Claims/Evaluations/data gaps. |
| `buildMarketAnalysisEvidence` | analysis + valuation → evidence projections | report policy | report/tests | Compatibility projection; canonical output is Platform Evidence. |
| `MarketObservationProvider` | report → Platform observations | Market mappers | Platform mapper/tests | Canonical report-to-observation adapter, pending deterministic run context. |
| `mapMarketPlatformArtifacts` | report → full `MarketPlatformArtifacts` | all Platform artifact builders | canonical finalizer/tests | Split. Analysis may project reasoning artifacts, but must not auto-create Decision, Action, or Outcome. |
| `mapMarketAggregateIntelligence` | rich aggregate + Outcome → Intelligence report | Platform Intelligence | Tests only | Optional downstream projection; reconcile after one result model exists. |
| `buildMarketIntelligenceAggregate` | eight prebuilt dimensions → aggregate/readiness | score + readiness | Tests only | Rich but disconnected parallel orchestration. Fold valuable dimensions into future result; do not make a second public runner. |
| `buildMarketConfidence` | dimension scores/gaps → `MarketConfidence` | confidence helpers | Tests only | Candidate canonical aggregate-confidence policy; reconcile with valuation and Platform confidence. |
| `calculateOverallMarketScore` | aggregate dimensions → `MarketScore` | weight policy | aggregate/tests | Internal policy only. |
| `validateMarketIntelligenceReadiness` | dimensions → readiness | gap helpers | aggregate/tests | Candidate source for canonical data gaps/readiness. |
| `buildExecutiveMarketSummary` | section results → summary | none | Tests only | Read projection helper. |
| `buildMarketIntelligence` | profile/legacy observations/comparables → deprecated report | merge + score | No production caller | Compatibility facade only; do not extend. |
| `mergeProviderResults` | legacy observations → merged observations | provenance | legacy builder | Compatibility helper. |
| `scoreConfidence` | legacy observations → legacy confidence | provenance | legacy builder | Compatibility helper. |
| Property/comparable provider factories | environment/options → provider ports | concrete RentCast Infrastructure | Tests only | Move construction to a composition root; Application should accept ports. |
| Property/comparable registries | provider type → port | provider ports | lookups/factories/tests | Retain only if multi-provider runtime selection is required. |
| `observePropertyProviderResult` / `observeComparableProviderResult` | canonical provider result → observations | Platform observations | `executeObserved`/tests | Retain as boundary projection; add failure/data-gap semantics later. |
| Low-level Market mappers | report parts → observations | Platform observations | observation provider/tests | Internal adapter implementation, not public capability API. |

The root barrel also exports `RentCastClient`, `RentCastPropertyProvider`, `mapRentCastProperty`, RentCast options, and RentCast response DTOs. Those are not Market public application services and must be removed from the capability barrel in a compatibility-controlled batch. Infrastructure-specific imports may remain available from an explicit infrastructure entry point for composition roots.

Several well-tested rich builders—property, comparable, neighborhood, supply, demand, and trend intelligence—are not exported by the application barrel and have no runtime caller. They are classified as disconnected implementation candidates rather than hidden canonical entry points.

## RMI-001C Provider Boundary Audit

### Current providers

| Dependency | Infrastructure implementation | Provider payload | Canonical output | Leakage / gaps |
| --- | --- | --- | --- | --- |
| RentCast property API | `RentCastClient`, `RentCastPropertyProvider`, `mapRentCastProperty` | `RentCastPropertyResponse`, property/tax/assessment DTOs | `PropertyRecord`, `PropertySearchMatch`, `ProviderResult` | DTOs, client, mapper, and options leak from the capability root barrel. Mapper time defaults to `new Date()`. |
| RentCast AVM/comparables | same client, `RentCastComparableProvider`, `mapRentCastComparable` | `RentCastValueEstimateResponse`, `RentCastComparableRecord` | `ComparableProperty[]`, `ProviderResult` | DTO is infrastructure-local but client generic `requestValueEstimate<T>` exposes transport typing. Invalid comparables are discarded without explicit gaps. |
| Integrations provider registry | `features/integrations` metadata | provider registration only | capability metadata | Not wired to Market factories or lookup registries. |
| MLS | None | None | None | Missing. |
| Zillow | None | None | None | Missing. |
| Regrid | None | None | None | Missing. |
| STR performance provider | None | None | None | Missing; therefore real ADR, occupancy, and STR revenue evidence are unavailable. |

### Boundary findings

The concrete RentCast providers correctly return canonical Market records; raw response DTOs do not escape those provider methods at runtime. The public barrel nevertheless exposes those DTOs and concrete adapters, so compile-time provider leakage exists.

Application factories import concrete RentCast Infrastructure. This makes the application layer both define the port and construct its adapter. Target composition is:

```mermaid
flowchart LR
  External[External provider API] --> Infra[Infrastructure adapter + DTO mapper]
  Infra --> Port[Market provider port]
  Port --> Lookup[Market application lookup]
  Lookup --> Canonical[Canonical Market records]
  Root[Composition root] --> Infra
  Root --> Lookup
```

Rules for every future provider:

1. Provider DTOs, HTTP status/header details, URLs, authentication, and SDK types remain under Infrastructure.
2. A provider adapter maps to `PropertyRecord`, `ComparableProperty`, canonical observations, or an explicit provider-neutral failure/data-gap before returning.
3. Retrieval time, run identity, and ID factories are injected; defaults may exist only at an outer production factory.
4. Provider-specific confidence inputs are normalized and provenance retains provider, retrieval time, sample size, notes, and normalization version.
5. Invalid or omitted records produce observable gaps/diagnostics rather than disappearing silently.
6. Investment never imports a provider port, factory, adapter, DTO, or provider enum.

## RMI-001D Canonical Domain Audit

### Current object families

| Object | Assessment | Decision |
| --- | --- | --- |
| `PropertyRecord` | Canonical provider-neutral property resolution model | Retain as `MarketProperty` equivalent; consider renaming only in a compatibility batch. |
| Market `ComparableProperty` | Canonical provider-normalized comparable | Retain. It is distinct from Investment's incompatible `ComparableProperty`; only one adapter may cross that boundary. |
| `ComparableSubject` | Canonical valuation subject | Retain. |
| `SimilarityScore`, `ComparableWeight`, `ComparableAdjustment`, `WeightedComparable` | Coherent comparable-analysis value graph | Retain as internal domain/policy results. |
| `ComparableAnalysis` | Canonical comparable-analysis result | Retain. |
| `MarketValueRange`, `ValuationConfidence`, `MarketValuation` | Canonical valuation graph | Retain. |
| `MarketAnalysisReport` | Current canonical Market read projection | Retain as report projection within the future lifecycle result. |
| `MarketAnalysisEvidence` / `MarketAnalysisFinding` | Deprecated report projections | Retain temporarily; Platform Evidence/Claims/Evaluations and explicit data gaps are authoritative. |
| `MarketIntelligenceAggregate` and eight component entities | Rich, internally coherent, parallel object graph | Reconcile into future result or projections; do not establish a second runner. |
| `MarketConfidence` | Rich multi-dimensional confidence | Candidate aggregate confidence model; overlaps valuation confidence, legacy confidence, and Platform confidence. |
| `ConfidenceScore` / `ConfidenceLevel` | Feature-local compatibility confidence | Retain inside Market methodology, map once to Platform confidence. Avoid exposing competing confidence meanings. |
| `MarketObservation` | Deprecated provider/read model | Platform Observation is canonical reasoning artifact. |
| `MarketProfile` | Legacy revenue-oriented profile | Transitional; overlaps aggregate, report, and Investment market snapshot. |
| `MarketIntelligenceReport` | Explicitly deprecated legacy report | Compatibility only. |
| `MarketPlatformArtifacts` | Provider-neutral but lifecycle-overreaching bundle | Replace with a stable Market Platform analysis projection that stops before operator Decision/Action/Outcome. |
| `MarketRisk` | Missing named canonical object | Currently represented by report findings and Platform Claims/Evaluations. Future result should expose explicit route-neutral risks or rely solely on canonical Platform projections. |
| `MarketDataGap` | Missing named canonical object | Currently a finding type/readiness issue. Add one explicit gap contract before provider integration is considered complete. |

### Selected canonical object graph

The valuation/report graph is the narrowest complete, provider-fed foundation. The richer aggregate contains valuable future dimensions but currently has no provider path and must not replace the working valuation graph wholesale.

```mermaid
flowchart TD
  Property[PropertyRecord / Market property] --> Subject[ComparableSubject]
  Comparables[ComparableProperty set + provenance] --> Weighted[WeightedComparable set]
  Subject --> Weighted
  Weighted --> Analysis[ComparableAnalysis]
  Analysis --> Valuation[MarketValuation + ValuationConfidence]
  Analysis --> Report[MarketAnalysisReport]
  Valuation --> Report
  Report --> Platform[Market Platform analysis: Observations / Evidence / Claims / Evaluations / Scores / Recommendations / Data gaps]
  Aggregate[Optional property / neighborhood / supply / demand / trend dimensions] -. future enrichment .-> Report
```

The future `MarketAnalysisResult` should contain property, normalized comparables, comparable analysis, valuation, report, Platform analysis, confidence, data gaps, and lineage. It must be discriminated/versioned if multiple analysis strategies emerge. It must not contain automatic operator Decisions, execution Actions, or Outcomes.

## RMI-001E Market to Investment Integration Audit

### Current flow

There is no production import from Market Intelligence into Investment Intelligence. The active workspace directly constructs every market-facing Investment input:

| Investment input | Current source | Current transformation | Classification |
| --- | --- | --- | --- |
| Property address/characteristics | Workspace form | Copied into Investment command | Manual, valid operator input; no Market resolution. |
| Purchase price | Workspace form default/value | Copied directly | Manual underwriting input; Market valuation unused. |
| Monthly lease | Workspace form default/value | Copied directly | Manual underwriting input; rental estimate unused. |
| Projected ADR | Workspace default `$200` / form | Copied directly | Placeholder/manual assumption; no Market evidence. |
| Projected occupancy | Workspace default `75%` / form | Copied directly | Placeholder/manual assumption; no Market evidence. |
| Projected revenue | Investment calculator | ADR × occupancy policy | Correctly Investment-owned. |
| Median ADR | Hard-coded `$180` | Embedded in command | Placeholder duplication. |
| Median occupancy | Hard-coded `70%` | Embedded in command | Placeholder duplication. |
| Market trend | Hard-coded stable | Embedded in command | Placeholder duplication. |
| Revenue confidence | Hard-coded `80` | Embedded in command | Placeholder; ignores Market confidence. |
| Comparables | `createWorkspaceComparables` | Two synthetic Investment-shaped objects | Provisional/disconnected from Market comparable lookup. |
| Property value / taxes | User purchase price and annual taxes | No Market mapping | Market `PropertyRecord` facts unused. |
| Rental value | User monthly lease | No Market mapping | No canonical rental provider exists. |

Investment owns another incompatible `ComparableProperty` interface focused on ADR, occupancy, rating, reviews, and amenities. Market's canonical `ComparableProperty` includes provider identity, valuation fields, STR metrics, and provenance. Direct assignment is neither possible nor desirable; an explicit mapping policy is required.

The nested `features/investment-intelligence/market-intelligence` package defines a third report model and a simple score-based recommendation (`Pursue this market` / `Investigate further`). It has no production caller and must be treated as legacy/disconnected, not as the integration adapter.

### Canonical integration decision

Exactly one integration route is sanctioned:

```mermaid
flowchart LR
  MarketResult[MarketAnalysisResult] --> Adapter[Investment-owned adaptMarketAnalysisToInvestmentInput]
  Operator[Explicit operator inputs] --> Compose[buildInvestmentAnalysisContext]
  Adapter --> Candidates[Market-derived assumption candidates + confidence + data gaps + lineage]
  Candidates --> Compose
  Compose --> Investment[runInvestmentAnalysis]
```

The adapter should map, where supported:

- Market ADR and occupancy estimates to Investment assumption candidates, never directly to projections;
- Market comparable records to the Investment comparable input projection;
- valuation/property facts to purchase-price, tax, or rent candidates only when semantically appropriate;
- Market confidence to input confidence/provenance, not Investment decision confidence;
- Market gaps and weak/substituted evidence to explicit Investment gaps;
- Market run, observation, evidence, report, and provider lineage into the Investment Platform run context.

Explicit operator input retains precedence over Market-derived candidates, consistent with II-008C. The adapter must not calculate Investment revenue, expenses, cash flow, score, or recommendation. Until RMI-002 implements this adapter and replaces workspace placeholders, there is no real Market-to-Investment runtime path.

## RMI-001F Architecture Decision Record

### Context

The repository contains mature isolated calculations and provider adapters but no runtime Market consumer. Multiple reports, confidence models, aggregate graphs, and Platform projections compete for authority. Public exports expose Infrastructure, and the largest Platform mapper advances Decision/Action/Outcome lifecycle stages automatically.

### Decision

1. Introduce one future public orchestration boundary: `runMarketAnalysis(command, context): Promise<MarketAnalysisResult>`.
2. The command accepts provider-neutral property/market search intent and analysis policy inputs. Provider choice is an injected strategy/configuration concern, not an Investment concern.
3. The deterministic context owns market run ID, observed/retrieved/recorded/generated times, and ID factories.
4. The runner composes property resolution, comparable discovery, normalization, comparable analysis, valuation, report construction, confidence, data gaps, and Platform reasoning projection.
5. Existing lookup services remain focused internal/public utilities; calculators/builders become policies behind the runner.
6. `buildMarketAnalysisReport` remains a report assembler. `buildCanonicalMarketAnalysis` becomes a compatibility/finalization facade or delegates to the runner once raw-input orchestration exists.
7. `MarketIntelligenceAggregate` becomes an enrichment/projection within the same result, not a second orchestration boundary.
8. Market analysis stops at Market recommendations. It does not automatically create operator Decisions, Actions, or Outcomes.
9. The capability root exports application/domain contracts only. Concrete providers and DTOs move behind an Infrastructure/composition-root import path.
10. Investment consumes only `MarketAnalysisResult` through one Investment-owned adapter. Direct RentCast, provider-port, or Market-domain imports elsewhere in Investment are prohibited.

### Target dependency direction

```mermaid
flowchart TD
  Presentation --> Investment[Investment application]
  Investment --> Market[Market public application boundary]
  Market --> Platform[Canonical Platform primitives]
  Composition[Application composition root] --> Market
  Composition --> Infrastructure[Market Infrastructure adapters]
  Infrastructure --> External[External provider APIs]
  Infrastructure -. implements .-> Ports[Market provider ports]
  Market --> Ports
```

Provider traffic flows in the opposite data direction—External Provider → Infrastructure Adapter → Canonical Market Models → Market Application Services → Market Analysis Result → Investment—but compile-time dependencies remain inward through ports and outward only in the composition root.

### Consequences

- Future providers can be added without changing Investment.
- Market calculations and provider normalization become independently testable and deterministic.
- Provider DTO leakage and environment construction require compatibility-safe cleanup.
- The current workspace remains placeholder-driven until the canonical adapter is implemented.
- Existing report and aggregate tests remain valuable characterization; no formulas are changed by RMI-001.
- Platform lifecycle semantics must be corrected before declaring the current Market Platform artifact bundle canonical.

### Rejected alternatives

- **Investment calls RentCast directly:** violates capability ownership and makes every provider an Investment dependency.
- **Keep both report and aggregate runners public:** preserves duplicate orchestration truth.
- **Make the rich aggregate canonical immediately:** it lacks provider composition and would discard the working valuation/report path.
- **Use `buildCanonicalMarketAnalysis` unchanged as the runner:** it accepts already-derived analysis and valuation, so it does not own the lifecycle named by its API.
- **Allow Market to emit completed Decision/Action/Outcome artifacts during analysis:** collapses analysis, operator commitment, execution, and measurement.

## Architecture Diagrams

### Current state

```mermaid
flowchart TD
  RentCast[RentCast HTTP + DTOs] --> PropertyAdapter[Property provider + mapper]
  RentCast --> ComparableAdapter[Comparable provider + mapper]
  PropertyAdapter --> PropertyLookup[lookupProperty]
  ComparableAdapter --> ComparableLookup[lookupComparables]
  PropertyLookup -. no runtime caller .-> Dead1[Disconnected]
  ComparableLookup -. no runtime caller .-> Dead2[Disconnected]

  ComparablePolicies[Similarity / weights / outliers] --> Valuation[ComparableAnalysis + MarketValuation]
  Valuation --> Report[MarketAnalysisReport]
  Report --> FullMapper[mapMarketPlatformArtifacts]
  FullMapper --> Reasoning[Observations through Recommendations]
  FullMapper --> Lifecycle[Automatic Decision + completed Action + Outcome]

  RichBuilders[Property / comparable / neighborhood / supply / demand / trends] --> Aggregate[MarketIntelligenceAggregate]
  Aggregate -. separate path .-> Intelligence[Platform Intelligence]

  Legacy[MarketProfile + MarketObservation] --> LegacyReport[Deprecated MarketIntelligenceReport]
  Nested[Investment-local market package] -. disconnected .-> Legacy2[Separate report/recommendation]

  Workspace[Investment workspace] --> Manual[Hard-coded medians/confidence + synthetic comparables]
  Manual --> Investment[runInvestmentAnalysis]
  Report -. no adapter .-> Investment
```

### Target state

```mermaid
flowchart TD
  Provider[External provider] --> Infra[Infrastructure adapter]
  Infra --> Records[Canonical property/comparable records + provenance]
  Records --> Runner[runMarketAnalysis]
  Runner --> Analysis[Comparable / market analysis policies]
  Analysis --> Valuation[Valuation + confidence + data gaps]
  Valuation --> Report[MarketAnalysisReport]
  Report --> Platform[Market Platform reasoning projection]
  Platform --> Result[MarketAnalysisResult]
  Result --> Adapter[Investment-owned Market adapter]
  Adapter --> Context[buildInvestmentAnalysisContext]
  Context --> Investment[runInvestmentAnalysis]
```

## Proposed Implementation Batches

1. **RMI-002A — Stable lifecycle contracts:** define `RunMarketAnalysisCommand`, deterministic run context, and `MarketAnalysisResult`; delegate to current policies without formula changes.
2. **RMI-002B — Provider composition:** move concrete factory wiring to a composition root, inject clocks/IDs, and stop exporting RentCast DTOs from the capability barrel.
3. **RMI-002C — Canonical provider ingestion:** compose property and comparable lookup into the runner; emit explicit provider failures/data gaps and preserve lineage.
4. **RMI-002D — Reconcile analysis graphs:** retain the valuation/report graph as the base and incorporate useful aggregate dimensions as optional enrichment; characterize confidence equivalence before consolidation.
5. **RMI-002E — Correct Platform projection:** produce deterministic observations, evidence, claims, evaluations, scores, recommendations, and gaps; remove automatic Decision/Action/Outcome creation from the canonical path while preserving compatibility if needed.
6. **RMI-003 — Single Investment adapter:** implement `adaptMarketAnalysisToInvestmentInput`, replace workspace market placeholders, and prove operator-input precedence and route-safe mappings.
7. **Later providers:** add STR performance first for ADR/occupancy evidence, then MLS/Regrid/Zillow adapters behind the unchanged ports and runner.

## RMI-002 Real Property Resolution

Real Property Resolution is the single canonical boundary for establishing the Market subject property. Provider-specific requests and responses terminate in Infrastructure. The boundary resolves identity and supported characteristics only; it performs no comparable analysis, valuation, underwriting, or Investment projection.

```mermaid
flowchart TD
  Address[Structured user address] --> Resolve[resolveMarketProperty]
  Resolve --> Normalize[Canonical address normalization]
  Normalize --> Port[MarketPropertyResolutionProvider]
  Port --> RentCast[RentCast infrastructure adapter]
  RentCast --> Candidates[Provider-neutral candidates]
  Candidates --> Policy[Deterministic resolution policy]
  Policy --> Result[MarketPropertyResolutionResult]
  Result --> Resolved[resolved]
  Result --> Ambiguous[ambiguous]
  Result --> NotFound[not-found]
  Result --> Unsupported[unsupported]
```

### Canonical API

`resolveMarketProperty(command, dependencies)` accepts a structured, provider-neutral address plus deterministic resolution identity and time. Its injected `MarketPropertyResolutionProvider` returns neutral candidates. The result contains a Market-owned property ID, generic provider references, normalized address, narrow resolution confidence, alternatives, explicit property data gaps, and provenance.

The existing `lookupProperty` service remains a compatibility path for current tests and callers. It delegates to a registry and returns the provider's first property record, so it is not an ambiguity-safe boundary and must not be used by future Market orchestration. The candidate resolution policy is owned only by `resolveMarketProperty`.

### Resolution semantics

- `resolved`: exactly one candidate matches all critical normalized address fields and any supplied unit.
- `ambiguous`: multiple candidates have equal eligible match quality; provider ordering is never used as a tie-breaker.
- `not-found`: the provider returned no candidates or none met the critical address policy.
- `unsupported`: identity resolved, but the returned property type is outside the residential Market scope.

Address normalization trims values, standardizes supported state names, reduces ZIP+4 to its comparison ZIP, and normalizes common street suffixes. Unit identity, directionals, numbered street names, city, state, and postal code remain material. The original request, normalized representation, and provider address remain separately auditable.

A legitimate empty provider response is `not-found`. Authentication, authorization, rate limiting, timeout, invalid response, and availability failures remain coded `ProviderError` failures and are propagated; they are never converted to `not-found`.

Missing property type, bedrooms, bathrooms, square footage, year built, coordinates, unit resolution, or provider timestamp produces an explicit coded gap. No optional fact is fabricated. Provider identifiers are retained only as generic provider references; the canonical property ID is owned by the resolution run.

The RentCast adapter now exposes all returned records through the neutral candidate port instead of applying its legacy `limit: 1` selection. Raw RentCast DTOs and concrete infrastructure exports have been removed from the Market capability root. Transport configuration and live verification remain infrastructure/composition-root responsibilities. RMI-003 may consume the resolved property to acquire real comparables; it must not reopen property identity selection.

## RMI-003 Real Comparable Acquisition

Real Comparable Acquisition is the canonical boundary for discovering and normalizing provider-backed comparable candidates. Acquisition preserves factual provider evidence, search criteria, data gaps, and provenance. It does not determine comparable eligibility, similarity, weighting, outliers, valuation, revenue, or Investment assumptions.

```mermaid
flowchart TD
  Subject[Resolved MarketProperty] --> Acquire[acquireMarketComparables]
  Acquire --> Criteria[Canonical criteria policy]
  Criteria --> Port[MarketComparableProvider]
  Port --> Sale[RentCast sale AVM]
  Port --> Rent[RentCast long-term rent AVM]
  Sale --> Candidates[Neutral provider candidates]
  Rent --> Candidates
  Candidates --> Identity[Canonical identity + deduplication]
  Identity --> Exclusion[Subject exclusion]
  Exclusion --> Result[MarketComparableAcquisitionResult]
  Result --> RMI004[RMI-004 qualification and weighting]
```

### Supported purposes and public API

`acquireMarketComparables(command, dependencies)` accepts the resolved Market property, an explicit purpose, optional criteria, and deterministic acquisition context. `sale-valuation` uses RentCast's `/avm/value` comparable listings. `long-term-rent` uses `/avm/rent/long-term` and treats provider `price` as monthly rent. `short-term-rental-performance` returns `unsupported` without calling a provider because neither endpoint supplies authoritative ADR or occupancy evidence.

The injected `MarketComparableProvider` is provider-neutral. Provider DTOs, endpoint paths, query translation, and concrete adapters remain in Infrastructure. The capability root exports only the canonical command, result, candidate, service, and provider port. The old `lookupComparables` API is deprecated compatibility behavior: it returns valuation-shaped `ComparableProperty` objects and must not be used for new acquisition flows.

### Search, identity, and ordering policy

Criteria precedence is explicit input, then subject-derived ranges, then stable defaults. Version-one defaults are a five-mile radius, 15 results, a one-year lookback, subject property type, bedrooms and bathrooms within one, and square footage within 20 percent or 250 square feet. The provider-neutral safe limits are 25 miles and 25 AVM comparables. Every materialized criterion is retained in the result even when a provider endpoint cannot enforce a filter directly.

Candidate IDs derive from provider, external ID, and purpose; array position is never identity. Duplicate provider/external-ID/purpose records consolidate deterministically, retain all provenance entries, and emit a conflict gap when prices disagree. Cross-provider address-only merging is deferred until parcel identity can be proven.

The subject is excluded by matching provider reference or exact normalized address, including unit identity. Geographic proximity alone never excludes a candidate. Canonical ordering is distance ascending, listing recency descending, normalized display address, canonical ID, then source rank. Provider rank is retained only as provenance.

### Empty, errors, gaps, and deferred qualification

A valid empty provider array produces `empty`. Authentication, rate limiting, timeout, invalid response, and availability failures remain coded provider errors. Representable partial candidates are preserved with explicit gaps for property type, bedrooms, bathrooms, square footage, coordinates, price/rent, date, listing status, or retrieval timestamp. An unrepresentable record missing provider identity or address fails as an invalid provider response instead of disappearing silently.

No candidate contains similarity, weight, inclusion, outlier, or valuation contribution. RMI-004 owns those judgments and consumes this acquisition result as factual input. Live provider verification was not part of automated validation and should be performed only with configured credentials and available quota.

## RMI-004 Comparable Qualification and Weighting

Comparable Qualification and Weighting is the canonical Market Intelligence boundary for converting acquired provider-backed candidates into an explainable analytical comparable set. It determines eligibility, similarity, outlier treatment, and relative analytical influence. It performs no provider acquisition, final valuation, revenue projection, Market report assembly, or Investment projection.

```mermaid
flowchart TD
  Acquisition[MarketComparableAcquisitionResult] --> Qualify[qualifyMarketComparables]
  Qualify --> Eligibility[Purpose-specific eligibility]
  Eligibility --> Included0[Eligible]
  Eligibility --> Excluded[Excluded with reasons]
  Eligibility --> Unresolved[Unresolved with gaps]
  Included0 --> Similarity[Supported-dimension similarity]
  Similarity --> Outliers[Median-deviation outlier policy]
  Outliers --> Hard[Hard outlier exclusion]
  Outliers --> Weight[Raw analytical weight]
  Weight --> Normalize[Normalized weights total 1]
  Normalize --> Set[Qualified comparable set]
  Set --> RMI005[RMI-005 valuation and analysis]
```

### Canonical policy and public API

`qualifyMarketComparables(command)` is pure and synchronous. It accepts a Market subject, the canonical acquisition result, an explicit policy, and deterministic qualification context. `buildDefaultMarketComparableQualificationPolicy` materializes the version-one sale or long-term-rent policy. The result separates included, excluded, and unresolved candidates and snapshots the policy and acquisition lineage.

The default policy retains the mature legacy comparison thresholds where applicable: five-mile maximum distance, 50 percent square-footage variance, two-bedroom and 1.5-bathroom hard variance limits, and a 40-year similarity horizon. Sale evidence uses a 365-day recency window and requires price; long-term rental evidence uses 270 days and requires monthly rent. Both remain purpose-specific and cannot mix. STR performance remains unsupported.

The legacy `calculateComparableSimilarity`, `buildWeightedComparables`, `normalizeComparableWeights`, and `detectComparableOutliers` functions remain compatibility policies for the valuation graph. They are not canonical acquisition-result orchestration: the legacy similarity policy assigns neutral values to missing dimensions and has no unresolved state. New production composition must enter through `qualifyMarketComparables`.

### Eligibility and missing evidence

Hard exclusion is limited to analytically disqualifying facts: unsupported property type, excessive distance or age, missing purpose-required price/rent, and characteristic variance beyond the explicit policy. Missing property type, required coordinates/date, or subject-comparable square footage produces `unresolved` when the policy cannot decide safely. Candidate gaps remain attached and are rolled up without silently discarding evidence.

Similarity evaluates distance, square footage, bedrooms, bathrooms, year built, property type, and recency. Missing dimensions are omitted, listed explicitly, and supported component weights are re-normalized; no fabricated neutral or perfect component is introduced. Scores remain on a deterministic 0–100 scale.

### Outliers, weights, and sufficiency

Outlier assessment runs only over eligible candidates and uses purpose-specific unit value: sale/listing price per square foot or monthly rent per square foot. Fewer than three supported observations produce `insufficient-sample` and no statistical exclusion. The version-one median-deviation bands are above 35 percent for a soft outlier and above 60 percent for a hard outlier. Soft outliers remain eligible with a 0.5 weight multiplier; hard outliers move to the excluded collection.

Raw weight combines similarity, outlier treatment, and evidence completeness. Provider rank and array order never affect analytical influence. Included weights are normalized to exactly one within six-decimal precision; a single comparable receives one and an empty set receives none.

Coverage is `insufficient` below three included comparables, `limited` from three through four, and `sufficient` at five or more under the default policy. This is comparable-set sufficiency, not full Market confidence. Included ordering is normalized weight, similarity, distance, and canonical ID. Excluded and unresolved ordering uses stage/reason and canonical ID. RMI-005 owns final valuation, rent estimation, and report confidence.

## RMI-005 Real Market Analysis Report

Real Market Analysis is the canonical orchestration boundary for converting a resolved property and provider-backed comparable evidence into an explainable Market Analysis Report. Market Intelligence owns property resolution, comparable acquisition, comparable qualification, valuation, long-term rent estimation, confidence, risks, data gaps, and evidence lineage. It does not own STR-performance projections, underwriting, financing, acquisition recommendations, or execution decisions.

```mermaid
flowchart TD
  Resolution[Resolved Market property] --> Run[runMarketAnalysis]
  Run --> SaleAcquire[Acquire sale comparables]
  Run --> RentAcquire[Acquire long-term rental comparables]
  SaleAcquire --> SaleQualify[Qualify sale comparables]
  RentAcquire --> RentQualify[Qualify rental comparables]
  SaleQualify --> SaleEstimate[Weighted sale estimate + range]
  RentQualify --> RentEstimate[Weighted monthly-rent estimate + range]
  SaleEstimate --> Report[Canonical MarketAnalysisReport]
  RentEstimate --> Report
  Report --> Confidence[Confidence]
  Report --> Limits[Risks + data gaps]
  Report --> Reasoning[Observations + evidence]
  Report --> RMI006[RMI-006 Investment projection]
```

### Supported analysis and status

`runMarketAnalysis(command, dependencies)` is the sole public end-to-end Market runner. Its command contains a resolved property result, explicitly enabled sale and/or long-term-rent requests, immutable policies, and deterministic analysis context. A provider-neutral comparable dependency is injected at the composition root. The runner invokes `acquireMarketComparables` and `qualifyMarketComparables`; it does not reconstruct those policies.

Sale valuation and long-term market rent are supported. No-analysis requests return `unsupported` without a provider call. A report is `complete` only when every requested section has a sufficient estimate, `partial` when at least one policy-authorized estimate is limited, and `insufficient` when no requested estimate can be supported. Provider failures remain coded errors. STR ADR, occupancy, and revenue do not exist in the report contract.

### Estimation and confidence

Both sections preserve the characterized weighted-comparable-mean calculation and consume RMI-004 normalized weights directly. The default range is the 25th–75th percentile of included factual values, expanded when necessary to contain the weighted estimate. Sale inputs are listing/sale prices; rental inputs are monthly long-term rents. Unit estimates divide the resulting estimate by known subject square footage. No second weighting model is calculated.

One-comparable limited estimation is explicitly authorized by the version-one estimation policy (`minimumEstimateComparables: 1`); raising that threshold produces `insufficient` and no value. All estimates and ranges must be finite and non-negative, and the estimate remains within its stated range.

Section confidence retains the characterized formula: comparable coverage contributes 30 points, average similarity 45, and estimate dispersion 25. Confidence therefore measures evidence support rather than whether a value is attractive. Report confidence averages requested section assessments. The full policy version is preserved as `market-analysis-v1` lineage.

### Risks, gaps, reasoning, and lineage

The report derives deterministic Market-only risks for insufficient/limited coverage, low similarity, stale evidence, high dispersion, concentrated weight, and incomplete subject facts. Duplicate risks merge their evidence and gap references. Investment financing, return, and acquisition risks are excluded.

Property-resolution, acquisition, qualification, valuation, and rent-analysis gaps are projected with stable IDs, source stage, and affected section. Source artifacts are cloned before the returned report is deeply frozen. Observations expose the subject and supported estimates; evidence references the exact qualified candidate IDs. Summary fields are projections of canonical section results rather than an independent calculation.

Lineage closes each estimate through qualification ID, acquisition ID, included candidate IDs, provider references carried by those candidates, and the property-resolution ID. The old `buildCanonicalMarketAnalysis` and `buildMarketAnalysisReport` functions are deprecated compatibility projections for the disconnected legacy valuation graph. They are not alternative end-to-end runners. RMI-006 must consume this report through one Investment-owned adapter rather than recombining subordinate Market artifacts.

## RMI-006 Investment Consumption Boundary

Investment Intelligence consumes Market Intelligence through one Investment-owned adapter that projects the canonical Market Analysis Report into Investment market context. The adapter preserves Market estimates, confidence, risks, data gaps, evidence, and lineage without recalculating Market conclusions. Explicit user input takes precedence over approved Learning, approved Learning takes precedence over Market evidence, and Market evidence takes precedence over Investment defaults.

```mermaid
flowchart LR
  Report[MarketAnalysisReport] --> Adapter[buildInvestmentMarketContext]
  Adapter --> MarketContext[InvestmentMarketContext]
  User[Explicit user input] --> Compose[buildInvestmentAnalysisContext]
  Learning[Approved applied Learning] --> Compose
  MarketContext --> Compose
  Defaults[Investment defaults] --> Compose
  Compose --> Input[Canonical Investment input]
  Compose --> Explain[Market evidence + risks + gaps + lineage]
  Input --> Engine[runInvestmentAnalysis]
```

### Projection, usability, and route semantics

`buildInvestmentMarketContext(report)` is the sole production Market-to-Investment transformation. It imports only the Market capability's public report contract. Sale value and range, long-term monthly rent and range, section comparable counts, Market confidence, risks, data gaps, evidence references, analysis timestamp, policy version, and resolution/acquisition/qualification lineage are copied into Investment-owned terminology. Insufficient and unsupported estimates remain absent.

`assessInvestmentMarketEvidenceUsability` classifies each supported section as usable, usable with caution, or unusable. Missing estimates, insufficient or unsupported sections, and blocking section gaps are unusable. Limited or sub-60-confidence evidence remains visible with caution rather than being erased.

Purchase price remains a deal term and is never replaced by sale valuation. Market sale value is contextual underwriting evidence. Long-term rent is retained as a distinct market benchmark. For rental arbitrage, it may fill only an unmarked legacy/default lease assumption; an explicit lease term or approved Learning wins. No Market field produces ADR, occupancy, STR revenue, cleaning expense, financing, score, or recommendation.

### Precedence and source lineage

The canonical composition order is:

1. explicit current user value;
2. approved applied Learning;
3. usable canonical Market evidence;
4. Investment system default.

Market-resolved assumptions record the Market analysis ID, Market evidence IDs, and section confidence. The complete `InvestmentMarketContext` remains beside the canonical engine input so downstream observations and explainability can trace Market-derived context back through the report, qualification, acquisition, and property resolution. The deterministic analysis engine does not inspect Market providers or subordinate Market artifacts.

### Workspace compatibility and RMI-007

The current React workspace still requires legacy STR-shaped comparable input and prefilled market medians because `calculateComparableAnalysis` rejects an empty set. RMI-006 does not misrepresent RMI-005 long-term rental evidence as STR evidence and does not add a live provider call to React. That compatibility path is now the explicit remaining target for RMI-007, which will provide request lifecycle, unavailable/limited UI states, and source labels. There is no RentCast or Market infrastructure dependency in Investment.

## Validation Record

- Repository and call-site audit: complete.
- Market capability tests: 45 files, 124 tests passing.
- RMI-001 production behavior changes: none.
- Provider leakage: documented; root barrel cleanup deferred to compatibility-controlled RMI-002B.
- Market-to-Investment runtime adapter: missing; exactly one sanctioned target path documented for RMI-003.
