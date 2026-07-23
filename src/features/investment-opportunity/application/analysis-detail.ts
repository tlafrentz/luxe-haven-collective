import type { InvestmentOpportunityRepository } from "./ports/repository";
import { createInvestmentOpportunityId, createOpportunityAnalysisId, createOpportunityOwnerId } from "../domain";

export async function buildOpportunityAnalysisDetailView(repository: InvestmentOpportunityRepository, input: Readonly<{ ownerId: string; opportunityId: string; analysisId: string }>) {
  const analysis = await repository.findAnalysisById(createInvestmentOpportunityId(input.opportunityId), createOpportunityAnalysisId(input.analysisId), createOpportunityOwnerId(input.ownerId)); if (!analysis) return null; const props = analysis.props, snapshot = props.resultSnapshot;
  return Object.freeze({ opportunityId: input.opportunityId, id: props.id.value, sequence: props.sequence, route: props.route, recommendation: snapshot.recommendation, score: snapshot.score, confidence: snapshot.confidence, financials: snapshot.financials, market: snapshot.market, risks: snapshot.risks, dataGaps: snapshot.dataGaps, evidence: snapshot.evidence, sourceSummary: props.sourceSummary, lineage: props.lineage, policyVersions: props.policyVersions, analyzedAt: snapshot.analyzedAt });
}
