import type { InvestmentOpportunityRoute, OpportunityAnalysisId } from "@/features/investment-opportunity/domain";
import type { AcquisitionOfferTerms } from "../offers/acquisition-offer-terms";
import type { OfferSourceAnalysisReference } from "../offers/acquisition-offer";

export type AcquisitionAnalysisCommercialBasis = Readonly<{ analysisId: OpportunityAnalysisId; version: number; route: InvestmentOpportunityRoute; evaluatedAt: Date; acquisitionTerms: Readonly<Record<string, unknown>> }>;
export type OfferAnalysisAlignmentStatus = "aligned" | "materially-changed" | "analysis-stale" | "analysis-missing";
export type OfferAnalysisAlignment = Readonly<{ status: OfferAnalysisAlignmentStatus; differences: readonly string[] }>;
export type OfferAnalysisMaterialityPolicy = Readonly<{ moneyDifference?: number; dateDifferenceDays?: number }>;
export function assessOfferAnalysisAlignment(source: OfferSourceAnalysisReference | undefined, offerTerms: AcquisitionOfferTerms, current: AcquisitionAnalysisCommercialBasis | undefined, policy: OfferAnalysisMaterialityPolicy = {}): OfferAnalysisAlignment {
  if (!source || !current) return Object.freeze({ status: "analysis-missing", differences: Object.freeze(["analysis-reference-missing"]) });
  if (source.route !== current.route) return Object.freeze({ status: "materially-changed", differences: Object.freeze(["route"]) });
  const differences: string[] = [];
  const basis = current.acquisitionTerms;
  if (offerTerms.route === "purchase" && typeof basis.purchasePrice === "number" && Math.abs(offerTerms.offerPrice.amount - basis.purchasePrice) > (policy.moneyDifference ?? 0)) differences.push("purchase-price");
  if (offerTerms.route === "rental-arbitrage" && typeof basis.monthlyRent === "number" && Math.abs(offerTerms.proposedMonthlyRent.amount - basis.monthlyRent) > (policy.moneyDifference ?? 0)) differences.push("monthly-rent");
  if (current.version !== source.analysisVersion || current.analysisId.value !== source.analysisId.value) return Object.freeze({ status: "analysis-stale", differences: Object.freeze(differences.length ? differences : ["source-analysis-version"]) });
  return Object.freeze({ status: differences.length ? "materially-changed" : "aligned", differences: Object.freeze(differences) });
}
