import type { AcquisitionActorReference } from "./acquisition-actor-reference";
import type { AcquisitionCommandId } from "./identifiers";
import { AcquisitionPipelineVersion } from "./acquisition-pipeline-version";
import { AcquisitionDomainError } from "./errors";

export type AcquisitionCommandContextInput = Readonly<{ commandId: AcquisitionCommandId; actor: AcquisitionActorReference; occurredAt: Date; expectedPipelineVersion?: AcquisitionPipelineVersion; expectedOpportunityVersion?: number }>;
export type AcquisitionCommandContext = Readonly<{ commandId: AcquisitionCommandId; actor: AcquisitionActorReference; occurredAt: Date; expectedPipelineVersion?: AcquisitionPipelineVersion; expectedOpportunityVersion?: number }>;
export function createAcquisitionCommandContext(input: AcquisitionCommandContextInput): AcquisitionCommandContext {
  if (!(input.occurredAt instanceof Date) || Number.isNaN(input.occurredAt.getTime()) || (input.expectedOpportunityVersion !== undefined && (!Number.isInteger(input.expectedOpportunityVersion) || input.expectedOpportunityVersion <= 0))) throw new AcquisitionDomainError("INVALID_ACQUISITION_COMMAND_CONTEXT");
  return Object.freeze({ commandId: input.commandId, actor: Object.freeze({ ...input.actor }), occurredAt: new Date(input.occurredAt), ...(input.expectedPipelineVersion ? { expectedPipelineVersion: input.expectedPipelineVersion } : {}), ...(input.expectedOpportunityVersion !== undefined ? { expectedOpportunityVersion: input.expectedOpportunityVersion } : {}) });
}
