import { describe, expect, it } from "vitest";
import { createHpmReleaseManifest, evaluateHpmCohortAccess, evaluateHpmFeatureFlags, evaluateReleaseThresholds, HPM_PLATFORM_V1_THRESHOLDS, HPM_RELEASE_FLAGS, transitionHpmRelease, validateCohort, validateHpmConfiguration, validateReleaseGates, verifyNoAutonomousAuthority, type HpmReleaseRecord } from ".";

const actor = { actorId: "operator-1", roleIds: ["release-owner"], active: true } as const;
const approval = { actorId: "operator-1", authority: "release-owner", approvedAt: "2026-08-09T18:00:00.000Z", rationale: "All required gates passed." } as const;
const record: HpmReleaseRecord = { id: "hpm-platform-v1", state: "draft", version: 1, manifestChecksum: "abc", cohort: "verification", events: [] };

describe("HPM-001F release controls", () => {
  it("defaults every feature off and enforces dependencies and kill switches", () => {
    expect(HPM_RELEASE_FLAGS.every(({ defaultEnabled }) => defaultEnabled === false)).toBe(true);
    expect(evaluateHpmFeatureFlags({ requested: { reporting: true } }).reporting).toBe(false);
    expect(evaluateHpmFeatureFlags({ requested: { workspace: true, lifecycle: true, reporting: true } }).reporting).toBe(true);
    expect(evaluateHpmFeatureFlags({ requested: { workspace: true, lifecycle: true, reporting: true }, killSwitches: { lifecycle: true } }).reporting).toBe(false);
    expect(evaluateHpmFeatureFlags({ requested: { workspace: true, lifecycle: true, learn: true, recommend: true }, killSwitches: { learn: true } }).recommend).toBe(false);
  });

  it("generates deterministic secret-free manifests", () => {
    const input = { releaseName: "Platform/HPM v1", semanticVersion: "1.0.0", gitCommitSha: "853147b8", buildId: "build-1", createdAt: "2026-08-09T18:00:00.000Z", migrationChecksums: {}, sourceContractVersions: { observations: "v1" }, policyVersions: { lifecycle: "hpm-lifecycle-v1" }, featureFlags: HPM_RELEASE_FLAGS, requiredEnvironmentVariables: ["HPM_UNIFIED_WORKSPACE_ENABLED"], runtimeVersions: { node: "22" }, knownLimitations: [], approvedDeferrals: [], rollbackTarget: "dcdb76c4" } as const;
    const first = createHpmReleaseManifest(input), second = createHpmReleaseManifest(input);
    expect(first.ok && second.ok && first.value.checksum).toBe(second.ok && second.value.checksum);
    expect(createHpmReleaseManifest({ ...input, gitCommitSha: "not-a-sha" })).toMatchObject({ ok: false, code: "HPM_RELEASE_MANIFEST_INVALID" });
    expect(createHpmReleaseManifest({ ...input, knownLimitations: ["postgres://user:password@example.test/db"] })).toMatchObject({ ok: false });
  });

  it("validates configuration by names and returns only a safe fingerprint", () => {
    const result = validateHpmConfiguration({ requiredNames: ["HPM_UNIFIED_WORKSPACE_ENABLED"], availableNames: ["HPM_UNIFIED_WORKSPACE_ENABLED", "DATABASE_URL"] });
    expect(result.ok && result.value.present).toEqual(["HPM_UNIFIED_WORKSPACE_ENABLED"]);
    expect(result.ok && result.value.safeFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(validateHpmConfiguration({ requiredNames: ["MISSING"], availableNames: [] })).toMatchObject({ ok: false, code: "HPM_RELEASE_CONFIGURATION_INVALID" });
  });

  it("blocks incomplete gates and incomplete deferrals", () => {
    const base = { required: true, owner: "release", checkedAt: "2026-08-09T18:00:00.000Z", evidenceReferences: ["evidence/test.txt"] } as const;
    expect(validateReleaseGates([{ ...base, id: "tests", status: "passed" }])).toMatchObject({ ok: true });
    expect(validateReleaseGates([{ ...base, id: "rls", status: "blocked" }])).toMatchObject({ ok: false });
    expect(validateReleaseGates([{ ...base, id: "migration", status: "approved-deferral", reason: "" }])).toMatchObject({ ok: false });
  });

  it("enforces release transitions, authority, approvals, concurrency, and idempotency", () => {
    const candidate = transitionHpmRelease({ record, expectedVersion: 1, to: "candidate", actor, environment: "preview", correlationId: "cor-1", idempotencyKey: "candidate-1", now: "2026-08-09T18:00:00.000Z" });
    expect(candidate.ok && candidate.value.state).toBe("candidate");
    expect(candidate.ok && candidate.value.version).toBe(2);
    if (!candidate.ok) throw new Error("candidate transition failed");
    const replay = transitionHpmRelease({ record: candidate.value, expectedVersion: 2, to: "ready-for-rehearsal", actor, environment: "preview", correlationId: "cor-1", idempotencyKey: "candidate-1", now: "2026-08-09T18:01:00.000Z" });
    expect(replay.ok && replay.value.version).toBe(2);
    expect(transitionHpmRelease({ record, expectedVersion: 0, to: "candidate", actor, environment: "preview", correlationId: "cor", idempotencyKey: "new", now: "2026-08-09T18:00:00.000Z" })).toMatchObject({ ok: false, currentVersion: 1 });
    expect(transitionHpmRelease({ record, expectedVersion: 1, to: "released", actor, environment: "production", correlationId: "cor", idempotencyKey: "bad", now: "2026-08-09T18:00:00.000Z" })).toMatchObject({ ok: false });
    expect(transitionHpmRelease({ record: { ...record, state: "rehearsal-passed" }, expectedVersion: 1, to: "ready-for-production", actor, environment: "production", correlationId: "cor", idempotencyKey: "approval", now: "2026-08-09T18:00:00.000Z" })).toMatchObject({ ok: false, code: "HPM_RELEASE_APPROVAL_REQUIRED" });
  });

  it("requires explicit cohort approval and bounded scope", () => {
    expect(validateCohort({ cohort: "internal", tenantCount: 3, propertyCount: 10, approval, predecessorCompleted: true })).toMatchObject({ ok: true });
    expect(validateCohort({ cohort: "internal", tenantCount: 6, propertyCount: 10, approval, predecessorCompleted: true })).toMatchObject({ ok: false, code: "HPM_RELEASE_COHORT_INELIGIBLE" });
    expect(validateCohort({ cohort: "limited", tenantCount: 1, propertyCount: 1, predecessorCompleted: true })).toMatchObject({ ok: false });
  });

  it("keeps internal cohorts limited to authenticated platform administrators", () => {
    expect(evaluateHpmCohortAccess({ cohort: "internal", enabled: true, profileRole: "admin" })).toBe(true);
    expect(evaluateHpmCohortAccess({ cohort: "internal", enabled: true, profileRole: "owner" })).toBe(false);
    expect(evaluateHpmCohortAccess({ cohort: "internal", enabled: false, profileRole: "admin" })).toBe(false);
    expect(evaluateHpmCohortAccess({ cohort: "named-test-tenants", enabled: true, tenantId: "tenant-a", namedTenantIds: ["tenant-a"] })).toBe(true);
    expect(evaluateHpmCohortAccess({ cohort: "named-test-tenants", enabled: true, tenantId: "tenant-b", namedTenantIds: ["tenant-a"] })).toBe(false);
  });

  it("halts on safety signals and applies immutable rollout thresholds", () => {
    const healthy = { projectionAvailability: 1, projectionP95Ms: 900, sourceFailureRate: 0, reportSuccess: 1, exportSuccess: 1, clientErrorRate: 0, oldestJobAgeMs: 0, crossTenantSignals: 0, unauthorizedMutations: 0, corruptedLineage: 0, autonomousActions: 0 };
    expect(evaluateReleaseThresholds(healthy)).toMatchObject({ ok: true });
    expect(evaluateReleaseThresholds({ ...healthy, crossTenantSignals: 1 })).toMatchObject({ ok: false, code: "HPM_RELEASE_HALTED" });
    expect(evaluateReleaseThresholds({ ...healthy, projectionP95Ms: HPM_PLATFORM_V1_THRESHOLDS.projectionP95MaximumMs + 1 })).toMatchObject({ ok: false, code: "HPM_RELEASE_THRESHOLD_BREACHED" });
  });

  it("prevents every automated authority-bearing mutation", () => {
    for (const command of ["accept-recommendation", "approve-decision", "activate-action", "assign-worker", "change-policy", "mutate-provider", "send-external-communication", "approve-learning"]) expect(verifyNoAutonomousAuthority({ source: "scheduler", command })).toMatchObject({ ok: false, code: "HPM_RELEASE_AUTONOMY_GUARD_FAILED" });
    expect(verifyNoAutonomousAuthority({ source: "human", command: "approve-decision", authenticatedActorId: "actor", explicitApprovalId: "approval" })).toMatchObject({ ok: true });
    expect(verifyNoAutonomousAuthority({ source: "feedback", command: "create-recommendation-opportunity" })).toMatchObject({ ok: true });
  });
});
