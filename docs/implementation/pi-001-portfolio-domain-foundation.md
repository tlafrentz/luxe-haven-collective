# PI-001 — Portfolio Domain Foundation

## Status

Implemented July 23, 2026.

## Outcome

PI-001 establishes `src/features/portfolio` as a first-class bounded context. Its canonical aggregate is `Portfolio`, representing the hospitality business and its strategic composition—not a list of properties and not an extension of Investment Intelligence.

The boundary answers:

> Should this asset or opportunity become part of this business, given its current composition, capital, exposure, health, and strategy?

It does not answer whether an opportunity is a good investment in isolation. Investment Intelligence retains that responsibility.

## Ownership

Portfolio owns:

- explicit property and opportunity membership;
- historical membership records;
- current capital position;
- exposure and diversification representation;
- allocation priorities and growth strategy;
- qualitative portfolio health;
- strategic observations and decisions;
- portfolio identity, strategy, goals, version, and domain-event history.

Portfolio references, but does not own:

- properties through opaque `propertyId` references;
- investment opportunities through opaque `opportunityId` references;
- analyses through opaque `analysisId` references;
- platform confidence and scoring primitives.

There are no imports from Investment Intelligence, Investment Opportunity, Acquisition OS, Revenue Intelligence, or property domains in the Portfolio domain.

## Aggregate model

`Portfolio` is the aggregate root and enforces:

- owner-scoped identity;
- explicit membership with no duplicate active relationship;
- retained property and opportunity history after removal;
- a distinct opportunity planning lifecycle:
  `observed → analyzing → candidate → approved → acquiring → acquired`, with explicit rejection and exit paths;
- non-negative capital buckets;
- exposure totals no greater than 100% within each dimension;
- decisions referencing only observations published by the same portfolio;
- monotonic aggregate versions;
- meaningful domain events for business changes.

Opportunity membership state is deliberately not an acquisition pipeline stage. Portfolio planning and acquisition execution remain separate concepts.

## Domain concepts

### Composition

- `PortfolioProperty`
- `PortfolioOpportunity`
- `PortfolioComposition`

A membership contains a reference to the externally owned entity and portfolio-specific facts such as status, weight, contribution, market, type, annual revenue, and risk. Removal ends the active relationship; it does not delete history.

### Capital and allocation

`CapitalPosition` represents:

- available;
- committed;
- reserved;
- allocated;
- future requirements.

`PortfolioAllocation` represents capital priorities, investment priorities, and growth strategy. PI-001 contains no forecast, optimization, simulation, or allocation engine.

### Exposure

`PortfolioExposure` contains typed exposure entries for:

- market;
- property type;
- operator;
- geography;
- revenue;
- concentration.

`DiversificationScore`, `MarketExposure`, `AssetWeight`, and `RiskWeight` establish extension points for PI-002 and PI-003 without deriving analytics in PI-001.

### Health, observations, and decisions

`PortfolioHealth` is qualitative: `healthy`, `attention`, `at-risk`, or `critical`. No scoring or derivation policy is embedded.

`PortfolioObservation` supports market concentration, revenue concentration, geographic concentration, capital utilization, and growth opportunity facts.

`PortfolioDecision` supports acquire, improve, sell, wait, refinance, and diversify decisions. It keeps referential lineage to opportunities, analyses, properties, and observations rather than copying source intelligence.

## Platform primitives

Neutral immutable `Money` and `Percentage` value objects were added to the platform kernel. Portfolio also uses the platform `Score` and `ConfidenceAssessment` concepts. This prevents Portfolio from importing the structurally similar value types owned by Investment Intelligence.

## Application contracts

`PortfolioRepository` provides only owner-scoped aggregate loading and optimistic-version persistence:

```ts
interface PortfolioRepository {
  findById(id: PortfolioId, ownerId: PortfolioOwnerId): Promise<Portfolio | null>;
  save(portfolio: Portfolio, expectedVersion?: number): Promise<void>;
}
```

The application layer exposes create, load, require, and save services. It rejects owner overrides and requires an expected version for updates.

Read-side contracts are domain-oriented and presentation-neutral:

- `PortfolioSummary`
- `PortfolioMembership`
- `PortfolioCapital`
- `PortfolioExposure`
- `PortfolioHealth`
- `PortfolioProjectionReader`

No dashboard or workspace projection is introduced.

## Domain events

The aggregate records:

- `portfolio-created`
- `property-added`
- `property-removed`
- `opportunity-added`
- `opportunity-removed`
- `capital-updated`
- `allocation-changed`
- `health-changed`
- `observation-published`
- `decision-recorded`

Events contain portfolio identity, occurrence time, and aggregate version. Exposure replacement and opportunity state changes increment the aggregate version but are intentionally not assigned new event names beyond the PI-001 event vocabulary.

## Folder structure

```text
src/features/portfolio/
├── application/
│   ├── contracts.ts
│   ├── services.ts
│   └── services.test.ts
├── domain/
│   ├── events.ts
│   ├── model.ts
│   ├── portfolio.ts
│   ├── portfolio-error.ts
│   ├── value-objects.ts
│   └── portfolio.test.ts
├── infrastructure/
│   └── in-memory-portfolio-repository.ts
└── index.ts
```

`presentation/` is intentionally absent because PI-001 excludes UI. Production persistence is also deferred; the infrastructure adapter exists only to exercise the repository contract and optimistic concurrency.

## Verification

The implementation is covered by:

- aggregate and value-object tests;
- application and in-memory repository tests;
- platform primitive tests;
- architecture tests protecting Portfolio, Investment Intelligence, and Acquisition OS boundaries.

Required repository checks:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Route-manifest verification is satisfied by the production build because PI-001 introduces no route.

## Deferred work

- PI-002: health derivation engine
- PI-003: allocation engine
- PI-004: Portfolio workspace
- PI-005: recommendations
- PI-006: dashboard

No analytics, forecasting, scenario modeling, capital simulation, AI recommendation, or presentation logic is included in PI-001.
