import type { InvestmentOpportunityId } from "@/features/investment-opportunity/domain";
import type { AcquisitionPipelineRepository } from "../domain/acquisition-pipeline-repository";
import { AcquisitionPipeline } from "../domain/acquisition-pipeline";
import type { AcquisitionPipelineId } from "../domain/identifiers";
import { AcquisitionDomainError } from "../domain/errors";

export class InMemoryAcquisitionPipelineRepository implements AcquisitionPipelineRepository {
  private readonly records = new Map<string, AcquisitionPipeline>();
  public async findById(id: AcquisitionPipelineId): Promise<AcquisitionPipeline | null> { const value = this.records.get(id.value); return value ? AcquisitionPipeline.restore(value.props) : null; }
  public async findByOpportunity(opportunityId: InvestmentOpportunityId): Promise<AcquisitionPipeline | null> { const value = [...this.records.values()].find(item => item.opportunityId.equals(opportunityId)); return value ? AcquisitionPipeline.restore(value.props) : null; }
  public async exists(opportunityId: InvestmentOpportunityId): Promise<boolean> { return Boolean(await this.findByOpportunity(opportunityId)); }
  public async save(pipeline: AcquisitionPipeline, expectedVersion?: number): Promise<void> {
    const existing = this.records.get(pipeline.id.value);
    if (!existing && expectedVersion !== undefined) throw new AcquisitionDomainError("INVALID_ACQUISITION_PIPELINE_VERSION", { expected: expectedVersion });
    if (existing && (expectedVersion === undefined || existing.version().value !== expectedVersion || pipeline.version().value !== expectedVersion + 1)) throw new AcquisitionDomainError("INVALID_ACQUISITION_PIPELINE_VERSION", { expected: expectedVersion, actual: existing.version().value });
    const byOpportunity = await this.findByOpportunity(pipeline.opportunityId);
    if (!existing && byOpportunity) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION", { opportunityId: pipeline.opportunityId.value });
    this.records.set(pipeline.id.value, AcquisitionPipeline.restore(pipeline.props));
  }
  public snapshot(): readonly AcquisitionPipeline[] { return [...this.records.values()].map(value => AcquisitionPipeline.restore(value.props)); }
  public restoreSnapshot(values: readonly AcquisitionPipeline[]): void { this.records.clear(); for (const value of values) this.records.set(value.id.value, AcquisitionPipeline.restore(value.props)); }
}
