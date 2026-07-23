import type { InvestmentOpportunityRoute, OpportunityAnalysisId } from "@/features/investment-opportunity/domain";
import type { AcquisitionActorReference } from "./acquisition-actor-reference";
import { AcquisitionDomainError } from "./errors";

export type PipelineSourceAnalysisReference = Readonly<{ analysisId: OpportunityAnalysisId; analysisVersion: number; analyzedAt: Date; route?: InvestmentOpportunityRoute; assumptionFingerprint?: string }>;
export type PipelineActivation = Readonly<{ activatedAt: Date; activatedBy: AcquisitionActorReference; sourceAnalysis: PipelineSourceAnalysisReference }>;
export function createPipelineActivation(input: PipelineActivation): PipelineActivation {
  const source = input.sourceAnalysis;
  if (!source.analysisId || !Number.isInteger(source.analysisVersion) || source.analysisVersion < 1 || !(input.activatedAt instanceof Date) || Number.isNaN(input.activatedAt.getTime()) || !(source.analyzedAt instanceof Date) || Number.isNaN(source.analyzedAt.getTime()) || input.activatedAt.getTime() < source.analyzedAt.getTime()) throw new AcquisitionDomainError("INVALID_PIPELINE_ACTIVATION");
  if (source.assumptionFingerprint?.trim() === "") throw new AcquisitionDomainError("INVALID_PIPELINE_SOURCE_ANALYSIS");
  return Object.freeze({ activatedAt: new Date(input.activatedAt), activatedBy: Object.freeze({ ...input.activatedBy }), sourceAnalysis: Object.freeze({ ...source, analyzedAt: new Date(source.analyzedAt), ...(source.assumptionFingerprint ? { assumptionFingerprint: source.assumptionFingerprint } : {}) }) });
}
