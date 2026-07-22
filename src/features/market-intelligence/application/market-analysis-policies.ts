import type { MarketAnalysisPolicies } from "../domain/canonical-market-analysis-report";
import { buildDefaultMarketComparableQualificationPolicy } from "./market-comparable-qualification-policy";

export function buildDefaultMarketAnalysisPolicies(propertyType?: string): MarketAnalysisPolicies {
  const allowed = propertyType ? [propertyType] : [];
  return deepFreeze({ saleQualification: buildDefaultMarketComparableQualificationPolicy("sale-valuation", allowed), longTermRentQualification: buildDefaultMarketComparableQualificationPolicy("long-term-rent", allowed), saleEstimation: { minimumEstimateComparables: 1, lowPercentile: 0.25, highPercentile: 0.75 }, longTermRentEstimation: { minimumEstimateComparables: 1, lowPercentile: 0.25, highPercentile: 0.75 }, version: "market-analysis-v1" });
}
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
