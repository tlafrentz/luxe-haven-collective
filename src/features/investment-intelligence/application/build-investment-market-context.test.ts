import { describe, expect, it } from "vitest";

import type { MarketAnalysisReport } from "@/features/market-intelligence";

import {
  assessInvestmentMarketEvidenceUsability,
  buildInvestmentMarketContext,
  InvestmentMarketContextError,
} from "./build-investment-market-context";

function report(overrides: Partial<MarketAnalysisReport> = {}): MarketAnalysisReport {
  const value = {
    analysisId: "market-analysis-1",
    subject: { id: "property-1" },
    status: "complete",
    saleValuation: {
      status: "estimated",
      estimatedValue: 425000,
      valueRange: { lower: 405000, upper: 445000 },
      qualification: { included: [{}, {}, {}, {}] },
      confidence: { score: 88, level: "high", reasons: ["Strong sale coverage."] },
      risks: [],
      dataGaps: [],
    },
    longTermRent: {
      status: "limited",
      estimatedMonthlyRent: 2650,
      rentRange: { lower: 2450, upper: 2800 },
      qualification: { included: [{}, {}, {}] },
      confidence: { score: 58, level: "medium", reasons: ["Limited rental coverage."] },
      risks: [],
      dataGaps: [],
    },
    confidence: { score: 76, level: "medium", reasons: ["Rental evidence is limited."] },
    risks: [{
      code: "RENTAL_EVIDENCE_LIMITED",
      severity: "medium",
      title: "Rental evidence limited",
      description: "Only three rentals qualified.",
      evidenceIds: ["evidence-rent"],
      dataGapIds: ["gap-rent"],
    }],
    dataGaps: [{
      id: "gap-rent",
      code: "LONG_TERM_RENT_EVIDENCE_LIMITED",
      description: "Rental evidence is limited.",
      severity: "material",
      sourceStage: "comparable-qualification",
      section: "long-term-rent",
    }],
    observations: [{ id: "observation-value", type: "value", label: "Value", value: 425000, sourceIds: ["evidence-sale"] }],
    evidence: [
      { id: "evidence-sale", type: "sale-comparables", description: "Qualified sales.", candidateIds: ["sale-2", "sale-1"] },
      { id: "evidence-rent", type: "rental-comparables", description: "Qualified rentals.", candidateIds: ["rent-1"] },
    ],
    summary: {
      estimatedValue: 425000,
      estimatedMonthlyRent: 2650,
      confidenceScore: 76,
      confidenceLevel: "medium",
      saleComparableCount: 4,
      rentalComparableCount: 3,
      riskCount: 1,
      dataGapCount: 1,
      headline: "Market evidence is available.",
      explanation: "Sale evidence is strong and rental evidence is limited.",
    },
    lineage: {
      propertyResolutionId: "resolution-1",
      sale: { acquisitionId: "sale-acquisition-1", qualificationId: "sale-qualification-1", includedCandidateIds: ["sale-1", "sale-2"] },
      longTermRent: { acquisitionId: "rent-acquisition-1", qualificationId: "rent-qualification-1", includedCandidateIds: ["rent-1"] },
      observationIds: ["observation-value"],
      evidenceIds: ["evidence-rent", "evidence-sale"],
      policyVersion: "market-policy-v1",
    },
    analyzedAt: new Date("2026-07-21T12:00:00.000Z"),
    ...overrides,
  };
  return value as unknown as MarketAnalysisReport;
}

function errorCode(run: () => unknown): string | undefined {
  try { run(); } catch (error) {
    return error instanceof InvestmentMarketContextError ? error.code : undefined;
  }
  return undefined;
}

describe("buildInvestmentMarketContext", () => {
  it("projects exact sale and rent conclusions without recalculation", () => {
    const result = buildInvestmentMarketContext(report());
    expect(result.saleValuation).toMatchObject({ estimatedValue: 425000, valueRange: { lower: 405000, upper: 445000 }, comparableCount: 4 });
    expect(result.longTermRent).toMatchObject({ estimatedMonthlyRent: 2650, rentRange: { lower: 2450, upper: 2800 }, comparableCount: 3 });
  });

  it.each([
    ["complete", "available"],
    ["partial", "limited"],
    ["insufficient", "insufficient"],
    ["unsupported", "unsupported"],
  ] as const)("maps %s report status to %s", (source, expected) => {
    expect(buildInvestmentMarketContext(report({ status: source })).status).toBe(expected);
  });

  it("preserves confidence, risks, gaps, evidence, and full Market lineage", () => {
    const result = buildInvestmentMarketContext(report());
    expect(result.confidence).toEqual({ score: 76, level: "medium", reasons: ["Rental evidence is limited."] });
    expect(result.risks[0]).toMatchObject({ marketRiskCode: "RENTAL_EVIDENCE_LIMITED", marketAnalysisId: "market-analysis-1" });
    expect(result.dataGaps[0]).toMatchObject({ affectedInvestmentAssumptionKeys: ["monthly-lease"], sourceMarketAnalysisId: "market-analysis-1" });
    expect(result.evidence[0].candidateIds).toEqual(["rent-1"]);
    expect(result.lineage).toMatchObject({ propertyResolutionId: "resolution-1", saleQualificationId: "sale-qualification-1", rentalQualificationId: "rent-qualification-1" });
  });

  it("does not manufacture absent or unsupported estimates", () => {
    const source = report({ saleValuation: undefined, longTermRent: undefined, status: "unsupported" });
    const result = buildInvestmentMarketContext(source);
    expect(result.saleValuation).toBeUndefined();
    expect(result.longTermRent).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/adr|occupancy|revenue/i);
  });

  it("classifies strong, limited, and unavailable evidence explicitly", () => {
    const usability = assessInvestmentMarketEvidenceUsability(buildInvestmentMarketContext(report()));
    expect(usability.saleValuation).toBe("usable");
    expect(usability.longTermRent).toBe("usable-with-caution");
    const unavailable = assessInvestmentMarketEvidenceUsability(buildInvestmentMarketContext(report({ saleValuation: undefined, longTermRent: undefined })));
    expect(unavailable).toMatchObject({ saleValuation: "unusable", longTermRent: "unusable" });
  });

  it("makes a blocking section gap render its estimate unusable", () => {
    const source = report({ risks: [], dataGaps: [{
      id: "gap-blocking", code: "SALE_BLOCKED", description: "Sale evidence blocked.", severity: "blocking",
      sourceStage: "valuation", section: "sale-valuation",
    }] });
    const context = buildInvestmentMarketContext(source);
    expect(assessInvestmentMarketEvidenceUsability(context).saleValuation).toBe("unusable");
  });

  it("rejects invalid identity and dangling lineage", () => {
    expect(errorCode(() => buildInvestmentMarketContext(report({ analysisId: "" })))).toBe("INVESTMENT_MARKET_CONTEXT_INVALID_REPORT");
    expect(errorCode(() => buildInvestmentMarketContext(report({
      lineage: { ...report().lineage, evidenceIds: ["missing-evidence"] },
    })))).toBe("INVESTMENT_MARKET_CONTEXT_INVALID_LINEAGE");
  });

  it("is deterministic, deeply frozen, and leaves the report unchanged", () => {
    const source = report();
    const before = structuredClone(source);
    const first = buildInvestmentMarketContext(source);
    const second = buildInvestmentMarketContext(source);
    expect(second).toEqual(first);
    expect(source).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.saleValuation?.valueRange)).toBe(true);
  });
});
