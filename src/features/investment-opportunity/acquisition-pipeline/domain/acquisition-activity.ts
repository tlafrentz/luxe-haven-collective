import type { AcquisitionActorReference } from "./acquisition-actor-reference";
import type { AcquisitionStage } from "./acquisition-stage";
import type { AcquisitionPipelineVersion } from "./acquisition-pipeline-version";
import type { AcquisitionStageTransitionId } from "./identifiers";

export type AcquisitionActivityType = "pipeline-activated" | "stage-transitioned" | "pipeline-exited" | "pipeline-closed-acquired";
export type AcquisitionActivity = Readonly<{
  id: AcquisitionStageTransitionId;
  type: AcquisitionActivityType;
  occurredAt: Date;
  actor: AcquisitionActorReference;
  details: Readonly<Record<string, unknown>>;
  aggregateVersion: AcquisitionPipelineVersion;
  from?: AcquisitionStage;
  to: AcquisitionStage;
}>;
