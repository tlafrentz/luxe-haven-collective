import { describe, expect, it } from "vitest";
import type {
  AutomationRun,
  AutomationRunStep,
} from "../domain/automation-governed-execution";
import {
  detectAutomationReconciliationCandidates,
  overallAutomationHealth,
  projectAutomationOperations,
} from "./automation-health";
import { validateAutomationIntegrations } from "./automation-integration-registry";
import {
  exportAutomationReportCsv,
  generateAutomationReport,
} from "./automation-reporting";
import { createHpmProjectionSourcePort } from "@/platform/hpm";
import { createAutomationHpmExecuteContributionPort } from "./automation-hpm-source";

const now = "2026-08-10T18:00:00.000Z";
const run = (overrides: Partial<AutomationRun> = {}): AutomationRun => ({
  id: "run-1",
  tenantId: "tenant-a",
  propertyIds: ["property-a"],
  automationDefinitionId: "definition-a",
  automationDefinitionVersionId: "version-a",
  automationDefinitionVersion: 1,
  runRequestId: "request-a",
  triggerOccurrenceId: "occurrence-a",
  executionPlanVersion: "v1",
  initiatingActorId: "actor-a",
  serviceActorPolicyId: "service-a",
  correlationId: "correlation-a",
  causationId: "causation-a",
  status: "running",
  createdAt: "2026-08-10T16:00:00.000Z",
  updatedAt: "2026-08-10T16:00:00.000Z",
  version: 1,
  ...overrides,
});
const step = (
  overrides: Partial<AutomationRunStep> = {},
): AutomationRunStep => ({
  id: "step-1",
  tenantId: "tenant-a",
  runId: "run-1",
  stepKey: "execute",
  owningCapability: "Execute",
  commandType: "create-draft-plan",
  commandContractVersion: "v1",
  dependencies: [],
  status: "leased",
  deterministicCommandId: "command-a",
  idempotencyKey: "idem-a",
  attemptCount: 1,
  leaseGeneration: 1,
  version: 1,
  ...overrides,
});
const source = (overrides: Record<string, unknown> = {}) => ({
  runs: [run({ status: "succeeded" })],
  steps: [step({ leaseExpiresAt: "2026-08-10T17:00:00.000Z" })],
  approvals: [],
  notificationIntents: [],
  definitionCount: 1,
  activeDefinitionCount: 1,
  triggerSourceAvailable: true,
  schedulerEnabled: true,
  reportingAvailable: true,
  hpmPublishedRunIds: [],
  generatedFromAt: "2026-08-10T17:59:00.000Z",
  restrictedRecordCount: 0,
  ...overrides,
});
const scope = {
  tenantId: "tenant-a",
  type: "tenant" as const,
  propertyIds: ["property-a"],
  from: "2026-08-01T00:00:00.000Z",
  to: now,
  timeZone: "America/Chicago",
  label: "Authorized tenant",
};

describe("AU-001E operations", () => {
  it("detects expired leases and missing HPM publication without mutating facts", () => {
    const input = source(),
      candidates = detectAutomationReconciliationCandidates(input, now);
    expect(candidates.map((item) => item.type)).toEqual([
      "expired-lease",
      "missing-hpm-lineage",
    ]);
    expect(input.steps[0].status).toBe("leased");
  });
  it("quarantines unknown outcomes and never offers a blind retry", () => {
    const candidates = detectAutomationReconciliationCandidates(
      source({
        steps: [step({ status: "reconciliation_required" })],
        hpmPublishedRunIds: ["run-1"],
      }),
      now,
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      type: "unknown-outcome",
      safeRecovery: "reconcile",
      requiresHumanReview: true,
    });
  });
  it("gives a critical unhealthy component precedence", () => {
    expect(
      overallAutomationHealth([
        {
          id: "one",
          name: "one",
          critical: false,
          status: "healthy",
          evaluatedAt: now,
          policyVersion: "v1",
          measures: {},
          thresholds: {},
          reasons: [],
          freshness: "current",
          restrictions: [],
          investigationHref: "/",
        },
        {
          id: "two",
          name: "two",
          critical: true,
          status: "unhealthy",
          evaluatedAt: now,
          policyVersion: "v1",
          measures: {},
          thresholds: {},
          reasons: [],
          freshness: "current",
          restrictions: [],
          investigationHref: "/",
        },
      ]),
    ).toBe("unhealthy");
  });
  it("fails required incompatible integrations safely while isolating optional adapters", () => {
    const result = validateAutomationIntegrations({
      "identity-authorization": {
        configured: true,
        enabled: true,
        version: "unsupported",
      },
      hpm: { configured: true, enabled: true, version: "bad" },
    });
    expect(
      result.find((item) => item.id === "identity-authorization")?.status,
    ).toBe("unhealthy");
    expect(result.find((item) => item.id === "hpm-lifecycle")?.status).toBe(
      "disabled",
    );
  });
  it("discloses stale and restricted sources rather than treating them as zero", () => {
    const projection = projectAutomationOperations({
      scope,
      source: source({
        generatedFromAt: "2026-08-10T12:00:00.000Z",
        restrictedRecordCount: 2,
      }),
      integrations: validateAutomationIntegrations({}),
      now,
      operationsEnabled: true,
      killSwitch: false,
      operatorAuthorized: false,
    });
    expect(projection.freshness.status).toBe("partial");
    expect(projection.restrictions.map((item) => item.code)).toContain(
      "AUTHORIZED_SUBSET",
    );
    expect(projection.validCommands).toEqual([]);
  });
  it("projects only safe reconcile and lease recovery commands for authorized operators", () => {
    const projection = projectAutomationOperations({
      scope,
      source: source(),
      integrations: validateAutomationIntegrations({
        "identity-authorization": {
          configured: true,
          enabled: true,
          version: "workspace-access-v1",
        },
      }),
      now,
      operationsEnabled: true,
      killSwitch: false,
      operatorAuthorized: true,
    });
    expect(projection.validCommands.map((item) => item.type)).toEqual(
      expect.arrayContaining(["refresh", "release-expired-lease", "rebuild"]),
    );
    expect(projection.validCommands.map((item) => item.type)).not.toContain(
      "retry",
    );
  });
  it("generates reproducible governed reports and CSV exports", () => {
    const projection = projectAutomationOperations({
        scope,
        source: source(),
        integrations: validateAutomationIntegrations({}),
        now,
        operationsEnabled: true,
        killSwitch: false,
        operatorAuthorized: true,
      }),
      first = generateAutomationReport({
        key: "operational-health",
        projection,
        generatedAt: now,
      }),
      second = generateAutomationReport({
        key: "operational-health",
        projection,
        generatedAt: now,
      }),
      exported = exportAutomationReportCsv(first);
    expect(first.checksum).toBe(second.checksum);
    expect(exported.checksum).toHaveLength(64);
    expect(exported.rowCount).toBe(first.rows.length);
    expect(exported.content).toContain("Overall health");
  });
  it("augments the canonical HPM Execute source without replacing its records or policy", async () => {
    const projection = projectAutomationOperations({
      scope,
      source: source(),
      integrations: validateAutomationIntegrations({}),
      now,
      operationsEnabled: true,
      killSwitch: false,
      operatorAuthorized: false,
    });
    const base = createHpmProjectionSourcePort({
      capability: "execute",
      contractVersion: "hpm-source-v1",
      project: async () => ({
        state: {
          capability: "execute",
          contractVersion: "hpm-source-v1",
          freshness: "current",
          policyVersion: "execute-v1",
          contributesToCounts: true,
          contributesToHealth: true,
          contributesToLineage: true,
        },
        records: [
          {
            tenantId: "tenant-a",
            source: {
              capability: "execute",
              recordType: "action",
              recordId: "action-1",
              recordVersion: "1",
            },
            stage: "execute",
            canonicalStatus: "active",
            presentationState: "in-progress",
            summary: "Canonical action",
            propertyIds: ["property-a"],
            attentionState: "none",
            validNextCommands: [],
            createdAt: now,
            updatedAt: now,
            visibility: "property",
          },
        ],
      }),
    });
    const port = createAutomationHpmExecuteContributionPort(
        base,
        async () => projection,
      ),
      result = await port.project({
        actor: {
          actorId: "actor-a",
          tenantId: "tenant-a",
          roleIds: ["owner"],
          propertyIds: ["property-a"],
          active: true,
        },
        scope: {
          tenantId: "tenant-a",
          type: "property",
          propertyIds: ["property-a"],
          timeZone: "America/Chicago",
          from: scope.from,
          to: scope.to,
        },
        correlationId: "correlation-a",
        requestedAt: now,
      });
    expect(result.records[0].source.recordId).toBe("action-1");
    expect(
      result.records.some(
        (item) => item.source.recordType === "automation-operational-fact",
      ),
    ).toBe(true);
    expect(result.state.policyVersion).toContain("execute-v1");
  });
});
