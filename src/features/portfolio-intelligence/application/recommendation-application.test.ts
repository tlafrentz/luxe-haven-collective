import { describe, expect, it, vi } from "vitest";
import { createPortfolioOwnerId } from "@/features/portfolio";
import { createEvaluatePortfolioRecommendationsUseCase } from "./evaluate-portfolio-recommendations";
import type { PortfolioRecommendationReaders } from "./recommendation-contracts";
import { recommendationInput, recommendationObservation } from "../domain/recommendations/test-fixtures";

const input = recommendationInput();
const query = Object.freeze({
  ownerId: createPortfolioOwnerId("recommendation-owner"),
  portfolioId: input.portfolioId,
  observationWindow: input.observationWindow,
  evaluatedAt: input.evaluatedAt,
});
function readers(override: Partial<PortfolioRecommendationReaders> = {}): PortfolioRecommendationReaders {
  return {
    portfolio: { async readPortfolio() { return { portfolioVersion: input.portfolioVersion }; } },
    health: { async readLatestHealth() { return input.health; } },
    allocation: { async readLatestAllocation() { return input.allocation; } },
    strategy: { async readStrategy() { return input.strategy; } },
    executive: { async readExecutiveObservations() { return [recommendationObservation()]; } },
    market: { async readMarketObservations() { return []; } },
    investment: { async readInvestmentObservations() { return []; } },
    ...override,
  };
}

describe("Evaluate Portfolio Recommendations application service", () => {
  it("authorizes before loading and evaluates once through bounded readers", async () => {
    const order: string[] = [];
    const instrumentation = { record: vi.fn() };
    const service = createEvaluatePortfolioRecommendationsUseCase({
      authorizer: { async authorize() { order.push("authorize"); return true; } },
      readers: readers({ portfolio: { async readPortfolio() { order.push("portfolio"); return { portfolioVersion: input.portfolioVersion }; } } }),
      instrumentation,
    });
    const result = await service(query);
    expect(result.isSuccess).toBe(true);
    expect(order).toEqual(["authorize", "portfolio"]);
    expect(instrumentation.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "evaluated", recommendationCount: expect.any(Number) }));
  });

  it("denies unauthorized access without loading sources", async () => {
    const readPortfolio = vi.fn();
    const service = createEvaluatePortfolioRecommendationsUseCase({ authorizer: { async authorize() { return false; } }, readers: readers({ portfolio: { readPortfolio } }) });
    expect(await service(query)).toMatchObject({ isSuccess: false, error: { code: "PORTFOLIO_RECOMMENDATIONS_NOT_AUTHORIZED" } });
    expect(readPortfolio).not.toHaveBeenCalled();
  });

  it("handles missing portfolio, health, allocation, and policy safely", async () => {
    const authorize = { async authorize() { return true; } };
    expect(await createEvaluatePortfolioRecommendationsUseCase({ authorizer: authorize, readers: readers({ portfolio: { async readPortfolio() { return null; } } }) })(query)).toMatchObject({ isSuccess: false, error: { code: "PORTFOLIO_RECOMMENDATIONS_NOT_FOUND" } });
    expect(await createEvaluatePortfolioRecommendationsUseCase({ authorizer: authorize, readers: readers({ health: { async readLatestHealth() { return null; } } }) })(query)).toMatchObject({ isSuccess: false, error: { code: "PORTFOLIO_RECOMMENDATIONS_HEALTH_UNAVAILABLE" } });
    expect(await createEvaluatePortfolioRecommendationsUseCase({ authorizer: authorize, readers: readers({ allocation: { async readLatestAllocation() { return null; } } }) })(query)).toMatchObject({ isSuccess: false, error: { code: "PORTFOLIO_RECOMMENDATIONS_ALLOCATION_UNAVAILABLE" } });
    expect(await createEvaluatePortfolioRecommendationsUseCase({ authorizer: authorize, readers: readers(), policies: { get() { return null; } } })({ ...query, policyVersion: "portfolio-recommendations-99" })).toMatchObject({ isSuccess: false, error: { code: "PORTFOLIO_RECOMMENDATIONS_POLICY_NOT_FOUND" } });
  });

  it("degrades optional strategy, executive, market, and investment sources explicitly", async () => {
    const unavailable = async () => { throw new Error("unavailable"); };
    const service = createEvaluatePortfolioRecommendationsUseCase({
      authorizer: { async authorize() { return true; } },
      readers: readers({
        strategy: { readStrategy: unavailable },
        executive: { readExecutiveObservations: unavailable },
        market: { readMarketObservations: unavailable },
        investment: { readInvestmentObservations: unavailable },
      }),
    });
    const result = await service(query);
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.sourceLimitations).toEqual([
      "PORTFOLIO_RECOMMENDATIONS_EXECUTIVE_UNAVAILABLE",
      "PORTFOLIO_RECOMMENDATIONS_INVESTMENT_UNAVAILABLE",
      "PORTFOLIO_RECOMMENDATIONS_MARKET_UNAVAILABLE",
      "PORTFOLIO_RECOMMENDATIONS_STRATEGY_UNAVAILABLE",
    ]);
    expect(result.value.recommendations.some((item) => item.type === "collect-missing-data" && item.evidence.some((evidence) => evidence.referenceId === "strategy-source-unavailable"))).toBe(true);
    expect(result.value.confidence.score.value).toBeLessThan(input.health.confidence.score.value);
  });

  it("rejects incompatible source lineage and equivalent queries remain deterministic", async () => {
    const authorize = { async authorize() { return true; } };
    const incompatible = createEvaluatePortfolioRecommendationsUseCase({ authorizer: authorize, readers: readers({ portfolio: { async readPortfolio() { return { portfolioVersion: 99 }; } } }) });
    expect(await incompatible(query)).toMatchObject({ isSuccess: false, error: { code: "PORTFOLIO_RECOMMENDATIONS_SOURCES_INCOMPATIBLE" } });
    const service = createEvaluatePortfolioRecommendationsUseCase({ authorizer: authorize, readers: readers() });
    const first = await service(query);
    const second = await service(query);
    expect(first.isSuccess && second.isSuccess && second.value.snapshotFingerprint).toBe(first.isSuccess ? first.value.snapshotFingerprint : "");
  });

  it("validates dates without loading any source", async () => {
    const readPortfolio = vi.fn();
    const service = createEvaluatePortfolioRecommendationsUseCase({ authorizer: { async authorize() { return true; } }, readers: readers({ portfolio: { readPortfolio } }) });
    expect(await service({ ...query, evaluatedAt: new Date("invalid") })).toMatchObject({ isSuccess: false, error: { code: "PORTFOLIO_RECOMMENDATIONS_INPUT_INVALID" } });
    expect(readPortfolio).not.toHaveBeenCalled();
  });
});
