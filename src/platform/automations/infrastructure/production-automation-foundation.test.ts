import { describe, expect, it } from "vitest";
import type { AutomationSupabaseClient } from "./supabase-automation-foundation-repository";
import { createProductionAutomationFoundation } from "./production-automation-foundation";

describe("AU-001A production composition", () => {
  it("constructs only the authenticated foundation service and exposes no runtime execution surface", () => {
    const client = {} as AutomationSupabaseClient;
    const composition = createProductionAutomationFoundation({ client, actor: { actorId: "actor-1", tenantId: "tenant-1", role: "administrator", active: true, propertyIds: [] }, clock: () => "2026-08-10T00:00:00.000Z", id: () => "id-1" });
    expect(Object.keys(composition).sort()).toEqual(["createDraft", "get", "list", "revise", "transition"]);
    expect(composition).not.toHaveProperty("processTrigger");
    expect(composition).not.toHaveProperty("dispatch");
    expect(composition).not.toHaveProperty("schedule");
  });
});
