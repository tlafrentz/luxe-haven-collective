import { describe, expect, it } from "vitest";
import { overviewProjectionFixture, overviewPropertyFixture } from "../application/overview/overview.test";
import { buildPortfolioPropertyComparison, comparisonCapabilitiesForRole } from "../application/property-comparison";
import { AuthorizationAwarePropertyComparisonCache, propertyComparisonCacheKey } from "./property-comparison-cache";
const context = { workspaceId: "w", membershipId: "m", role: "owner", authorizedPropertyIds: ["a"], includedPropertyIds: ["a"], currentFrom: "2026-07-01", currentTo: "2026-07-31", comparisonType: "previous-period", metricFamily: "revenue", normalization: "absolute", grouping: "none", capabilities: ["performance","financials"], projectionVersion: "v1" };
const model = buildPortfolioPropertyComparison({ projection: overviewProjectionFixture([overviewPropertyFixture("a",100)]), capabilities: comparisonCapabilitiesForRole("owner") });
describe("Property comparison cache", () => {
  it("isolates membership, property scope, capabilities, metrics, periods, and projection versions", () => {
    for (const variant of [{ membershipId:"other" },{ authorizedPropertyIds:["b"] },{ capabilities:["performance"] },{ metricFamily:"financial" },{ currentTo:"2026-08-31" },{ projectionVersion:"v2" }]) expect(propertyComparisonCacheKey(context)).not.toBe(propertyComparisonCacheKey({ ...context, ...variant }));
  });
  it("never serves financial comparison across authorization contexts", () => {
    const cache = new AuthorizationAwarePropertyComparisonCache();
    cache.set(context, model);
    expect(cache.get({ ...context, role:"contributor", capabilities:["performance"] })).toBeNull();
    cache.invalidateWorkspace("w");
    expect(cache.get(context)).toBeNull();
  });
});
