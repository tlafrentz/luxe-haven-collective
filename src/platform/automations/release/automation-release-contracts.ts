export const AUTOMATION_RELEASE_SCHEMA_VERSION = "au-release-manifest-v1";
export const AUTOMATION_RELEASE_POLICY_VERSION = "au001f-release-v1";

export const AUTOMATION_RELEASE_FAILURE_CODES = [
  "AU_RELEASE_PREREQUISITE_FAILED",
  "AU_RELEASE_CONFIGURATION_INVALID",
  "AU_RELEASE_CONTRACT_INCOMPATIBLE",
  "AU_RELEASE_MIGRATION_FAILED",
  "AU_RELEASE_INTEGRITY_FAILED",
  "AU_RELEASE_RLS_FAILED",
  "AU_RELEASE_AUTHORIZATION_FAILED",
  "AU_RELEASE_AUTONOMOUS_AUTHORITY_DETECTED",
  "AU_RELEASE_DUPLICATE_EFFECT_DETECTED",
  "AU_RELEASE_OBSERVABILITY_FAILED",
  "AU_RELEASE_KILL_SWITCH_FAILED",
  "AU_RELEASE_SMOKE_TEST_FAILED",
  "AU_RELEASE_THRESHOLD_BREACHED",
  "AU_RELEASE_ROLLBACK_FAILED",
  "AU_RELEASE_APPROVAL_REQUIRED",
] as const;
export type AutomationReleaseFailureCode =
  (typeof AUTOMATION_RELEASE_FAILURE_CODES)[number];
export const AUTOMATION_RELEASE_STATES = [
  "draft",
  "candidate",
  "ready-for-rehearsal",
  "rehearsal-passed",
  "ready-for-disabled-deployment",
  "deployed-disabled",
  "internal-read-only",
  "internal-shadow",
  "internal-tier-one",
  "pilot",
  "stabilizing",
  "released",
  "paused",
  "halted",
  "rolled-back",
  "superseded",
] as const;
export type AutomationReleaseState = (typeof AUTOMATION_RELEASE_STATES)[number];
export type AutomationReleaseEnvironment =
  | "development"
  | "test"
  | "preview"
  | "staging"
  | "production";
export type AutomationReleaseCohort =
  | "none"
  | "internal-read-only"
  | "internal-shadow"
  | "internal-tier-one"
  | "named-pilot"
  | "limited"
  | "general-availability";
export type AutomationRiskTier = 0 | 1 | 2 | 3;
export type AutomationReleaseGateStatus =
  | "passed"
  | "approved_deferral"
  | "blocked"
  | "not_applicable";

export type AutomationReleaseActor = Readonly<{
  actorId: string;
  active: boolean;
  roleIds: readonly string[];
}>;
export type AutomationReleaseApproval = Readonly<{
  actorId: string;
  authority: "product" | "engineering" | "security" | "operations" | "release";
  approvedAt: string;
  rationale: string;
}>;
export type AutomationReleaseGate = Readonly<{
  id: string;
  requirement: string;
  slice:
    | "AU-001A"
    | "AU-001B"
    | "AU-001C"
    | "AU-001D"
    | "AU-001E"
    | "AU-001F"
    | "HPM-001F";
  implementationCommit?: string;
  status: AutomationReleaseGateStatus;
  evidence: readonly string[];
  migrationDependencies: readonly string[];
  integrationVersions: Readonly<Record<string, string>>;
  flags: readonly string[];
  owner: string;
  checkedAt: string;
  deferral?: Readonly<{
    rationale: string;
    risk: string;
    mitigation: string;
    owner: string;
    followUp: string;
  }>;
}>;
export type AutomationReleaseFlag = Readonly<{
  key: string;
  environment: AutomationReleaseEnvironment;
  defaultEnabled: false;
  dependencies: readonly string[];
  killSwitch: string;
  riskTier: AutomationRiskTier;
  owner: string;
}>;
export type AutomationCommandRisk = Readonly<{
  capability: string;
  command: string;
  version: string;
  tier: AutomationRiskTier;
  enabledForInitialRelease: boolean;
  requiresApproval: boolean;
  reversible: boolean;
  externalEffect: boolean;
  owner: string;
}>;
export type AutomationCohortRule = Readonly<{
  cohort: AutomationReleaseCohort;
  maximumTenants: number;
  maximumProperties: number;
  maximumDefinitions: number;
  allowedRiskTiers: readonly AutomationRiskTier[];
  observationMinutes: number;
  predecessor?: AutomationReleaseCohort;
  requiresApproval: true;
}>;
export type AutomationReleaseManifestInput = Readonly<{
  releaseId: string;
  semanticVersion: string;
  createdAt: string;
  gitCommit: string;
  buildArtifactId: string;
  deploymentId?: string;
  implementationCommits: Readonly<Record<string, string>>;
  migrationChecksums: Readonly<Record<string, string>>;
  requiredEnvironmentVariableNames: readonly string[];
  flags: readonly AutomationReleaseFlag[];
  cohortRules: readonly AutomationCohortRule[];
  integrationVersions: Readonly<Record<string, readonly string[]>>;
  commandRisks: readonly AutomationCommandRisk[];
  enabledTriggerIds: readonly string[];
  enabledTemplateIds: readonly string[];
  enabledNotificationIds: readonly string[];
  enabledReportIds: readonly string[];
  knownLimitations: readonly string[];
  approvedDeferrals: readonly string[];
  evidenceIndex: readonly string[];
  runbookVersion: string;
  rollbackTarget: string;
  approvers: readonly AutomationReleaseApproval[];
}>;
export type AutomationReleaseManifest = AutomationReleaseManifestInput &
  Readonly<{
    schemaVersion: typeof AUTOMATION_RELEASE_SCHEMA_VERSION;
    checksum: string;
  }>;
export type AutomationReleaseRecord = Readonly<{
  id: string;
  manifestChecksum: string;
  state: AutomationReleaseState;
  cohort: AutomationReleaseCohort;
  version: number;
  events: readonly AutomationReleaseEvent[];
}>;
export type AutomationReleaseEvent = Readonly<{
  id: string;
  from: AutomationReleaseState;
  to: AutomationReleaseState;
  environment: AutomationReleaseEnvironment;
  actorId: string;
  approvalAuthorities: readonly AutomationReleaseApproval["authority"][];
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  classification: string;
  version: number;
}>;
export type AutomationReleaseResult<T> = Readonly<
  | { ok: true; value: T }
  | {
      ok: false;
      code: AutomationReleaseFailureCode;
      message: string;
      currentVersion?: number;
    }
>;

export const AUTOMATION_CATEGORICAL_HALT_SIGNALS = [
  "tenant-isolation",
  "unauthorized-effect",
  "autonomous-authority",
  "duplicate-business-effect",
  "unbounded-fan-out",
  "data-corruption",
  "broken-lineage",
  "dispatch-stop-failed",
  "unsafe-unknown-outcome",
  "critical-adapter-incompatible",
  "monitoring-blindness",
  "threshold-breach",
] as const;
