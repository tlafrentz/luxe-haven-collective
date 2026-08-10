import { describe, expect, it } from "vitest";
import { projectAutomationRun } from "./automation-governed-projections";
const run: any = { id: "run", tenantId: "tenant", propertyIds: ["property"], status: "running", version: 2 };
describe("AU-001C run projections", () => {
  it("computes recovery commands server-side", () => { const value = projectAutomationRun({ run, steps: [{ id: "step", status: "reconciliation_required" } as any], actor: { actorId: "operator", tenantId: "tenant", role: "operator", active: true, propertyIds: ["property"] }, generatedAt: "2026-08-10T12:00:00Z" }); expect(value.validCommands).toContain("reconcile"); expect(value.reconciliationRequired).toBe(true); });
  it("denies cross-property projections", () => { expect(() => projectAutomationRun({ run, steps: [], actor: { actorId: "operator", tenantId: "tenant", role: "operator", active: true, propertyIds: [] }, generatedAt: "2026-08-10T12:00:00Z" })).toThrow(); });
});
