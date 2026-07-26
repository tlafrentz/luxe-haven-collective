import {
  authorizeFinancialRead, buildFinancialReadModel, financialCacheKey, observeFinancialEvaluation,
  type FinancialObservability, type FinancialReadModelRepository, type FinancialSnapshotRepository,
  type FinancialSource, type GetFinancialSnapshotQuery,
} from "../application";
import type { FinancialReadModel, FinancialSnapshot } from "../domain";
import { assertFinancialPeriod } from "../domain";

export class InMemoryFinancialSnapshotRepository implements FinancialSnapshotRepository {
  private readonly values = new Map<string, FinancialSnapshot>();
  async get(query: GetFinancialSnapshotQuery): Promise<FinancialSnapshot | null> {
    const currency = query.reportingCurrency ?? "";
    return this.values.get(financialCacheKey(query, currency)) ?? null;
  }
  async put(key: string, snapshot: FinancialSnapshot): Promise<void> { this.values.set(key, snapshot); }
  async invalidateWorkspace(workspaceId: string): Promise<void> {
    for (const key of this.values.keys()) if (key.startsWith(`financial|${workspaceId}|`)) this.values.delete(key);
  }
  getByKey(key: string): FinancialSnapshot | null { return this.values.get(key) ?? null; }
}

export class ComputedFinancialReadModelRepository implements FinancialReadModelRepository {
  constructor(
    private readonly source: FinancialSource,
    private readonly cache?: FinancialSnapshotRepository,
    private readonly observability?: FinancialObservability,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  async buildFinancialReadModel(query: GetFinancialSnapshotQuery): Promise<FinancialReadModel> {
    const startedAt = this.clock();
    const model = await buildFinancialReadModel(this.source, query);
    observeFinancialEvaluation(this.observability, model, startedAt, this.clock());
    if (this.cache) await this.cache.put(financialCacheKey(query, query.reportingCurrency ?? model.identity.reportingCurrency), model.snapshot);
    return model;
  }

  async getFinancialSnapshot(query: GetFinancialSnapshotQuery): Promise<FinancialSnapshot> {
    assertFinancialPeriod(query.period);
    authorizeFinancialRead(query);
    if (this.cache) {
      const identity = await this.source.getIdentity(query.workspaceId);
      if (identity) {
        const cached = await this.cache.get({ ...query, reportingCurrency: query.reportingCurrency ?? identity.reportingCurrency });
        if (cached) return cached;
      }
    }
    return (await this.buildFinancialReadModel(query)).snapshot;
  }
}
