import { describe, expect, it } from "vitest";
import type {
  AutomationDefinition,
  AutomationDefinitionVersion,
} from "@/platform/automations/domain/automation-definition";
import type {
  AutomationApproval,
  AutomationRun,
  AutomationRunStep,
} from "@/platform/automations/domain/automation-governed-execution";
import {
  automationCohortEligible,
  parseAutomationWorkspaceQuery,
} from "./automation-workspace-composition";
import {
  projectAutomationWorkspace,
  projectApproval,
  projectRun,
} from "./automation-workspace-projections";

const definition: AutomationDefinition = {
  id: "automation-1",
  tenantId: "tenant-1",
  status: "active",
  currentVersion: 2,
  version: 3,
  createdBy: "owner-1",
  createdAt: "2026-08-10T10:00:00Z",
};
const current: AutomationDefinitionVersion = {
  id: "version-2",
  automationId: "automation-1",
  tenantId: "tenant-1",
  version: 2,
  name: "Create decision follow-up",
  description: "Create governed follow-up work.",
  status: "active",
  configuration: {
    scope: { type: "property", propertyIds: ["property-1"] },
    ownerId: "owner-1",
    trigger: {
      kind: "domain-event",
      schemaVersion: "v1",
      sourceCapability: "decide",
      specification: {},
    },
    conditions: [],
    exclusions: [],
    command: {
      owningCapability: "execute",
      commandType: "createDraftPlan",
      contractVersion: "v1",
    },
    approval: { mode: "before-run", authority: "owner" },
    execution: { maxFanOut: 1, maxChainDepth: 1, concurrency: "queue" },
    retry: { maxAttempts: 3, timeoutMs: 60000 },
    notification: { eventTypes: ["failed"] },
    effectiveFrom: "2026-08-10T10:00:00Z",
  },
  schemaVersion: "au001-definition.v1",
  policyVersion: "au001-foundation.v1",
  compatibility: "compatible",
  createdBy: "owner-1",
  createdAt: "2026-08-10T10:00:00Z",
  reason: "Activate",
};
const run: AutomationRun = {
  id: "run-1",
  tenantId: "tenant-1",
  propertyIds: ["property-1"],
  automationDefinitionId: "automation-1",
  automationDefinitionVersionId: "version-2",
  automationDefinitionVersion: 2,
  runRequestId: "request-1",
  triggerOccurrenceId: "occurrence-1",
  executionPlanVersion: "plan-1",
  initiatingActorId: "owner-1",
  serviceActorPolicyId: "service-policy",
  correlationId: "correlation-1",
  causationId: "request-1",
  status: "reconciliation_required",
  createdAt: "2026-08-10T11:00:00Z",
  updatedAt: "2026-08-10T11:05:00Z",
  version: 4,
};
const step: AutomationRunStep = {
  id: "step-1",
  tenantId: "tenant-1",
  runId: "run-1",
  stepKey: "create",
  owningCapability: "execute",
  commandType: "createDraftPlan",
  commandContractVersion: "v1",
  dependencies: [],
  status: "reconciliation_required",
  deterministicCommandId: "command-1",
  idempotencyKey: "key-1",
  attemptCount: 1,
  leaseGeneration: 1,
  version: 5,
};
const approval: AutomationApproval = {
  id: "approval-1",
  tenantId: "tenant-1",
  runId: "run-1",
  stepIds: ["step-1"],
  definitionVersionId: "version-2",
  commandFingerprint: "fingerprint",
  targetContextVersion: "context-1",
  policyVersion: "policy-1",
  status: "pending",
  requestedAt: "2026-08-10T11:00:00Z",
  expiresAt: "2026-08-11T11:00:00Z",
  version: 1,
};

describe("AU-001D server projections", () => {
  it("reconciles overview counts with authorized destination records", () => {
    const value = projectAutomationWorkspace({
      tenantId: "tenant-1",
      propertyIds: ["property-1"],
      scopeLabel: "Oak Street",
      timeZone: "America/Chicago",
      definitions: [{ definition, current }],
      runs: [{ run, steps: [step] }],
      approvals: [{ approval, automationId: definition.id }],
      generatedAt: "2026-08-10T12:00:00Z",
    });
    expect(value.counts.active).toBe(
      value.automations.filter(({ status }) => status === "active").length,
    );
    expect(value.counts.reconciliation).toBe(1);
    expect(value.counts.approvals).toBe(1);
  });
  it("omits cross-property resources instead of leaking counts", () => {
    const value = projectAutomationWorkspace({
      tenantId: "tenant-1",
      propertyIds: ["property-2"],
      scopeLabel: "Other",
      timeZone: "America/Chicago",
      definitions: [{ definition, current }],
      runs: [{ run, steps: [step] }],
      approvals: [{ approval, automationId: definition.id }],
      generatedAt: "2026-08-10T12:00:00Z",
    });
    expect(value.automations).toHaveLength(0);
    expect(value.runs).toHaveLength(0);
    expect(value.approvals).toHaveLength(0);
  });
  it("never projects retry while an outcome requires reconciliation", () => {
    const value = projectRun(run, [step]);
    expect(value.attention).toBe("uncertain");
    expect(value.validCommands.map(({ type }) => type)).toEqual(["reconcile"]);
  });
  it("invalidates expired approvals and removes decision commands", () => {
    const value = projectApproval(
      approval,
      definition.id,
      "2026-08-12T12:00:00Z",
    );
    expect(value.status).toBe("expired");
    expect(value.validCommands).toHaveLength(0);
  });
  it("bounds and normalizes URL query state", () => {
    const value = parseAutomationWorkspaceQuery(
      { page: "-9", pageSize: "500", search: "  run  ", sort: "unknown" },
      "runs",
    );
    expect(value).toMatchObject({
      page: 1,
      pageSize: 100,
      search: "run",
      sort: "attention",
    });
  });
  it("fails cohort access closed unless the tenant or internal actor is approved", () => {
    expect(
      automationCohortEligible({
        enabled: false,
        tenantId: "tenant-1",
        tenantIds: ["tenant-1"],
        internalActor: false,
      }),
    ).toBe(false);
    expect(
      automationCohortEligible({
        enabled: true,
        tenantId: "tenant-1",
        tenantIds: ["tenant-2"],
        internalActor: false,
      }),
    ).toBe(false);
    expect(
      automationCohortEligible({
        enabled: true,
        tenantId: "tenant-1",
        tenantIds: ["tenant-1"],
        internalActor: false,
      }),
    ).toBe(true);
  });
});
