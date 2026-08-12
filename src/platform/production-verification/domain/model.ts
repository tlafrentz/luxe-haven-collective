export type VerificationRunStatus =
  | "draft" | "ready" | "running" | "paused" | "blocked"
  | "awaiting_review" | "passed" | "failed" | "cancelled";

export type ScenarioStatus =
  | "pending" | "ready" | "running" | "waiting" | "passed"
  | "failed" | "blocked" | "skipped" | "cancelled";

export type ProductionReleaseCandidate = {
  id: string;
  environmentCode: "production";
  repositoryCode: string;
  commitSha: string;
  deploymentId: string;
  deploymentUrl: string;
  productionAlias: string;
  buildId?: string;
  deployedAt: Date;
  databaseMigrationSetHash: string;
  latestMigrationCode: string;
  registryVersions: Readonly<Record<string, number>>;
  verificationPlanVersion: number;
  featureConfigurationFingerprint: string;
  createdAt: Date;
};

export type ProductionVerificationRun = {
  id: string;
  releaseCandidateId: string;
  planCode: string;
  planVersion: number;
  environmentCode: "production";
  status: VerificationRunStatus;
  initiatedBy: string;
  reviewedBy?: string;
  startedAt?: Date;
  completedAt?: Date;
  correlationId: string;
  revision: number;
};

export type VerificationScenarioInstance = {
  id: string;
  verificationRunId: string;
  scenarioCode: string;
  scenarioVersion: number;
  status: ScenarioStatus;
  latestAttemptNumber: number;
  expectedOutcomeCode: string;
  actualOutcomeCode?: string;
  blockerCode?: string;
  revision: number;
};

export type VerificationEvidence = {
  id: string;
  verificationRunId: string;
  scenarioInstanceId: string;
  evidenceCode: string;
  evidenceVersion: number;
  sourceDomainCode: string;
  sourceResourceType: string;
  opaqueSourceReference: string;
  classification: "valid" | "invalid" | "missing" | "expired" | "superseded";
  observedOutcomeCode: string;
  capturedAt: Date;
  capturedBy: "system" | "verifier" | "reviewer";
  correlationId: string;
};

export type VerificationResourceReference = {
  id: string;
  verificationRunId: string;
  scenarioInstanceId?: string;
  owningDomainCode: string;
  resourceTypeCode: string;
  opaqueResourceId: string;
  creationClassification: "created" | "reused" | "preexisting_fixture";
  cleanupClassification: "required" | "retain" | "owning_domain_retention" | "not_applicable";
  cleanupStatus: "pending" | "completed" | "failed" | "retained";
};

export class ProductionVerificationError extends Error {
  constructor(public readonly code: string) { super(code); Object.freeze(this); }
}

const transitions: Readonly<Record<VerificationRunStatus, readonly VerificationRunStatus[]>> = {
  draft: ["ready", "cancelled"], ready: ["running", "blocked", "cancelled"],
  running: ["paused", "blocked", "awaiting_review", "failed", "cancelled"],
  paused: ["running", "blocked", "cancelled"], blocked: ["running", "failed", "cancelled"],
  awaiting_review: ["passed", "failed", "blocked"], passed: [], failed: [], cancelled: [],
};

export function transitionVerificationRun(run: ProductionVerificationRun, next: VerificationRunStatus, expectedRevision: number) {
  if (run.revision !== expectedRevision) throw new ProductionVerificationError("STALE_VERIFICATION_REVISION");
  if (!transitions[run.status].includes(next)) throw new ProductionVerificationError("INVALID_VERIFICATION_TRANSITION");
  return { ...run, status: next, revision: run.revision + 1 };
}
