import { describe, expect, it } from "vitest";
import { createProductionAutomationTriggers } from "./production-automation-triggers";
import type { TriggerSupabaseClient } from "./supabase-automation-trigger-repository";

describe("AU-001B production composition", () => {
  it("is inert, kill-switchable, and contains no command-dispatch surface", () => {
    const composition = createProductionAutomationTriggers({ client: {} as TriggerSupabaseClient, actor: { actorId: "owner-1", tenantId: "tenant-1", role: "owner", active: true, propertyIds: [] }, flags: { automationFoundationEnabled: true, triggerProcessingEnabled: false, schedulerKillSwitch: true }, clock: () => "2026-08-10T12:00:00Z", id: () => "id-1" });
    expect(composition).toHaveProperty("requestManualTrigger"); expect(composition).toHaveProperty("scanDueSchedules");
    expect(composition).not.toHaveProperty("dispatch"); expect(composition).not.toHaveProperty("execute"); expect(composition).not.toHaveProperty("commandBus");
  });
  it("rejects inactive composition actors", () => {
    expect(() => createProductionAutomationTriggers({ client: {} as TriggerSupabaseClient, actor: { actorId: "owner-1", tenantId: "tenant-1", role: "owner", active: false, propertyIds: [] }, flags: { automationFoundationEnabled: true, triggerProcessingEnabled: true, schedulerKillSwitch: false } })).toThrow("Active");
  });
});
