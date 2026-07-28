import type { InvestmentOpportunityRepository } from "./ports/repository";
import { readImmutableAnalysis } from "./immutable-analysis-projection";

export async function buildOpportunityAnalysisDetailView(repository: InvestmentOpportunityRepository, input: Readonly<{ ownerId: string; opportunityId: string; analysisId: string }>) {
  const projection = await readImmutableAnalysis(repository, { ownerId: input.ownerId, opportunityId: input.opportunityId, analysisVersionId: input.analysisId });
  if (!projection) return null;
  const snapshot = projection.snapshot, version = projection.analysisVersion;
  return Object.freeze({ opportunityId: projection.opportunity.id, id: version.id, sequence: version.number, route: projection.opportunity.route, recommendation: snapshot.recommendation, score: snapshot.score, confidence: snapshot.confidence, financials: snapshot.financials, market: snapshot.market, risks: snapshot.risks, dataGaps: snapshot.dataGaps, evidence: snapshot.evidence, assumptions: projection.assumptions, subject: snapshot.subject, sourceSummary: version.sourceSummary, lineage: version.lineage, policyVersions: version.policyVersions, analyzedAt: snapshot.analyzedAt, projectionVersion: projection.projectionVersion });
}
