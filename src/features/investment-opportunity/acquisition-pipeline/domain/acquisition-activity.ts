import type { AcquisitionActorReference } from "./acquisition-actor-reference";
import type { AcquisitionStage } from "./acquisition-stage";
import type { AcquisitionPipelineVersion } from "./acquisition-pipeline-version";
import type { AcquisitionStageTransitionId } from "./identifiers";

export type AcquisitionActivityType = "pipeline-activated" | "stage-transitioned" | "pipeline-exited" | "pipeline-closed-acquired" | "offer-draft-created" | "offer-draft-updated" | "offer-draft-rebased" | "offer-submitted" | "offer-withdrawn" | "offer-expired" | "offer-rejected" | "offer-countered" | "offer-accepted" | "counteroffer-accepted" | "contract-recorded" | "external-contract-recorded" | "contingency-added" | "due-diligence-item-added" | "contingency-started" | "contingency-satisfied" | "contingency-waived" | "contingency-failed" | "due-diligence-item-started" | "due-diligence-item-completed" | "due-diligence-item-waived" | "due-diligence-item-failed";
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
