import type { InvestmentOpportunityId } from "@/features/investment-opportunity/domain";
import type { AcquisitionPipelineId } from "./identifiers";
import type { AcquisitionPipeline } from "./acquisition-pipeline";

export interface AcquisitionPipelineRepository {
  findById(id: AcquisitionPipelineId): Promise<AcquisitionPipeline | null>;
  findByOpportunity(opportunityId: InvestmentOpportunityId): Promise<AcquisitionPipeline | null>;
  exists(opportunityId: InvestmentOpportunityId): Promise<boolean>;
  save(pipeline: AcquisitionPipeline, expectedVersion?: number): Promise<void>;
}
