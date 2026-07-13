import {
  OPPORTUNITY_CATEGORIES,
  type OpportunityCategory,
  type OpportunitySeverity,
  type OpportunitySummary,
  type RevenueOpportunity,
} from "../types";

const DEFAULT_CURRENCY = "USD";

function createCategoryCounts(): Record<
  OpportunityCategory,
  number
> {
  return Object.fromEntries(
    OPPORTUNITY_CATEGORIES.map(
      (category) => [category, 0],
    ),
  ) as Record<OpportunityCategory, number>;
}

function createSeverityCounts(): Record<
  OpportunitySeverity,
  number
> {
  return {
    high: 0,
    medium: 0,
    low: 0,
  };
}

function isRevenueImpact(
  opportunity: RevenueOpportunity,
): boolean {
  return (
    opportunity.impact?.type ===
      "revenue-increase" ||
    opportunity.impact?.type ===
      "revenue-at-risk"
  );
}

function resolveCurrency(
  opportunities: RevenueOpportunity[],
): string {
  const currency = opportunities.find(
    (opportunity) =>
      opportunity.impact?.currency,
  )?.impact?.currency;

  return currency ?? DEFAULT_CURRENCY;
}

export function summarizeOpportunities(
  opportunities: RevenueOpportunity[],
): OpportunitySummary {
  const byCategory = createCategoryCounts();
  const bySeverity = createSeverityCounts();

  let estimatedRevenueImpact = 0;

  for (const opportunity of opportunities) {
    byCategory[opportunity.category] += 1;
    bySeverity[opportunity.severity] += 1;

    if (
      isRevenueImpact(opportunity) &&
      typeof opportunity.impact
        ?.estimatedAmount === "number"
    ) {
      estimatedRevenueImpact +=
        opportunity.impact.estimatedAmount;
    }
  }

  return {
    total: opportunities.length,
    highPriority: bySeverity.high,
    mediumPriority: bySeverity.medium,
    lowPriority: bySeverity.low,
    estimatedRevenueImpact:
      Math.round(
        (estimatedRevenueImpact +
          Number.EPSILON) *
          100,
      ) / 100,
    currency: resolveCurrency(opportunities),
    byCategory,
    bySeverity,
  };
}
