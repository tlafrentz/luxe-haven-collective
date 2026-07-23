import type { AcquisitionCommandReceipt, AcquisitionCommandReceiptRepository, AcquisitionTransactionalContext, AcquisitionUnitOfWork } from "../ports";
import type { AcquisitionPipelineRepository } from "../../domain";
import type { InvestmentOpportunityRepository } from "@/features/investment-opportunity/application";

/** Test adapter for the application boundary. Repositories are intentionally injected ports. */
export class InMemoryAcquisitionCommandReceiptRepository implements AcquisitionCommandReceiptRepository {
  private readonly records = new Map<string, AcquisitionCommandReceipt>();
  public async find(commandId: { value: string }, ownerId: { value: string }) { return this.records.get(`${ownerId.value}:${commandId.value}`) ?? null; }
  public async save(receipt: AcquisitionCommandReceipt) { const key = `${receipt.ownerId.value}:${receipt.commandId.value}`; const existing = this.records.get(key); if (existing && existing.commandType !== receipt.commandType) throw new Error("command id reused"); this.records.set(key, Object.freeze({ ...receipt })); }
}

export class InMemoryAcquisitionUnitOfWork implements AcquisitionUnitOfWork {
  public constructor(private readonly context: AcquisitionTransactionalContext) {}
  public async execute<T>(operation: (context: AcquisitionTransactionalContext) => Promise<T>): Promise<T> {
    const pipelineStore = this.context.acquisitionPipelines as AcquisitionPipelineRepository & { snapshot?: () => readonly unknown[]; restoreSnapshot?: (values: readonly unknown[]) => void };
    const opportunityStore = this.context.investmentOpportunities as InvestmentOpportunityRepository & { snapshot?: () => readonly unknown[]; restoreSnapshot?: (values: readonly unknown[]) => void };
    const pipelines = pipelineStore.snapshot?.(), opportunities = opportunityStore.snapshot?.();
    try { return await operation(this.context); } catch (error) { if (pipelines && pipelineStore.restoreSnapshot) pipelineStore.restoreSnapshot(pipelines); if (opportunities && opportunityStore.restoreSnapshot) opportunityStore.restoreSnapshot(opportunities); throw error; }
  }
}

export function createInMemoryAcquisitionContext(input: Readonly<{ acquisitionPipelines: AcquisitionPipelineRepository; investmentOpportunities: InvestmentOpportunityRepository; commandReceipts?: AcquisitionCommandReceiptRepository }>): AcquisitionTransactionalContext {
  return { acquisitionPipelines: input.acquisitionPipelines, investmentOpportunities: input.investmentOpportunities, commandReceipts: input.commandReceipts ?? new InMemoryAcquisitionCommandReceiptRepository() };
}
