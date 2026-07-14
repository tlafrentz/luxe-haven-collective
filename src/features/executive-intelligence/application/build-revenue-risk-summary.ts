import type {
  RevenueIntelligence,
} from "@/features/revenue-intelligence";

import type {
  RevenueRiskSummary,
} from "../domain";

export function buildRevenueRiskSummary(
  intelligence: RevenueIntelligence,
): RevenueRiskSummary {
  const items =
    intelligence.opportunityReport.opportunities
      .filter(
        (opportunity) =>
          opportunity.impact?.type ===
            "revenue-at-risk" &&
          typeof opportunity.impact
            .estimatedAmount === "number",
      )
      .map((opportunity) => ({
        id: opportunity.id,
        pillar: "revenue" as const,
        propertyId: opportunity.propertyId,
        title: opportunity.title,
        summary: opportunity.summary,
        estimatedAmount:
          opportunity.impact
            ?.estimatedAmount ?? 0,
        currency:
          opportunity.impact?.currency ??
          intelligence.opportunityReport
            .summary.currency,
        confidence: opportunity.confidence,
        detectedAt: opportunity.detectedAt,
      }))
      .sort(
        (left, right) =>
          right.estimatedAmount -
          left.estimatedAmount,
      );

  const currency =
    items[0]?.currency ??
    intelligence.opportunityReport.summary
      .currency;

  return {
    totalEstimatedAmount: items.reduce(
      (total, item) =>
        total + item.estimatedAmount,
      0,
    ),
    currency,
    itemCount: items.length,
    items,
  };
}
