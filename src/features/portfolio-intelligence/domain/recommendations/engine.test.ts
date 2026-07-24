import { describe, expect, it } from "vitest";
import { Percentage } from "@/platform/kernel";
import { evaluatePortfolioRecommendations, fingerprintPortfolioRecommendations } from "./engine";
import { recommendationInput, recommendationObservation } from "./test-fixtures";

describe("Portfolio recommendation engine", () => {
  it("generates evidence-backed, reversible, confidence-scored recommendations without executing anything", () => {
    const result = evaluatePortfolioRecommendations(recommendationInput({ observations: [recommendationObservation()] }));
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every((item) => item.evidence.length > 0 && item.recommendedAction.reversible && item.rank > 0)).toBe(true);
    expect(result.recommendations.some((item) => item.type === "improve-occupancy" && item.recommendedAction.subject.id === "property-a")).toBe(true);
    expect(result.recommendations.every((item) => !Object.is(item.benefits, item.tradeOffs) && !Object.is(item.constraints, item.tradeOffs))).toBe(true);
  });

  it("maps critical risk, capital shortfall, concentration, and missing strategy through stable rules", () => {
    const input = recommendationInput();
    const risk = Object.freeze({
      code: "PORTFOLIO_RISK_CRITICAL" as const, dimension: "risk" as const, severity: "critical" as const,
      subject: "portfolio" as const, evidence: Object.freeze([{ kind: "risk" as const, referenceId: "risk-critical" }]), resolvable: true,
    });
    const concentration = Object.freeze({
      code: "PORTFOLIO_MARKET_CONCENTRATED" as const, dimension: "diversification" as const, severity: "high" as const,
      subject: "market" as const, subjectId: "austin", evidence: Object.freeze([{ kind: "calculation" as const, referenceId: "market-hhi" }]), resolvable: true,
    });
    const health = { ...input.health, risks: [risk, concentration], capitalAssessment: { ...input.health.capitalAssessment, unfundedCommitment: input.health.capitalAssessment.available } };
    const result = evaluatePortfolioRecommendations(recommendationInput({ health, strategy: { available: true, defined: false, goals: [], version: 0 } }));
    expect(result.recommendations.map((item) => [item.type, item.priority])).toEqual(expect.arrayContaining([
      ["resolve-portfolio-risk", "critical"],
      ["resolve-capital-shortfall", "critical"],
      ["address-concentration", "high"],
      ["reevaluate-strategy", "medium"],
    ]));
    expect(result.posture).toBe("protect");
  });

  it("suppresses duplicate recommendations by normalized type and subject while merging references", () => {
    const input = recommendationInput();
    const duplicateGap = { code: "PORTFOLIO_PROPERTY_DATA_INCOMPLETE" as const, dimension: "data-quality" as const, subjectType: "property" as const, subjectId: "property-a", impact: "material" as const, missingFields: ["noi"], confidencePenalty: Percentage.create(10) };
    const health = { ...input.health, dataGaps: [duplicateGap, { ...duplicateGap, missingFields: ["revenue"] }] };
    const result = evaluatePortfolioRecommendations(recommendationInput({ health }));
    const matches = result.recommendations.filter((item) => item.type === "collect-missing-data" && item.recommendedAction.subject.id === "property-a");
    expect(matches).toHaveLength(1);
    expect(result.suppressed).toContainEqual(expect.objectContaining({ sourceCount: 2 }));
    expect(matches[0].evidence).toHaveLength(1);
  });

  it("represents growth-versus-liquidity conflicts explicitly", () => {
    const input = recommendationInput();
    const allocation = { ...input.allocation, recommendedPosture: "preserve-liquidity" as const };
    const result = evaluatePortfolioRecommendations(recommendationInput({ allocation }));
    const acquire = result.recommendations.find((item) => item.category === "acquire");
    const preserve = result.recommendations.find((item) => item.category === "preserve");
    expect(acquire).toBeDefined();
    expect(preserve).toBeDefined();
    expect(result.conflicts).toContainEqual(expect.objectContaining({ code: "PORTFOLIO_RECOMMENDATION_GROWTH_LIQUIDITY_CONFLICT" }));
    expect(acquire?.conflictIds.some((id) => id.equals(preserve!.id))).toBe(true);
  });

  it("does not invent recommendations from unknown observations and penalizes stale recognized evidence", () => {
    const unknown = evaluatePortfolioRecommendations(recommendationInput({ observations: [recommendationObservation({ code: "UNSUPPORTED_SIGNAL" })] }));
    expect(unknown.recommendations.some((item) => item.supportingFindingCodes.includes("UNSUPPORTED_SIGNAL"))).toBe(false);
    const current = evaluatePortfolioRecommendations(recommendationInput({ observations: [recommendationObservation()] }));
    const stale = evaluatePortfolioRecommendations(recommendationInput({ observations: [recommendationObservation({ observedAt: new Date("2020-01-01") })] }));
    expect(stale.recommendations.find((item) => item.type === "improve-occupancy")!.confidence.score.value).toBeLessThan(current.recommendations.find((item) => item.type === "improve-occupancy")!.confidence.score.value);
    expect(stale.recommendations.find((item) => item.type === "improve-occupancy")!.constraints).toContain("stale-data");
  });

  it("uses an explicit strategy-misalignment finding rather than interpreting strategy text", () => {
    const input = recommendationInput();
    const misalignment = Object.freeze({
      code: "PORTFOLIO_STRATEGY_MISALIGNED" as const, dimension: "strategic-alignment" as const, severity: "high" as const,
      subject: "portfolio" as const, evidence: Object.freeze([{ kind: "objective" as const, referenceId: "objective-market" }]), resolvable: true,
    });
    const result = evaluatePortfolioRecommendations(recommendationInput({ health: { ...input.health, risks: [...input.health.risks, misalignment] } }));
    expect(result.recommendations).toContainEqual(expect.objectContaining({ type: "reevaluate-strategy", supportingFindingCodes: ["PORTFOLIO_STRATEGY_MISALIGNED"] }));
  });

  it("is deterministic and independent of observation order", () => {
    const observations = [
      recommendationObservation(),
      recommendationObservation({ kind: "market-observation", observationId: "observation-market", code: "MARKET_CONCENTRATION_HIGH", subjectType: "market", subjectId: "austin" }),
    ];
    const firstInput = recommendationInput({ observations });
    const secondInput = recommendationInput({ observations: [...observations].reverse() });
    const first = evaluatePortfolioRecommendations(firstInput);
    const second = evaluatePortfolioRecommendations(secondInput);
    expect(second.snapshotFingerprint).toBe(first.snapshotFingerprint);
    expect(second.recommendations.map((item) => [item.id.value, item.rank])).toEqual(first.recommendations.map((item) => [item.id.value, item.rank]));
    expect(fingerprintPortfolioRecommendations(firstInput)).toBe(fingerprintPortfolioRecommendations(secondInput));
  });

  it("rejects stale or incompatible assessment lineage", () => {
    const input = recommendationInput();
    expect(() => evaluatePortfolioRecommendations({ ...input, portfolioVersion: 99 })).toThrow(/stale/);
    expect(() => evaluatePortfolioRecommendations({ ...input, allocation: { ...input.allocation, healthPolicyVersion: "portfolio-health-99" } })).toThrow(/incompatible/);
  });
});
