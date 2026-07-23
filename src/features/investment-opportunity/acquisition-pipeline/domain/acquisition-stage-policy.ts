import { AcquisitionDomainError } from "./errors";
import { type AcquisitionStage, isTerminalAcquisitionStage } from "./acquisition-stage";

export type AcquisitionTransitionClassification = "forward" | "backward" | "terminal";
export type AcquisitionTransitionRequirements = Readonly<{
  classification?: AcquisitionTransitionClassification;
  reasonRequired: boolean;
  exitRequired: boolean;
  closingFactsRequired: boolean;
  acceptedAgreementRequired: boolean;
  closingReadinessRequired: boolean;
}>;
export type AcquisitionTransitionAssessment = Readonly<{
  allowed: boolean;
  classification?: AcquisitionTransitionClassification;
  reasonRequired: boolean;
  errorCode?: "INVALID_ACQUISITION_STAGE_TRANSITION" | "ACQUISITION_PIPELINE_TERMINAL";
  requirements: AcquisitionTransitionRequirements;
}>;

export const ALLOWED_ACQUISITION_STAGE_TRANSITIONS: Readonly<Record<AcquisitionStage, readonly AcquisitionStage[]>> = {
  pursuit: ["offer-preparation", "exited"],
  "offer-preparation": ["pursuit", "offer-submitted", "exited"],
  "offer-submitted": ["negotiating", "under-contract", "exited"],
  negotiating: ["offer-submitted", "under-contract", "exited"],
  "under-contract": ["due-diligence", "closing-preparation", "exited"],
  "due-diligence": ["under-contract", "closing-preparation", "exited"],
  "closing-preparation": ["due-diligence", "closed-acquired", "exited"],
  "closed-acquired": [],
  exited: [],
};

const backward = new Set(["offer-preparation:pursuit", "negotiating:offer-submitted", "due-diligence:under-contract", "closing-preparation:due-diligence"]);
const key = (from: AcquisitionStage, to: AcquisitionStage) => `${from}:${to}`;

export function getAllowedAcquisitionStageTransitions(stage: AcquisitionStage): readonly AcquisitionStage[] { return Object.freeze([...ALLOWED_ACQUISITION_STAGE_TRANSITIONS[stage]]); }
export function canTransitionAcquisitionStage(from: AcquisitionStage, to: AcquisitionStage): boolean { return ALLOWED_ACQUISITION_STAGE_TRANSITIONS[from].includes(to); }
export function getAcquisitionTransitionRequirements(from: AcquisitionStage, to: AcquisitionStage): AcquisitionTransitionRequirements {
  const allowed = canTransitionAcquisitionStage(from, to);
  const terminal = allowed && (to === "exited" || to === "closed-acquired");
  const classification = allowed ? terminal ? "terminal" : backward.has(key(from, to)) ? "backward" : "forward" : undefined;
  return Object.freeze({ classification, reasonRequired: classification === "backward", exitRequired: to === "exited", closingFactsRequired: to === "closed-acquired", acceptedAgreementRequired: to === "under-contract" || to === "closing-preparation" || to === "closed-acquired", closingReadinessRequired: to === "closed-acquired" });
}
export function assessAcquisitionStageTransition(from: AcquisitionStage, to: AcquisitionStage): AcquisitionTransitionAssessment {
  const requirements = getAcquisitionTransitionRequirements(from, to);
  if (from === to || isTerminalAcquisitionStage(from) || !requirements.classification) return Object.freeze({ allowed: false, reasonRequired: false, errorCode: isTerminalAcquisitionStage(from) ? "ACQUISITION_PIPELINE_TERMINAL" : "INVALID_ACQUISITION_STAGE_TRANSITION", requirements });
  return Object.freeze({ allowed: true, classification: requirements.classification, reasonRequired: requirements.reasonRequired, requirements });
}
export function assertValidAcquisitionStageTransition(from: AcquisitionStage, to: AcquisitionStage): void { const assessment = assessAcquisitionStageTransition(from, to); if (!assessment.allowed) throw new AcquisitionDomainError(assessment.errorCode ?? "INVALID_ACQUISITION_STAGE_TRANSITION", { from, to }); }
