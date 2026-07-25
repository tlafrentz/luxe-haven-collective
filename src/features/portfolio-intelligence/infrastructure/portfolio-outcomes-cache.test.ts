import { describe, expect, it } from "vitest";
import { portfolioOutcomesCacheKey } from "./portfolio-outcomes-cache";
describe("Portfolio outcomes cache isolation", () => {
  const base = { workspaceId: "workspace-1", authorizedPropertyIds: ["a", "b"], role: "owner", decisionRevisionFingerprint: "d:2", outcomePolicyVersion: "o:v1" };
  it("isolates workspace scope, role, decision revisions, and policy versions", () => {
    const key = portfolioOutcomesCacheKey(base);
    expect(portfolioOutcomesCacheKey({ ...base, role: "viewer" })).not.toBe(key);
    expect(portfolioOutcomesCacheKey({ ...base, authorizedPropertyIds: ["a"] })).not.toBe(key);
    expect(portfolioOutcomesCacheKey({ ...base, decisionRevisionFingerprint: "d:3" })).not.toBe(key);
    expect(portfolioOutcomesCacheKey({ ...base, outcomePolicyVersion: "o:v2" })).not.toBe(key);
  });
});

