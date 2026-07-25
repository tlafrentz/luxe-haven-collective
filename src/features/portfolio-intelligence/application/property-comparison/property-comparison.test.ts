import { describe, expect, it } from "vitest";
import { ConfidenceLevel } from "@/platform/scoring";
import { overviewProjectionFixture, overviewPropertyFixture } from "../overview/overview.test";
import {
  assignPortfolioPropertyRole, buildDecisionSpecificRankings, buildPortfolioPropertyComparison,
  buildPropertyPeerComparisons, evaluatePropertyMomentum, median,
} from "./build-property-comparison";
import { comparisonCapabilitiesForRole } from "./policies";

describe("Portfolio property comparison policies", () => {
  it("reconciles revenue, bookings, available nights, burden, and change contributions", () => {
    const current = overviewProjectionFixture([overviewPropertyFixture("a", 150), overviewPropertyFixture("b", 50)]);
    const prior = overviewProjectionFixture([overviewPropertyFixture("a", 100), overviewPropertyFixture("b", 40)]);
    const model = buildPortfolioPropertyComparison({ projection: current, comparison: prior, capabilities: comparisonCapabilitiesForRole("owner") });
    expect(model.properties.reduce((sum, row) => sum + (row.contribution.revenue ?? 0), 0)).toBeCloseTo(1);
    expect(model.properties.reduce((sum, row) => sum + (row.contribution.bookings ?? 0), 0)).toBeCloseTo(1);
    expect(model.properties.reduce((sum, row) => sum + (row.contribution.availableNights ?? 0), 0)).toBeCloseTo(1);
    expect(model.contribution).toMatchObject({ revenueReconciles: true, revenueChangeReconciles: true, portfolioRevenueChange: 60 });
  });

  it("supports every momentum state from multiple signals", () => {
    const prior = overviewPropertyFixture("a", 100);
    expect(evaluatePropertyMomentum(overviewPropertyFixture("a", 120, { metrics: { ...prior.metrics, grossRevenue: 120, occupancy: 0.55, adr: 105, revpar: 60, bookingCount: 12 } }), prior, 90)).toBe("improving");
    expect(evaluatePropertyMomentum(overviewPropertyFixture("a", 80, { metrics: { ...prior.metrics, grossRevenue: 80, occupancy: 0.4, adr: 90, revpar: 40, bookingCount: 8 } }), prior, 90)).toBe("declining");
    expect(evaluatePropertyMomentum(overviewPropertyFixture("a", 110, { metrics: { ...prior.metrics, grossRevenue: 110, occupancy: 0.4 } }), prior, 90)).toBe("mixed");
    expect(evaluatePropertyMomentum(prior, prior, 90)).toBe("stable");
    expect(evaluatePropertyMomentum(prior, undefined, 90)).toBe("new");
    expect(evaluatePropertyMomentum({ ...prior, evidence: [] }, prior, 90)).toBe("insufficient-evidence");
  });

  it("assigns deterministic descriptive roles without strategic actions", () => {
    expect(assignPortfolioPropertyRole({ momentum: "improving", revenueContribution: 0.4, burdenContribution: 0.1, financialEligible: false }).role).toBe("growth-driver");
    expect(assignPortfolioPropertyRole({ momentum: "declining", revenueContribution: 0.4, burdenContribution: 0.1, financialEligible: false }).role).toBe("turnaround-candidate");
    expect(assignPortfolioPropertyRole({ momentum: "stable", revenueContribution: 0.1, burdenContribution: 0.5, financialEligible: false }).role).toBe("operational-burden");
    expect(assignPortfolioPropertyRole({ momentum: "insufficient-evidence", revenueContribution: null, burdenContribution: null, financialEligible: false }).role).toBe("evidence-limited");
  });

  it("omits sensitive financial fields and rankings at the application boundary", () => {
    const property = overviewPropertyFixture("a", 100, { metrics: { ...overviewPropertyFixture("a", 100).metrics, netOperatingIncome: 40, margin: 0.4, cashFlow: 30 } });
    const restricted = buildPortfolioPropertyComparison({ projection: overviewProjectionFixture([property]), capabilities: comparisonCapabilitiesForRole("contributor") });
    expect(restricted.rankings.map(({ metric }) => metric)).not.toContain("noi");
    expect(restricted.rankings.map(({ metric }) => metric)).not.toContain("margin");
    expect(restricted.properties[0].performance).not.toHaveProperty("netOperatingIncome");
    expect(restricted.properties[0].change).not.toHaveProperty("netOperatingIncome");
  });

  it("excludes degraded, partial, and missing metrics while disclosing eligibility", () => {
    const current = overviewProjectionFixture([
      overviewPropertyFixture("a", 100),
      overviewPropertyFixture("b", 90, { freshness: "degraded" }),
      overviewPropertyFixture("c", null, { confidence: ConfidenceLevel.LOW }),
    ]);
    const rows = buildPortfolioPropertyComparison({ projection: current, capabilities: comparisonCapabilitiesForRole("owner"), contexts: { a: { partialPeriod: true } } }).properties;
    const rankings = buildDecisionSpecificRankings(rows, current.period, comparisonCapabilitiesForRole("owner"));
    expect(rankings.find(({ metric }) => metric === "revenue")).toMatchObject({ eligiblePropertyCount: 0, missingPropertyCount: 3 });
  });

  it("preserves effective ties without false precision", () => {
    const current = overviewProjectionFixture([overviewPropertyFixture("a", 100), overviewPropertyFixture("b", 100.4)]);
    const ranking = buildPortfolioPropertyComparison({ projection: current, capabilities: comparisonCapabilitiesForRole("owner") }).rankings.find(({ metric }) => metric === "revenue")!;
    expect(ranking.entries[1]).toMatchObject({ position: 1, tied: true });
  });

  it("calculates medians and requires meaningful peer groups", () => {
    expect(median([1, 10, 3])).toBe(3);
    expect(median([1, 3])).toBe(2);
    const only = buildPortfolioPropertyComparison({ projection: overviewProjectionFixture([overviewPropertyFixture("a", 100)]), capabilities: comparisonCapabilitiesForRole("viewer") }).properties;
    expect(buildPropertyPeerComparisons(only)[0]).toMatchObject({ available: false });
  });

  it("labels new, partial-period, one-property, and scope-change conditions", () => {
    const current = overviewProjectionFixture([overviewPropertyFixture("a", 100), overviewPropertyFixture("b", 30)]);
    const prior = overviewProjectionFixture([overviewPropertyFixture("a", 80)]);
    const model = buildPortfolioPropertyComparison({ projection: current, comparison: prior, capabilities: comparisonCapabilitiesForRole("operator"), contexts: { b: { partialPeriod: true } } });
    expect(model.contribution.reportedScopeChanged).toBe(true);
    expect(model.properties.find(({ property }) => property.propertyId === "b")).toMatchObject({ change: { state: "new" }, operatingContext: { partialPeriod: true } });
  });
});
