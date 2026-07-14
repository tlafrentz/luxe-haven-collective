import type {
  RevenueIntelligence,
} from "@/features/revenue-intelligence";

import type {
  PortfolioChange,
} from "../domain";

export function buildIntelligenceChanges(
  intelligence: RevenueIntelligence,
): PortfolioChange[] {
  return intelligence.opportunityReport.opportunities
    .slice(0, 8)
    .map((opportunity) => {
      const isRisk =
        opportunity.impact?.type ===
          "revenue-at-risk" ||
        opportunity.impact?.type ===
          "operational-risk";

      return {
        id: `intelligence-change-${opportunity.id}`,
        type: isRisk
          ? "risk-detected"
          : "opportunity-detected",
        tone: isRisk
          ? opportunity.severity === "high"
            ? "negative"
            : "warning"
          : "informational",
        pillar:
          opportunity.category === "operations"
            ? "operations"
            : opportunity.category ===
                "distribution"
              ? "growth"
              : "revenue",
        propertyId: opportunity.propertyId,
        title: opportunity.title,
        description: opportunity.summary,
        occurredAt: opportunity.detectedAt,
        value:
          opportunity.impact?.estimatedAmount ??
          opportunity.impact
            ?.estimatedPercentage,
        unit:
          opportunity.impact
            ?.estimatedAmount !== undefined
            ? "currency"
            : opportunity.impact
                  ?.estimatedPercentage !==
                undefined
              ? "percentage"
              : undefined,
        currency:
          opportunity.impact?.currency,
      } satisfies PortfolioChange;
    });
}
