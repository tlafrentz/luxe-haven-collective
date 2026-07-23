import type { InvestmentOpportunity, InvestmentOpportunityId, OpportunityAnalysisId, OpportunityOwnerId } from "../../domain";
import { InvestmentOpportunityError, type InvestmentOpportunityPage, type InvestmentOpportunityRepository, type InvestmentOpportunityRepositoryQuery } from "../../application";
import { fromInvestmentOpportunityPersistence, toInvestmentOpportunityPersistence, type InvestmentOpportunityPersistenceRecord } from "../mappers/opportunity-persistence-mapper";

/** Supabase-specific gateway, kept inside infrastructure so row/RPC shapes never leak. */
export interface SupabaseInvestmentOpportunityGateway {
  saveAtomic(payload: ReturnType<typeof toInvestmentOpportunityPersistence>, expectedVersion?: number, commandId?: string): Promise<void>;
  findBundle(id: string, ownerId: string): Promise<InvestmentOpportunityPersistenceRecord | null>;
  listBundles(query: Readonly<{ ownerId: string; statuses?: readonly string[]; includeArchived: boolean; route?: string; limit: number; cursor?: string }>): Promise<Readonly<{ records: readonly InvestmentOpportunityPersistenceRecord[]; nextCursor?: string }>>;
}
export class SupabaseInvestmentOpportunityRepository implements InvestmentOpportunityRepository {
  constructor(private readonly gateway: SupabaseInvestmentOpportunityGateway) {}
  async findById(id: InvestmentOpportunityId, ownerId: OpportunityOwnerId) { const record = await this.gateway.findBundle(id.value, ownerId.value); return record ? fromInvestmentOpportunityPersistence(record) : null; }
  async save(opportunity: InvestmentOpportunity, expectedVersion?: number, idempotencyKey?: string) { try { await this.gateway.saveAtomic(toInvestmentOpportunityPersistence(opportunity), expectedVersion, idempotencyKey); } catch (cause) { if (isSerializationFailure(cause)) throw new InvestmentOpportunityError("CONCURRENT_OPPORTUNITY_MODIFICATION", "The opportunity was modified concurrently.", cause); throw new InvestmentOpportunityError("OPPORTUNITY_PERSISTENCE_FAILED", "Investment opportunity persistence failed.", cause); } }
  async list(query: InvestmentOpportunityRepositoryQuery): Promise<InvestmentOpportunityPage> { const page = await this.gateway.listBundles({ ownerId: query.ownerId.value, statuses: query.statuses, includeArchived: query.includeArchived ?? false, route: query.route, limit: Math.min(Math.max(query.limit ?? 50, 1), 100), cursor: query.cursor }); return { items: page.records.map(fromInvestmentOpportunityPersistence), ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) }; }
  async findAnalysisById(opportunityId: InvestmentOpportunityId, analysisId: OpportunityAnalysisId, ownerId: OpportunityOwnerId) { const opportunity = await this.findById(opportunityId, ownerId); return opportunity?.props.analyses.find(item => item.id.equals(analysisId)) ?? null; }
  async listAnalyses(opportunityId: InvestmentOpportunityId, ownerId: OpportunityOwnerId) { const opportunity = await this.findById(opportunityId, ownerId); return Object.freeze([...(opportunity?.props.analyses ?? [])].sort((a, b) => b.sequence - a.sequence)); }
}
function isSerializationFailure(cause: unknown) { return Boolean(cause && typeof cause === "object" && "code" in cause && (cause as { code?: unknown }).code === "40001"); }
