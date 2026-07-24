import { Result } from "@/platform/kernel";
import {
  PORTFOLIO_RECOMMENDATION_POLICY_V1,
  evaluatePortfolioRecommendations as evaluatePure,
  type PortfolioRecommendationPolicy,
  type PortfolioRecommendationPolicyVersion,
} from "../domain";
import type {
  EvaluatePortfolioRecommendationsError,
  EvaluatePortfolioRecommendationsQuery,
  PortfolioRecommendationAuthorizer,
  PortfolioRecommendationInstrumentation,
  PortfolioRecommendationPolicyProvider,
  PortfolioRecommendationReaders,
} from "./recommendation-contracts";

export class DefaultPortfolioRecommendationPolicyProvider implements PortfolioRecommendationPolicyProvider {
  public constructor(private readonly policies: readonly PortfolioRecommendationPolicy[] = [PORTFOLIO_RECOMMENDATION_POLICY_V1]) {}
  public get(version?: PortfolioRecommendationPolicyVersion): PortfolioRecommendationPolicy | null {
    return version ? this.policies.find((policy) => policy.version === version) ?? null : this.policies.at(-1) ?? null;
  }
}

export function createEvaluatePortfolioRecommendationsUseCase(input: Readonly<{
  authorizer: PortfolioRecommendationAuthorizer;
  readers: PortfolioRecommendationReaders;
  policies?: PortfolioRecommendationPolicyProvider;
  instrumentation?: PortfolioRecommendationInstrumentation;
}>) {
  const policies = input.policies ?? new DefaultPortfolioRecommendationPolicyProvider();
  return async (query: EvaluatePortfolioRecommendationsQuery) => {
    if (!valid(query)) return Result.fail<EvaluatePortfolioRecommendationsError>({ code: "PORTFOLIO_RECOMMENDATIONS_INPUT_INVALID", field: "query" });
    const policy = policies.get(query.policyVersion);
    if (!policy) return Result.fail<EvaluatePortfolioRecommendationsError>({ code: "PORTFOLIO_RECOMMENDATIONS_POLICY_NOT_FOUND" });
    if (!await input.authorizer.authorize(query.ownerId, query.portfolioId)) return Result.fail<EvaluatePortfolioRecommendationsError>({ code: "PORTFOLIO_RECOMMENDATIONS_NOT_AUTHORIZED" });
    try {
      const portfolio = await input.readers.portfolio.readPortfolio(query.ownerId, query.portfolioId);
      if (!portfolio) return Result.fail<EvaluatePortfolioRecommendationsError>({ code: "PORTFOLIO_RECOMMENDATIONS_NOT_FOUND" });
      const [healthResult, allocationResult] = await Promise.allSettled([
        input.readers.health.readLatestHealth(query.ownerId, query.portfolioId),
        input.readers.allocation.readLatestAllocation(query.ownerId, query.portfolioId),
      ]);
      if (healthResult.status === "rejected" || !healthResult.value) return Result.fail<EvaluatePortfolioRecommendationsError>({ code: "PORTFOLIO_RECOMMENDATIONS_HEALTH_UNAVAILABLE", retryable: true });
      if (allocationResult.status === "rejected" || !allocationResult.value) return Result.fail<EvaluatePortfolioRecommendationsError>({ code: "PORTFOLIO_RECOMMENDATIONS_ALLOCATION_UNAVAILABLE", retryable: true });
      const [strategy, executive, market, investment] = await Promise.allSettled([
        input.readers.strategy.readStrategy(query.ownerId, query.portfolioId),
        input.readers.executive.readExecutiveObservations(query.ownerId, query.portfolioId, query.observationWindow),
        input.readers.market.readMarketObservations(query.ownerId, query.portfolioId, query.observationWindow),
        input.readers.investment.readInvestmentObservations(query.ownerId, query.portfolioId, query.observationWindow),
      ]);
      const limitations: string[] = [];
      if (strategy.status === "rejected") limitations.push("PORTFOLIO_RECOMMENDATIONS_STRATEGY_UNAVAILABLE");
      if (executive.status === "rejected") limitations.push("PORTFOLIO_RECOMMENDATIONS_EXECUTIVE_UNAVAILABLE");
      if (market.status === "rejected") limitations.push("PORTFOLIO_RECOMMENDATIONS_MARKET_UNAVAILABLE");
      if (investment.status === "rejected") limitations.push("PORTFOLIO_RECOMMENDATIONS_INVESTMENT_UNAVAILABLE");
      const observations = [
        ...(executive.status === "fulfilled" ? executive.value : []),
        ...(market.status === "fulfilled" ? market.value : []),
        ...(investment.status === "fulfilled" ? investment.value : []),
      ];
      const strategyValue = strategy.status === "fulfilled"
        ? strategy.value
        : Object.freeze({ available: false, defined: false, goals: Object.freeze([]), version: 0 });
      let assessment;
      try {
        assessment = evaluatePure({
          portfolioId: query.portfolioId,
          portfolioVersion: portfolio.portfolioVersion,
          health: healthResult.value,
          allocation: allocationResult.value,
          strategy: strategyValue,
          observations: Object.freeze(observations),
          policy,
          observationWindow: query.observationWindow,
          evaluatedAt: query.evaluatedAt,
          sourceLimitations: Object.freeze(limitations),
        });
      } catch (error) {
        if (error instanceof Error && /incompatible|stale/.test(error.message)) return Result.fail<EvaluatePortfolioRecommendationsError>({ code: "PORTFOLIO_RECOMMENDATIONS_SOURCES_INCOMPATIBLE" });
        throw error;
      }
      input.instrumentation?.record({ policyVersion: policy.version, outcome: "evaluated", recommendationCount: assessment.recommendations.length, limitationCount: limitations.length });
      return Result.ok(assessment);
    } catch {
      input.instrumentation?.record({ policyVersion: policy.version, outcome: "failure", recommendationCount: 0, limitationCount: 0 });
      return Result.fail<EvaluatePortfolioRecommendationsError>({ code: "PORTFOLIO_RECOMMENDATIONS_UNEXPECTED" });
    }
  };
}

function valid(query: EvaluatePortfolioRecommendationsQuery) {
  return !Number.isNaN(query.evaluatedAt.getTime()) &&
    !Number.isNaN(query.observationWindow.start.getTime()) &&
    !Number.isNaN(query.observationWindow.end.getTime()) &&
    query.observationWindow.start <= query.observationWindow.end;
}
