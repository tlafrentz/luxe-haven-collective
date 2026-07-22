import { describe, expect, it } from "vitest";

import { AcquisitionType } from "@/features/investment-intelligence/domain/enums/acquisition-type";
import { MarketTrend } from "@/features/investment-intelligence/domain/enums/market-trend";
import { PropertyType } from "@/features/investment-intelligence/domain/enums/property-type";
import { investmentWorkspaceActionSchema } from "./investment-workspace-schema";

function valid() {
  return {
    clientRequestId: "client-1",
    address: { streetAddress: "123 Main St", city: "Mesa", state: "AZ", postalCode: "85201", countryCode: "US" },
    investmentInput: {
      acquisitionType: AcquisitionType.Purchase,
      property: { id: "pending", address1: "123 Main St", city: "Mesa", state: "AZ", postalCode: "85201", furnishingBudget: 25000, propertyType: PropertyType.SingleFamily, bedrooms: 3, bathrooms: 2, squareFeet: 1650, purchasePrice: 400000, closingCosts: 12000 },
      financing: { downPaymentPercentage: 25, interestRatePercentage: 6.5, loanTermYears: 30 },
      revenue: { projectedAdr: 210, projectedOccupancyPercentage: 68, averageLengthOfStay: 4 },
      operating: { managementFeePercentage: 10, monthlyUtilities: 300, annualInsurance: 1800, annualCleaning: 7200, annualSoftware: 1200, annualSupplies: 1800, maintenanceReservePercentage: 5, capitalReservePercentage: 3, annualTaxes: 4200 },
      market: { name: "Mesa", medianAdr: 210, medianOccupancyPercentage: 68, trend: MarketTrend.Stable }, comparables: [],
    },
    userProvidedAssumptionKeys: ["purchase-price", "projected-adr"],
    marketRequest: { saleValuation: true, longTermRent: true },
  };
}

describe("investmentWorkspaceActionSchema", () => {
  it("accepts the strict canonical purchase payload", () => expect(investmentWorkspaceActionSchema.safeParse(valid()).success).toBe(true));
  it("rejects unknown fields", () => expect(investmentWorkspaceActionSchema.safeParse({ ...valid(), actorId: "forged" }).success).toBe(false));
  it("rejects impossible occupancy", () => expect(investmentWorkspaceActionSchema.safeParse({ ...valid(), investmentInput: { ...valid().investmentInput, revenue: { ...valid().investmentInput.revenue, projectedOccupancyPercentage: 101 } } }).success).toBe(false));
  it("rejects negative financial values", () => expect(investmentWorkspaceActionSchema.safeParse({ ...valid(), investmentInput: { ...valid().investmentInput, property: { ...valid().investmentInput.property, purchasePrice: -1 } } }).success).toBe(false));
  it("rejects oversized addresses", () => expect(investmentWorkspaceActionSchema.safeParse({ ...valid(), address: { ...valid().address, streetAddress: "x".repeat(161) } }).success).toBe(false));
  it("rejects duplicate assumption keys", () => expect(investmentWorkspaceActionSchema.safeParse({ ...valid(), userProvidedAssumptionKeys: ["purchase-price", "purchase-price"] }).success).toBe(false));
  it("rejects unsupported countries", () => expect(investmentWorkspaceActionSchema.safeParse({ ...valid(), address: { ...valid().address, countryCode: "CA" } }).success).toBe(false));
  it("rejects requests with no Market section", () => expect(investmentWorkspaceActionSchema.safeParse({ ...valid(), marketRequest: { saleValuation: false, longTermRent: false } }).success).toBe(false));
  it("rejects client-supplied Learning objects until references have a server resolver", () => expect(investmentWorkspaceActionSchema.safeParse({ ...valid(), appliedLearningContext: {} }).success).toBe(false));
});
