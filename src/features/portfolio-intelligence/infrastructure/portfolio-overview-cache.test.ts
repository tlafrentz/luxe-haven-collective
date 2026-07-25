import { describe, expect, it } from "vitest";
import { buildPortfolioOverview } from "../application/overview";
import { overviewProjectionFixture, overviewPropertyFixture } from "../application/overview/overview.test";
import { AuthorizationAwarePortfolioOverviewCache, portfolioOverviewCacheKey } from "./portfolio-overview-cache";

const base = { workspaceId: "workspace-1", membershipId: "membership-1", role: "owner", propertyIds: ["a"], currentFrom: "2026-07-01", currentTo: "2026-07-31", comparisonType: "previous-period" };
const overview = buildPortfolioOverview({ projection: overviewProjectionFixture([overviewPropertyFixture("a", 100)]) });

describe("Portfolio Overview authorization-aware cache", () => {
  it("keys by access, scope, period, and comparison", () => {
    expect(portfolioOverviewCacheKey(base)).not.toBe(portfolioOverviewCacheKey({ ...base, membershipId: "membership-2" }));
    expect(portfolioOverviewCacheKey(base)).not.toBe(portfolioOverviewCacheKey({ ...base, propertyIds: ["b"] }));
    expect(portfolioOverviewCacheKey(base)).not.toBe(portfolioOverviewCacheKey({ ...base, comparisonType: "previous-year" }));
  });
  it("never returns a full-workspace result to another membership and invalidates by workspace", () => {
    const cache = new AuthorizationAwarePortfolioOverviewCache();
    cache.set(base, overview);
    expect(cache.get(base)).toBe(overview);
    expect(cache.get({ ...base, membershipId: "scoped-member", role: "viewer" })).toBeNull();
    cache.invalidateWorkspace("workspace-1");
    expect(cache.get(base)).toBeNull();
  });
  it("expires bounded entries", () => {
    let now = 0;
    const cache = new AuthorizationAwarePortfolioOverviewCache(100, () => now);
    cache.set(base, overview);
    now = 101;
    expect(cache.get(base)).toBeNull();
  });
});
