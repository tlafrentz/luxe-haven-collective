import type { OpportunityStatus } from "@/features/investment-opportunity/domain";
import type { AcquisitionStage } from "./acquisition-stage";

export const ACQUISITION_STAGE_TO_OPPORTUNITY_STATUS: Readonly<Record<AcquisitionStage, OpportunityStatus>> = Object.freeze({
  pursuit: "shortlisted", "offer-preparation": "shortlisted", "offer-submitted": "offer-submitted", negotiating: "offer-submitted", "under-contract": "under-contract", "due-diligence": "under-contract", "closing-preparation": "under-contract", "closed-acquired": "acquired", exited: "rejected",
});
export function deriveOpportunityStatusFromAcquisitionStage(stage: AcquisitionStage): OpportunityStatus { return ACQUISITION_STAGE_TO_OPPORTUNITY_STATUS[stage]; }
