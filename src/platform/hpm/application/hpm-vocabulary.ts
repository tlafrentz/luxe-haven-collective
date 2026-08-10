export const HPM_PROJECTION_POLICY_VERSION = "hpm-projection-v1";
export const HPM_PRESENTATION_POLICY_VERSION = "hpm-presentation-v1";

export const HPM_LIFECYCLE_STAGES = [
  "see",
  "understand",
  "decide",
  "execute",
  "learn",
  "recommend",
] as const;

export type HpmLifecycleStage = (typeof HPM_LIFECYCLE_STAGES)[number];

export type HpmPresentationState =
  | "needs-attention"
  | "awaiting-review"
  | "awaiting-authority"
  | "ready-to-proceed"
  | "in-progress"
  | "blocked"
  | "awaiting-evidence"
  | "awaiting-measurement"
  | "completed"
  | "evaluated"
  | "needs-reevaluation"
  | "superseded"
  | "archived";

export type HpmPresentationMapping = Readonly<{
  capability: HpmSourceCapability;
  canonicalStatus: string;
  presentationState: HpmPresentationState;
  label: string;
  explanation: string;
  policyVersion: typeof HPM_PRESENTATION_POLICY_VERSION;
}>;

export const HPM_SOURCE_CAPABILITIES = [
  "observations",
  "intelligence",
  "decisions",
  "execute",
  "outcomes",
  "learning",
  "recommendations",
] as const;

export type HpmSourceCapability = (typeof HPM_SOURCE_CAPABILITIES)[number];

export const HPM_CAPABILITY_STAGE: Readonly<Record<HpmSourceCapability, HpmLifecycleStage>> =
  Object.freeze({
    observations: "see",
    intelligence: "understand",
    decisions: "decide",
    execute: "execute",
    outcomes: "learn",
    learning: "learn",
    recommendations: "recommend",
  });

const PRESENTATION_LABELS: Readonly<Record<HpmPresentationState, string>> = Object.freeze({
  "needs-attention": "Needs attention",
  "awaiting-review": "Awaiting review",
  "awaiting-authority": "Awaiting authority",
  "ready-to-proceed": "Ready to proceed",
  "in-progress": "In progress",
  blocked: "Blocked",
  "awaiting-evidence": "Awaiting evidence",
  "awaiting-measurement": "Awaiting measurement",
  completed: "Completed",
  evaluated: "Evaluated",
  "needs-reevaluation": "Needs reevaluation",
  superseded: "Superseded",
  archived: "Archived",
});

export function mapHpmPresentationState(input: Readonly<{
  capability: HpmSourceCapability;
  canonicalStatus: string;
  presentationState: HpmPresentationState;
  explanation: string;
}>): HpmPresentationMapping {
  if (!input.canonicalStatus.trim()) throw new Error("HPM_CANONICAL_STATUS_REQUIRED");
  if (!input.explanation.trim()) throw new Error("HPM_STATUS_EXPLANATION_REQUIRED");
  return Object.freeze({
    ...input,
    canonicalStatus: input.canonicalStatus.trim(),
    explanation: input.explanation.trim(),
    label: PRESENTATION_LABELS[input.presentationState],
    policyVersion: HPM_PRESENTATION_POLICY_VERSION,
  });
}
