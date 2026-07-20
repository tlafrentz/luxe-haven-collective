import type { RevenueReasoningArtifacts } from "../domain/revenue-reasoning-artifacts";
import { summarizeOpportunities } from "../engine/summarizer";
import type { OpportunityReport } from "../domain/opportunity-report";

/** Builds the legacy dashboard report from canonical Recommendations plus feature presentation data. */
export function projectRevenueOpportunityReport(source: OpportunityReport, reasoning: RevenueReasoningArtifacts): OpportunityReport {
  const opportunityIds = new Set(reasoning.recommendations.toArray().map((recommendation) => recommendation.metadata.opportunityId).filter((value): value is string => typeof value === "string"));
  const opportunities = source.opportunities.filter((opportunity) => opportunityIds.has(opportunity.id)).map((opportunity) => ({ ...opportunity, evidence: opportunity.evidence.map((item) => ({ ...item })), action: { ...opportunity.action } }));
  return { opportunities, summary: summarizeOpportunities(opportunities), generatedAt: source.generatedAt };
}
