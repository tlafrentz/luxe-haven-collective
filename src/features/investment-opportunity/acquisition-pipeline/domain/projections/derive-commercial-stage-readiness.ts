import type { AcquisitionStage } from "../acquisition-stage";
import type { AcquisitionPipeline } from "../acquisition-pipeline";
export type CommercialStageBlocker = Readonly<{ code: string; description: string }>;
export type CommercialStageReadiness = Readonly<{ targetStage: AcquisitionStage; ready: boolean; blockers: readonly CommercialStageBlocker[] }>;
export function deriveCommercialStageReadiness(pipeline: AcquisitionPipeline, targetStage: AcquisitionStage): CommercialStageReadiness {
  const offer = pipeline.currentOffer(), contract = pipeline.contract(), agreement = pipeline.acceptedAgreement();
  const blockers: CommercialStageBlocker[] = [];
  if (targetStage === "offer-submitted" && (!offer || offer.status !== "submitted")) blockers.push({ code: "SUBMITTED_OFFER_REQUIRED", description: "A submitted current offer is required." });
  if (targetStage === "negotiating" && !pipeline.responses().some(value => value.type === "counter")) blockers.push({ code: "COUNTEROFFER_REQUIRED", description: "A recorded counteroffer is required." });
  if (targetStage === "under-contract" && !agreement && !contract) blockers.push({ code: "ACCEPTED_AGREEMENT_REQUIRED", description: "Accepted offer, counteroffer, or external agreement facts are required." });
  if (targetStage === "due-diligence" && !contract) blockers.push({ code: "CONTRACT_REQUIRED", description: "A recorded contract is required." });
  if (targetStage === "closing-preparation" && !contract) blockers.push({ code: "CONTRACT_REQUIRED", description: "A recorded contract is required." });
  if (targetStage === "closed-acquired") blockers.push({ code: "CLOSING_READINESS_DEFERRED", description: "Closing readiness is introduced in a later milestone." });
  return Object.freeze({ targetStage, ready: blockers.length === 0, blockers: Object.freeze(blockers) });
}
