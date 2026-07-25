import { describe, expect, it } from "vitest";
import { portfolioDecisionCacheKey } from "./portfolio-decisions-cache";

describe("Portfolio decision cache isolation", () => {
  const base = {
    workspaceId: "workspace-1", authorizedPropertyIds: ["a", "b"], role: "owner",
    financials: true, period: "90d:previous-period",
    findingsVersion: "findings-v1", decisionPolicyVersion: "decisions-v1",
  };
  it("includes authorization, capabilities, periods, and upstream versions", () => {
    const key = portfolioDecisionCacheKey(base);
    expect(portfolioDecisionCacheKey({ ...base, role: "viewer" })).not.toBe(key);
    expect(portfolioDecisionCacheKey({ ...base, authorizedPropertyIds: ["a"] })).not.toBe(key);
    expect(portfolioDecisionCacheKey({ ...base, financials: false })).not.toBe(key);
    expect(portfolioDecisionCacheKey({ ...base, period: "30d:none" })).not.toBe(key);
    expect(portfolioDecisionCacheKey({ ...base, findingsVersion: "findings-v2" })).not.toBe(key);
  });
});

