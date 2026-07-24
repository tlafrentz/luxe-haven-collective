import { describe, expect, it, vi } from "vitest";
import { createPortfolioId, createPortfolioOwnerId, Money } from "@/features/portfolio";
import { evaluatePortfolioHealth } from "../domain";
import { evaluatedAt, healthSnapshot, window } from "../domain/health/test-fixtures";
import { PORTFOLIO_HEALTH_POLICY_V1 } from "../domain/health/policy";
import { comparePortfolioHealth } from "./compare-portfolio-health";
import type { PortfolioHealthReaders } from "./contracts";
import { createEvaluatePortfolioHealthUseCase } from "./evaluate-portfolio-health";

function readers(): PortfolioHealthReaders {
  const snapshot = healthSnapshot();
  return {
    portfolio: { readPortfolio: vi.fn(async () => ({ portfolio: snapshot.portfolio, opportunities: snapshot.opportunities })) },
    properties: { readProperties: vi.fn(async () => snapshot.properties.map((property) => ({
      propertyId: property.propertyId,
      membershipStatus: property.membershipStatus,
      marketKey: property.marketKey,
      geographicKey: property.geographicKey,
      propertyType: property.propertyType,
      operatingModel: property.operatingModel,
      capitalBasis: property.capitalBasis,
      riskLevel: property.riskLevel,
      dataCompleteness: property.dataCompleteness,
      updatedAt: property.updatedAt,
    }))) },
    performance: { readPerformance: vi.fn(async () => Object.fromEntries(snapshot.properties.map((property) => [property.propertyId, { revenue: property.revenue, netOperatingIncome: property.netOperatingIncome, occupancy: property.occupancy, adr: property.adr }]))) },
    capital: { readCapital: vi.fn(async () => snapshot.capital) },
    risks: { readRisks: vi.fn(async () => snapshot.risks) },
    strategy: { readStrategy: vi.fn(async () => snapshot.strategy) },
    exposures: { readExposures: vi.fn(async () => snapshot.exposures) },
    observations: { readObservations: vi.fn(async () => snapshot.observations) },
  };
}
const query = () => ({ ownerId: createPortfolioOwnerId("owner-1"), portfolioId: healthSnapshot().portfolio.portfolioId, observationWindow: window, evaluatedAt });

describe("evaluatePortfolioHealth application service", () => {
  it("loads bounded public projections and returns a platform Result", async () => {
    const dependencies = readers();
    const useCase = createEvaluatePortfolioHealthUseCase({ readers: dependencies });
    const result = await useCase(query());
    expect(result.isSuccess).toBe(true);
    expect(result.isSuccess && result.value.status).toBe("evaluated");
    expect(dependencies.portfolio.readPortfolio).toHaveBeenCalledWith(query().ownerId, query().portfolioId);
  });

  it("returns typed not-found, policy, validation, and required-source errors", async () => {
    const notFoundReaders = readers();
    vi.mocked(notFoundReaders.portfolio.readPortfolio).mockResolvedValue(null);
    expect(await createEvaluatePortfolioHealthUseCase({ readers: notFoundReaders })(query())).toMatchObject({ isFailure: true, error: { code: "PORTFOLIO_HEALTH_NOT_FOUND" } });
    expect(await createEvaluatePortfolioHealthUseCase({ readers: readers() })({ ...query(), policyVersion: "portfolio-health-999" })).toMatchObject({ isFailure: true, error: { code: "PORTFOLIO_HEALTH_POLICY_NOT_FOUND" } });
    expect(await createEvaluatePortfolioHealthUseCase({ readers: readers() })({ ...query(), observationWindow: { start: window.end, end: window.start } })).toMatchObject({ isFailure: true, error: { code: "PORTFOLIO_HEALTH_INPUT_INVALID" } });
    const failed = readers();
    vi.mocked(failed.capital.readCapital).mockRejectedValue(new Error("unavailable"));
    expect(await createEvaluatePortfolioHealthUseCase({ readers: failed })(query())).toMatchObject({ isFailure: true, error: { code: "PORTFOLIO_HEALTH_SOURCE_UNAVAILABLE", source: "capital" } });
  });

  it("degrades optional risk and strategy failures into explicit gaps and confidence penalties", async () => {
    const degraded = readers();
    vi.mocked(degraded.risks.readRisks).mockRejectedValue(new Error("risk unavailable"));
    vi.mocked(degraded.strategy.readStrategy).mockRejectedValue(new Error("strategy unavailable"));
    const result = await createEvaluatePortfolioHealthUseCase({ readers: degraded })(query());
    expect(result.isSuccess).toBe(true);
    expect(result.isSuccess && result.value.status === "evaluated" && result.value.assessment.dataGaps.map((gap) => gap.code)).toEqual(expect.arrayContaining(["PORTFOLIO_RISK_SOURCE_MISSING", "PORTFOLIO_STRATEGY_MISSING"]));
  });
});

describe("Portfolio health comparison", () => {
  function assessment(available = 300_000) {
    const snapshot = healthSnapshot();
    const result = evaluatePortfolioHealth({ snapshot: { ...snapshot, capital: { ...snapshot.capital, available: Money.usd(available) } }, policy: PORTFOLIO_HEALTH_POLICY_V1, observationWindow: window, evaluatedAt });
    if (result.status !== "evaluated") throw new Error("Expected assessment.");
    return result.assessment;
  }

  it("identifies improvements, band changes, and finding changes deterministically", () => {
    const previous = assessment(25_000);
    const current = assessment(300_000);
    const change = comparePortfolioHealth(previous, current);
    expect(change.policyCompatible).toBe(true);
    expect(change.overallChange).toBe("improved");
    expect(change.scoreDelta).toBeGreaterThan(0);
    expect(change.resolvedFindings.some((finding) => finding.code === "PORTFOLIO_CAPITAL_OVERCOMMITTED")).toBe(true);
    expect(comparePortfolioHealth(current, current).overallChange).toBe("unchanged");
  });

  it("rejects another portfolio and marks policy or window incompatibility non-comparable", () => {
    const previous = assessment();
    const differentWindow = { ...assessment(), observationWindow: { start: new Date("2026-01-01"), end: new Date("2026-02-01") } };
    expect(comparePortfolioHealth(previous, differentWindow)).toMatchObject({ policyCompatible: false, overallChange: "not-comparable" });
    const otherPortfolio = { ...assessment(), portfolioId: createPortfolioId("portfolio-other") };
    expect(() => comparePortfolioHealth(previous, otherPortfolio)).toThrow(/same portfolio/);
  });
});
