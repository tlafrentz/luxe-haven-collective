import { describe, expect, it } from "vitest";
import { InMemoryFinancialOverviewCache } from ".";

describe("Financial Overview cache invalidation", () => {
  it("invalidates affected historical periods for backdated entries and reclassifications", async () => {
    const cache = new InMemoryFinancialOverviewCache();
    const value = { identity: { workspaceId: "w" }, period: { from: "2026-07-01", to: "2026-07-31" } } as never;
    await cache.put("one", value);
    await cache.invalidate({ workspaceId: "w", from: "2026-07-15", reason: "backdated-entry" });
    expect(cache.size()).toBe(0);
  });
});
