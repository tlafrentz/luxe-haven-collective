import { InvestmentOpportunity, type InvestmentOpportunityId, type OpportunityAnalysisId, type OpportunityOwnerId } from "../../domain";
import { InvestmentOpportunityError } from "../../application";
import type { InvestmentOpportunityPage, InvestmentOpportunityRepository, InvestmentOpportunityRepositoryQuery } from "../../application";

export class InMemoryInvestmentOpportunityRepository implements InvestmentOpportunityRepository {
  private readonly records = new Map<string, InvestmentOpportunity>();
  private readonly idempotency = new Map<string, string>();
  async findById(id: InvestmentOpportunityId, ownerId: OpportunityOwnerId) { const item = this.records.get(id.value); return item?.ownerId.equals(ownerId) ? clone(item) : null; }
  async save(opportunity: InvestmentOpportunity, expectedVersion?: number, idempotencyKey?: string) {
    const key = idempotencyKey ? `${opportunity.ownerId.value}:${idempotencyKey}` : undefined;
    if (key && this.idempotency.has(key)) return;
    const existing = this.records.get(opportunity.id.value);
    if (existing && (expectedVersion === undefined || existing.version !== expectedVersion || opportunity.version !== expectedVersion + 1)) throw new InvestmentOpportunityError("CONCURRENT_OPPORTUNITY_MODIFICATION", "Stale opportunity version.");
    if (!existing && expectedVersion !== undefined) throw new InvestmentOpportunityError("CONCURRENT_OPPORTUNITY_MODIFICATION", "Opportunity does not yet exist.");
    this.records.set(opportunity.id.value, clone(opportunity)); if (key) this.idempotency.set(key, opportunity.id.value);
  }
  async list(query: InvestmentOpportunityRepositoryQuery): Promise<InvestmentOpportunityPage> {
    const sorted = [...this.records.values()].filter(value => value.ownerId.equals(query.ownerId)).filter(value => query.includeArchived || !value.props.archivedAt).filter(value => !query.statuses?.length || query.statuses.includes(value.props.status)).filter(value => !query.route || value.props.route === query.route).sort((a, b) => b.props.updatedAt.getTime() - a.props.updatedAt.getTime() || a.id.value.localeCompare(b.id.value));
    const offset = query.cursor ? Number.parseInt(query.cursor, 10) : 0, limit = Math.min(Math.max(query.limit ?? 50, 1), 100), items = sorted.slice(offset, offset + limit).map(clone);
    return { items, ...(offset + limit < sorted.length ? { nextCursor: String(offset + limit) } : {}) };
  }
  async findAnalysisById(opportunityId: InvestmentOpportunityId, analysisId: OpportunityAnalysisId, ownerId: OpportunityOwnerId) { const opportunity = await this.findById(opportunityId, ownerId); return opportunity?.props.analyses.find(value => value.id.equals(analysisId)) ?? null; }
  async listAnalyses(opportunityId: InvestmentOpportunityId, ownerId: OpportunityOwnerId) { const opportunity = await this.findById(opportunityId, ownerId); return Object.freeze([...(opportunity?.props.analyses ?? [])].sort((a, b) => b.sequence - a.sequence)); }
}
function clone(value: InvestmentOpportunity) { return InvestmentOpportunity.restore(value.props); }
