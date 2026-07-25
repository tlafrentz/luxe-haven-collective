import { describe, expect, it } from "vitest";
import { ConfidenceLevel } from "@/platform/scoring";
import type { PortfolioProjection, PortfolioPropertyProjection } from "@/features/portfolio";
import {
  buildPortfolioMetricSummaries,
  buildPortfolioOverview,
  buildPropertyContributionPreview,
  evaluatePortfolioCondition,
  identifyMaterialPortfolioChanges,
} from "./build-portfolio-overview";

function property(id: string, revenue: number | null, options: Partial<PortfolioPropertyProjection> = {}): PortfolioPropertyProjection {
  return {
    propertyId: id, name: `Property ${id}`, status: "active", market: id === "a" ? "Austin" : "Phoenix", operatingModel: "short-term-rental",
    metrics: { grossRevenue: revenue, adr: revenue === null ? null : 100, occupancy: revenue === null ? null : 0.5, revpar: revenue === null ? null : 50, netOperatingIncome: null, cashFlow: null, margin: null, bookingCount: revenue === null ? 0 : 10, activeStays: 1, openActions: 0, operationalIssues: 0 },
    contribution: { revenue, netOperatingIncome: null, bookings: revenue === null ? 0 : 10, actions: 0, operationalIssues: 0, evidenceCount: revenue === null ? 0 : 1 },
    observations: [], evidence: revenue === null ? [] : [{ id: `e-${id}`, propertyId: id, kind: "revenue", statement: "Revenue evidence", observedAt: "2026-07-25T12:00:00Z", confidence: ConfidenceLevel.HIGH }],
    confidence: revenue === null ? ConfidenceLevel.LOW : ConfidenceLevel.HIGH, freshness: "current", ...options,
  };
}
function projection(properties: readonly PortfolioPropertyProjection[], options: Partial<PortfolioProjection> = {}): PortfolioProjection {
  const revenue = properties.some(({ metrics }) => metrics.grossRevenue !== null) ? properties.reduce((sum, item) => sum + (item.metrics.grossRevenue ?? 0), 0) : null;
  const bookingCount = properties.reduce((sum, item) => sum + item.metrics.bookingCount, 0);
  const scope = { propertyIds: properties.map(({ propertyId }) => propertyId), propertyCount: properties.length, authorization: { type: "workspace" as const, role: "owner" as const } };
  const evidence = properties.flatMap(({ evidence }) => evidence);
  return {
    identity: { workspaceId: "workspace-1", scope, evaluatedAt: "2026-07-25T12:00:00Z" }, scope,
    period: { current: { from: "2026-05-01", to: "2026-07-29" }, comparison: { from: "2026-01-31", to: "2026-04-30" }, comparisonType: "previous-period" },
    state: properties.every(({ evidence }) => evidence.length) ? "ready" : properties.length ? "insufficient-evidence" : "no-portfolio",
    summary: { propertyCount: properties.length, activeProperties: properties.length, archivedProperties: 0, includedProperties: properties.length, marketsRepresented: ["Austin"], operatingModels: ["short-term-rental"], freshness: "current", evidenceConfidence: ConfidenceLevel.HIGH },
    performance: { grossRevenue: revenue, adr: revenue === null ? null : 100, occupancy: revenue === null ? null : 0.5, revpar: revenue === null ? null : 50, netOperatingIncome: null, cashFlow: null, margin: null, bookingCount, activeStays: properties.length, openActions: 0, operationalIssues: 0 },
    properties, observations: [], evidence: { items: evidence, counts: { revenue: evidence.length, market: 0, bookings: 0, operational: 0, financial: 0, "data-quality": 0, investment: 0, workspace: 0 }, propertyCoverage: properties.length ? evidence.length / properties.length : 0, evidenceThreshold: 1 },
    confidence: ConfidenceLevel.HIGH, freshness: "current", generatedAt: "2026-07-25T12:00:00Z", ...options,
  };
}

describe("Portfolio Overview policies", () => {
  it("calculates comparisons and distinguishes percentage-point changes", () => {
    const metrics = buildPortfolioMetricSummaries(projection([property("a", 120)]), projection([property("a", 100)]));
    expect(metrics.find(({ metric }) => metric === "gross-revenue")?.change).toMatchObject({ absolute: 20, percentage: 0.2, unit: "currency" });
    expect(metrics.find(({ metric }) => metric === "occupancy")?.change?.unit).toBe("percentage-points");
  });

  it("keeps missing NOI out instead of displaying zero", () => {
    const metrics = buildPortfolioMetricSummaries(projection([property("a", 100)]));
    expect(metrics.find(({ metric }) => metric === "noi")).toBeUndefined();
  });

  it("reconciles contribution shares to portfolio revenue", () => {
    const preview = buildPropertyContributionPreview(projection([property("a", 75), property("b", 25)]));
    expect(preview.reconcilesToRevenue).toBe(100);
    expect(preview.items.reduce((sum, item) => sum + (item.revenueShare ?? 0), 0)).toBe(1);
  });

  it("limits and orders material changes", () => {
    const current = projection([property("a", 200)]);
    const prior = projection([property("a", 100)]);
    const changes = identifyMaterialPortfolioChanges(current, prior, buildPortfolioMetricSummaries(current, prior));
    expect(changes.length).toBeLessThanOrEqual(5);
    expect(changes[0]).toMatchObject({ category: "revenue", direction: "improved" });
  });

  it("applies condition precedence without an opaque score", () => {
    const insufficient = projection([property("a", null)]);
    expect(evaluatePortfolioCondition(insufficient, buildPortfolioMetricSummaries(insufficient), [])).toMatchObject({ status: "insufficient-evidence" });
    const strong = projection([property("a", 120)]);
    const prior = projection([property("a", 100)]);
    const metrics = buildPortfolioMetricSummaries(strong, prior);
    expect(evaluatePortfolioCondition(strong, metrics, identifyMaterialPortfolioChanges(strong, prior, metrics))).toMatchObject({ status: "strong" });
    const degraded = projection([property("a", 70, { freshness: "degraded" })], { freshness: "degraded" });
    const degradedMetrics = buildPortfolioMetricSummaries(degraded, prior);
    expect(evaluatePortfolioCondition(degraded, degradedMetrics, identifyMaterialPortfolioChanges(degraded, prior, degradedMetrics))).toMatchObject({ status: "at-risk" });
  });

  it("labels assigned and single-property scopes explicitly", () => {
    const base = projection([property("a", 100)]);
    const assignedScope = { ...base.scope, authorization: { type: "assigned-properties" as const, role: "viewer" as const } };
    const assigned = buildPortfolioOverview({ projection: { ...base, scope: assignedScope, identity: { ...base.identity, scope: assignedScope } } });
    expect(assigned.scopeLabel).toBe("Your Assigned Portfolio");
    expect(assigned.permissionLimited).toBe(true);
    const singleScope = { ...base.scope, authorization: { type: "single-property" as const, role: "owner" as const } };
    expect(buildPortfolioOverview({ projection: { ...base, scope: singleScope, identity: { ...base.identity, scope: singleScope } } }).scopeLabel).toBe("Single Property Portfolio");
  });

  it("discloses scope changes between periods", () => {
    const overview = buildPortfolioOverview({ projection: projection([property("a", 100), property("b", 50)]), comparison: projection([property("a", 80)]) });
    expect(overview.scopeChanged).toBe(true);
    expect(overview.changes).toContainEqual(expect.objectContaining({ category: "property-scope" }));
    expect(overview.propertyContribution.items.find(({ propertyId }) => propertyId === "b")?.state).toBe("new");
  });
});

export { projection as overviewProjectionFixture, property as overviewPropertyFixture };
