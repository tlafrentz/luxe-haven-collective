import type { HpmReleaseFailureCode, HpmReleaseResult } from "./hpm-release-contracts";

export type HpmReleaseThresholds = Readonly<{ projectionAvailabilityMinimum: number; projectionP95MaximumMs: number; sourceFailureMaximumRate: number; reportSuccessMinimum: number; exportSuccessMinimum: number; clientErrorMaximumRate: number; maximumJobAgeMs: number }>;
export type HpmReleaseSignals = Readonly<{ projectionAvailability: number; projectionP95Ms: number; sourceFailureRate: number; reportSuccess: number; exportSuccess: number; clientErrorRate: number; oldestJobAgeMs: number; crossTenantSignals: number; unauthorizedMutations: number; corruptedLineage: number; autonomousActions: number }>;

export const HPM_PLATFORM_V1_THRESHOLDS: HpmReleaseThresholds = Object.freeze({ projectionAvailabilityMinimum: 0.99, projectionP95MaximumMs: 3_000, sourceFailureMaximumRate: 0.01, reportSuccessMinimum: 0.99, exportSuccessMinimum: 0.99, clientErrorMaximumRate: 0.01, maximumJobAgeMs: 300_000 });

export function evaluateReleaseThresholds(signals: HpmReleaseSignals, thresholds = HPM_PLATFORM_V1_THRESHOLDS): HpmReleaseResult<HpmReleaseSignals> {
  if (signals.crossTenantSignals || signals.unauthorizedMutations || signals.corruptedLineage || signals.autonomousActions) return failure("HPM_RELEASE_HALTED", "A non-negotiable safety halt signal was detected.");
  if (signals.projectionAvailability < thresholds.projectionAvailabilityMinimum || signals.projectionP95Ms > thresholds.projectionP95MaximumMs || signals.sourceFailureRate > thresholds.sourceFailureMaximumRate || signals.reportSuccess < thresholds.reportSuccessMinimum || signals.exportSuccess < thresholds.exportSuccessMinimum || signals.clientErrorRate > thresholds.clientErrorMaximumRate || signals.oldestJobAgeMs > thresholds.maximumJobAgeMs) return failure("HPM_RELEASE_THRESHOLD_BREACHED", "One or more predeclared rollout thresholds were breached.");
  return { ok: true, value: signals };
}

const AUTHORITY_MUTATIONS = ["accept-recommendation", "approve-decision", "resolve-decision", "activate-action", "complete-action", "assign-worker", "change-recurring-template", "change-policy", "change-measurement-plan", "approve-budget", "mutate-provider", "send-external-communication", "approve-learning"] as const;
export function verifyNoAutonomousAuthority(input: Readonly<{ source: "human" | "scheduler" | "webhook" | "retry" | "feedback"; command: string; authenticatedActorId?: string; explicitApprovalId?: string }>): HpmReleaseResult<typeof input> {
  if (input.source !== "human" && AUTHORITY_MUTATIONS.includes(input.command as typeof AUTHORITY_MUTATIONS[number])) return failure("HPM_RELEASE_AUTONOMY_GUARD_FAILED", "Automated sources may produce proposals and projections, but cannot authorize mutations.");
  if (AUTHORITY_MUTATIONS.includes(input.command as typeof AUTHORITY_MUTATIONS[number]) && (!input.authenticatedActorId || !input.explicitApprovalId)) return failure("HPM_RELEASE_AUTONOMY_GUARD_FAILED", "A human actor and explicit owning-capability approval are required.");
  return { ok: true, value: input };
}
function failure(code: HpmReleaseFailureCode, message: string): HpmReleaseResult<never> { return { ok: false, code, message }; }
