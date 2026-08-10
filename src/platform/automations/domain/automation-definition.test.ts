import { describe, expect, it } from "vitest";
import { canManageAutomation, createAutomationDefinitionVersion, transitionAutomationDefinition, validateAutomationConfiguration, type AutomationActor, type AutomationDefinitionConfiguration } from "./automation-definition";

const actor: AutomationActor = { actorId: "actor-1", tenantId: "tenant-1", role: "operator", active: true, propertyIds: ["property-1"] };
export const configuration: AutomationDefinitionConfiguration = { scope: { type: "property", propertyIds: ["property-1"] }, ownerId: "actor-1", trigger: { kind: "manual", schemaVersion: "v1", sourceCapability: "automation", specification: {} }, conditions: [], exclusions: [], command: { owningCapability: "execute", commandType: "create-draft-action", contractVersion: "v1" }, approval: { mode: "before-run", authority: "execute-plan-owner" }, execution: { maxFanOut: 1, maxChainDepth: 0, concurrency: "queue" }, retry: { maxAttempts: 1, timeoutMs: 30_000 }, notification: { eventTypes: ["definition-ready"] }, effectiveFrom: "2026-08-10T00:00:00.000Z" };

describe("AU-001A automation definition", () => {
  it("creates immutable definition versions with canonical policy versions", () => {
    const value = createAutomationDefinitionVersion({ id: "version-1", automationId: "automation-1", tenantId: "tenant-1", version: 1, name: " Review overdue work ", description: " Create a draft review request ", status: "draft", configuration, compatibility: "unverified", createdBy: actor.actorId, createdAt: "2026-08-10T01:00:00.000Z", reason: "Initial draft" });
    expect(value).toMatchObject({ name: "Review overdue work", schemaVersion: "au001-definition.v1", policyVersion: "au001-foundation.v1" });
    expect(Object.isFrozen(value.configuration.scope.propertyIds)).toBe(true);
  });

  it("enforces lifecycle authority and required reasons", () => {
    expect(transitionAutomationDefinition("ready-for-review", "active", { actor, activatorAuthorized: true })).toBe("active");
    expect(() => transitionAutomationDefinition("ready-for-review", "active", { actor })).toThrow("explicit authority");
    expect(() => transitionAutomationDefinition("active", "paused", { actor })).toThrow("requires a reason");
    expect(() => transitionAutomationDefinition("retired", "active", { actor, activatorAuthorized: true })).toThrow("Invalid automation transition");
  });

  it("validates bounded, declarative configuration without executing it", () => {
    expect(validateAutomationConfiguration(configuration)).toEqual([]);
    expect(validateAutomationConfiguration({ ...configuration, execution: { ...configuration.execution, maxFanOut: 0 } })).toContainEqual(expect.objectContaining({ severity: "blocking", code: "AUTOMATION_DEFINITION_INVALID" }));
    expect(validateAutomationConfiguration({ ...configuration, approval: { mode: "none", authority: "allowlist" } })).toContainEqual(expect.objectContaining({ severity: "warning" }));
  });

  it("enforces tenant, role, active-user, and selected-property boundaries", () => {
    expect(canManageAutomation(actor, "tenant-1", ["property-1"])).toBe(true);
    expect(canManageAutomation(actor, "tenant-2", ["property-1"])).toBe(false);
    expect(canManageAutomation(actor, "tenant-1", ["property-2"])).toBe(false);
    expect(canManageAutomation({ ...actor, active: false }, "tenant-1", ["property-1"])).toBe(false);
    expect(canManageAutomation({ ...actor, role: "viewer" }, "tenant-1", ["property-1"])).toBe(false);
  });
});
