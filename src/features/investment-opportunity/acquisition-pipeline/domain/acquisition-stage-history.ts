import type { AcquisitionActorReference } from "./acquisition-actor-reference";
import type { AcquisitionStage } from "./acquisition-stage";
import type { AcquisitionTransitionClassification } from "./acquisition-stage-policy";
import type { AcquisitionTransitionReason } from "./acquisition-transition";
import type { AcquisitionStageTransitionId } from "./identifiers";
import type { AcquisitionPipelineVersion } from "./acquisition-pipeline-version";

export type AcquisitionStageHistoryEntry = Readonly<{
  transitionId: AcquisitionStageTransitionId;
  from?: AcquisitionStage;
  to: AcquisitionStage;
  occurredAt: Date;
  actor: AcquisitionActorReference;
  classification: AcquisitionTransitionClassification;
  reason?: AcquisitionTransitionReason;
  aggregateVersion: AcquisitionPipelineVersion;
}>;
