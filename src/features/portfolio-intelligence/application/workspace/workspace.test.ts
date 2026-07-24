import { describe, expect, it, vi } from "vitest";
import { createPortfolioId } from "@/features/portfolio";
import { evaluateCapitalAllocation } from "../../domain/allocation";
import { engineInput } from "../../domain/allocation/test-fixtures";
import { health } from "../../domain/allocation/test-fixtures";
import {
  buildPortfolioWorkspace,
  createGetPortfolioIntelligenceWorkspace,
  PORTFOLIO_WORKSPACE_LIMITS,
  type GetPortfolioIntelligenceWorkspaceQuery,
  type PortfolioWorkspaceSource,
} from "./index";

const portfolioId = createPortfolioId("portfolio-health-test");
const evaluatedAt = new Date("2026-07-23T12:00:00.000Z");
const observationWindow = Object.freeze({ start: new Date("2026-06-01T00:00:00.000Z"), end: new Date("2026-07-01T00:00:00.000Z") });
const query: GetPortfolioIntelligenceWorkspaceQuery = Object.freeze({ ownerId: "owner-1", portfolioId, observationWindow, evaluatedAt });

function source(override: Partial<PortfolioWorkspaceSource> = {}): PortfolioWorkspaceSource {
  return Object.freeze({
    portfolioId,
    version: 7,
    name: "Luxe Haven Portfolio",
    strategySummary: "Growth with liquidity protection",
    reportingCurrency: "USD",
    updatedAt: new Date("2026-07-23T10:00:00.000Z"),
    properties: Object.freeze([
      Object.freeze({ propertyId: "property-a", name: "Main Street Retreat", market: "Austin", propertyType: "single-family", operatingModel: "self", active: true }),
      Object.freeze({ propertyId: "property-b", name: "Music Row Loft", market: "Nashville", propertyType: "condo", operatingModel: "partner", active: true }),
    ]),
    opportunities: Object.freeze([
      Object.freeze({ opportunityId: "opportunity-growth", name: "Willow Street", planningStatus: "candidate", active: true }),
      Object.freeze({ opportunityId: "opportunity-exited", name: "Exited", planningStatus: "exited", active: false }),
    ]),
    health: health(),
    allocation: evaluateCapitalAllocation(engineInput()),
    ...override,
  });
}

describe("Portfolio Intelligence workspace query", () => {
  it("authorizes before its one bounded source read and returns a ready projection", async () => {
    const order: string[] = [];
    const observer = { record: vi.fn() };
    const execute = createGetPortfolioIntelligenceWorkspace({
      authorizer: { async authorize() { order.push("authorize"); return "authorized"; } },
      reader: { async read() { order.push("read"); return source(); } },
      observer,
    });
    const result = await execute(query);
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.status).toBe("ready");
    expect(order).toEqual(["authorize", "read"]);
    expect(observer.record).toHaveBeenCalledWith("portfolio_workspace_opened", expect.objectContaining({ status: "ready" }));
  });

  it("denies anonymous access and conceals cross-owner portfolios without reading", async () => {
    for (const [authorization, code] of [["unauthenticated", "PORTFOLIO_WORKSPACE_NOT_AUTHENTICATED"], ["concealed", "PORTFOLIO_WORKSPACE_NOT_FOUND"]] as const) {
      const read = vi.fn();
      const execute = createGetPortfolioIntelligenceWorkspace({ authorizer: { async authorize() { return authorization; } }, reader: { read } });
      const result = await execute(query);
      expect(result).toMatchObject({ isSuccess: false, error: { code } });
      expect(read).not.toHaveBeenCalled();
    }
  });

  it("degrades missing health and allocation independently", () => {
    expect(buildPortfolioWorkspace(source({ health: null }), query)).toMatchObject({ status: "health-unavailable" });
    expect(buildPortfolioWorkspace(source({ allocation: null }), query)).toMatchObject({ status: "allocation-unavailable" });
  });

  it("represents empty and formation-stage portfolios intentionally", () => {
    expect(buildPortfolioWorkspace(source({ properties: [], opportunities: [] }), query)).toMatchObject({ status: "insufficient-data", gaps: [{ code: "PORTFOLIO_HAS_NO_ACTIVE_PROPERTIES" }] });
    expect(buildPortfolioWorkspace(source({ properties: [] }), query)).toMatchObject({ status: "formation-stage", formation: { activeOpportunities: 1 } });
  });

  it("enforces collection bounds and preserves active composition semantics", () => {
    const value = buildPortfolioWorkspace(source(), { ...query, attentionLimit: 999, propertyContributionLimit: 999, allocationCandidateLimit: 999 });
    expect(value.status).toBe("ready");
    if (value.status !== "ready") return;
    expect(value.workspace.attention.priorities.length).toBeLessThanOrEqual(PORTFOLIO_WORKSPACE_LIMITS.attention);
    expect(value.workspace.composition.propertyContributions.length).toBeLessThanOrEqual(PORTFOLIO_WORKSPACE_LIMITS.propertyContributions);
    expect(value.workspace.allocation!.alternates.length).toBeLessThanOrEqual(PORTFOLIO_WORKSPACE_LIMITS.allocationCandidates);
    expect(value.workspace.portfolio.activeOpportunityCount).toBe(1);
    expect(value.workspace.composition.opportunityStates).toEqual([{ key: "candidate", count: 1 }]);
  });

  it("detects changed portfolio, stale health lineage, and policy incompatibility", () => {
    const changed = buildPortfolioWorkspace(source({ version: 8 }), query);
    expect(changed.status).toBe("ready");
    if (changed.status === "ready") {
      expect(changed.workspace.assessmentLineage.healthFreshness).toBe("stale");
      expect(changed.workspace.assessmentLineage.allocationFreshness).toBe("stale");
    }
    const allocation = evaluateCapitalAllocation(engineInput());
    const incompatible = buildPortfolioWorkspace(source({ allocation: { ...allocation, healthPolicyVersion: "portfolio-health-99" } }), query);
    expect(incompatible.status).toBe("ready");
    if (incompatible.status === "ready") {
      expect(incompatible.workspace.assessmentLineage.compatible).toBe(false);
      expect(incompatible.workspace.limitations.some((item) => item.code === "PORTFOLIO_WORKSPACE_POLICIES_INCOMPATIBLE")).toBe(true);
    }
  });

  it("is deterministic for equivalent inputs and exposes no fingerprints", () => {
    const first = buildPortfolioWorkspace(source(), query);
    const second = buildPortfolioWorkspace(source({ properties: [...source().properties].reverse() }), query);
    expect(first.status).toBe("ready");
    expect(JSON.stringify(first)).not.toContain("snapshotFingerprint");
    expect(JSON.stringify(first)).not.toContain("owner-1");
    expect(JSON.stringify(buildPortfolioWorkspace(source(), query))).toBe(JSON.stringify(first));
    expect(second.status).toBe("ready");
  });
});
