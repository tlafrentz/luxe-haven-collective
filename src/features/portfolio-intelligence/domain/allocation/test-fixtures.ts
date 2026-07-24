import { createPortfolioId, createPortfolioOwnerId } from "@/features/portfolio";
import { Money, Percentage } from "@/platform/kernel";
import { ConfidenceAssessment, ConfidenceScore } from "@/platform/scoring";

import { buildAcquisitionCandidate, buildPreserveCapitalCandidate } from "../../application/allocation-builders";
import { evaluatePortfolioHealth } from "../health";
import { evaluatedAt, healthSnapshot, window } from "../health/test-fixtures";
import { PORTFOLIO_HEALTH_POLICY_V1 } from "../health/policy";
import type { CapitalAllocationCandidate, CapitalAllocationPosition, EvaluateCapitalAllocationInput } from "./contracts";
import { CAPITAL_ALLOCATION_POLICY_V1 } from "./policy";

export { evaluatedAt };
export const ownerId = createPortfolioOwnerId("allocation-owner");
export const portfolioId = createPortfolioId("portfolio-health-test");
export const highConfidence = ConfidenceAssessment.create({ score: ConfidenceScore.create(90), rationale: ["Verified allocation source."] });
export function position(override: Partial<CapitalAllocationPosition> = {}): CapitalAllocationPosition {
  return Object.freeze({
    reportingCurrency: "USD", availableCapital: Money.usd(500_000), reservedCapital: Money.usd(75_000),
    committedCapital: Money.usd(50_000), allocatedCapital: Money.usd(25_000), requiredMinimumReserve: Money.usd(100_000),
    nearTermObligations: Money.usd(50_000), capturedAt: new Date("2026-07-23T10:00:00.000Z"), ...override,
  });
}
export function health() {
  const result = evaluatePortfolioHealth({ snapshot: healthSnapshot(), policy: PORTFOLIO_HEALTH_POLICY_V1, observationWindow: window, evaluatedAt });
  if (result.status !== "evaluated") throw new Error("Expected health assessment.");
  return result.assessment;
}
export function acquisition(id = "opportunity-growth", amount = 100_000, returnValue = 20): CapitalAllocationCandidate {
  const result = buildAcquisitionCandidate({
    portfolioId,
    goals: [],
    source: {
      opportunityId: id, opportunityVersion: 2, analysisId: `analysis-${id}`, analysisVersion: 3,
      recommendation: "buy", requiredCapital: Money.usd(amount), projectedAnnualCashFlow: Money.usd(amount * returnValue / 100),
      projectedReturn: Percentage.create(returnValue), acquisitionStatus: "candidate", committed: false,
      confidence: highConfidence, updatedAt: new Date("2026-07-22T00:00:00.000Z"), acquisitionRoute: "purchase",
    },
  });
  return result.candidate!;
}
export function hold(capital = position()) { return buildPreserveCapitalCandidate({ portfolioId, capital, confidence: highConfidence }); }
export function engineInput(candidates: readonly CapitalAllocationCandidate[] = [acquisition(), hold()]): EvaluateCapitalAllocationInput {
  return {
    portfolio: Object.freeze({ portfolioId, portfolioVersion: 7, reportingCurrency: "USD", goals: Object.freeze([]) }),
    health: health(), capital: position(), candidates: Object.freeze(candidates),
    policy: CAPITAL_ALLOCATION_POLICY_V1, evaluatedAt,
  };
}
