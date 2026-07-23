import { Identifier } from "@/platform/kernel";
import { AcquisitionDomainError } from "./errors";

export type AcquisitionPipelineId = Identifier<`acquisition-pipeline-${string}`>;
export type AcquisitionStageTransitionId = Identifier<`acquisition-stage-transition-${string}`>;
export type AcquisitionCommandId = Identifier<`acquisition-command-${string}`>;

function createId<T extends string>(value: string | undefined, prefix: string, code: "INVALID_ACQUISITION_PIPELINE_ID" | "INVALID_ACQUISITION_TRANSITION_ID" | "INVALID_ACQUISITION_COMMAND_ID"): Identifier<T> {
  const candidate = value ?? `${prefix}${crypto.randomUUID()}`;
  if (!candidate.trim() || !candidate.startsWith(prefix)) throw new AcquisitionDomainError(code);
  return Identifier.create(candidate as T);
}

export const createAcquisitionPipelineId = (value?: string): AcquisitionPipelineId => createId(value, "acquisition-pipeline-", "INVALID_ACQUISITION_PIPELINE_ID");
export const createAcquisitionStageTransitionId = (value?: string): AcquisitionStageTransitionId => createId(value, "acquisition-stage-transition-", "INVALID_ACQUISITION_TRANSITION_ID");
export const createAcquisitionCommandId = (value?: string): AcquisitionCommandId => createId(value, "acquisition-command-", "INVALID_ACQUISITION_COMMAND_ID");
