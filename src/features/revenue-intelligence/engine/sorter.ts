import type {
  OpportunityConfidence,
  OpportunitySeverity,
  RevenueOpportunity,
} from "../types";

const SEVERITY_RANK: Record<
  OpportunitySeverity,
  number
> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CONFIDENCE_RANK: Record<
  OpportunityConfidence,
  number
> = {
  high: 0,
  medium: 1,
  low: 2,
};

function getEstimatedImpact(
  opportunity: RevenueOpportunity,
): number {
  return (
    opportunity.impact?.estimatedAmount ?? 0
  );
}

export function sortOpportunities(
  opportunities: RevenueOpportunity[],
): RevenueOpportunity[] {
  return [...opportunities].sort(
    (first, second) => {
      const severityDifference =
        SEVERITY_RANK[first.severity] -
        SEVERITY_RANK[second.severity];

      if (severityDifference !== 0) {
        return severityDifference;
      }

      const confidenceDifference =
        CONFIDENCE_RANK[first.confidence] -
        CONFIDENCE_RANK[second.confidence];

      if (confidenceDifference !== 0) {
        return confidenceDifference;
      }

      const impactDifference =
        getEstimatedImpact(second) -
        getEstimatedImpact(first);

      if (impactDifference !== 0) {
        return impactDifference;
      }

      return first.id.localeCompare(second.id);
    },
  );
}
