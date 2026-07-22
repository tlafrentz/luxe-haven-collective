import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AcquisitionType,
  MarketTrend,
  PropertyType,
} from "../domain";
import {
  buildInvestmentAnalysisContext,
  InvestmentAnalysisContextError,
} from "./build-investment-analysis-context";
import {
  runInvestmentAnalysis,
} from "./run-investment-analysis";

import type {
  RunInvestmentAnalysisCommand,
} from "./run-investment-analysis";

import type {
  InvestmentAppliedLearningContext,
  InvestmentAssumptionOverride,
  InvestmentMarketContext,
} from "./types";

function marketContext(options: {
  subjectId?: string;
  saleValue?: number;
  monthlyRent?: number;
  saleUsable?: boolean;
  rentUsable?: boolean;
} = {}): InvestmentMarketContext {
  const saleValue = options.saleValue ?? 425000;
  const monthlyRent = options.monthlyRent ?? 2300;
  return {
    marketAnalysisId: "market-analysis-1",
    subjectId: options.subjectId ?? "property-1",
    status: "available",
    saleValuation: {
      status: options.saleUsable === false ? "insufficient" : "estimated",
      ...(options.saleUsable === false ? {} : { estimatedValue: saleValue, valueRange: { lower: saleValue - 20000, upper: saleValue + 20000 } }),
      comparableCount: 4,
      confidenceScore: 85,
      source: "market-analysis",
    },
    longTermRent: {
      status: options.rentUsable === false ? "insufficient" : "estimated",
      ...(options.rentUsable === false ? {} : { estimatedMonthlyRent: monthlyRent, rentRange: { lower: monthlyRent - 150, upper: monthlyRent + 150 } }),
      comparableCount: 3,
      confidenceScore: 75,
      source: "market-analysis",
    },
    confidence: { score: 80, level: "high", reasons: [] },
    risks: [],
    dataGaps: [],
    evidence: [{ evidenceId: "market-evidence-1", type: "qualified-comparables", description: "Qualified Market evidence.", candidateIds: ["candidate-1"] }],
    lineage: {
      marketAnalysisId: "market-analysis-1",
      propertyResolutionId: "resolution-1",
      policyVersion: "market-v1",
      observationIds: ["market-observation-1"],
      evidenceIds: ["market-evidence-1"],
    },
    analyzedAt: new Date("2026-07-21T12:00:00.000Z"),
  };
}

function purchaseInput(): RunInvestmentAnalysisCommand {
  return {
    acquisitionType: AcquisitionType.Purchase,
    property: {
      id: "property-1",
      address1: "100 Main Street",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
      purchasePrice: 425000,
      closingCosts: 12000,
      furnishingBudget: 25000,
      propertyType: PropertyType.Apartment,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
    },
    financing: {
      downPaymentPercentage: 25,
      interestRatePercentage: 6.5,
      loanTermYears: 30,
    },
    revenue: {
      projectedAdr: 200,
      projectedOccupancyPercentage: 75,
      averageLengthOfStay: 4,
    },
    operating: {
      managementFeePercentage: 10,
      monthlyUtilities: 300,
      annualInsurance: 1800,
      annualTaxes: 4200,
      annualCleaning: 7200,
      annualSoftware: 1200,
      annualSupplies: 1800,
      maintenanceReservePercentage: 5,
      capitalReservePercentage: 3,
    },
    market: {
      name: "Mesa",
      medianAdr: 180,
      medianOccupancyPercentage: 70,
    },
    comparables: [{
      id: "comparable-1",
      distanceMiles: 1,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: { amount: 190, currency: "USD" },
      occupancy: { value: 70 },
      rating: { value: 4.8, max: 5 },
      reviewCount: 100,
      amenities: ["Kitchen"],
    }],
  };
}

function rentalInput(): RunInvestmentAnalysisCommand {
  return {
    acquisitionType: AcquisitionType.RentalArbitrage,
    property: {
      id: "property-1",
      address1: "100 Main Street",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
      furnishingBudget: 15000,
      propertyType: PropertyType.Apartment,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
    },
    lease: {
      monthlyLease: 2200,
      securityDeposit: 2200,
      leaseTermMonths: 12,
      startupCosts: 3000,
      utilitiesIncluded: false,
    },
    revenue: {
      projectedAdr: 200,
      projectedOccupancyPercentage: 75,
      averageLengthOfStay: 4,
    },
    operating: {
      managementFeePercentage: 10,
      monthlyUtilities: 250,
      annualInsurance: 1200,
      annualCleaning: 6000,
      annualSoftware: 600,
      annualSupplies: 1200,
      maintenanceReservePercentage: 3,
      capitalReservePercentage: 2,
    },
    market: {
      name: "Mesa",
      medianAdr: 180,
      medianOccupancyPercentage: 70,
    },
    comparables: [{
      id: "comparable-1",
      distanceMiles: 1,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: { amount: 190, currency: "USD" },
      occupancy: { value: 70 },
      rating: { value: 4.8, max: 5 },
      reviewCount: 100,
      amenities: ["Kitchen"],
    }],
  };
}

function override(
  assumptionKey: string,
  value: number | string | boolean,
  options: Partial<InvestmentAssumptionOverride> = {},
): InvestmentAssumptionOverride {
  return {
    assumptionKey,
    operation: "replace",
    appliedValue: { value },
    applicationId: `application-${assumptionKey}`,
    rationale: `Approved ${assumptionKey}.`,
    ...options,
  };
}

function appliedLearning({
  overrides = [],
  constraints = [],
  resolvedDataGaps = [],
  persistentRisks = [],
}: {
  overrides?: InvestmentAppliedLearningContext["assumptionOverrides"];
  constraints?: InvestmentAppliedLearningContext["constraints"];
  resolvedDataGaps?: InvestmentAppliedLearningContext["resolvedDataGaps"];
  persistentRisks?: InvestmentAppliedLearningContext["persistentRisks"];
} = {}): InvestmentAppliedLearningContext {
  const applicationIds = [...new Set([
    ...overrides.map(({ applicationId }) => applicationId),
    ...constraints.map(({ applicationId }) => applicationId),
    ...persistentRisks.map(({ applicationId }) => applicationId),
  ])].sort();
  return {
    applicationIds,
    assumptionOverrides: overrides,
    constraints,
    resolvedDataGaps,
    persistentRisks,
    lineage: applicationIds.map((applicationId) => ({
      applicationId,
      learningInsightIds: [`learning-${applicationId}`],
      outcomeIds: [`outcome-${applicationId}`],
      investmentRunIds: [`run-${applicationId}`],
      approvalDecisionId: `decision-${applicationId}`,
    })),
  };
}

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof InvestmentAnalysisContextError
      ? error.code
      : undefined;
  }
  return undefined;
}

describe("buildInvestmentAnalysisContext", () => {
  describe("assumption precedence", () => {
    it("applies Market above a legacy/default rental lease while preserving a distinct benchmark", () => {
      const result = buildInvestmentAnalysisContext({
        input: rentalInput(),
        userProvidedAssumptionKeys: [],
        marketContext: marketContext({ monthlyRent: 2300 }),
      });
      expect(result.input.acquisitionType).toBe(AcquisitionType.RentalArbitrage);
      if (result.input.acquisitionType === AcquisitionType.RentalArbitrage) {
        expect(result.input.lease.monthlyLease).toBe(2300);
      }
      expect(result.assumptions).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "monthly-lease", value: 2300, source: "market" }),
        expect.objectContaining({ key: "market-monthly-rent-estimate", value: 2300, source: "market" }),
      ]));
    });

    it("enforces User over Learning over Market over Default", () => {
      const market = marketContext({ monthlyRent: 2300 });
      const user = buildInvestmentAnalysisContext({
        input: rentalInput(), userProvidedAssumptionKeys: ["monthly-lease"], marketContext: market,
        appliedLearning: appliedLearning({ overrides: [override("monthly-lease", 2475)] }),
      });
      const learned = buildInvestmentAnalysisContext({
        input: rentalInput(), userProvidedAssumptionKeys: [], marketContext: market,
        appliedLearning: appliedLearning({ overrides: [override("monthly-lease", 2475)] }),
      });
      expect(user.assumptions.find(({ key }) => key === "monthly-lease")).toMatchObject({ value: 2200, source: "user" });
      expect(learned.assumptions.find(({ key }) => key === "monthly-lease")).toMatchObject({ value: 2475, source: "applied-learning" });
    });

    it("keeps purchase price separate while exposing Market value with source lineage", () => {
      const result = buildInvestmentAnalysisContext({
        input: purchaseInput(), userProvidedAssumptionKeys: ["purchase-price"], marketContext: marketContext({ saleValue: 450000 }),
      });
      expect(result.input.acquisitionType).toBe(AcquisitionType.Purchase);
      if (result.input.acquisitionType === AcquisitionType.Purchase) {
        expect(result.input.property.purchasePrice).toBe(425000);
      }
      expect(result.assumptions.find(({ key }) => key === "market-value")).toMatchObject({
        value: 450000, source: "market", marketAnalysisId: "market-analysis-1", marketEvidenceIds: ["market-evidence-1"],
      });
      expect(result.input.revenue.projectedAdr).toBe(200);
      expect(result.input.revenue.projectedOccupancyPercentage).toBe(75);
    });

    it("ignores unusable Market estimates and rejects a mismatched subject", () => {
      const unusable = buildInvestmentAnalysisContext({
        input: rentalInput(), userProvidedAssumptionKeys: [], marketContext: marketContext({ rentUsable: false }),
      });
      expect(unusable.input.acquisitionType).toBe(AcquisitionType.RentalArbitrage);
      if (unusable.input.acquisitionType === AcquisitionType.RentalArbitrage) expect(unusable.input.lease.monthlyLease).toBe(2200);
      expect(unusable.assumptions.find(({ key }) => key === "monthly-lease")?.source).toBe("system-default");
      expect(unusable.assumptions.some(({ key }) => key === "market-monthly-rent-estimate")).toBe(false);
      expect(errorCode(() => buildInvestmentAnalysisContext({
        input: purchaseInput(), userProvidedAssumptionKeys: [], marketContext: marketContext({ subjectId: "property-2" }),
      }))).toBe("INVESTMENT_ANALYSIS_CONTEXT_LINEAGE_MISMATCH");
    });

    it("keeps an explicit user value ahead of approved Learning", () => {
      const result = buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: ["annual-insurance-premium"],
        appliedLearning: appliedLearning({
          overrides: [override("annual-insurance-premium", 4800)],
        }),
      });
      expect(result.input.operating.annualInsurance).toBe(1800);
      expect(result.assumptions.find(({ key }) => key === "annual-insurance-premium"))
        .toMatchObject({ value: 1800, source: "user" });
    });

    it("applies approved Learning ahead of an unmarked prefilled/default value", () => {
      const result = buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({
          overrides: [override("annual-insurance-premium", 4800)],
        }),
      });
      expect(result.input.operating.annualInsurance).toBe(4800);
      expect(result.assumptions.find(({ key }) => key === "annual-insurance-premium"))
        .toMatchObject({ value: 4800, source: "applied-learning", applicationId: "application-annual-insurance-premium" });
    });

    it("materializes system defaults when neither user nor Learning supplies a value", () => {
      const result = buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
      });
      expect(result.input.revenue.confidencePercentage).toBe(80);
      expect(result.input.market.trend).toBe(MarketTrend.Stable);
      expect(result.assumptions).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "revenue-confidence-percentage", value: 80, source: "system-default" }),
        expect.objectContaining({ key: "market-trend", value: MarketTrend.Stable, source: "system-default" }),
      ]));
    });

    it("applies a numeric adjustment without changing the approved operation", () => {
      const result = buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({
          overrides: [override("monthly-utilities", 50, { operation: "adjust" })],
        }),
      });
      expect(result.input.operating.monthlyUtilities).toBe(350);
      expect(result.assumptions.find(({ key }) => key === "monthly-utilities"))
        .toMatchObject({ value: 350, source: "applied-learning" });
    });

    it("supports route-specific rental assumptions", () => {
      const result = buildInvestmentAnalysisContext({
        input: rentalInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({
          overrides: [override("monthly-lease", 2500)],
        }),
      });
      expect(result.input.acquisitionType).toBe(AcquisitionType.RentalArbitrage);
      if (result.input.acquisitionType === AcquisitionType.RentalArbitrage) {
        expect(result.input.lease.monthlyLease).toBe(2500);
      }
    });

    it("rejects route-incompatible and duplicate user assumption keys", () => {
      expect(errorCode(() => buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: ["monthly-lease"],
      }))).toBe("INVESTMENT_ANALYSIS_CONTEXT_UNSUPPORTED_ASSUMPTION");
      expect(errorCode(() => buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: ["annual-insurance-premium", "annual-insurance-premium"],
      }))).toBe("INVESTMENT_ANALYSIS_CONTEXT_DUPLICATE_USER_KEY");
    });

    it("rejects unknown Learning keys, invalid type replacement, and nonnumeric adjustment", () => {
      expect(errorCode(() => buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({ overrides: [override("unknown", 1)] }),
      }))).toBe("INVESTMENT_ANALYSIS_CONTEXT_UNSUPPORTED_ASSUMPTION");
      expect(errorCode(() => buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({ overrides: [override("annual-insurance-premium", true)] }),
      }))).toBe("INVESTMENT_ANALYSIS_CONTEXT_INVALID_OVERRIDE");
      expect(errorCode(() => buildInvestmentAnalysisContext({
        input: rentalInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({ overrides: [override("utilities-included", true, { operation: "adjust" })] }),
      }))).toBe("INVESTMENT_ANALYSIS_CONTEXT_INVALID_OVERRIDE");
    });
  });

  describe("supporting context", () => {
    it("preserves, deduplicates, and sorts constraints", () => {
      const constraint = { key: "regulation", description: "STR operation is prohibited.", applicationId: "application-regulation" };
      const result = buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({ constraints: [constraint, constraint] }),
      });
      expect(result.constraints).toEqual([constraint]);
    });

    it("rejects conflicting duplicate constraints", () => {
      expect(errorCode(() => buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({ constraints: [
          { key: "regulation", description: "Allowed.", applicationId: "application-regulation" },
          { key: "regulation", description: "Prohibited.", applicationId: "application-regulation" },
        ] }),
      }))).toBe("INVESTMENT_ANALYSIS_CONTEXT_CONFLICT");
    });

    it("propagates resolved gaps without inventing unresolved gaps", () => {
      const result = buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({
          resolvedDataGaps: ["hoa-approval", "hoa-approval", "insurance-quote"],
        }),
      });
      expect(result.resolvedDataGaps).toEqual(["hoa-approval", "insurance-quote"]);
      expect(result.resolvedDataGaps).not.toContain("regulation-data");
    });

    it("carries persistent risks with stable ordering", () => {
      const result = buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({ persistentRisks: [
          { key: "repairs", description: "Repairs were historically understated.", severity: "material", applicationId: "application-repairs" },
          { key: "foundation", description: "Foundation history remains relevant.", severity: "blocking", applicationId: "application-foundation" },
        ] }),
      });
      expect(result.persistentRiskContext.map(({ key }) => key)).toEqual(["foundation", "repairs"]);
    });
  });

  describe("lineage, determinism, and engine independence", () => {
    it("preserves full applied lineage and requires every item to reference it", () => {
      const learning = appliedLearning({
        overrides: [override("annual-insurance-premium", 4800)],
      });
      const result = buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: learning,
      });
      expect(result.lineage).toEqual(learning.lineage);
      expect(errorCode(() => buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: { ...learning, lineage: [] },
      }))).toBe("INVESTMENT_ANALYSIS_CONTEXT_LINEAGE_MISMATCH");
    });

    it("is deterministic regardless of applied context ordering", () => {
      const overrides = [
        override("monthly-utilities", 350),
        override("annual-insurance-premium", 4800),
      ];
      const first = buildInvestmentAnalysisContext({
        input: purchaseInput(), userProvidedAssumptionKeys: [], appliedLearning: appliedLearning({ overrides }),
      });
      const second = buildInvestmentAnalysisContext({
        input: purchaseInput(), userProvidedAssumptionKeys: [], appliedLearning: appliedLearning({ overrides: [...overrides].reverse() }),
      });
      expect(first).toEqual(second);
    });

    it("does not mutate user input or Applied Learning and returns a deeply frozen context", () => {
      const input = purchaseInput();
      const learning = appliedLearning({ overrides: [override("annual-insurance-premium", 4800)] });
      const market = marketContext();
      const inputBefore = structuredClone(input);
      const learningBefore = structuredClone(learning);
      const marketBefore = structuredClone(market);
      const result = buildInvestmentAnalysisContext({ input, userProvidedAssumptionKeys: [], appliedLearning: learning, marketContext: market });
      expect(input).toEqual(inputBefore);
      expect(learning).toEqual(learningBefore);
      expect(market).toEqual(marketBefore);
      expect(Object.isFrozen(market)).toBe(false);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.input.operating)).toBe(true);
      expect(Object.isFrozen(result.lineage[0])).toBe(true);
      expect(Object.isFrozen(result.marketContext)).toBe(true);
    });

    it("produces canonical input that the unchanged analysis engine consumes", () => {
      const baseline = runInvestmentAnalysis(purchaseInput());
      const context = buildInvestmentAnalysisContext({
        input: purchaseInput(),
        userProvidedAssumptionKeys: [],
        appliedLearning: appliedLearning({ overrides: [override("annual-insurance-premium", 4800)] }),
      });
      const learned = runInvestmentAnalysis(context.input);
      expect(learned.analysis.expenseProjection.totalOperatingExpenses.amount)
        .toBeGreaterThan(baseline.analysis.expenseProjection.totalOperatingExpenses.amount);
      expect(context.lineage[0].applicationId).toBe("application-annual-insurance-premium");
    });
  });
});
