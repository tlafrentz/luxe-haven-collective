export const HPM_PLATFORM_RELEASE_VERSION = "hpm-platform-v1";
export const HPM_RELEASE_POLICY_VERSION = "hpm-release-v1";

export const HPM_RELEASE_FAILURE_CODES = [
  "HPM_RELEASE_PREREQUISITE_FAILED", "HPM_RELEASE_MANIFEST_INVALID", "HPM_RELEASE_CONFIGURATION_INVALID",
  "HPM_RELEASE_SOURCE_INCOMPATIBLE", "HPM_RELEASE_MIGRATION_FAILED", "HPM_RELEASE_MIGRATION_VERIFICATION_FAILED",
  "HPM_RELEASE_DATA_INTEGRITY_FAILED", "HPM_RELEASE_RLS_VERIFICATION_FAILED", "HPM_RELEASE_LIFECYCLE_VERIFICATION_FAILED",
  "HPM_RELEASE_AUTONOMY_GUARD_FAILED", "HPM_RELEASE_FLAG_EVALUATION_FAILED", "HPM_RELEASE_COHORT_INELIGIBLE",
  "HPM_RELEASE_THRESHOLD_BREACHED", "HPM_RELEASE_SMOKE_TEST_FAILED", "HPM_RELEASE_ROLLBACK_REHEARSAL_FAILED",
  "HPM_RELEASE_ROLLBACK_FAILED", "HPM_RELEASE_RECOVERY_FAILED", "HPM_RELEASE_OBSERVABILITY_INSUFFICIENT",
  "HPM_RELEASE_APPROVAL_REQUIRED", "HPM_RELEASE_STABILIZATION_INCOMPLETE", "HPM_RELEASE_HALTED",
] as const;
export type HpmReleaseFailureCode = typeof HPM_RELEASE_FAILURE_CODES[number];

export const HPM_RELEASE_STATES = ["draft", "candidate", "ready-for-rehearsal", "rehearsal-passed", "ready-for-production", "deployed-disabled", "internal-enabled", "limited-cohort", "broad-cohort", "stabilizing", "released", "paused", "halted", "rolled-back", "superseded"] as const;
export type HpmReleaseState = typeof HPM_RELEASE_STATES[number];
export type HpmReleaseEnvironment = "development" | "test" | "preview" | "staging" | "production";
export type HpmReleaseCohort = "verification" | "internal" | "named-test-tenants" | "limited" | "broad" | "general-availability";
export type HpmFeatureKey = "workspace" | "lifecycle" | "attention" | "command-routing" | "reporting" | "operations" | "learn" | "recommend";

export type HpmReleaseActor = Readonly<{ actorId: string; roleIds: readonly string[]; active: boolean }>;
export type HpmReleaseApproval = Readonly<{ actorId: string; authority: "release-owner" | "incident-commander" | "security" | "operations"; approvedAt: string; rationale: string }>;
export type HpmReleaseFlag = Readonly<{ key: HpmFeatureKey; owner: string; defaultEnabled: false; environments: readonly HpmReleaseEnvironment[]; dependencies: readonly HpmFeatureKey[]; killSwitch: string; removalCriteria: string }>;
export type HpmCohortRule = Readonly<{ cohort: HpmReleaseCohort; maximumTenants: number; maximumProperties: number; observationMinutes: number; requiresApproval: true; predecessor?: HpmReleaseCohort }>;
export type HpmReleaseGate = Readonly<{ id: string; required: boolean; status: "passed" | "approved-deferral" | "blocked" | "not-applicable"; evidenceReferences: readonly string[]; owner: string; checkedAt: string; reason?: string }>;

export type HpmReleaseManifestInput = Readonly<{
  releaseName: string; semanticVersion: string; gitCommitSha: string; buildId: string; createdAt: string;
  migrationChecksums: Readonly<Record<string, string>>; sourceContractVersions: Readonly<Record<string, string>>;
  policyVersions: Readonly<Record<string, string>>; featureFlags: readonly HpmReleaseFlag[];
  requiredEnvironmentVariables: readonly string[]; runtimeVersions: Readonly<Record<string, string>>;
  knownLimitations: readonly string[]; approvedDeferrals: readonly string[]; rollbackTarget: string;
}>;
export type HpmReleaseManifest = HpmReleaseManifestInput & Readonly<{ schemaVersion: "hpm-release-manifest-v1"; checksum: string }>;

export type HpmReleaseEvent = Readonly<{ id: string; releaseId: string; from: HpmReleaseState; to: HpmReleaseState; actorId: string; environment: HpmReleaseEnvironment; correlationId: string; idempotencyKey: string; occurredAt: string; result: "accepted" | "rejected"; classification: string; version: number }>;
export type HpmReleaseRecord = Readonly<{ id: string; state: HpmReleaseState; version: number; manifestChecksum: string; cohort: HpmReleaseCohort; events: readonly HpmReleaseEvent[] }>;
export type HpmReleaseResult<T> = Readonly<{ ok: true; value: T } | { ok: false; code: HpmReleaseFailureCode; message: string; currentVersion?: number }>;

export const HPM_HALT_SIGNALS = ["tenant-isolation", "unauthorized-mutation", "autonomous-authority", "data-loss", "broken-lineage", "rls-missing", "required-source-incompatible", "migration-verification", "threshold-breach", "report-reconciliation", "kill-switch-failure", "support-unavailable"] as const;
