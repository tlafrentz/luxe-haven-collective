# PM-003 — Market Intelligence Migration Inventory

## Baseline and result

The initial analyzer baseline contained 134 production files, 7 Platform Observation imports across 7 files, 5% direct adoption, and 9% effective adoption. After responsibility separation, Market Intelligence contains 139 production files and consumes 11 canonical Platform packages through its explicit boundaries, with approximately 8% direct and 14% effective whole-feature adoption. Low raw adoption is expected because most files implement market-owned calculations, provider infrastructure, bounded-context scaffolding, or projections.

## Classification

| Area | Current concepts | Classification and disposition |
| --- | --- | --- |
| Property | `PropertyRecord`, address, coordinates, characteristics, financial facts | Market/provider normalized input; retained |
| Comparables | `ComparableProperty`, `ComparableSubject`, `ComparableAnalysis`, `WeightedComparable`, `PropertyComparable` | Market expertise; retained |
| Valuation | `MarketValuation`, `MarketValueRange`, `ValuationConfidence`, adjustment and weight models | Market methodology; retained |
| Market models | `MarketProfile`, property/demand/supply/neighborhood/comparable/trend intelligence aggregates | Market policy inputs and compatibility projections; retained |
| Reports | `MarketAnalysisReport`, `MarketIntelligenceReport`, `ExecutiveMarketSummary` | Explicit read projections; not canonical lifecycle artifacts |
| Provider observations | `MarketObservation`, `DataProvenance` | Deprecated compatibility/provider model; mapped to Platform Observation |
| Reasoning evidence | `MarketAnalysisEvidence` | Deprecated projection; mapped to Platform Evidence |
| Findings | `MarketAnalysisFinding` | Deprecated projection; mapped to Claim plus Evaluation |
| Confidence | local `ConfidenceScore`, `ConfidenceLevel` | Retained temporarily for market algorithms; mapped to Platform Scoring at artifact boundary |
| Trend direction | local `TrendDirection` | Retained temporarily for market algorithms; mapped to Platform Intelligence direction |
| Market metric inputs | formerly Investment `Money`/`Percentage` | Replaced by Market-owned normalized structural contracts; feature-to-feature domain dependency removed |

## Providers

| Provider component | Responsibility |
| --- | --- |
| `RentCastClient` | External API transport and response handling |
| `RentCastPropertyProvider` | Property lookup implementation |
| `RentCastComparableProvider` | Comparable lookup implementation |
| RentCast DTOs and mappers | Provider normalization; retained in Market infrastructure |
| Property/Comparable provider interfaces | Market-owned ports |
| Provider registries and factories | Provider selection; retained |
| `ProviderResult` | Compatibility result envelope |
| `observePropertyProviderResult` | Canonical Property Observation adapter |
| `observeComparableProviderResult` | Canonical Comparable Observation adapter |
| `LookupProperty.executeObserved` | Provider result plus canonical observations |
| `LookupComparables.executeObserved` | Provider result plus canonical observations |

Provider Observations preserve provider name, retrieval/effective time, source reference, confidence, sample size, notes, and provider-specific metadata. Platform contains no RentCast or real-estate vocabulary.

## Calculators and policies retained

- Comparable similarity and configurable weighting
- Weight normalization
- Comparable outlier detection
- Market valuation and price-per-square-foot calculations
- Valuation confidence methodology
- Property, comparable, neighborhood, supply, demand, and trend scoring
- Overall market scoring and readiness validation
- Confidence dimension methodology
- Executive market interpretation
- Provider merge and normalization behavior

These remain Market Intelligence policy code.

## Canonical lifecycle mapping

| Legacy concept | Canonical artifact |
| --- | --- |
| Provider property/comparable record | Observation |
| `MarketAnalysisEvidence` | Evidence referencing Observations |
| `MarketAnalysisFinding` | Claim |
| Finding support, risk, or data gap judgment | Evaluation with Platform confidence |
| Favorable condition, risk mitigation, wait/invest focus | Recommendation |
| Market analysis request/completion | Decision, Action, Outcome used for auditable Intelligence lineage |
| Strength or interpreted observation | Insight |
| Market opportunity | Intelligence Opportunity |
| Comparable valuation estimate | Forecast |
| Risk or material data gap | Anomaly |
| `MarketTrendIntelligence` | Platform Trend through `mapMarketAggregateIntelligence` |

`mapMarketPlatformArtifacts` produces the complete canonical reasoning set from `MarketAnalysisReport`. `mapMarketAggregateIntelligence` maps richer aggregate trend, opportunity, forecast, insight, and anomaly policy results into Platform Intelligence.

## Reports and consumers

`MarketAnalysisReport`, `MarketIntelligenceReport`, and `ExecutiveMarketSummary` remain feature-owned report/dashboard projections. Their generic reasoning primitives are documented as compatibility models in `features/market-intelligence/compatibility/README.md`. No external production feature currently imports Market Intelligence, so new consumers should use canonical artifact adapters.

## Adoption eligibility

Direct or effective Platform adoption is expected for provider observation adapters, report observation providers, canonical reasoning mappers, canonical Intelligence mappers, and their public barrels. Comparable selection, valuation, similarity, adjustment, readiness, provider transport, RentCast mapping, report rendering, and bounded-context placeholders are intentionally non-eligible. The raw 14% effective figure therefore measures the whole feature, not migration completeness of eligible boundaries.
