import { describe, expect, it } from "vitest";
import {
  createAutomationReleaseManifest,
  validateAutomationReleaseConfiguration,
} from "./automation-release-manifest";
import {
  AUTOMATION_CATEGORICAL_HALT_SIGNALS,
  type AutomationReleaseManifestInput,
  type AutomationReleaseRecord,
} from "./automation-release-contracts";
import {
  AUTOMATION_COHORT_RULES,
  AUTOMATION_RELEASE_FLAGS,
  evaluateAutomationReleaseFlags,
  transitionAutomationRelease,
  validateAutomationCohort,
  validateAutomationCommandRisks,
  validateAutomationReleaseGates,
} from "./automation-release-policy";

const now = "2026-08-10T23:30:00.000Z",
  sha = "8ecd6d428393dfb5c453e112545584d1498729da",
  approval = (
    authority:
      | "product"
      | "engineering"
      | "security"
      | "operations"
      | "release",
  ) => ({
    actorId: `${authority}-owner`,
    authority,
    approvedAt: now,
    rationale: "Reviewed release evidence.",
  });
const record = (
  state: AutomationReleaseRecord["state"] = "rehearsal-passed",
): AutomationReleaseRecord => ({
  id: "au001-v1",
  manifestChecksum: "checksum",
  state,
  cohort: "none",
  version: 1,
  events: [],
});
const manifest = (
  overrides: Partial<AutomationReleaseManifestInput> = {},
): AutomationReleaseManifestInput => ({
  releaseId: "au001-v1",
  semanticVersion: "1.0.0",
  createdAt: now,
  gitCommit: sha,
  buildArtifactId: "build-immutable",
  implementationCommits: {
    "AU-001A": "2c4e0b93",
    "AU-001B": "bd2e1c99",
    "AU-001C": "0ee433f5",
    "AU-001D": "6e8fbf92",
    "AU-001E": "8ecd6d42",
  },
  migrationChecksums: { "20260810010000": "checksum" },
  requiredEnvironmentVariableNames: ["AUTOMATION_WORKSPACE_ENABLED"],
  flags: AUTOMATION_RELEASE_FLAGS,
  cohortRules: AUTOMATION_COHORT_RULES,
  integrationVersions: { hpm: ["hpm-source-v1"], execute: ["v1"] },
  commandRisks: [
    {
      capability: "reporting",
      command: "generate",
      version: "v1",
      tier: 0,
      enabledForInitialRelease: true,
      requiresApproval: false,
      reversible: true,
      externalEffect: false,
      owner: "automation",
    },
  ],
  enabledTriggerIds: [],
  enabledTemplateIds: [],
  enabledNotificationIds: [],
  enabledReportIds: ["operational-health"],
  knownLimitations: ["Production approval pending."],
  approvedDeferrals: [],
  evidenceIndex: ["docs/releases/au-001-production-readiness.md"],
  runbookVersion: "au001e-v1",
  rollbackTarget: "8ecd6d428393dfb5c453e112545584d1498729da",
  approvers: [],
  ...overrides,
});

describe("AU-001F release controls", () => {
  it("keeps every production flag off by default and enforces dependencies and risk tiers", () => {
    const requested = Object.fromEntries(
        AUTOMATION_RELEASE_FLAGS.map(({ key }) => [key, true]),
      ),
      result = evaluateAutomationReleaseFlags({
        requested,
        killSwitches: {
          AUTOMATION_GOVERNED_DISPATCH_ENABLED_KILL_SWITCH: true,
        },
        environment: "production",
        allowedRiskTiers: [0],
      });
    expect(
      AUTOMATION_RELEASE_FLAGS.every(
        ({ defaultEnabled }) => defaultEnabled === false,
      ),
    ).toBe(true);
    expect(result.AUTOMATION_WORKSPACE_ENABLED).toBe(true);
    expect(result.AUTOMATION_GOVERNED_DISPATCH_ENABLED).toBe(false);
    expect(result.AUTOMATION_RETRY_PROCESSING_ENABLED).toBe(false);
  });
  it("blocks production promotion until HPM-001F final approval is explicit", () => {
    const result = transitionAutomationRelease({
      record: record(),
      expectedVersion: 1,
      to: "ready-for-disabled-deployment",
      actor: { actorId: "release", active: true, roleIds: ["release-owner"] },
      approvals: [approval("release")],
      environment: "production",
      correlationId: "correlation",
      idempotencyKey: "promotion",
      now,
      hpmFinalApproval: false,
      readinessGatesPassed: false,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "AU_RELEASE_PREREQUISITE_FAILED",
    });
  });
  it("does not allow HPM approval alone to unlock production promotion", () => {
    const result = transitionAutomationRelease({
      record: record(),
      expectedVersion: 1,
      to: "ready-for-disabled-deployment",
      actor: { actorId: "release", active: true, roleIds: ["release-owner"] },
      approvals: [approval("release")],
      environment: "production",
      correlationId: "correlation",
      idempotencyKey: "readiness-gates",
      now,
      hpmFinalApproval: true,
      readinessGatesPassed: false,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "AU_RELEASE_PREREQUISITE_FAILED",
    });
  });
  it("requires all five authorities for final release", () => {
    const result = transitionAutomationRelease({
      record: record("stabilizing"),
      expectedVersion: 1,
      to: "released",
      actor: { actorId: "release", active: true, roleIds: ["release-owner"] },
      approvals: [approval("release")],
      environment: "production",
      correlationId: "correlation",
      idempotencyKey: "release",
      now,
      hpmFinalApproval: true,
      readinessGatesPassed: true,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "AU_RELEASE_APPROVAL_REQUIRED",
    });
  });
  it("categorical halt signals prevent promotion", () => {
    const result = transitionAutomationRelease({
      record: record(),
      expectedVersion: 1,
      to: "ready-for-disabled-deployment",
      actor: { actorId: "release", active: true, roleIds: ["release-owner"] },
      approvals: [approval("release")],
      environment: "production",
      correlationId: "correlation",
      idempotencyKey: "promotion",
      now,
      hpmFinalApproval: true,
      readinessGatesPassed: true,
      haltSignals: [AUTOMATION_CATEGORICAL_HALT_SIGNALS[0]],
    });
    expect(result).toMatchObject({
      ok: false,
      code: "AU_RELEASE_THRESHOLD_BREACHED",
    });
  });
  it("rejects protected or external commands from initial enablement", () => {
    expect(
      validateAutomationCommandRisks([
        {
          capability: "provider",
          command: "change-price",
          version: "v1",
          tier: 3,
          enabledForInitialRelease: true,
          requiresApproval: true,
          reversible: false,
          externalEffect: true,
          owner: "revenue",
        },
      ]),
    ).toMatchObject({
      ok: false,
      code: "AU_RELEASE_AUTONOMOUS_AUTHORITY_DETECTED",
    });
  });
  it("bounds cohorts by explicit subjects and risk classes", () => {
    expect(
      validateAutomationCohort({
        cohort: "internal-tier-one",
        tenantCount: 3,
        propertyCount: 1,
        definitionCount: 1,
        riskTiers: [1],
        predecessorCompleted: true,
        approval: approval("release"),
      }),
    ).toMatchObject({ ok: false, code: "AU_RELEASE_APPROVAL_REQUIRED" });
  });
  it("does not permit blocked readiness gates or incomplete deferrals", () => {
    expect(
      validateAutomationReleaseGates([
        {
          id: "hpm",
          requirement: "HPM approval",
          slice: "HPM-001F",
          status: "blocked",
          evidence: [],
          migrationDependencies: [],
          integrationVersions: {},
          flags: [],
          owner: "release",
          checkedAt: now,
        },
      ]),
    ).toMatchObject({ ok: false });
  });
  it("creates deterministic manifests containing names but rejecting credentials", () => {
    const first = createAutomationReleaseManifest(manifest()),
      second = createAutomationReleaseManifest(manifest());
    expect(first.ok && second.ok && first.value.checksum).toBe(
      second.ok ? second.value.checksum : "",
    );
    expect(
      createAutomationReleaseManifest(
        manifest({ buildArtifactId: "postgres://secret@host/db" }),
      ),
    ).toMatchObject({ ok: false, code: "AU_RELEASE_CONFIGURATION_INVALID" });
  });
  it("validates configuration by name and emits only a safe fingerprint", () => {
    const result = validateAutomationReleaseConfiguration({
      requiredNames: ["A", "B"],
      availableNames: ["B", "A", "SECRET_UNUSED"],
    });
    expect(result.ok && result.value.names).toEqual(["A", "B"]);
    expect(result.ok && result.value.safeFingerprint).toHaveLength(64);
  });
});
