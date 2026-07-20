/**
 * Compatibility read model for existing Revenue dashboards and downstream aggregators.
 * It recombines canonical lifecycle stages and contains no lifecycle behavior.
 */
export const OPPORTUNITY_CATEGORIES = ["pricing", "occupancy", "revenue", "distribution", "operations"] as const;
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];
export const OPPORTUNITY_TYPES = ["underpriced-weekend", "high-demand-period", "low-demand-period", "gap-night", "low-weekday-occupancy", "low-upcoming-occupancy", "booking-pace-behind", "minimum-stay-friction", "long-stay-opportunity", "elevated-cancellation-rate", "source-concentration", "uncaptured-payment", "unpaid-reservation"] as const;
export type RevenueOpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export type OpportunitySeverity = "high" | "medium" | "low";
export type OpportunityConfidence = "high" | "medium" | "low";
/** @deprecated Canonical status is represented by Recommendation, Decision, Action, and Outcome. */
export type OpportunityStatus = "open" | "dismissed" | "accepted" | "resolved";
export type OpportunityDateRange = { startDate: string; endDate: string };
export type OpportunityEvidenceValue = string | number | boolean | null;
/** @deprecated Canonical detector support is Platform Evidence. */
export type OpportunityEvidence = { key: string; label: string; value: OpportunityEvidenceValue; unit?: "currency" | "percentage" | "days" | "nights" | "count" };
export type OpportunityImpact = { type: "revenue-increase" | "revenue-at-risk" | "occupancy-increase" | "cost-reduction" | "operational-risk"; estimatedAmount?: number; estimatedPercentage?: number; currency?: string; basis: string };
export type OpportunityActionType = "increase-rate" | "decrease-rate" | "apply-discount" | "change-minimum-stay" | "open-calendar" | "promote-availability" | "review-payment" | "review-cancellation-policy" | "diversify-booking-sources" | "monitor";
/** @deprecated Proposed work is represented canonically by Recommendation, then Action after Decision. */
export type OpportunityAction = { type: OpportunityActionType; summary: string; parameters?: Record<string, string | number | boolean | null> };
/** @deprecated Projection only; not an authoritative lifecycle entity. */
export type RevenueOpportunity = { id: string; detectorId: string; type: RevenueOpportunityType; category: OpportunityCategory; severity: OpportunitySeverity; confidence: OpportunityConfidence; status: OpportunityStatus; propertyId: string | null; dateRange?: OpportunityDateRange; detectedAt: string; title: string; summary: string; evidence: OpportunityEvidence[]; impact?: OpportunityImpact; action: OpportunityAction };
