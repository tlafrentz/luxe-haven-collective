import type {
  OpportunityCategory,
  RevenueIntelligence,
  RevenueOpportunity,
} from "@/features/revenue-intelligence";

import type {
  HpmPillar,
} from "@/features/hpm";

import type {
  ExecutivePriority,
} from "../domain";

function mapCategoryToPillar(
  category: OpportunityCategory,
): HpmPillar {
  switch (category) {
    case "operations":
      return "operations";

    case "distribution":
      return "growth";

    case "pricing":
    case "occupancy":
    case "revenue":
    default:
      return "revenue";
  }
}

function getRationale(
  opportunity: RevenueOpportunity,
): string {
  const evidence = opportunity.evidence
    .slice(0, 3)
    .map(
      (item) =>
        `${item.label}: ${String(item.value)}`,
    )
    .join(" · ");

  return evidence.length > 0
    ? evidence
    : opportunity.impact?.basis ??
        opportunity.summary;
}

function getRankScore(
  opportunity: RevenueOpportunity,
): number {
  const severityWeight = {
    high: 300,
    medium: 200,
    low: 100,
  }[opportunity.severity];

  const confidenceWeight = {
    high: 30,
    medium: 20,
    low: 10,
  }[opportunity.confidence];

  const amountWeight =
    opportunity.impact?.estimatedAmount ?? 0;

  return (
    severityWeight +
    confidenceWeight +
    amountWeight
  );
}

export function buildExecutivePriorities(
  intelligence: RevenueIntelligence,
): ExecutivePriority[] {
  return intelligence.opportunityReport
    .opportunities
    .filter(
      (opportunity) =>
        opportunity.status === "open",
    )
    .sort(
      (left, right) =>
        getRankScore(right) -
        getRankScore(left),
    )
    .slice(0, 5)
    .map((opportunity, index) => ({
      id: `executive-priority-${opportunity.id}`,
      rank: index + 1,
      source: "revenue-intelligence",
      sourceId: opportunity.id,
      pillar: mapCategoryToPillar(
        opportunity.category,
      ),
      propertyId: opportunity.propertyId,
      status: "open",
      severity: opportunity.severity,
      confidence: opportunity.confidence,
      title: opportunity.title,
      summary: opportunity.summary,
      rationale:
        getRationale(opportunity),
      impact: opportunity.impact
        ? {
            type: opportunity.impact.type,
            estimatedAmount:
              opportunity.impact
                .estimatedAmount,
            estimatedPercentage:
              opportunity.impact
                .estimatedPercentage,
            currency:
              opportunity.impact.currency,
            basis:
              opportunity.impact.basis,
          }
        : undefined,
      action: opportunity.action,
      detectedAt: opportunity.detectedAt,
    }));
}
