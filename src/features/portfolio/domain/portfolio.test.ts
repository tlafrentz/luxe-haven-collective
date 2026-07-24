import { describe, expect, it } from "vitest";

import {
  AssetWeight,
  CapitalAllocation,
  CapitalPosition,
  MarketExposure,
  Money,
  Percentage,
  Portfolio,
  PortfolioDomainError,
  PortfolioGoal,
  PortfolioHealth,
  PortfolioStrategy,
  RiskWeight,
  createPortfolioAllocation,
  createPortfolioExposure,
  createPortfolioOwnerId,
} from "./index";

const at = new Date("2026-07-23T12:00:00.000Z");
const next = (seconds: number) => new Date(at.getTime() + seconds * 1000);
const strategy = {
  strategy: PortfolioStrategy.create("balanced"),
  goals: [PortfolioGoal.create("diversification", "Reduce dependence on a single market.")],
};
const create = () => Portfolio.create({ ownerId: createPortfolioOwnerId("owner-1"), name: "Luxe Haven", strategy, occurredAt: at });
const propertyInput = {
  propertyId: "property-1",
  weight: AssetWeight.create(40),
  contribution: Money.usd(80_000),
  market: "Austin",
  propertyType: "single-family",
  annualRevenue: Money.usd(240_000),
  risk: RiskWeight.create(25),
};

describe("Portfolio aggregate", () => {
  it("is a versioned business aggregate with identity, strategy, health, and a creation event", () => {
    const portfolio = create();
    expect(portfolio.id.value).toMatch(/^portfolio-/);
    expect(portfolio.props.name.value).toBe("Luxe Haven");
    expect(portfolio.props.strategy.goals).toHaveLength(1);
    expect(portfolio.props.health.status).toBe("healthy");
    expect(portfolio.props.events[0]).toMatchObject({ type: "portfolio-created", aggregateVersion: 1 });
  });

  it("owns explicit property membership without owning the property", () => {
    const portfolio = create();
    portfolio.addProperty({ ...propertyInput, occurredAt: next(1) });
    expect(portfolio.props.composition.properties[0]).toMatchObject({
      property: { propertyId: "property-1" },
      status: "active",
      market: "Austin",
    });
    expect(portfolio.props.events.at(-1)?.type).toBe("property-added");
    expect(() => portfolio.addProperty({ ...propertyInput, occurredAt: next(2) })).toThrowError("DUPLICATE_MEMBERSHIP");
    portfolio.removeProperty("property-1", next(3));
    expect(portfolio.props.composition.properties[0]).toMatchObject({ status: "historical", removedAt: next(3) });
    portfolio.addProperty({ ...propertyInput, occurredAt: next(4) });
    expect(portfolio.props.composition.properties).toHaveLength(2);
  });

  it("models portfolio planning states independently and preserves opportunity history", () => {
    const portfolio = create();
    portfolio.addOpportunity("investment-opportunity-1", "observed", next(1));
    portfolio.transitionOpportunity("investment-opportunity-1", "analyzing", next(2));
    portfolio.transitionOpportunity("investment-opportunity-1", "candidate", next(3));
    expect(portfolio.props.composition.opportunities[0].status).toBe("candidate");
    expect(() => portfolio.transitionOpportunity("investment-opportunity-1", "acquired", next(4))).toThrowError("INVALID_OPPORTUNITY_MEMBERSHIP_TRANSITION");
    portfolio.removeOpportunity("investment-opportunity-1", next(5));
    expect(portfolio.props.composition.opportunities[0]).toMatchObject({ status: "exited", removedAt: next(5) });
  });

  it("represents capital and allocation without forecasting", () => {
    const portfolio = create();
    portfolio.updateCapital(CapitalPosition.create({
      available: Money.usd(500_000),
      committed: Money.usd(100_000),
      reserved: Money.usd(50_000),
      allocated: Money.usd(200_000),
      futureRequirements: Money.usd(75_000),
    }), next(1));
    portfolio.changeAllocation(createPortfolioAllocation({
      capitalPriorities: [CapitalAllocation.create({ priority: "Renovations", amount: Money.usd(50_000) })],
      investmentPriorities: ["New market entry"],
      growthStrategy: "Measured expansion",
    }), next(2));
    expect(portfolio.props.capital.futureRequirements.amount).toBe(75_000);
    expect(portfolio.props.allocation.growthStrategy).toBe("Measured expansion");
    expect(portfolio.props.events.slice(-2).map((event) => event.type)).toEqual(["capital-updated", "allocation-changed"]);
  });

  it("makes exposure dimensions and diversification first-class", () => {
    const exposure = createPortfolioExposure([
      MarketExposure.create({ dimension: "market", segment: "Austin", weight: Percentage.create(60) }),
      MarketExposure.create({ dimension: "market", segment: "Nashville", weight: Percentage.create(40) }),
      MarketExposure.create({ dimension: "operator", segment: "Self-operated", weight: Percentage.create(100) }),
    ]);
    const portfolio = create();
    portfolio.updateExposure(exposure, next(1));
    expect(portfolio.props.exposure.entries.map((entry) => entry.dimension)).toEqual(["market", "market", "operator"]);
    expect(() => createPortfolioExposure([
      MarketExposure.create({ dimension: "market", segment: "Austin", weight: Percentage.create(60) }),
      MarketExposure.create({ dimension: "market", segment: "Nashville", weight: Percentage.create(50) }),
    ])).toThrowError("INVALID_EXPOSURE");
  });

  it("publishes observations and records referential strategic decisions", () => {
    const portfolio = create();
    const observation = portfolio.publishObservation({
      type: "market-concentration",
      summary: "Austin represents most portfolio revenue.",
      observedAt: next(1),
    }, next(1));
    const decision = portfolio.recordDecision({
      type: "diversify-market",
      rationale: "Reduce exposure to a single demand cycle.",
      observationId: observation.id,
      opportunity: { opportunityId: "investment-opportunity-2" },
      analysis: { analysisId: "opportunity-analysis-9" },
      decidedAt: next(2),
    }, next(2));
    expect(decision).toMatchObject({
      opportunity: { opportunityId: "investment-opportunity-2" },
      analysis: { analysisId: "opportunity-analysis-9" },
    });
    expect(portfolio.props.events.slice(-2).map((event) => event.type)).toEqual(["observation-published", "decision-recorded"]);
  });

  it("keeps health qualitative and emits only meaningful health changes", () => {
    const portfolio = create();
    portfolio.changeHealth(PortfolioHealth.create({ status: "attention", assessedAt: next(1), rationale: "Concentration requires review." }), next(1));
    expect(portfolio.props.health.status).toBe("attention");
    expect(portfolio.props.events.at(-1)).toMatchObject({ type: "health-changed", previous: "healthy", current: "attention" });
    const version = portfolio.version;
    portfolio.changeHealth(PortfolioHealth.create({ status: "attention", assessedAt: next(2) }), next(2));
    expect(portfolio.version).toBe(version);
  });

  it("validates core value objects", () => {
    expect(() => PortfolioStrategy.create("custom")).toThrowError(PortfolioDomainError);
    expect(() => PortfolioGoal.create("scale", " ")).toThrowError(PortfolioDomainError);
    expect(() => CapitalPosition.create({ available: Money.usd(-1), committed: Money.zero(), reserved: Money.zero(), allocated: Money.zero(), futureRequirements: Money.zero() })).toThrowError("INVALID_CAPITAL_POSITION");
  });
});
