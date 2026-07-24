import { describe, expect, it, vi } from "vitest";
import { Score } from "@/platform/scoring";
import { createPortfolioId } from "@/features/portfolio";
import { evaluateCapitalAllocation } from "../../domain/allocation";
import { engineInput, health } from "../../domain/allocation/test-fixtures";
import { evaluatePortfolioRecommendations } from "../../domain/recommendations";
import { recommendationInput } from "../../domain/recommendations/test-fixtures";
import {
  buildPortfolioIntelligenceDashboard,
  createGetPortfolioIntelligenceDashboard,
  PORTFOLIO_DASHBOARD_LIMITS,
  type GetPortfolioIntelligenceDashboardQuery,
  type PortfolioDashboardSource,
} from "./index";

const currentHealth = health();
const currentAllocation = evaluateCapitalAllocation(engineInput());
const currentRecommendations = evaluatePortfolioRecommendations(recommendationInput());
const portfolioId = createPortfolioId("portfolio-health-test");
const query: GetPortfolioIntelligenceDashboardQuery = Object.freeze({ ownerId: "owner-dashboard", portfolioId, observationWindow: currentHealth.observationWindow, evaluatedAt: new Date("2026-07-23T14:00:00Z") });

function source(override: Partial<PortfolioDashboardSource> = {}): PortfolioDashboardSource {
  const previousHealth = { ...currentHealth, overall: { ...currentHealth.overall, score: Score.create(Math.max(0, currentHealth.overall.score.value - 4)) }, evaluatedAt: new Date("2026-07-22T12:00:00Z") };
  const previousAllocation = { ...currentAllocation, recommendedPosture: currentAllocation.recommendedPosture === "pursue-growth" ? "allocate-selectively" as const : "pursue-growth" as const, evaluatedAt: new Date("2026-07-22T13:00:00Z") };
  const previousRecommendations = { ...currentRecommendations, recommendations: currentRecommendations.recommendations.slice(1), evaluatedAt: new Date("2026-07-22T14:00:00Z") };
  return Object.freeze({
    current: Object.freeze({
      portfolioId,
      version: 7,
      name: "Luxe Haven Portfolio",
      strategySummary: "Growth with liquidity protection",
      reportingCurrency: "USD",
      updatedAt: new Date("2026-07-23T10:00:00Z"),
      properties: Object.freeze([
        Object.freeze({ propertyId: "property-a", name: "Main Street Retreat", market: "Austin", propertyType: "single-family", active: true }),
        Object.freeze({ propertyId: "property-b", name: "Music Row Loft", market: "Nashville", propertyType: "condo", active: true }),
      ]),
      opportunities: Object.freeze([
        Object.freeze({ opportunityId: "opportunity-growth", name: "Willow Street", planningStatus: "candidate", active: true }),
        Object.freeze({ opportunityId: "opportunity-exited", name: "Exited", planningStatus: "exited", active: false }),
      ]),
      health: currentHealth,
      allocation: currentAllocation,
    }),
    recommendations: currentRecommendations,
    recommendationHistories: Object.freeze([]),
    previousHealth,
    previousAllocation,
    previousRecommendations,
    ...override,
  });
}

describe("Portfolio Intelligence dashboard mapper", () => {
  it("builds a current executive projection without recalculating upstream conclusions", () => {
    const result = buildPortfolioIntelligenceDashboard(source(), query);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.dashboard.executiveSummary).toMatchObject({
      healthBand: currentHealth.overall.band,
      healthScore: currentHealth.overall.score.value,
      healthDirection: "improved",
      capitalStatus: "protected",
      allocationPosture: currentAllocation.recommendedPosture,
    });
    expect(result.dashboard.capital.deployable).toBe(currentAllocation.capitalPosition.deployableCapital.amount);
    expect(result.dashboard.recommendations.topRecommendations[0]?.id).toBe(currentRecommendations.recommendations[0]?.id.value);
    expect(JSON.stringify(result)).not.toContain("snapshotFingerprint");
  });

  it("returns intentional empty and formation-stage states", () => {
    const empty = buildPortfolioIntelligenceDashboard(source({ current: { ...source().current, properties: [], opportunities: [], health: null, allocation: null }, recommendations: null }), query);
    expect(empty).toMatchObject({ status: "empty", dashboard: { portfolio: { lifecycle: "empty" }, capital: { status: "unavailable" } } });
    const formation = buildPortfolioIntelligenceDashboard(source({ current: { ...source().current, properties: [], health: null }, recommendations: null }), query);
    expect(formation).toMatchObject({ status: "formation-stage", dashboard: { portfolio: { lifecycle: "formation-stage", activeOpportunityCount: 1 } } });
  });

  it("degrades health, allocation, recommendations, and comparison independently without fabricating values", () => {
    const noHealth = buildPortfolioIntelligenceDashboard(source({ current: { ...source().current, health: null }, recommendations: null, previousHealth: null }), query);
    expect(noHealth.status).toBe("degraded");
    if (noHealth.status !== "degraded") return;
    expect(noHealth.unavailableSections).toEqual(expect.arrayContaining(["health", "recommendations", "changes"]));
    expect(noHealth.dashboard.health).toMatchObject({ status: "unavailable", movement: { status: "not-comparable" } });
    expect(noHealth.dashboard.executiveSummary.healthBand).toBeNull();

    const noAllocation = buildPortfolioIntelligenceDashboard(source({ current: { ...source().current, allocation: null }, recommendations: null }), query);
    expect(noAllocation.status).toBe("degraded");
    if (noAllocation.status === "degraded") expect(noAllocation.dashboard.allocation.posture).toBeNull();
  });

  it("enforces all collection bounds and preserves authoritative recommendation rank", () => {
    const result = buildPortfolioIntelligenceDashboard(source(), { ...query, recommendationLimit: 999, driverLimit: 999, changeLimit: 999, attentionLimit: 999 });
    if (result.status !== "ready") throw new Error("Expected ready dashboard.");
    expect(result.dashboard.recommendations.topRecommendations.length).toBeLessThanOrEqual(PORTFOLIO_DASHBOARD_LIMITS.recommendations);
    expect(result.dashboard.attention.items.length).toBeLessThanOrEqual(PORTFOLIO_DASHBOARD_LIMITS.attention);
    expect(result.dashboard.changes.items.length).toBeLessThanOrEqual(PORTFOLIO_DASHBOARD_LIMITS.changes);
    expect(result.dashboard.drivers.positive.length).toBeLessThanOrEqual(PORTFOLIO_DASHBOARD_LIMITS.positiveDrivers);
    expect(result.dashboard.drivers.exposures.length).toBeLessThanOrEqual(PORTFOLIO_DASHBOARD_LIMITS.exposures);
    const authoritative = new Map<string, number>(currentRecommendations.recommendations.map((item, index) => [item.id.value, index]));
    const positions = result.dashboard.recommendations.topRecommendations.map((item) => authoritative.get(item.id) ?? -1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("excludes resolved and superseded recommendations from the active dashboard", () => {
    const first = currentRecommendations.recommendations[0];
    const second = currentRecommendations.recommendations[1];
    const statuses = ["resolved", "superseded"] as const;
    const histories = [first, second].filter(Boolean).map((item, index) => Object.freeze({ recommendationId: item.id, portfolioId, events: Object.freeze([{ status: statuses[index], occurredAt: new Date("2026-07-23") }]), currentStatus: statuses[index] }));
    const result = buildPortfolioIntelligenceDashboard(source({ recommendationHistories: histories }), query);
    if (result.status !== "ready") throw new Error("Expected ready dashboard.");
    expect(result.dashboard.recommendations.topRecommendations.some((item) => histories.some((history) => history.recommendationId.value === item.id))).toBe(false);
    expect(result.dashboard.recommendations.totalActiveCount).toBe(currentRecommendations.recommendations.length - histories.length);
  });

  it("marks changed Portfolio and incompatible lineage stale without producing a trend", () => {
    const stale = buildPortfolioIntelligenceDashboard(source({ current: { ...source().current, version: 8 } }), query);
    expect(stale.status).toBe("degraded");
    if (stale.status === "degraded") {
      expect(stale.dashboard.freshness).toMatchObject({ overall: "stale", healthStatus: "stale", allocationStatus: "stale", recommendationStatus: "stale" });
      expect(stale.dashboard.attention.items.some((item) => item.code.includes("REEVALUATION_REQUIRED"))).toBe(true);
    }
    const incompatibleHealth = { ...source().previousHealth!, policyVersion: "portfolio-health-99" as const };
    const incompatible = buildPortfolioIntelligenceDashboard(source({ previousHealth: incompatibleHealth }), query);
    if (incompatible.status === "ready") expect(incompatible.dashboard.health.movement).toMatchObject({ status: "not-comparable", reason: "policy-incompatible" });
  });

  it("maps positive, constraining, opportunity, and exposure drivers with explicit bases", () => {
    const result = buildPortfolioIntelligenceDashboard(source(), query);
    if (result.status !== "ready") throw new Error("Expected ready dashboard.");
    expect(result.dashboard.drivers.positive.length).toBeGreaterThan(0);
    expect(result.dashboard.drivers.capitalConsuming[0]).toMatchObject({ subject: { type: "opportunity" }, contribution: "capital-consuming" });
    expect(result.dashboard.drivers.exposures.every((item) => ["revenue", "noi", "capital", "property-count"].includes(item.basis))).toBe(true);
  });

  it("produces equivalent projections for identical canonical inputs", () => {
    expect(JSON.stringify(buildPortfolioIntelligenceDashboard(source(), query))).toBe(JSON.stringify(buildPortfolioIntelligenceDashboard(source(), query)));
  });
});

describe("Portfolio Intelligence dashboard query", () => {
  it("authorizes before its one bounded source read and records safe telemetry", async () => {
    const order: string[] = [];
    const observer = { record: vi.fn() };
    const execute = createGetPortfolioIntelligenceDashboard({
      authorizer: { async authorize() { order.push("authorize"); return "authorized"; } },
      reader: { async read(_owner, _portfolio, limit) { order.push(`read:${limit}`); return source(); } },
      observer,
    });
    const result = await execute(query);
    expect(result.isSuccess).toBe(true);
    expect(order).toEqual(["authorize", `read:${PORTFOLIO_DASHBOARD_LIMITS.subjectReferences}`]);
    expect(observer.record).toHaveBeenCalledWith("portfolio_dashboard_opened", expect.objectContaining({ status: "ready" }));
    expect(JSON.stringify(observer.record.mock.calls)).not.toContain(portfolioId.value);
  });

  it("denies anonymous and conceals cross-owner access before reading", async () => {
    for (const [authorization, code] of [["unauthenticated", "PORTFOLIO_DASHBOARD_NOT_AUTHENTICATED"], ["concealed", "PORTFOLIO_DASHBOARD_NOT_FOUND"]] as const) {
      const read = vi.fn();
      const execute = createGetPortfolioIntelligenceDashboard({ authorizer: { async authorize() { return authorization; } }, reader: { read } });
      expect(await execute(query)).toMatchObject({ isSuccess: false, error: { code } });
      expect(read).not.toHaveBeenCalled();
    }
  });

  it("handles missing and unavailable Portfolio safely", async () => {
    const authorized = { async authorize() { return "authorized" as const; } };
    expect(await createGetPortfolioIntelligenceDashboard({ authorizer: authorized, reader: { async read() { return null; } } })(query)).toMatchObject({ isSuccess: false, error: { code: "PORTFOLIO_DASHBOARD_NOT_FOUND" } });
    expect(await createGetPortfolioIntelligenceDashboard({ authorizer: authorized, reader: { async read() { throw new Error("down"); } } })(query)).toMatchObject({ isSuccess: false, error: { code: "PORTFOLIO_DASHBOARD_PORTFOLIO_UNAVAILABLE" } });
  });
});
