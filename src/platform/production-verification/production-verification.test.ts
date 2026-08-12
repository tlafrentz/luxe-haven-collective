import { describe, expect, it, vi } from "vitest";
import { CA001F_PLAN, ExecuteVerificationScenario, ProductionVerificationError, VERIFICATION_SCENARIOS, assertCandidateUnchanged, assertExactCleanupTarget, confirmReleaseCandidate, evaluateReleaseGate, transitionVerificationRun, validateVerificationRegistry } from ".";

const state = { environmentCode: "production" as const, repositoryCode: "luxe-haven", commitSha: "a".repeat(40), deploymentId: "dep_opaque", deploymentUrl: "https://deployment.invalid", productionAlias: "https://example.invalid", deployedAt: new Date(), databaseMigrationSetHash: "migration-hash", latestMigrationCode: "20260811100000", registryVersions: { commercial: 1, entitlement: 1, onboarding: 1, firstValue: 1, admin: 1 }, verificationPlanVersion: 1, featureConfigurationFingerprint: "configuration-hash" };

describe("CA-001F registries and candidate locking", () => {
  it("registers the complete immutable PV-001 through PV-031 plan", () => {
    expect(validateVerificationRegistry()).toBe(true);
    expect(VERIFICATION_SCENARIOS).toHaveLength(31);
    expect(CA001F_PLAN.requiredScenarioCodes).toEqual(Array.from({ length: 31 }, (_, index) => `PV-${String(index + 1).padStart(3, "0")}`));
    expect(Object.isFrozen(VERIFICATION_SCENARIOS)).toBe(true);
  });
  it("confirms exact production identity and rejects substitution", async () => {
    await expect(confirmReleaseCandidate({ commitSha: state.commitSha, deploymentId: state.deploymentId, planVersion: 1 }, { resolve: async () => state })).resolves.toEqual(state);
    await expect(confirmReleaseCandidate({ commitSha: "wrong", deploymentId: state.deploymentId, planVersion: 1 }, { resolve: async () => state })).rejects.toMatchObject({ code: "CANDIDATE_COMMIT_MISMATCH" });
  });
  it("detects an alias target/configuration change during a run", () => {
    const locked = { ...state, id: "candidate", createdAt: new Date() };
    expect(() => assertCandidateUnchanged(locked, { ...state, deploymentId: "new" })).toThrowError(ProductionVerificationError);
  });
  it("uses expected revisions and forbids direct draft-to-pass", () => {
    const run = { id: "run", releaseCandidateId: "candidate", planCode: CA001F_PLAN.code, planVersion: 1, environmentCode: "production" as const, status: "draft" as const, initiatedBy: "actor", correlationId: "correlation", revision: 1 };
    expect(() => transitionVerificationRun(run, "passed", 1)).toThrowError(ProductionVerificationError);
    expect(transitionVerificationRun(run, "ready", 1).revision).toBe(2);
    expect(() => transitionVerificationRun(run, "ready", 2)).toThrowError(ProductionVerificationError);
  });
});

describe("CA-001F scenario execution", () => {
  const instance = { id: "instance", verificationRunId: "run", scenarioCode: "PV-001", scenarioVersion: 1, status: "ready" as const, latestAttemptNumber: 0, expectedOutcomeCode: "PV-001_PASS", revision: 1 };
  const identity = { id: "identity", environmentCode: "production" as const, identityTypeCode: "release_verifier", allowedScenarioCodes: ["PV-001"], status: "active" as const };
  const auth = { authorize: vi.fn(async () => ({ allowed: true, roles: ["release_verifier"] })) };
  const attempts = { hasActiveAttempt: vi.fn(async () => false), findAttemptByIdempotencyHash: vi.fn(async () => null), createAttempt: vi.fn(async () => ({ id: "attempt" })) };
  const port = { execute: vi.fn(async () => ({ stableResultCode: "CANDIDATE_CONFIRMED" })) };
  it("executes only a registered, controlled, authorized scenario", async () => {
    await expect(new ExecuteVerificationScenario(auth, attempts, port).execute({ actorId: "actor", runId: "run", instance, identity, completedScenarioCodes: [], correlationId: "correlation", idempotencyKeyHash: "hash" })).resolves.toMatchObject({ attemptId: "attempt", stableResultCode: "CANDIDATE_CONFIRMED" });
    expect(port.execute).toHaveBeenCalledWith("EXECUTE_PV-001", expect.objectContaining({ controlledIdentityId: "identity" }));
  });
  it("rejects browser-invented scenarios and uncontrolled identities", async () => {
    const operation = new ExecuteVerificationScenario(auth, attempts, port);
    await expect(operation.execute({ actorId: "actor", runId: "run", instance: { ...instance, scenarioCode: "PV-X" }, identity, completedScenarioCodes: [], correlationId: "c", idempotencyKeyHash: "h2" })).rejects.toMatchObject({ code: "SCENARIO_NOT_REGISTERED" });
    await expect(operation.execute({ actorId: "actor", runId: "run", instance, identity: { ...identity, allowedScenarioCodes: [] }, completedScenarioCodes: [], correlationId: "c", idempotencyKeyHash: "h3" })).rejects.toMatchObject({ code: "CONTROLLED_IDENTITY_SCENARIO_DENIED" });
  });
  it("prevents concurrent attempts", async () => {
    const busy = { ...attempts, hasActiveAttempt: vi.fn(async () => true) };
    await expect(new ExecuteVerificationScenario(auth, busy, port).execute({ actorId: "actor", runId: "run", instance, identity, completedScenarioCodes: [], correlationId: "c", idempotencyKeyHash: "unique" })).rejects.toMatchObject({ code: "SCENARIO_ATTEMPT_ACTIVE" });
  });
});

describe("CA-001F evidence, gate, and cleanup", () => {
  const scenarios = VERIFICATION_SCENARIOS.map((definition, index) => ({ id: `instance-${index}`, verificationRunId: "run", scenarioCode: definition.code, scenarioVersion: 1, status: "passed" as const, latestAttemptNumber: 1, expectedOutcomeCode: definition.expectedOutcomeCode, actualOutcomeCode: definition.expectedOutcomeCode, revision: 2 }));
  const evidence = scenarios.map((instance, index) => ({ id: `evidence-${index}`, verificationRunId: "run", scenarioInstanceId: instance.id, evidenceCode: `${instance.scenarioCode}_CANONICAL_EVIDENCE`, evidenceVersion: 1, sourceDomainCode: "canonical", sourceResourceType: "decision", opaqueSourceReference: `opaque-${index}`, classification: "valid" as const, observedOutcomeCode: instance.expectedOutcomeCode, capturedAt: new Date(), capturedBy: "system" as const, correlationId: "correlation" }));
  it("passes only with every canonical evidence and review/cleanup gate", () => {
    expect(evaluateReleaseGate({ candidateConfirmed: true, candidateUnchanged: true, scenarios, evidence, resources: [], reviewerApproved: true, manualCheckpointsComplete: true }).status).toBe("pass");
    expect(evaluateReleaseGate({ candidateConfirmed: true, candidateUnchanged: true, scenarios, evidence: evidence.slice(1), resources: [], reviewerApproved: true, manualCheckpointsComplete: true })).toMatchObject({ status: "blocked", blockerCodes: ["EVIDENCE_MISSING:PV-001"] });
  });
  it("refuses broad, reused, or cross-run cleanup targets", () => {
    const resource = { id: "resource", verificationRunId: "run", owningDomainCode: "guidebook", resourceTypeCode: "guidebook", opaqueResourceId: "opaque", creationClassification: "created" as const, cleanupClassification: "required" as const, cleanupStatus: "pending" as const };
    expect(() => assertExactCleanupTarget(resource, "run")).not.toThrow();
    expect(() => assertExactCleanupTarget({ ...resource, creationClassification: "reused" }, "run")).toThrowError(ProductionVerificationError);
    expect(() => assertExactCleanupTarget(resource, "another-run")).toThrowError(ProductionVerificationError);
  });
});
