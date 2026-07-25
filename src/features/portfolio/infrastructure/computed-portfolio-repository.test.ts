import { describe, expect, it, vi } from "vitest";
import { permissionsForRole, type WorkspaceAccessContext } from "@/features/workspace";
import { ConfidenceLevel } from "@/platform/scoring";
import { ComputedPortfolioRepository } from "./computed-portfolio-repository";

const access: WorkspaceAccessContext = {
  profileId: "profile-1", workspaceId: "workspace-1", ownerId: "owner-1",
  ownerProfileId: "profile-1", membershipId: "membership-1", role: "viewer", status: "active",
  propertyAccess: { type: "selected", propertyIds: ["property-1"] },
  permissions: permissionsForRole("viewer"),
};
const query = {
  access,
  workspaceId: "workspace-1",
  period: { current: { from: "2026-07-01", to: "2026-07-31" }, comparisonType: "none" as const },
};

describe("ComputedPortfolioRepository", () => {
  it("rebuilds the read model from current source facts without persisting it", async () => {
    let revenue = 100;
    const source = {
      listWorkspaceProperties: vi.fn(async () => [{ propertyId: "property-1", included: true }]),
      loadAuthorizedProperties: vi.fn(async () => [{
        propertyId: "property-1", name: "Lake House", status: "active" as const,
        market: "Austin", operatingModel: "managed",
        metrics: { grossRevenue: revenue, adr: 100, occupancy: 0.5, revpar: 50, netOperatingIncome: null, cashFlow: null, margin: null, bookingCount: 1, activeStays: 0, openActions: 0, operationalIssues: 0 },
        observations: [], evidence: [{ id: "e-1", propertyId: "property-1", kind: "revenue" as const, statement: "Revenue fact", observedAt: "2026-07-25T00:00:00.000Z", confidence: ConfidenceLevel.HIGH }],
        confidence: ConfidenceLevel.HIGH, freshness: "current" as const,
      }]),
    };
    const repository = new ComputedPortfolioRepository(source);
    expect((await repository.getPortfolioProjection(query)).performance.grossRevenue).toBe(100);
    revenue = 250;
    expect((await repository.buildPortfolioProjection(query)).performance.grossRevenue).toBe(250);
  });
});
