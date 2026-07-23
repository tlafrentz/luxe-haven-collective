import { AcquisitionDomainError } from "./errors";

export const ACQUISITION_STAGES = [
  "pursuit", "offer-preparation", "offer-submitted", "negotiating",
  "under-contract", "due-diligence", "closing-preparation", "closed-acquired", "exited",
] as const;
export type AcquisitionStage = (typeof ACQUISITION_STAGES)[number];
export const INITIAL_ACQUISITION_STAGE: AcquisitionStage = "pursuit";
export const TERMINAL_ACQUISITION_STAGES = ["closed-acquired", "exited"] as const;

export type AcquisitionStageCategory = "pre-offer" | "offer" | "contract" | "closing" | "terminal";
export type AcquisitionStageDefinition = Readonly<{ stage: AcquisitionStage; sequence: number; category: AcquisitionStageCategory; terminal: boolean }>;

const DEFINITIONS: Readonly<Record<AcquisitionStage, AcquisitionStageDefinition>> = {
  pursuit: { stage: "pursuit", sequence: 10, category: "pre-offer", terminal: false },
  "offer-preparation": { stage: "offer-preparation", sequence: 20, category: "pre-offer", terminal: false },
  "offer-submitted": { stage: "offer-submitted", sequence: 30, category: "offer", terminal: false },
  negotiating: { stage: "negotiating", sequence: 40, category: "offer", terminal: false },
  "under-contract": { stage: "under-contract", sequence: 50, category: "contract", terminal: false },
  "due-diligence": { stage: "due-diligence", sequence: 60, category: "contract", terminal: false },
  "closing-preparation": { stage: "closing-preparation", sequence: 70, category: "closing", terminal: false },
  "closed-acquired": { stage: "closed-acquired", sequence: 80, category: "terminal", terminal: true },
  exited: { stage: "exited", sequence: 90, category: "terminal", terminal: true },
};

export function isAcquisitionStage(value: unknown): value is AcquisitionStage {
  return typeof value === "string" && (ACQUISITION_STAGES as readonly string[]).includes(value);
}
export function parseAcquisitionStage(value: unknown): AcquisitionStage {
  if (!isAcquisitionStage(value)) throw new AcquisitionDomainError("INVALID_ACQUISITION_STAGE");
  return value;
}
export function getAcquisitionStageDefinition(stage: AcquisitionStage): AcquisitionStageDefinition { return DEFINITIONS[stage]; }
export function isTerminalAcquisitionStage(stage: AcquisitionStage): boolean { return DEFINITIONS[stage].terminal; }
export function isActiveAcquisitionStage(stage: AcquisitionStage): boolean { return !isTerminalAcquisitionStage(stage); }
export function isPreContractAcquisitionStage(stage: AcquisitionStage): boolean { return DEFINITIONS[stage].category === "pre-offer" || DEFINITIONS[stage].category === "offer"; }
export function isContractStage(stage: AcquisitionStage): boolean { return DEFINITIONS[stage].category === "contract"; }
export function isClosingAcquisitionStage(stage: AcquisitionStage): boolean { return stage === "closing-preparation"; }
export function assertAcquisitionPipelineIsActive(stage: AcquisitionStage): void { if (isTerminalAcquisitionStage(stage)) throw new AcquisitionDomainError("ACQUISITION_PIPELINE_TERMINAL", { stage }); }
