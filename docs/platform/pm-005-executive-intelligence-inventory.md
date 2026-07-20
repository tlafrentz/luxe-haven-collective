# PM-005 Executive Intelligence Inventory

Status: canonical orchestration boundary implemented; compatibility dashboard projection retained  
Scope: `src/features/executive-intelligence`  
Recorded: 2026-07-19

## Ownership decision

Executive Intelligence owns prioritization, attention scoring, grouping, sequencing, daily briefing, health projection, and cross-capability synthesis. It does not own revenue detection, market analysis, investment underwriting, or execution truth.

```text
Platform Recommendations + Decisions + Actions + Outcomes + Intelligence
                              ↓
                   Executive Input Adapter
                              ↓
                  Executive Attention Policy
                              ↓
          Executive Projection + focus Decision + briefing
                              ↓
                       Executive Dashboard
```

The canonical input contract imports only public `@/platform/*` APIs. Feature reports are not accepted as canonical Executive domain input.

## Inventory and classification

| Current concept | Existing source | Classification | PM-005 ownership |
| --- | --- | --- | --- |
| `ExecutivePriority` | Revenue opportunity DTO plus HPM pillar | Compatibility projection | Replaced canonically by `ExecutiveAttentionItem` |
| `ExecutiveBrief` | HPM, revenue risk, analytics snapshot | Presentation projection | Executive |
| `ExecutiveIntelligenceReport` | Analytics, HPM, Revenue aggregate | Compatibility dashboard DTO | Replaced canonically by `ExecutiveProjection` |
| `PortfolioHealth` | HPM performance | Compatibility projection | `ExecutiveHealthProjection` synthesized from Intelligence and Outcomes |
| `PortfolioSnapshot` | Revenue/Analytics metrics | Presentation projection | Compatibility until dashboard cards consume canonical projection |
| `RevenueRiskSummary` | Revenue opportunities | Duplicate reasoning/read projection | Canonical Recommendations, Intelligence, and failed Outcomes |
| `PortfolioChange` | Analytics activity and revenue changes | Presentation activity projection | Executive read model |
| `buildExecutivePriorities` | Revenue-specific ranking | Compatibility behavior | `ExecutiveAttentionPolicy` is authoritative |
| `buildExecutiveBrief` | Revenue/HPM narrative | Compatibility behavior | Canonical briefing projection is authoritative |
| `getExecutiveIntelligence` | Direct Analytics, HPM, Revenue fan-in | Compatibility provider | Dashboard calls one named projection adapter |

No standalone `ExecutiveRecommendation`, `ExecutiveOpportunity`, `ExecutiveInsight`, `ExecutiveRisk`, or `ExecutiveAlert` entity exists in the current feature. Their closest equivalents are fields in the legacy report and priority projections; they must not be promoted into new Executive lifecycle entities.

## Inputs

### Canonical input boundary

`ExecutivePlatformInputs` accepts only:

- `RecommendationCollection`
- `DecisionCollection`
- `ActionCollection`
- `OutcomeCollection`
- `IntelligenceCollection`

Revenue, Market, Investment, Execution, and future engines contribute through these collections. Executive does not import their DTOs, recalculate their conclusions, or reinterpret their evidence.

### Compatibility input dependencies

| Dependency | Current use | Disposition |
| --- | --- | --- |
| Revenue Intelligence | opportunities, snapshot, changes, risks | Isolated legacy report pipeline; replace with canonical Recommendation/Intelligence inputs |
| Analytics | date range, properties, booking activity, metric trends | Query and UI compatibility; not canonical Executive domain truth |
| HPM | pillar labels and initial performance score | Compatibility dashboard projection; health moves to Platform records |
| Market Intelligence | no direct current import | Consume future results through Platform only |
| Investment Intelligence | no direct current import | Consume future results through Platform only |
| Execution Engine | consumes `ExecutivePriority` in reverse | Temporary PM-001 compatibility mapper; migrate to Executive focus Decision/Platform Action |

## Domain ownership

### Remains Executive-owned

- `ExecutiveAttentionPolicy`, its weights, deterministic scoring, ranking, and stable tie-breaking.
- Cross-capability urgency and attention sequencing.
- Executive health projection across revenue, market, investment, operations, and growth.
- Briefing headline, narrative, highlights, concerns, and recommended focus.
- Dashboard grouping, digest generation, and presentation projections.
- Selection of a canonical Executive focus Decision from already-established conclusions.

### Remains outside Executive

- Revenue calculations and opportunity detection.
- Market valuation, comparable selection, provider normalization, and market interpretation.
- Investment underwriting, financing, risk methodology, and acquisition scoring.
- Action lifecycle transitions and Outcome measurement.
- Canonical lifecycle entities and collections.

## Prioritization policy

`ExecutiveAttentionPolicy` is isolated from adapters and UI. It scores normalized candidates using configurable urgency, impact, confidence, and recency weights. It is deterministic, side-effect free, independently testable, and uses source identifiers for stable ties. The policy ranks conclusions; it does not generate or re-evaluate them.

The default policy currently uses:

- urgency base weight: critical 400, high 300, medium 200, low 100;
- impact multiplier: 1;
- confidence multiplier: 0.5;
- recency allowance: 25 points with linear daily decay.

Changing these weights is an Executive policy change, not a Platform API change.

## Health and briefing

Canonical health is a behavior-free projection. Overall health is derived from successful versus unsuccessful Outcomes. Capability health is projected from the confidence of canonical Intelligence reports tagged by capability. Missing evidence remains `null`; Executive does not invent a score.

The canonical briefing summarizes ranked Platform records and Outcomes. Failed Outcomes become concerns, successful Outcomes become highlights, and the leading attention item supplies recommended focus.

## Consumers

| Consumer | Current boundary | Migration state |
| --- | --- | --- |
| Executive Dashboard | `getExecutiveDashboardProjection` | One adapter; legacy report shape retained behind it |
| Action Center | Platform Action adapter | No canonical dependency on Executive DTOs |
| Execution Engine | legacy `ExecutivePriority` mapper | Temporary compatibility; target is Platform Decision/Action |
| Investment Workspace | no Executive dependency | Correct direction; Investment contributes Platform artifacts |
| Reports | `ExecutiveIntelligenceReport` | Compatibility projection only |

## Compatibility register

- `ExecutiveIntelligenceReport`, `ExecutivePriority`, `PortfolioSnapshot`, `PortfolioHealth`, `RevenueRiskSummary`, and `PortfolioChange` remain behavior-free UI DTOs.
- `getExecutiveIntelligence`, `buildExecutivePriorities`, and the old revenue/HPM builders are deprecated compatibility behavior. They are not exported as the canonical orchestration API.
- `getExecutiveDashboardProjection` is the single production dashboard boundary during migration.
- Execution Engine's Executive-priority mapper is a PM-001 compatibility surface and must be removed when callers accept the canonical Executive focus Decision and Platform Actions.

## Completion evidence

PM-005 validation includes isolated policy tests, Platform-only orchestration tests, architecture lint, adoption reporting, lint, typecheck, full Vitest, production build, and diff validation. Raw adoption is not the target: UI components and behavior-free projections should not import Platform. Every file participating in canonical orchestration must do so exclusively through public Platform indexes.
