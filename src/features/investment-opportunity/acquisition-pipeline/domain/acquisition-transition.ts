import type { AcquisitionStage } from "./acquisition-stage";
import { AcquisitionDomainError } from "./errors";

export type AcquisitionStageTransition = Readonly<{ from: AcquisitionStage; to: AcquisitionStage }>;
export const ACQUISITION_BACKWARD_TRANSITION_REASONS = ["offer-revised", "counteroffer-received", "agreement-amended", "due-diligence-reopened", "closing-condition-unresolved", "operator-correction", "other"] as const;
export type AcquisitionBackwardTransitionReason = (typeof ACQUISITION_BACKWARD_TRANSITION_REASONS)[number];
export type AcquisitionTransitionReason = Readonly<{ code: AcquisitionBackwardTransitionReason; explanation?: string }>;
export const ACQUISITION_REASON_EXPLANATION_MAX_LENGTH = 2000;
export function createAcquisitionTransitionReason(input: AcquisitionTransitionReason): AcquisitionTransitionReason {
  if (!ACQUISITION_BACKWARD_TRANSITION_REASONS.includes(input.code)) throw new AcquisitionDomainError("INVALID_ACQUISITION_STAGE_TRANSITION");
  const explanation = input.explanation?.trim();
  if (input.code === "other" && !explanation) throw new AcquisitionDomainError("ACQUISITION_TRANSITION_EXPLANATION_REQUIRED");
  if (explanation && explanation.length > ACQUISITION_REASON_EXPLANATION_MAX_LENGTH) throw new AcquisitionDomainError("ACQUISITION_TRANSITION_EXPLANATION_REQUIRED");
  return Object.freeze({ code: input.code, ...(explanation ? { explanation } : {}) });
}
