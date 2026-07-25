import type { PropertyComparisonCapabilities, PropertyComparisonPolicy } from "./contracts";
import type { WorkspaceRole } from "@/features/workspace";

export const PROPERTY_COMPARISON_POLICY: PropertyComparisonPolicy = Object.freeze({
  version: "portfolio-property-comparison-v1",
  materialRevenuePercent: 0.05, materialOccupancyPoints: 0.03, materialAdrPercent: 0.04,
  materialRevparPercent: 0.05, materialBookingPercent: 0.08, contributionThreshold: 0.25,
  burdenThreshold: 0.35, minimumPeerSize: 2, minimumHistoryDays: 30, tieTolerance: 0.005,
});

export function comparisonCapabilitiesForRole(role: WorkspaceRole): PropertyComparisonCapabilities {
  return Object.freeze({
    performance: true,
    financials: role === "owner" || role === "administrator" || role === "operator",
    operations: role !== "viewer",
  });
}
