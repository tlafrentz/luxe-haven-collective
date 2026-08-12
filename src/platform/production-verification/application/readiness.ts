import { ProductionReleaseCandidate, ProductionVerificationError } from "../domain";
import { CA001F_PLAN, MANUAL_OBSERVATION_DEFINITIONS, VERIFICATION_EVIDENCE_DEFINITIONS, VERIFICATION_SCENARIOS } from "../domain/registry";
import { validateAdapterCoverage } from "./adapters";

export type ProductionExecutionReadiness = { ready: boolean; candidateId: string; planCode: string; planVersion: number; blockerCodes: readonly string[]; evaluatedAt: Date };
export interface ReadinessStateReader {
  resolveCurrentCandidate(): Promise<{ commitSha: string; deploymentId: string; aliasDeploymentId: string; latestMigrationCode: string }>;
  resolveRegistry(): Promise<{ planCode?: string; planVersion?: number; scenarioCodes: readonly string[]; evidenceCodes: readonly string[]; manualObservationCodes: readonly string[]; driftDetected: boolean }>;
  resolveAdapters(): Promise<{ executorCodes: readonly string[]; evaluatorCodes: readonly string[]; cleanupOperationCodes: readonly string[] }>;
  resolveIdentities(): Promise<{ activeIdentityTypeCodes: readonly string[]; expiredCount: number; verifierAuthorized: boolean; reviewerAuthorized: boolean; verifierId?: string; reviewerId?: string }>;
}

export async function evaluateProductionExecutionReadiness(candidate: ProductionReleaseCandidate, reader: ReadinessStateReader): Promise<ProductionExecutionReadiness> {
  const blockers: string[] = [], current = await reader.resolveCurrentCandidate();
  if (current.commitSha !== candidate.commitSha || current.deploymentId !== candidate.deploymentId || current.aliasDeploymentId !== candidate.deploymentId) blockers.push("CANDIDATE_OR_ALIAS_MISMATCH");
  if (current.latestMigrationCode !== "20260811100000") blockers.push("MIGRATION_SET_MISMATCH");
  const registry = await reader.resolveRegistry();
  if (registry.planCode !== CA001F_PLAN.code || registry.planVersion !== CA001F_PLAN.version) blockers.push("ACTIVE_PLAN_UNAVAILABLE");
  if (VERIFICATION_SCENARIOS.some(s => !registry.scenarioCodes.includes(s.code))) blockers.push("SCENARIO_REGISTRY_INCOMPLETE");
  if (VERIFICATION_EVIDENCE_DEFINITIONS.some(e => !registry.evidenceCodes.includes(e.code))) blockers.push("EVIDENCE_REGISTRY_INCOMPLETE");
  if (MANUAL_OBSERVATION_DEFINITIONS.some(o => !registry.manualObservationCodes.includes(o.code))) blockers.push("MANUAL_OBSERVATION_REGISTRY_INCOMPLETE");
  if (registry.driftDetected) blockers.push("PRODUCTION_REGISTRY_DRIFT");
  const missingAdapters = validateAdapterCoverage(await reader.resolveAdapters()); if (missingAdapters.length) blockers.push("AUTHORITATIVE_ADAPTER_COVERAGE_INCOMPLETE");
  const identities = await reader.resolveIdentities(), requiredIdentities = ["release_verifier", "release_reviewer", "manual_observer", "administrator", "activation_operator", "readonly_operator", "hpm_customer", "guidebook_customer", "furnishing_customer", "investment_customer", "bundle_customer", "wrong_tenant", "revoked", "non_member"];
  if (requiredIdentities.some(code => !identities.activeIdentityTypeCodes.includes(code)) || identities.expiredCount) blockers.push("CONTROLLED_IDENTITY_SET_INCOMPLETE");
  if (!identities.verifierAuthorized) blockers.push("VERIFIER_NOT_AUTHORIZED"); if (!identities.reviewerAuthorized || identities.verifierId === identities.reviewerId) blockers.push("REVIEWER_NOT_AUTHORIZED");
  return Object.freeze({ ready: blockers.length === 0, candidateId: candidate.id, planCode: CA001F_PLAN.code, planVersion: CA001F_PLAN.version, blockerCodes: Object.freeze(blockers), evaluatedAt: new Date() });
}

export function assertReadyToStart(result: ProductionExecutionReadiness) { if (!result.ready) throw new ProductionVerificationError("PRODUCTION_EXECUTION_NOT_READY"); }
