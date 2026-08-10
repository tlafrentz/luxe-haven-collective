import { describe, expect, it } from "vitest";
import { createProductionGovernedExecution } from "./production-automation-governed-execution";

const dependencies: any = { repository: {}, definitions: {}, policy: {}, approvalAuthority: {}, ports: [{ capability: "execute", contractVersions: ["v1"] }], serviceActor: { actorId: "service", tenantId: "tenant", policyId: "policy", active: true, grants: [{ capability: "execute", commandType: "createDraftPlan", propertyIds: [] }] } };
describe("AU-001C production composition", () => {
  it("constructs inert composition with all flags disabled", () => { expect(createProductionGovernedExecution({ ...dependencies, flags: { automationFoundationEnabled: false, governedExecutionEnabled: false, dispatchEnabled: false, globalKillSwitch: true } })).toBeDefined(); });
  it("rejects missing least-privilege grants", () => { expect(() => createProductionGovernedExecution({ ...dependencies, serviceActor: { ...dependencies.serviceActor, grants: [] }, flags: { automationFoundationEnabled: false, governedExecutionEnabled: false, dispatchEnabled: false, globalKillSwitch: true } })).toThrow(); });
  it("rejects duplicate capability adapters", () => { expect(() => createProductionGovernedExecution({ ...dependencies, ports: [...dependencies.ports, ...dependencies.ports], flags: { automationFoundationEnabled: false, governedExecutionEnabled: false, dispatchEnabled: false, globalKillSwitch: true } })).toThrow(); });
});
