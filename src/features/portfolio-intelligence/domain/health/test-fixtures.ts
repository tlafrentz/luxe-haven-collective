import { createPortfolioId, Money, Percentage } from "@/features/portfolio";
import { createObservationId } from "@/platform/observations";
import { ConfidenceAssessment, ConfidenceScore } from "@/platform/scoring";

import type { PortfolioHealthSnapshot, PortfolioMetricObservation, PortfolioObservationWindow } from "./contracts";

export const evaluatedAt = new Date("2026-07-23T12:00:00.000Z");
export const window: PortfolioObservationWindow = Object.freeze({
  start: new Date("2026-06-01T00:00:00.000Z"),
  end: new Date("2026-07-01T00:00:00.000Z"),
});
export const strongConfidence = ConfidenceAssessment.create({ score: ConfidenceScore.create(90), rationale: ["Verified source."] });
export function metric(id: string, value: number, extra: Partial<PortfolioMetricObservation> = {}): PortfolioMetricObservation {
  return Object.freeze({
    observationId: createObservationId(id),
    value,
    currency: "USD",
    window,
    confidence: strongConfidence,
    provenance: "verified",
    observedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...extra,
  });
}
export function healthSnapshot(): PortfolioHealthSnapshot {
  const properties = [
    {
      propertyId: "property-a", membershipStatus: "active" as const, marketKey: "austin", geographicKey: "texas", propertyType: "single-family", operatingModel: "self",
      capitalBasis: Money.usd(500_000), revenue: metric("observation-revenue-a", 60_000), netOperatingIncome: metric("observation-noi-a", 18_000),
      occupancy: metric("observation-occupancy-a", 80, { numerator: 240, denominator: 300 }), adr: metric("observation-adr-a", 200, { numerator: 48_000, denominator: 240 }),
      riskLevel: "low" as const, dataCompleteness: Percentage.create(100), updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
    {
      propertyId: "property-b", membershipStatus: "active" as const, marketKey: "nashville", geographicKey: "tennessee", propertyType: "condo", operatingModel: "partner",
      capitalBasis: Money.usd(400_000), revenue: metric("observation-revenue-b", 40_000), netOperatingIncome: metric("observation-noi-b", 12_000),
      occupancy: metric("observation-occupancy-b", 60, { numerator: 120, denominator: 200 }), adr: metric("observation-adr-b", 150, { numerator: 18_000, denominator: 120 }),
      riskLevel: "moderate" as const, dataCompleteness: Percentage.create(90), updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    },
  ];
  return Object.freeze({
    portfolio: Object.freeze({ portfolioId: createPortfolioId("portfolio-health-test"), portfolioVersion: 7, reportingCurrency: "USD" as const, name: "Health Test" }),
    properties: Object.freeze(properties),
    opportunities: Object.freeze([]),
    capital: Object.freeze({ available: Money.usd(300_000), reserved: Money.usd(100_000), committed: Money.usd(100_000), allocated: Money.usd(50_000), futureRequirements: Money.usd(50_000), capturedAt: new Date("2026-07-22T00:00:00.000Z") }),
    exposures: Object.freeze([
      Object.freeze({ type: "market" as const, key: "austin", share: Percentage.create(60), basis: "revenue" as const }),
      Object.freeze({ type: "market" as const, key: "nashville", share: Percentage.create(40), basis: "revenue" as const }),
      Object.freeze({ type: "property-type" as const, key: "single-family", share: Percentage.create(60), basis: "revenue" as const }),
      Object.freeze({ type: "property-type" as const, key: "condo", share: Percentage.create(40), basis: "revenue" as const }),
    ]),
    risks: Object.freeze([]),
    strategy: Object.freeze({
      strategyKind: "balanced",
      objectives: Object.freeze([
        Object.freeze({ objectiveId: "objective-market", type: "maximum-market-concentration" as const, targetNumber: 65, priority: "high" as const }),
        Object.freeze({ objectiveId: "objective-size", type: "portfolio-size" as const, targetNumber: 2, priority: "normal" as const }),
      ]),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    }),
    observations: Object.freeze(properties.flatMap((property) => [property.revenue, property.netOperatingIncome]).map((observation) => Object.freeze({
      observationId: observation.observationId, type: "financial", subjectId: observation.observationId.value, observedAt: observation.observedAt, confidence: observation.confidence, provenance: observation.provenance,
    }))),
    dataCoverage: Object.freeze({
      expectedPropertyCount: 2, coveredPropertyCount: 2, expectedMetricCount: 4, availableMetricCount: 4,
      sourceAvailable: Object.freeze({ performance: true, capital: true, exposure: true, risk: true, strategy: true }),
    }),
    capturedAt: new Date("2026-07-23T11:00:00.000Z"),
  });
}
