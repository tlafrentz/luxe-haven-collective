import { describe, expect, it, vi } from "vitest";
import { createPortfolioId } from "@/features/portfolio";
import { Money } from "@/platform/kernel";
import { compareCapitalAllocation } from "./compare-capital-allocation";
import type { CapitalAllocationReaders } from "./allocation-contracts";
import { CapitalAllocationAccessDeniedError, createEvaluateCapitalAllocationUseCase } from "./evaluate-capital-allocation";
import { evaluateCapitalAllocation } from "../domain";
import { acquisition, engineInput, evaluatedAt, health, highConfidence, hold, ownerId, portfolioId, position } from "../domain/allocation/test-fixtures";

function readers(): CapitalAllocationReaders {
  return {
    portfolio: { readPortfolio: vi.fn(async () => ({ portfolioId, portfolioVersion: 7, reportingCurrency: "USD" as const, goals: [] })) },
    health: { readLatestCompatibleHealth: vi.fn(async () => ({ assessmentId: "health-1", assessment: health() })) },
    capital: { readCapitalPosition: vi.fn(async () => position()) },
    opportunities: { readCandidates: vi.fn(async () => [{
      opportunityId: "opportunity-app", opportunityVersion: 1, analysisId: "analysis-app", analysisVersion: 1,
      recommendation: "buy", requiredCapital: Money.usd(100_000), projectedAnnualCashFlow: Money.usd(20_000),
      acquisitionStatus: "candidate" as const, acquisitionRoute: "purchase" as const, committed: false, confidence: highConfidence, updatedAt: evaluatedAt,
    }]) },
    improvements: { readImprovementCandidates: vi.fn(async () => []) },
    obligations: { readMandatoryObligations: vi.fn(async () => []) },
    strategy: { readGoals: vi.fn(async () => []) },
  };
}
const query = () => ({ ownerId, portfolioId, evaluatedAt });

describe("evaluateCapitalAllocation application service", () => {
  it("authorizes and loads public projections, adds preserve-capital, and evaluates once", async () => {
    const dependencies = readers();
    const result = await createEvaluateCapitalAllocationUseCase({ readers: dependencies })(query());
    expect(result.isSuccess).toBe(true);
    expect(result.isSuccess && result.value.candidates.some((candidate) => candidate.candidate.purpose === "defer-deployment")).toBe(true);
    expect(dependencies.health.readLatestCompatibleHealth).toHaveBeenCalledTimes(1);
    expect(dependencies.portfolio.readPortfolio).toHaveBeenCalledWith(ownerId, portfolioId);
  });

  it("returns presentation-safe authorization, missing, policy, health, and capital errors", async () => {
    const denied = readers();
    vi.mocked(denied.portfolio.readPortfolio).mockRejectedValue(new CapitalAllocationAccessDeniedError());
    expect(await createEvaluateCapitalAllocationUseCase({ readers: denied })(query())).toMatchObject({ isFailure: true, error: { code: "CAPITAL_ALLOCATION_NOT_AUTHORIZED" } });
    const missing = readers();
    vi.mocked(missing.portfolio.readPortfolio).mockResolvedValue(null);
    expect(await createEvaluateCapitalAllocationUseCase({ readers: missing })(query())).toMatchObject({ isFailure: true, error: { code: "CAPITAL_ALLOCATION_PORTFOLIO_NOT_FOUND" } });
    expect(await createEvaluateCapitalAllocationUseCase({ readers: readers() })({ ...query(), policyVersion: "capital-allocation-999" })).toMatchObject({ isFailure: true, error: { code: "CAPITAL_ALLOCATION_POLICY_NOT_FOUND" } });
    const noHealth = readers();
    vi.mocked(noHealth.health.readLatestCompatibleHealth).mockResolvedValue(null);
    expect(await createEvaluateCapitalAllocationUseCase({ readers: noHealth })(query())).toMatchObject({ isFailure: true, error: { code: "CAPITAL_ALLOCATION_HEALTH_UNAVAILABLE" } });
    const noCapital = readers();
    vi.mocked(noCapital.capital.readCapitalPosition).mockRejectedValue(new Error("offline"));
    expect(await createEvaluateCapitalAllocationUseCase({ readers: noCapital })(query())).toMatchObject({ isFailure: true, error: { code: "CAPITAL_ALLOCATION_CAPITAL_UNAVAILABLE" } });
  });

  it("degrades optional sources into explicit gaps without fabricating candidates", async () => {
    const degraded = readers();
    vi.mocked(degraded.opportunities.readCandidates).mockRejectedValue(new Error("offline"));
    vi.mocked(degraded.improvements.readImprovementCandidates).mockRejectedValue(new Error("offline"));
    vi.mocked(degraded.strategy.readGoals).mockRejectedValue(new Error("offline"));
    const result = await createEvaluateCapitalAllocationUseCase({ readers: degraded })(query());
    expect(result.isSuccess).toBe(true);
    expect(result.isSuccess && result.value.dataGaps.map((gap) => gap.code)).toEqual(expect.arrayContaining(["ALLOCATION_SOURCE_UNAVAILABLE", "ALLOCATION_STRATEGY_UNAVAILABLE"]));
    expect(result.isSuccess && result.value.candidates).toHaveLength(1);
  });

  it("returns equivalent assessments for an equivalent query and performs no aggregate mutation", async () => {
    const useCase = createEvaluateCapitalAllocationUseCase({ readers: readers() });
    const first = await useCase(query()), second = await useCase(query());
    expect(first.isSuccess && second.isSuccess && first.value.snapshotFingerprint).toBe(second.isSuccess ? second.value.snapshotFingerprint : "");
  });
});

describe("capital allocation comparison", () => {
  it("detects newly infeasible candidates, rank movement, posture, primary, and constraints", () => {
    const candidates = [acquisition(), hold()];
    const previous = evaluateCapitalAllocation(engineInput(candidates));
    const lowCapital = position({ availableCapital: Money.usd(50_000), committedCapital: Money.zero(), nearTermObligations: Money.zero() });
    const current = evaluateCapitalAllocation({ ...engineInput([acquisition(), hold(lowCapital)]), capital: lowCapital });
    const change = compareCapitalAllocation(previous, current);
    expect(change.comparable).toBe(true);
    expect(change.postureChange).toEqual({ from: previous.recommendedPosture, to: current.recommendedPosture });
    expect(change.newlyInfeasibleCandidates.some((id) => id.value.includes("opportunity-growth"))).toBe(true);
    expect(change.currentPrimaryCandidateId).toContain("hold");
  });

  it("marks policy changes non-comparable and rejects another portfolio", () => {
    const value = evaluateCapitalAllocation(engineInput());
    expect(compareCapitalAllocation(value, { ...value, allocationPolicyVersion: "capital-allocation-2" })).toMatchObject({ comparable: false });
    expect(() => compareCapitalAllocation(value, { ...value, portfolioId: createPortfolioId("portfolio-other") })).toThrow(/same portfolio/);
  });
});
