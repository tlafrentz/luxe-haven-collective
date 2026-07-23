import type { InvestmentOpportunity, InvestmentOpportunityId, InvestmentOpportunityRoute, OpportunityAnalysis, OpportunityAnalysisId, OpportunityOwnerId, OpportunityStatus } from "../../domain";

export type OpportunityAggregateVersion = number;
export type InvestmentOpportunityRepositoryQuery = Readonly<{ ownerId: OpportunityOwnerId; statuses?: readonly OpportunityStatus[]; includeArchived?: boolean; route?: InvestmentOpportunityRoute; limit?: number; cursor?: string }>;
export type InvestmentOpportunityPage = Readonly<{ items: readonly InvestmentOpportunity[]; nextCursor?: string }>;
export interface InvestmentOpportunityRepository {
  findById(id: InvestmentOpportunityId, ownerId: OpportunityOwnerId): Promise<InvestmentOpportunity | null>;
  save(opportunity: InvestmentOpportunity, expectedVersion?: OpportunityAggregateVersion, idempotencyKey?: string): Promise<void>;
  list(query: InvestmentOpportunityRepositoryQuery): Promise<InvestmentOpportunityPage>;
  findAnalysisById(opportunityId: InvestmentOpportunityId, analysisId: OpportunityAnalysisId, ownerId: OpportunityOwnerId): Promise<OpportunityAnalysis | null>;
  listAnalyses(opportunityId: InvestmentOpportunityId, ownerId: OpportunityOwnerId): Promise<readonly OpportunityAnalysis[]>;
}
