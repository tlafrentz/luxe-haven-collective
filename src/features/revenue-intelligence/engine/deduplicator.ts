import type {
  RevenueOpportunity,
} from "../types";

export function deduplicateOpportunities(
  opportunities: RevenueOpportunity[],
): RevenueOpportunity[] {
  const opportunitiesById = new Map<
    string,
    RevenueOpportunity
  >();

  for (const opportunity of opportunities) {
    if (!opportunitiesById.has(opportunity.id)) {
      opportunitiesById.set(
        opportunity.id,
        opportunity,
      );
    }
  }

  return [...opportunitiesById.values()];
}
