import { describe, expect, it } from "vitest";
import { projectAutomationRun } from "./automation-governed-projections";
import type { AutomationRun, AutomationRunStep } from "../domain/automation-governed-execution";
const run: AutomationRun = { id: "run", tenantId: "tenant", propertyIds: ["property"], automationDefinitionId: "automation", automationDefinitionVersionId: "definition-version", automationDefinitionVersion: 1, runRequestId: "request", triggerOccurrenceId: "occurrence", executionPlanVersion: "plan-v1", initiatingActorId: "owner", serviceActorPolicyId: "service-policy", correlationId: "correlation", causationId: "causation", status: "running", createdAt: "2026-08-10T12:00:00Z", updatedAt: "2026-08-10T12:00:00Z", version: 2 };
const step: AutomationRunStep = { id: "step", tenantId: "tenant", runId: "run", stepKey: "step", owningCapability: "execute", commandType: "createDraftPlan", commandContractVersion: "v1", dependencies: [], status: "reconciliation_required", deterministicCommandId: "command", idempotencyKey: "idempotency", attemptCount: 1, leaseGeneration: 1, version: 3 };
describe("AU-001C run projections", () => {
  it("computes recovery commands server-side", () => { const value = projectAutomationRun({ run, steps: [step], actor: { actorId: "operator", tenantId: "tenant", role: "operator", active: true, propertyIds: ["property"] }, generatedAt: "2026-08-10T12:00:00Z" }); expect(value.validCommands).toContain("reconcile"); expect(value.reconciliationRequired).toBe(true); });
  it("denies cross-property projections", () => { expect(() => projectAutomationRun({ run, steps: [], actor: { actorId: "operator", tenantId: "tenant", role: "operator", active: true, propertyIds: [] }, generatedAt: "2026-08-10T12:00:00Z" })).toThrow(); });
});
