import { describe, expect, it } from "vitest";
import { createPortfolioId } from "@/features/portfolio";
import { Money } from "@/platform/kernel";
import { buildObligationCandidate } from "../../application/allocation-builders";
import { evaluateCapitalAllocation, evaluateFeasibility, fingerprintCapitalAllocation, summarizePosition } from "./engine";
import { CAPITAL_ALLOCATION_POLICY_V1 } from "./policy";
import { acquisition, engineInput, evaluatedAt, highConfidence, hold, portfolioId, position } from "./test-fixtures";

describe("capital position and feasibility", () => {
  it("preserves buckets and excludes reserves, commitments, and obligations from deployable capital", () => {
    const value = summarizePosition(position());
    expect(value.availableCapital.amount).toBe(500_000);
    expect(value.requiredMinimumReserve.amount).toBe(100_000);
    expect(value.committedCapital.amount).toBe(50_000);
    expect(value.nearTermObligations.amount).toBe(50_000);
    expect(value.deployableCapital.amount).toBe(300_000);
    expect(value.capitalShortfall.amount).toBe(0);
  });

  it("identifies negative deployable capital without using unverified capital", () => {
    const value = summarizePosition(position({ availableCapital: Money.usd(100_000), requiredMinimumReserve: Money.usd(80_000), committedCapital: Money.usd(50_000), nearTermObligations: Money.usd(30_000), unverifiedCapital: Money.usd(1_000_000) }));
    expect(value.deployableCapital.amount).toBe(0);
    expect(value.capitalShortfall.amount).toBe(60_000);
  });

  it("evaluates fully funded, insufficient, reserve-breaching, expired, and stale candidates", () => {
    expect(evaluateFeasibility(acquisition("funded", 100_000), position(), CAPITAL_ALLOCATION_POLICY_V1, evaluatedAt).status).toBe("feasible");
    const insufficient = evaluateFeasibility(acquisition("too-large", 400_000), position(), CAPITAL_ALLOCATION_POLICY_V1, evaluatedAt);
    expect(insufficient).toMatchObject({ status: "infeasible", blockers: expect.arrayContaining([expect.objectContaining({ code: "ALLOCATION_CAPITAL_INSUFFICIENT" })]) });
    const expired = { ...acquisition("expired"), timing: { urgency: "planned" as const, delayImpact: "material" as const, expirationDate: new Date("2026-01-01") } };
    expect(evaluateFeasibility(expired, position(), CAPITAL_ALLOCATION_POLICY_V1, evaluatedAt)).toMatchObject({ status: "infeasible", blockers: [{ code: "ALLOCATION_CANDIDATE_EXPIRED" }] });
    const stale = { ...acquisition("stale"), sourceVersion: { ...acquisition("stale").sourceVersion, updatedAt: new Date("2025-01-01") } };
    expect(evaluateFeasibility(stale, position(), CAPITAL_ALLOCATION_POLICY_V1, evaluatedAt).status).toBe("conditionally-feasible");
  });

  it("validates staged requirements and never converts recurring requirements to one-time amounts", () => {
    const base = acquisition("staged", 100_000);
    const staged = { ...base, requiredCapital: { ...base.requiredCapital as Extract<typeof base.requiredCapital, { status: "known" }>, fundingType: "staged" as const, stages: [{ id: "one", amount: Money.usd(40_000) }, { id: "two", amount: Money.usd(50_000) }] } };
    expect(evaluateFeasibility(staged, position(), CAPITAL_ALLOCATION_POLICY_V1, evaluatedAt).status).toBe("insufficient-data");
    const recurring = { ...base, requiredCapital: { ...base.requiredCapital as Extract<typeof base.requiredCapital, { status: "known" }>, fundingType: "recurring" as const } };
    expect(evaluateFeasibility(recurring, position(), CAPITAL_ALLOCATION_POLICY_V1, evaluatedAt).status).toBe("insufficient-data");
  });
});

describe("mandatory coverage, ranking, and posture", () => {
  const obligation = (id: string, amount: number | null, severity: "normal" | "critical" = "normal") =>
    buildObligationCandidate(portfolioId, { obligationId: id, subject: { type: "obligation", obligationId: id }, type: "contractual", amount: amount === null ? null : Money.usd(amount), requiredBy: evaluatedAt, committed: true, severity, confidence: highConfidence }).candidate!;

  it("funds mandatory obligations before discretionary growth without requiring a return score", () => {
    const result = evaluateCapitalAllocation(engineInput([acquisition(), obligation("required", 80_000, "critical"), hold()]));
    expect(result.recommendedPosture).toBe("fund-mandatory-obligations");
    expect(result.primaryCandidateId?.value).toContain("obligation-required");
    expect(result.candidates.find((value) => value.candidate.id.value.includes("obligation-required"))).toMatchObject({ priorityClass: "required", scores: null, posture: "required", rank: 1 });
    expect(result.mandatoryCoverage.coverage?.value).toBe(100);
  });

  it("makes shortfall explicit and prohibits discretionary growth", () => {
    const result = evaluateCapitalAllocation({ ...engineInput([obligation("large", 600_000, "critical"), acquisition(), hold()]), capital: position({ availableCapital: Money.usd(200_000) }) });
    expect(result.mandatoryCoverage.unfunded.amount).toBeGreaterThan(0);
    expect(result.recommendedPosture).toBe("fund-mandatory-obligations");
    expect(result.candidates.find((value) => value.candidate.purpose === "new-acquisition")?.feasibility.status).toBe("infeasible");
  });

  it("blocks ranking when a mandatory amount is unknown", () => {
    const result = evaluateCapitalAllocation(engineInput([obligation("unknown", null), acquisition(), hold()]));
    expect(result.recommendedPosture).toBe("insufficient-data");
    expect(result.candidates.find((value) => value.candidate.id.value.includes("unknown"))?.rank).toBeNull();
    expect(result.primaryCandidateId).toBeUndefined();
  });

  it("uses Platform scoring for feasible discretionary candidates and keeps confidence distinct", () => {
    const result = evaluateCapitalAllocation(engineInput());
    const growth = result.candidates.find((value) => value.candidate.purpose === "new-acquisition")!;
    expect(growth.scores?.components).toHaveLength(7);
    expect(growth.scores?.components.reduce((sum, value) => sum + value.weight.percentage, 0)).toBe(100);
    expect(growth.scores?.total.value).not.toBe(growth.confidence.score.value);
    expect(growth.rank).toBe(1);
  });

  it("allows preserve-capital to become primary and treats holding as valid", () => {
    const capital = position({ availableCapital: Money.usd(50_000), committedCapital: Money.zero(), nearTermObligations: Money.zero() });
    const result = evaluateCapitalAllocation({ ...engineInput([acquisition(), hold(capital)]), capital });
    expect(result.recommendedPosture).toBe("preserve-liquidity");
    expect(result.primaryCandidateId?.value).toContain("capital-candidate-hold");
    const preserve = result.candidates.find((value) => value.candidate.purpose === "defer-deployment");
    expect(preserve?.feasibility.status).toBe("feasible");
    expect(preserve?.opportunityCosts[0]).toMatchObject({ type: "delayed-growth", candidateId: acquisition().id });
  });

  it("returns no primary candidate when all options are infeasible", () => {
    const result = evaluateCapitalAllocation(engineInput([acquisition("one", 900_000), acquisition("two", 800_000)]));
    expect(result.primaryCandidateId).toBeUndefined();
    expect(result.recommendedPosture).toBe("defer-deployment");
    expect(result.candidates.every((value) => value.rank === null)).toBe(true);
  });

  it("recognizes risk remediation, health impact, and evidence-backed trade-offs", () => {
    const candidate = {
      ...acquisition("risk", 50_000),
      purpose: "risk-remediation" as const,
      classification: "protective" as const,
      expectedImpact: {
        ...acquisition("risk", 50_000).expectedImpact,
        health: { affectedDimensions: [{ dimension: "risk" as const, direction: "improve" as const }], expectedDirection: "improve" as const, addressesLimitingDimension: true, addressesCriticalFinding: true, evidence: [{ code: "PORTFOLIO_RISK_CRITICAL" as const }] },
        risk: { direction: "reduces" as const, risksResolved: [{ riskId: "risk-1", severity: "critical" as const }], risksIntroduced: [], residualRisk: "low" as const },
        diversification: { direction: "improves" as const, affectedExposureTypes: ["market" as const], addressesExistingConcentration: true, introducesNewConcentration: false, evidence: [{ type: "market" as const, key: "austin" }] },
      },
    };
    const result = evaluateCapitalAllocation(engineInput([candidate, hold()]));
    const assessed = result.candidates.find((value) => value.candidate.id.equals(candidate.id))!;
    expect(assessed.priorityClass).toBe("protect");
    expect(assessed.strengths.some((value) => value.code === "ALLOCATION_ADDRESSES_CRITICAL_HEALTH")).toBe(true);
    expect(assessed.tradeOffs.every((value) => value.evidence.length > 0)).toBe(true);
  });

  it("ranks deterministically regardless of candidate order with stable ID tie-breaking and bounded alternatives", () => {
    const values = [acquisition("b", 100_000, 20), acquisition("a", 100_000, 20), hold()];
    const first = evaluateCapitalAllocation(engineInput(values));
    const second = evaluateCapitalAllocation(engineInput([...values].reverse()));
    expect(second.snapshotFingerprint).toBe(first.snapshotFingerprint);
    expect(second.candidates.map((value) => [value.candidate.id.value, value.rank])).toEqual(first.candidates.map((value) => [value.candidate.id.value, value.rank]));
    expect(first.alternateCandidateIds.length).toBeLessThanOrEqual(3);
    expect(fingerprintCapitalAllocation(engineInput(values))).toBe(fingerprintCapitalAllocation(engineInput([...values].reverse())));
  });

  it("rejects duplicate committed candidates and incompatible portfolio health", () => {
    const committed = { ...acquisition("duplicate"), classification: "mandatory" as const, requiredCapital: { ...(acquisition("duplicate").requiredCapital as Extract<ReturnType<typeof acquisition>["requiredCapital"], { status: "known" }>), committed: true } };
    expect(() => evaluateCapitalAllocation(engineInput([committed, { ...committed, sourceVersion: { ...committed.sourceVersion, version: 99 } }]))).toThrow(/DUPLICATE_COMMITMENT/);
    const input = engineInput();
    expect(() => evaluateCapitalAllocation({ ...input, portfolio: { ...input.portfolio, portfolioId: createPortfolioId("portfolio-other") } })).toThrow(/incompatible/);
  });
});
