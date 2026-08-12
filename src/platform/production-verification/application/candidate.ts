import { ProductionReleaseCandidate, ProductionVerificationError } from "../domain";

export type ResolvedProductionState = Omit<ProductionReleaseCandidate, "id" | "createdAt">;
export interface ProductionReleaseResolver { resolve(): Promise<ResolvedProductionState>; }

export async function confirmReleaseCandidate(expected: { commitSha: string; deploymentId: string; planVersion: number }, resolver: ProductionReleaseResolver): Promise<ResolvedProductionState> {
  const actual = await resolver.resolve();
  if (actual.environmentCode !== "production") throw new ProductionVerificationError("ENVIRONMENT_NOT_PRODUCTION");
  if (actual.commitSha !== expected.commitSha) throw new ProductionVerificationError("CANDIDATE_COMMIT_MISMATCH");
  if (actual.deploymentId !== expected.deploymentId) throw new ProductionVerificationError("CANDIDATE_DEPLOYMENT_MISMATCH");
  if (actual.verificationPlanVersion !== expected.planVersion) throw new ProductionVerificationError("VERIFICATION_PLAN_VERSION_MISMATCH");
  if (!actual.productionAlias || !actual.databaseMigrationSetHash || !actual.latestMigrationCode) throw new ProductionVerificationError("CANDIDATE_IDENTITY_INCOMPLETE");
  return actual;
}

export function assertCandidateUnchanged(locked: ProductionReleaseCandidate, current: ResolvedProductionState) {
  if (locked.commitSha !== current.commitSha || locked.deploymentId !== current.deploymentId || locked.databaseMigrationSetHash !== current.databaseMigrationSetHash || locked.featureConfigurationFingerprint !== current.featureConfigurationFingerprint) throw new ProductionVerificationError("CANDIDATE_CHANGED_DURING_RUN");
}
