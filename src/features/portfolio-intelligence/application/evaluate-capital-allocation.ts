import { Percentage, Result } from "@/platform/kernel";

import { CAPITAL_ALLOCATION_POLICY_V1, evaluateCapitalAllocation as evaluatePure, type CapitalAllocationDataGap, type CapitalAllocationPolicy } from "../domain";
import { buildAcquisitionCandidate, buildObligationCandidate, buildPreserveCapitalCandidate, buildPropertyImprovementCandidate } from "./allocation-builders";
import type { CapitalAllocationInstrumentation, CapitalAllocationPolicyProvider, CapitalAllocationReaders, EvaluateCapitalAllocationError, EvaluateCapitalAllocationQuery } from "./allocation-contracts";

export class DefaultCapitalAllocationPolicyProvider implements CapitalAllocationPolicyProvider {
  public constructor(private readonly policies: readonly CapitalAllocationPolicy[] = [CAPITAL_ALLOCATION_POLICY_V1]) {}
  public get(version?: import("../domain").CapitalAllocationPolicyVersion) {
    return version ? this.policies.find((policy) => policy.version === version) ?? null : this.policies.at(-1) ?? null;
  }
}
export class CapitalAllocationAccessDeniedError extends Error {
  public constructor() {
    super("Capital allocation access denied.");
    this.name = "CapitalAllocationAccessDeniedError";
  }
}

export function createEvaluateCapitalAllocationUseCase(input: {
  readers: CapitalAllocationReaders;
  policies?: CapitalAllocationPolicyProvider;
  instrumentation?: CapitalAllocationInstrumentation;
}) {
  const policies = input.policies ?? new DefaultCapitalAllocationPolicyProvider();
  return async (query: EvaluateCapitalAllocationQuery) => {
    const startedAt = performance.now();
    const policy = policies.get(query.policyVersion);
    if (!policy) return Result.fail<EvaluateCapitalAllocationError>({ code: "CAPITAL_ALLOCATION_POLICY_NOT_FOUND" });
    if (Number.isNaN(query.evaluatedAt.getTime())) return Result.fail<EvaluateCapitalAllocationError>({ code: "CAPITAL_ALLOCATION_INPUT_INVALID", field: "evaluatedAt" });
    try {
      let portfolio;
      try {
        portfolio = await input.readers.portfolio.readPortfolio(query.ownerId, query.portfolioId);
      } catch (error) {
        if (error instanceof CapitalAllocationAccessDeniedError) return Result.fail<EvaluateCapitalAllocationError>({ code: "CAPITAL_ALLOCATION_NOT_AUTHORIZED" });
        throw error;
      }
      if (!portfolio) return Result.fail<EvaluateCapitalAllocationError>({ code: "CAPITAL_ALLOCATION_PORTFOLIO_NOT_FOUND" });
      const [healthResult, capitalResult, obligationResult] = await Promise.allSettled([
        input.readers.health.readLatestCompatibleHealth(query.ownerId, query.portfolioId, query.healthAssessmentId),
        input.readers.capital.readCapitalPosition(query.ownerId, query.portfolioId),
        input.readers.obligations.readMandatoryObligations(query.ownerId, query.portfolioId),
      ]);
      if (healthResult.status === "rejected" || !healthResult.value || !healthResult.value.assessment.portfolioId.equals(portfolio.portfolioId) || healthResult.value.assessment.portfolioVersion !== portfolio.portfolioVersion) {
        return Result.fail<EvaluateCapitalAllocationError>({ code: "CAPITAL_ALLOCATION_HEALTH_UNAVAILABLE", retryable: healthResult.status === "rejected" });
      }
      if (capitalResult.status === "rejected") return Result.fail<EvaluateCapitalAllocationError>({ code: "CAPITAL_ALLOCATION_CAPITAL_UNAVAILABLE", retryable: true });
      if (obligationResult.status === "rejected") return Result.fail<EvaluateCapitalAllocationError>({ code: "CAPITAL_ALLOCATION_SOURCE_UNAVAILABLE", source: "obligations", retryable: true });
      if (capitalResult.value.reportingCurrency !== portfolio.reportingCurrency) return Result.fail<EvaluateCapitalAllocationError>({ code: "CAPITAL_ALLOCATION_CURRENCY_INCOMPATIBLE" });

      const [opportunities, improvements, strategy] = await Promise.allSettled([
        input.readers.opportunities.readCandidates(query.ownerId, query.portfolioId),
        input.readers.improvements.readImprovementCandidates(query.ownerId, query.portfolioId),
        input.readers.strategy.readGoals(query.ownerId, query.portfolioId),
      ]);
      const goals = strategy.status === "fulfilled" ? strategy.value : portfolio.goals;
      const built = [
        ...obligationResult.value.map((source) => buildObligationCandidate(portfolio.portfolioId, source)),
        ...(opportunities.status === "fulfilled" ? opportunities.value.map((source) => buildAcquisitionCandidate({ portfolioId: portfolio.portfolioId, source, goals })) : []),
        ...(improvements.status === "fulfilled" ? improvements.value.map((source) => buildPropertyImprovementCandidate({ portfolioId: portfolio.portfolioId, source, goals })) : []),
      ];
      const candidates = built.flatMap((result) => result.candidate ? [result.candidate] : []);
      candidates.push(buildPreserveCapitalCandidate({ portfolioId: portfolio.portfolioId, capital: capitalResult.value, confidence: healthResult.value.assessment.confidence }));
      const sourceDataGaps: CapitalAllocationDataGap[] = [
        ...built.flatMap((result) => result.dataGaps),
        ...(opportunities.status === "rejected" ? [sourceGap("opportunity")] : []),
        ...(improvements.status === "rejected" ? [sourceGap("property")] : []),
        ...(strategy.status === "rejected" ? [strategyGap()] : []),
      ];
      const assessment = evaluatePure({
        portfolio: Object.freeze({ ...portfolio, goals: Object.freeze([...goals]) }),
        health: healthResult.value.assessment,
        capital: capitalResult.value,
        candidates: Object.freeze(candidates),
        policy,
        evaluatedAt: query.evaluatedAt,
        ...(healthResult.value.assessmentId ? { portfolioHealthAssessmentId: healthResult.value.assessmentId } : {}),
        sourceDataGaps: Object.freeze(sourceDataGaps),
      });
      input.instrumentation?.record({ portfolioId: portfolio.portfolioId.value, policyVersion: policy.version, outcome: "evaluated", durationMilliseconds: Math.max(0, performance.now() - startedAt) });
      return Result.ok(assessment);
    } catch {
      input.instrumentation?.record({ portfolioId: query.portfolioId.value, policyVersion: policy.version, outcome: "failure", durationMilliseconds: Math.max(0, performance.now() - startedAt) });
      return Result.fail<EvaluateCapitalAllocationError>({ code: "CAPITAL_ALLOCATION_UNEXPECTED" });
    }
  };
}
function sourceGap(source: "property" | "opportunity"): CapitalAllocationDataGap {
  return Object.freeze({ code: "ALLOCATION_SOURCE_UNAVAILABLE", source, impact: "material", missingFields: Object.freeze(["candidates"]), confidencePenalty: Percentage.create(20) });
}
function strategyGap(): CapitalAllocationDataGap {
  return Object.freeze({ code: "ALLOCATION_STRATEGY_UNAVAILABLE", source: "strategy", impact: "material", missingFields: Object.freeze(["goals"]), confidencePenalty: Percentage.create(20) });
}
