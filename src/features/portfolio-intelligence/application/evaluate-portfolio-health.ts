import { Result } from "@/platform/kernel";

import {
  PORTFOLIO_HEALTH_POLICY_V1,
  evaluatePortfolioHealth as evaluatePure,
  type PortfolioHealthDataCoverageSource,
  type PortfolioHealthEvaluationResult,
  type PortfolioHealthPolicy,
  type PortfolioHealthSnapshot,
} from "../domain";
import type {
  EvaluatePortfolioHealthError,
  EvaluatePortfolioHealthQuery,
  PortfolioHealthInstrumentation,
  PortfolioHealthPolicyProvider,
  PortfolioHealthReaders,
} from "./contracts";

export class DefaultPortfolioHealthPolicyProvider implements PortfolioHealthPolicyProvider {
  public constructor(private readonly policies: readonly PortfolioHealthPolicy[] = [PORTFOLIO_HEALTH_POLICY_V1]) {}
  public get(version?: import("../domain").PortfolioHealthPolicyVersion): PortfolioHealthPolicy | null {
    return version ? this.policies.find((policy) => policy.version === version) ?? null : this.policies.at(-1) ?? null;
  }
}

export function createEvaluatePortfolioHealthUseCase(input: {
  readers: PortfolioHealthReaders;
  policies?: PortfolioHealthPolicyProvider;
  instrumentation?: PortfolioHealthInstrumentation;
}) {
  const policies = input.policies ?? new DefaultPortfolioHealthPolicyProvider();
  return async (query: EvaluatePortfolioHealthQuery): Promise<ReturnType<typeof Result.ok<PortfolioHealthEvaluationResult>> | ReturnType<typeof Result.fail<EvaluatePortfolioHealthError>>> => {
    const startedAt = performance.now();
    const policy = policies.get(query.policyVersion);
    if (!policy) return Result.fail({ code: "PORTFOLIO_HEALTH_POLICY_NOT_FOUND" });
    if (!validQuery(query)) return Result.fail({ code: "PORTFOLIO_HEALTH_INPUT_INVALID", field: "observationWindow" });
    try {
      const core = await input.readers.portfolio.readPortfolio(query.ownerId, query.portfolioId);
      if (!core) return Result.fail({ code: "PORTFOLIO_HEALTH_NOT_FOUND" });
      let properties;
      let capital;
      try {
        properties = await input.readers.properties.readProperties(query.ownerId, query.portfolioId);
      } catch {
        return Result.fail({ code: "PORTFOLIO_HEALTH_SOURCE_UNAVAILABLE", source: "properties", retryable: true });
      }
      try {
        capital = await input.readers.capital.readCapital(query.ownerId, query.portfolioId);
      } catch {
        return Result.fail({ code: "PORTFOLIO_HEALTH_SOURCE_UNAVAILABLE", source: "capital", retryable: true });
      }
      const [performanceResult, riskResult, strategyResult, exposureResult, observationResult] = await Promise.allSettled([
        input.readers.performance.readPerformance(query.ownerId, query.portfolioId, query.observationWindow),
        input.readers.risks.readRisks(query.ownerId, query.portfolioId),
        input.readers.strategy.readStrategy(query.ownerId, query.portfolioId),
        input.readers.exposures.readExposures(query.ownerId, query.portfolioId),
        input.readers.observations.readObservations(query.ownerId, query.portfolioId, query.observationWindow),
      ]);
      const performanceValues = performanceResult.status === "fulfilled" ? performanceResult.value : {};
      const enriched = properties.map((property) => Object.freeze({ ...property, ...(performanceValues[property.propertyId] ?? {}) }));
      const observations = observationResult.status === "fulfilled" ? observationResult.value : [];
      const coverage: PortfolioHealthDataCoverageSource = Object.freeze({
        expectedPropertyCount: enriched.filter((property) => property.membershipStatus === "active").length,
        coveredPropertyCount: enriched.filter((property) => property.membershipStatus === "active" && property.dataCompleteness.value > 0).length,
        expectedMetricCount: enriched.filter((property) => property.membershipStatus === "active").length * 2,
        availableMetricCount: enriched.reduce((sum, property) => sum + Number(Boolean(property.revenue)) + Number(Boolean(property.netOperatingIncome)), 0),
        sourceAvailable: Object.freeze({
          performance: performanceResult.status === "fulfilled",
          capital: true,
          exposure: exposureResult.status === "fulfilled",
          risk: riskResult.status === "fulfilled",
          strategy: strategyResult.status === "fulfilled" && strategyResult.value !== null,
        }),
      });
      const snapshot: PortfolioHealthSnapshot = Object.freeze({
        portfolio: core.portfolio,
        properties: Object.freeze(enriched),
        opportunities: Object.freeze([...core.opportunities]),
        capital,
        exposures: Object.freeze(exposureResult.status === "fulfilled" ? [...exposureResult.value] : []),
        risks: Object.freeze(riskResult.status === "fulfilled" ? [...riskResult.value] : []),
        strategy: strategyResult.status === "fulfilled" ? strategyResult.value : null,
        observations: Object.freeze([...observations]),
        dataCoverage: coverage,
        capturedAt: new Date(query.evaluatedAt),
      });
      const result = evaluatePure({ snapshot, policy, observationWindow: query.observationWindow, evaluatedAt: query.evaluatedAt });
      input.instrumentation?.record({ portfolioId: query.portfolioId.value, policyVersion: policy.version, outcome: result.status, durationMilliseconds: Math.max(0, performance.now() - startedAt) });
      return Result.ok(result);
    } catch {
      input.instrumentation?.record({ portfolioId: query.portfolioId.value, policyVersion: policy.version, outcome: "failure", durationMilliseconds: Math.max(0, performance.now() - startedAt) });
      return Result.fail({ code: "PORTFOLIO_HEALTH_UNEXPECTED" });
    }
  };
}

function validQuery(query: EvaluatePortfolioHealthQuery): boolean {
  return !Number.isNaN(query.evaluatedAt.getTime()) &&
    !Number.isNaN(query.observationWindow.start.getTime()) &&
    !Number.isNaN(query.observationWindow.end.getTime()) &&
    query.observationWindow.start < query.observationWindow.end;
}
