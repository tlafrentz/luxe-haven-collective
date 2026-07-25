import { describe, expect, it, vi } from "vitest";
import { permissionsForRole, type WorkspaceAccessContext, type WorkspaceRole } from "@/features/workspace";
import { ConfidenceLevel } from "@/platform/scoring";
import {
  buildPortfolioProjection,
  type BuildPortfolioProjectionQuery,
  type PortfolioProjectionSource,
  type PortfolioPropertySource,
} from "./read-model";

const period = { current: { from: "2026-07-01", to: "2026-07-31" }, comparisonType: "none" as const };
function access(role: WorkspaceRole = "owner", propertyIds: readonly string[] = []): WorkspaceAccessContext {
  return {
    profileId: "profile-1", workspaceId: "workspace-1", ownerId: "owner-1",
    ownerProfileId: "profile-1", membershipId: "membership-1", role, status: "active",
    propertyAccess: role === "owner" || role === "administrator" ? { type: "all" } : { type: "selected", propertyIds },
    permissions: permissionsForRole(role),
  };
}
function property(propertyId: string, revenue: number, freshness: "current" | "stale" | "degraded" = "current"): PortfolioPropertySource {
  return {
    propertyId, name: propertyId, status: "active", market: "Austin", operatingModel: "managed",
    metrics: {
      grossRevenue: revenue, adr: 100, occupancy: 0.5, revpar: 50,
      netOperatingIncome: revenue * 0.4, cashFlow: revenue * 0.3, margin: 0.4,
      bookingCount: 2, activeStays: 1, openActions: 1, operationalIssues: freshness === "current" ? 0 : 1,
    },
    observations: [], freshness, confidence: ConfidenceLevel.HIGH,
    evidence: [{ id: `evidence-${propertyId}`, propertyId, kind: "revenue", statement: "Canonical revenue observation", observedAt: "2026-07-25T00:00:00.000Z", confidence: ConfidenceLevel.HIGH }],
  };
}
function source(catalog = [
  { propertyId: "property-1", included: true },
  { propertyId: "property-2", included: true },
  { propertyId: "property-3", included: false },
]) {
  const loadAuthorizedProperties = vi.fn(async (_workspaceId: string, ids: readonly string[]) =>
    ids.map((id) => property(id, id === "property-1" ? 300 : 200, id === "property-2" ? "stale" : "current")));
  return {
    listWorkspaceProperties: vi.fn(async () => catalog),
    loadAuthorizedProperties,
  } satisfies PortfolioProjectionSource;
}
function query(overrides: Partial<BuildPortfolioProjectionQuery> = {}): BuildPortfolioProjectionQuery {
  return { access: access(), workspaceId: "workspace-1", period, evaluatedAt: "2026-07-25T12:00:00.000Z", ...overrides };
}

describe("Portfolio projection application service", () => {
  it("authorizes before loading facts and reconciles totals to included properties", async () => {
    const gateway = source();
    const projection = await buildPortfolioProjection(gateway, query({ access: access("operator", ["property-2", "property-3"]) }));
    expect(gateway.loadAuthorizedProperties).toHaveBeenCalledWith("workspace-1", ["property-2"], period);
    expect(projection.scope.authorization.type).toBe("assigned-properties");
    expect(projection.properties.map(({ propertyId }) => propertyId)).toEqual(["property-2"]);
    expect(projection.performance.grossRevenue).toBe(200);
    expect(projection.freshness).toBe("stale");
    expect(projection.confidence).toBe(ConfidenceLevel.HIGH);
  });

  it("omits excluded properties even for workspace owners", async () => {
    const projection = await buildPortfolioProjection(source(), query());
    expect(projection.scope.propertyIds).toEqual(["property-1", "property-2"]);
    expect(projection.performance.grossRevenue).toBe(500);
    expect(projection.summary.propertyCount).toBe(2);
  });

  it("represents no portfolio without loading property facts", async () => {
    const gateway = source([{ propertyId: "property-1", included: false }]);
    const projection = await buildPortfolioProjection(gateway, query());
    expect(projection.state).toBe("no-portfolio");
    expect(projection.freshness).toBe("unknown");
    expect(projection.confidence).toBe(ConfidenceLevel.VERY_LOW);
    expect(gateway.loadAuthorizedProperties).not.toHaveBeenCalled();
  });

  it("represents insufficient evidence intentionally", async () => {
    const projection = await buildPortfolioProjection(source(), query({ evidenceThreshold: 3 }));
    expect(projection.state).toBe("insufficient-evidence");
    expect(projection.observations.at(-1)?.kind).toBe("low-evidence");
  });

  it.each([
    ["anonymous", query({ access: null }), "ANONYMOUS_DENIED"],
    ["cross-workspace", query({ access: { ...access(), workspaceId: "other" } }), "CROSS_WORKSPACE_DENIED"],
    ["inactive", query({ access: { ...access(), status: "suspended" } }), "PORTFOLIO_ACCESS_DENIED"],
  ])("denies %s access before aggregation", async (_label, input, code) => {
    const gateway = source();
    await expect(buildPortfolioProjection(gateway, input)).rejects.toMatchObject({ code });
    expect(gateway.loadAuthorizedProperties).not.toHaveBeenCalled();
  });

  it("rejects filters that reference another workspace", async () => {
    const gateway = source();
    await expect(buildPortfolioProjection(gateway, query({ propertyIds: ["foreign"] }))).rejects.toMatchObject({ code: "INVALID_PROPERTY_FILTER" });
    expect(gateway.loadAuthorizedProperties).not.toHaveBeenCalled();
  });
});
