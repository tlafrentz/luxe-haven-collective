import { describe, expect, it } from "vitest";

import { AcquisitionType, PropertyType } from "../domain";
import { buildSuppliedAssumptionMarketProviders } from "@/app/actions/investment-workspace-runtime";
import { projectInvestmentWorkspaceTransport } from "./project-investment-workspace-transport";
import { runInvestmentWorkspaceAnalysis } from "./run-investment-workspace-analysis";
import type { RunInvestmentAnalysisCommand } from "./run-investment-analysis";

const analyzedAt = new Date("2026-07-21T18:00:00.000Z");

function command(): Parameters<typeof runInvestmentWorkspaceAnalysis>[0] {
  const investmentInput: RunInvestmentAnalysisCommand = {
    acquisitionType: AcquisitionType.RentalArbitrage,
    property: { id: "pending", address1: "123 Main Street", city: "Mesa", state: "AZ", postalCode: "85201", furnishingBudget: 15000, propertyType: PropertyType.Apartment, bedrooms: 2, bathrooms: 1, squareFeet: 950 },
    lease: { monthlyLease: 2500, securityDeposit: 2500, leaseTermMonths: 12, startupCosts: 3000, utilitiesIncluded: false },
    revenue: { projectedAdr: 210, projectedOccupancyPercentage: 68, averageLengthOfStay: 4 },
    operating: { managementFeePercentage: 10, monthlyUtilities: 300, annualInsurance: 1800, annualCleaning: 7200, annualSoftware: 1200, annualSupplies: 1800, maintenanceReservePercentage: 5, capitalReservePercentage: 3 },
    market: { name: "Mesa", medianAdr: 210, medianOccupancyPercentage: 68 },
    comparables: [],
  };
  return {
    address: { streetAddress: "123 Main Street", city: "Mesa", state: "AZ", postalCode: "85201" },
    investmentInput,
    userProvidedAssumptionKeys: ["monthly-lease", "projected-adr", "projected-occupancy-percentage"],
    marketRequest: { saleValuation: false, longTermRent: true },
    context: { workspaceRunId: "workspace-transport", propertyResolutionId: "resolution-transport", marketAnalysisId: "market-transport", requestedAt: analyzedAt, requestedBy: "operator-1" },
  };
}

function customPrototypePaths(value: unknown, path = "result", seen = new WeakSet<object>()): string[] {
  if (!value || typeof value !== "object" || value instanceof Date) return [];
  if (seen.has(value)) return [];
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  const own = prototype === Object.prototype || prototype === Array.prototype || prototype === null
    ? []
    : [`${path} <${prototype?.constructor?.name ?? "unknown"}>`];
  return [
    ...own,
    ...Object.entries(value).flatMap(([key, child]) => customPrototypePaths(child, `${path}.${key}`, seen)),
  ];
}

describe("projectInvestmentWorkspaceTransport", () => {
  it("removes the rich Platform workspace view from a rental analysis DTO", async () => {
    const input = command();
    const result = await runInvestmentWorkspaceAnalysis(input, buildSuppliedAssumptionMarketProviders(input));
    const domainPaths = customPrototypePaths(result);
    const transport = projectInvestmentWorkspaceTransport(result);

    expect(domainPaths.length).toBeGreaterThan(0);
    expect(domainPaths.every((path) =>
      path.startsWith("result.decisionAnalysis.workspaceView.platform"),
    )).toBe(true);
    expect(customPrototypePaths(transport)).toEqual([]);
    expect("workspaceView" in transport.decisionAnalysis).toBe(false);
    expect(transport.lifecycleResult).toBe(result.lifecycleResult);
    expect(result.decisionAnalysis.workspaceView.platform.observations.toArray().length).toBeGreaterThan(0);
  });
});
