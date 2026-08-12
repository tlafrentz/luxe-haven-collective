import { ProductionVerificationError, VerificationEvidence, VerificationResourceReference, VerificationScenarioInstance } from "../domain";
import { CA001F_PLAN } from "../domain/registry";

export type ReleaseGateDecision = { status: "pass" | "fail" | "blocked"; policyCode: string; policyVersion: number; requiredScenarioCount: number; passedScenarioCount: number; failedScenarioCount: number; blockedScenarioCount: number; skippedScenarioCount: number; blockerCodes: string[]; evaluatedAt: Date };

export function evaluateReleaseGate(input: { candidateConfirmed: boolean; candidateUnchanged: boolean; scenarios: readonly VerificationScenarioInstance[]; evidence: readonly VerificationEvidence[]; resources: readonly VerificationResourceReference[]; reviewerApproved: boolean; manualCheckpointsComplete: boolean }): ReleaseGateDecision {
  const required = CA001F_PLAN.requiredScenarioCodes;
  const byCode = new Map(input.scenarios.map(s => [s.scenarioCode, s]));
  const blockers: string[] = [];
  if (!input.candidateConfirmed || !input.candidateUnchanged) blockers.push("RELEASE_IDENTITY_UNPROVEN");
  for (const code of required) {
    const instance = byCode.get(code);
    if (!instance) blockers.push(`SCENARIO_MISSING:${code}`);
    else if (instance.status !== "passed") blockers.push(`SCENARIO_NOT_PASSED:${code}`);
    else if (!input.evidence.some(e => e.scenarioInstanceId === instance.id && e.classification === "valid")) blockers.push(`EVIDENCE_MISSING:${code}`);
  }
  if (input.resources.some(r => r.cleanupClassification === "required" && r.cleanupStatus !== "completed")) blockers.push("CLEANUP_INCOMPLETE");
  if (!input.manualCheckpointsComplete) blockers.push("MANUAL_CHECKPOINTS_INCOMPLETE");
  if (!input.reviewerApproved) blockers.push("REVIEW_REQUIRED");
  const failed = input.scenarios.filter(s => s.status === "failed").length;
  const blocked = input.scenarios.filter(s => s.status === "blocked").length;
  return { status: failed ? "fail" : blockers.length ? "blocked" : "pass", policyCode: "ALL_REQUIRED_AND_CLEAN_V1", policyVersion: 1, requiredScenarioCount: required.length, passedScenarioCount: input.scenarios.filter(s => s.status === "passed").length, failedScenarioCount: failed, blockedScenarioCount: blocked, skippedScenarioCount: input.scenarios.filter(s => s.status === "skipped").length, blockerCodes: blockers, evaluatedAt: new Date() };
}

export function assertExactCleanupTarget(resource: VerificationResourceReference, runId: string) {
  if (resource.verificationRunId !== runId) throw new ProductionVerificationError("CLEANUP_RESOURCE_OUT_OF_RUN");
  if (resource.creationClassification !== "created") throw new ProductionVerificationError("CLEANUP_RESOURCE_NOT_OWNED");
  if (resource.cleanupClassification !== "required") throw new ProductionVerificationError("CLEANUP_NOT_PERMITTED");
}
