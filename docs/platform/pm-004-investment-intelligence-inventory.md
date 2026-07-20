# PM-004 Investment Intelligence Inventory

Status: migration baseline and ownership decision  
Scope: `src/features/investment-intelligence`  
Recorded: 2026-07-19

## Boundary decision

Investment Intelligence remains the owner of acquisition and rental-arbitrage underwriting. Platform owns the immutable artifacts used to explain, commit to, execute, measure, and interpret that underwriting. The type historically named `InvestmentDecision` is retained as a compatibility/read projection; it is not a canonical Platform Decision and contains no user commitment.

Canonical flow:

```text
Market and Revenue Platform artifacts
        + property, financing, and operating assumptions
        ↓
Investment-owned underwriting policies
        ↓
Observation → Evidence → Claim → Evaluation → Score → Recommendation
                                                        ↓ explicit commitment
                                                   Decision → Action
                                                                  ↓ measurement
                                                            Outcome → Intelligence
```

## Ownership matrix

| Area | Current concepts | Classification | Target ownership |
| --- | --- | --- | --- |
| Property inputs | `PropertyProfile`, `Location`, `PropertyType` | Investment domain truth | Investment |
| Assumptions | `InvestmentAssumptions`, `PurchaseAssumptions`, `RentalArbitrageAssumptions` | Investment domain truth | Investment |
| Underwriting | purchase/arbitrage engines, mortgage, debt service, expenses, revenue projections | Investment domain truth | Investment |
| Performance | NOI, cap rate, cash-on-cash, DSCR, breakeven, lease coverage | Investment domain truth and view data | Investment |
| Comparables | comparable analysis and competitive position | Investment underwriting input | Investment; consume Market through adapter |
| Scenarios | purchase/arbitrage scenarios, stress tests, failure points | Investment domain truth | Investment |
| Risk | `InvestmentRisk`, `RiskSeverity`, mitigation and impact | Investment-specific policy result | Investment; project conclusions into Claims/Evaluations/Intelligence |
| Evidence | `SupportingEvidence`, evidence type/direction | Compatibility DTO | Platform Evidence is authoritative |
| Score | `InvestmentScore`, local `Score`, confidence enums | Methodology plus compatibility value objects | Weighting remains Investment; Platform Scoring is authoritative representation |
| Recommendation | `AcquisitionRecommendation`, purchase recommendation | Compatibility vocabulary/read projection | Platform Recommendation is authoritative proposal |
| Decision reports | `InvestmentDecision`, `DecisionReport`, `PurchaseDecisionReport` | Read-model projection / compatibility | Platform Decision records explicit commitment only |
| Strategy | `AcquisitionStrategy`, first-90-day priorities | Investment operating plan | Investment; accepted priorities project to Platform Actions |
| Measured result | no canonical feature model | Missing canonical boundary | Platform Outcome |
| Retrospective interpretation | generic opportunities/risks/findings | Compatibility or legacy intelligence | Platform Intelligence |
| Workspace | cards, previews, readiness, report components | Presentation/read model | Investment through one workspace adapter |

## Domain inventory

### Underwriting entities retained

- Acquisition: `InvestmentDecision`, `AcquisitionStrategy`, `InvestmentAssumptions`, `InvestmentScore`, `InvestmentRisk`, `SupportingEvidence`.
- Purchase: `PurchaseInvestmentAnalysis`, `PurchaseDecisionReport`, debt service, expense projection, financial performance, scenarios, and failure points.
- Rental arbitrage: `RentalArbitrageInvestmentAnalysis`, assumptions, expense projection, financial performance, stress tests, and failure points.
- Shared calculations: revenue and expense projections, financial performance, comparables, similarity, risk assessment, confidence, acquisition strategy, and investment score.
- Value objects: `Money`, `Percentage`, `Rating`, `Location`; local `Score` remains compatibility input while Platform Scoring is emitted.

### Platform-authoritative artifacts

| Legacy field or concept | Canonical artifact |
| --- | --- |
| Supporting evidence | `@/platform/evidence` |
| Acquisition and risk assertions | `@/platform/claims` |
| Support, opposition, confidence, and rationale | `@/platform/evaluations` + `@/platform/scoring` |
| Overall and dimensional scores | `@/platform/scoring` |
| strong-buy/buy/buy-with-conditions/wait/pass | `@/platform/recommendations` |
| accepted/rejected/deferred user commitment | `@/platform/decisions` |
| diligence and operating-plan work | `@/platform/actions` |
| measured diligence and operating performance | `@/platform/outcomes` |
| upside, risk, forecast, anomaly, and insight | `@/platform/intelligence` |

## Consumers and dependencies

- Production entry point: `src/app/(dashboard)/dashboard/investments/page.tsx` renders `InvestmentWorkspace` from the feature root.
- Workspace consumers are contained within `components/`; purchase results now cross `buildInvestmentWorkspaceView`, the single canonical read-model adapter. Rental-arbitrage compatibility remains presentation-only until its report projection is unified.
- Existing Observation provider and mappers already emit canonical Platform Observations for decisions, strategy, revenue, expenses, performance, score, risk, evidence, and summary.
- Investment has no production domain import from Revenue Intelligence or the top-level Market Intelligence feature. Canonical upstream data is accepted through `normalizeInvestmentUpstream`, which depends only on Platform public APIs.
- The nested `investment-intelligence/market-intelligence` calculators are underwriting support code, not a competing Platform reasoning lifecycle.
- `application/builders/build-market-recommendation.ts` imports the legacy `features/intelligence` model and is classified as duplicate/compatibility behavior to remove when that older consumer is retired.

## Compatibility register

| Compatibility surface | Reason retained | Permitted behavior |
| --- | --- | --- |
| `InvestmentDecision` | Purchase report and workspace consumers | Immutable calculation/read projection only; never user commitment |
| `SupportingEvidence` and local evidence enums | Existing builders and cards | Input/projection only; mapped to Platform Evidence |
| `InvestmentScore` and local `Score` | Existing calculators and cards | Calculation result; mapped to Platform Score |
| `AcquisitionRecommendation` | Existing policy and UI labels | Vocabulary projection; mapped to Platform Recommendation |
| `DecisionReport`, `PurchaseDecisionReport` | Purchase workspace/report rendering | Read model only |
| rental-arbitrage report models | Existing UI path | Compatibility projection until unified canonical mapper supports it |

Compatibility models must remain behavior-free. New lifecycle behavior belongs in the adapters/application boundary and canonical Platform entities.

## Implemented PM-004 boundaries

- `mapInvestmentPlatformAnalysis`: canonical Observations, Evidence, Claims, Evaluations, Scores, and Recommendation.
- `normalizeInvestmentUpstream`: Platform-only Market/Revenue input boundary.
- `commitInvestmentRecommendation`: explicit accepted/rejected/deferred Platform Decision and accepted-decision Actions.
- `recordInvestmentOutcome`: measured Platform Outcome with complete lineage, followed by Investment-owned Platform Intelligence.
- `buildInvestmentWorkspaceView`: sole purchase workspace canonical/read projection adapter.

## Remaining cleanup constraints

- Do not move underwriting formulas, thresholds, comparable logic, financing, scenarios, risk methods, or acquisition policy into Platform.
- Do not infer a Platform Decision from an analytical recommendation.
- Do not store measured results in `InvestmentDecision` or an Action compatibility type.
- Remove compatibility vocabulary only after all report and workspace consumers have migrated; until then it must remain documented and behavior-free.
- The legacy `features/intelligence` market recommendation builder is the only identified cross-feature generic intelligence dependency and should be removed with that compatibility path.

## Completion evidence

PM-004 is complete when architecture lint, eligible adoption reporting, lint, typecheck, relevant and full Vitest suites, build, and diff validation pass. The migration adoption metric must distinguish calculation/presentation files (not eligible to import Platform) from reasoning boundary files (eligible and required).
