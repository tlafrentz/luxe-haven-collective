import type { InvestmentOpportunity, InvestmentOpportunityId, InvestmentOpportunityRoute, OpportunityAnalysis, OpportunityAnalysisId, OpportunityOwnerId, OpportunityStatus } from "../../domain";

export type OpportunityAggregateVersion = number;
export type InvestmentOpportunityRepositoryQuery = Readonly<{ ownerId: OpportunityOwnerId; statuses?: readonly OpportunityStatus[]; includeArchived?: boolean; route?: InvestmentOpportunityRoute; limit?: number; cursor?: string }>;
export type InvestmentOpportunityPage = Readonly<{ items: readonly InvestmentOpportunity[]; nextCursor?: string }>;
export type InvestmentOpportunitySaveResult = Readonly<{ opportunityId: string; analysisVersionId?: string; analysisVersionNumber?: number; aggregateVersion: number; idempotent: boolean }>;
export type AtomicInitialOpportunityNote = Readonly<{ note: Readonly<Record<string, unknown>>; activity: Readonly<Record<string, unknown>> }>;
export type InvestmentOpportunitySaveOptions = Readonly<{ payloadHash?: string; initialNote?: AtomicInitialOpportunityNote }>;
export interface InvestmentOpportunityRepository {
  findById(id: InvestmentOpportunityId, ownerId: OpportunityOwnerId): Promise<InvestmentOpportunity | null>;
  save(opportunity: InvestmentOpportunity, expectedVersion?: OpportunityAggregateVersion, idempotencyKey?: string, options?: InvestmentOpportunitySaveOptions): Promise<InvestmentOpportunitySaveResult>;
  list(query: InvestmentOpportunityRepositoryQuery): Promise<InvestmentOpportunityPage>;
  findAnalysisById(opportunityId: InvestmentOpportunityId, analysisId: OpportunityAnalysisId, ownerId: OpportunityOwnerId): Promise<OpportunityAnalysis | null>;
  listAnalyses(opportunityId: InvestmentOpportunityId, ownerId: OpportunityOwnerId): Promise<readonly OpportunityAnalysis[]>;
}
