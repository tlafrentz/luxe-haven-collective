import { describe, expect, it } from "vitest";

import { AcquisitionType, MarketTrend, PropertyType } from "../../domain";
import { buildInvestmentReport } from "../../services";
import { buildInvestmentWorkspaceView } from "./investment-workspace-adapter";
import { commitInvestmentRecommendation } from "./investment-commitment-adapter";
import { recordInvestmentOutcome } from "./investment-outcome-adapter";

function platformAnalysis(source: ReturnType<typeof projection>) {
  const platform = buildInvestmentWorkspaceView(source).platform;
  if (!platform) throw new Error("Purchase workspace must expose Platform analysis.");
  return platform;
}

function projection() {
  return buildInvestmentReport({
    acquisitionType: AcquisitionType.Purchase,
    property: {
      id: "investment-platform-test",
      address1: "123 Main Street",
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
    financing: { downPaymentPercentage: 25, interestRatePercentage: 6.5, loanTermYears: 30 },
    revenue: { projectedAdr: 200, projectedOccupancyPercentage: 75, averageLengthOfStay: 4, confidencePercentage: 80 },
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
    market: { name: "Mesa", submarket: "Downtown", medianAdr: 180, medianOccupancyPercentage: 70, trend: MarketTrend.Stable },
    comparables: [{
      id: "comparable-1",
      distanceMiles: 0.8,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: { amount: 180, currency: "USD" },
      occupancy: { value: 70 },
      rating: { value: 4.8, max: 5 },
      reviewCount: 100,
      amenities: ["Kitchen", "Parking"],
    }],
  });
}

describe("Investment Platform adapters", () => {
  it("preserves the workspace projection while emitting canonical reasoning artifacts and scores", () => {
    const source = projection();
    const view = buildInvestmentWorkspaceView(source, new Date("2026-01-01T00:00:00Z"));
    if (!view.platform) throw new Error("Purchase workspace must expose Platform analysis.");

    expect(view.projection).toBe(source);
    expect(view.platform.observations.size).toBeGreaterThan(0);
    expect(view.platform.evidence.size).toBe(source.supportingEvidence.length);
    expect(view.platform.claims.size).toBeGreaterThan(0);
    expect(view.platform.evaluations.size).toBe(view.platform.claims.size);
    expect(view.platform.recommendations.size).toBe(1);
    expect(view.platform.scores.overall.value).toBe(source.score.overall.value);
  });

  it("does not create Actions until a recommendation is explicitly accepted", () => {
    const source = projection();
    const analysis = platformAnalysis(source);
    const rejected = commitInvestmentRecommendation({ projection: source, analysis, outcome: "rejected" });
    const accepted = commitInvestmentRecommendation({ projection: source, analysis, outcome: "accepted" });

    expect(rejected.actions.size).toBe(0);
    expect(accepted.actions.size).toBe(source.strategy.firstNinetyDayPriorities.length);
    expect(accepted.actions.toArray().every((action) => action.originatesFrom(accepted.decision))).toBe(true);
  });

  it("records execution truth as an Outcome with complete investment lineage", () => {
    const source = projection();
    const analysis = platformAnalysis(source);
    const commitment = commitInvestmentRecommendation({ projection: source, analysis, outcome: "accepted", decidedAt: new Date("2026-01-01T00:00:00Z") });
    const action = commitment.actions.toArray()[0]
      .accept(new Date("2026-01-02T00:00:00Z"))
      .start(new Date("2026-01-03T00:00:00Z"))
      .complete(new Date("2026-01-04T00:00:00Z"), { summary: "Diligence completed.", successful: true });
    const measured = recordInvestmentOutcome({
      projection: source,
      analysis,
      commitment,
      completedAction: action,
      successful: true,
      startedAt: new Date("2026-01-03T00:00:00Z"),
      completedAt: new Date("2026-01-04T00:00:00Z"),
      metrics: { diligenceItemsCompleted: 1 },
    });

    expect(measured.outcome.traces(action.id)).toBe(true);
    expect(measured.outcome.traces(commitment.decision.id)).toBe(true);
    expect(measured.outcome.lineage.recommendationIds).toEqual([commitment.recommendation.id]);
    expect(measured.intelligence.insights.length).toBe(source.risks.length);
    expect(measured.intelligence.opportunities).toHaveLength(1);
  });
});
