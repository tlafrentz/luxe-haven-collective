import { describe, expect, it, vi } from "vitest";

import { PropertyRecord } from "@/features/market-intelligence/domain/entities/property-record";
import { ProviderType } from "@/features/market-intelligence/domain/enums/provider-type";
import { ConfidenceScore } from "@/features/market-intelligence/domain/value-objects/confidence-score";
import { DataProvenance } from "@/features/market-intelligence/domain/value-objects/data-provenance";
import type { MarketComparableProvider, MarketComparableProviderCandidate } from "@/features/market-intelligence/application/providers/market-comparable-provider";
import type { MarketPropertyResolutionProvider } from "@/features/market-intelligence/application/providers/market-property-resolution-provider";
import { providerSuccess } from "@/features/market-intelligence/application/providers/provider-result";

import { AcquisitionType, PropertyType } from "../domain";
import { InvestmentWorkspaceAnalysisError, runInvestmentWorkspaceAnalysis } from "./run-investment-workspace-analysis";
import type { RunInvestmentAnalysisCommand } from "./run-investment-analysis";

const now = new Date("2026-07-21T18:00:00.000Z");

function property(id = "provider-property"): PropertyRecord {
  return new PropertyRecord(id, {
    formatted: "123 Main St, Mesa, AZ 85201", addressLine1: "123 Main St", city: "Mesa", state: "AZ", postalCode: "85201", country: "US",
  }, { propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1650, yearBuilt: 2001 }, {},
  new DataProvenance(ProviderType.RentCast, now, new ConfidenceScore(90), 1, "provider fact", "v1"),
  { latitude: 33.4, longitude: -111.8 });
}

function propertyProvider(records = [property()]): MarketPropertyResolutionProvider {
  return { lookupPropertyCandidates: vi.fn(async () => providerSuccess({
    provider: ProviderType.RentCast, retrievedAt: now,
    candidates: records.map((item) => ({ externalId: item.id, property: item })),
  })) };
}

function comparableCandidates(purpose: "sale-valuation" | "long-term-rent"): MarketComparableProviderCandidate[] {
  return Array.from({ length: 5 }, (_, index) => ({
    externalId: `${purpose}-${index}`,
    address: { formatted: `${200 + index} Oak St, Mesa, AZ 85201`, addressLine1: `${200 + index} Oak St`, city: "Mesa", state: "AZ", postalCode: "85201" },
    propertyType: "Single Family", bedrooms: 3, bathrooms: 2, squareFeet: 1600 + index * 20, yearBuilt: 1999,
    latitude: 33.41 + index * 0.001, longitude: -111.8, distanceMiles: 0.5 + index * 0.2,
    price: purpose === "sale-valuation" ? 405000 + index * 10000 : 2200 + index * 50,
    listedAt: new Date("2026-06-01T00:00:00.000Z"), listingStatus: purpose === "sale-valuation" ? "sold" : "active",
  }));
}

function comparableProvider(): MarketComparableProvider {
  return { acquireComparables: vi.fn(async (request) => providerSuccess({
    provider: ProviderType.RentCast, purpose: request.purpose, retrievedAt: now,
    candidates: comparableCandidates(request.purpose),
  })) };
}

function purchaseInput(): RunInvestmentAnalysisCommand {
  return {
    acquisitionType: AcquisitionType.Purchase,
    property: { id: "pending", address1: "123 Main Street", city: "Mesa", state: "AZ", postalCode: "85201", purchasePrice: 400000, closingCosts: 12000, furnishingBudget: 25000, propertyType: PropertyType.Apartment, bedrooms: 2, bathrooms: 1, squareFeet: 950 },
    financing: { downPaymentPercentage: 25, interestRatePercentage: 6.5, loanTermYears: 30 },
    revenue: { projectedAdr: 210, projectedOccupancyPercentage: 68, averageLengthOfStay: 4 },
    operating: { managementFeePercentage: 10, monthlyUtilities: 300, annualInsurance: 1800, annualTaxes: 4200, annualCleaning: 7200, annualSoftware: 1200, annualSupplies: 1800, maintenanceReservePercentage: 5, capitalReservePercentage: 3 },
    market: { name: "Mesa", medianAdr: 210, medianOccupancyPercentage: 68 }, comparables: [],
  };
}

function rentalInput(): RunInvestmentAnalysisCommand {
  const purchase = purchaseInput();
  return {
    acquisitionType: AcquisitionType.RentalArbitrage,
    property: { id: "pending", address1: "123 Main Street", city: "Mesa", state: "AZ", postalCode: "85201", furnishingBudget: 15000, propertyType: PropertyType.Apartment, bedrooms: 2, bathrooms: 1, squareFeet: 950 },
    lease: { monthlyLease: 2500, securityDeposit: 2500, leaseTermMonths: 12, startupCosts: 3000, utilitiesIncluded: false },
    revenue: purchase.revenue, operating: {
      managementFeePercentage: 10, monthlyUtilities: 300, annualInsurance: 1800, annualCleaning: 7200,
      annualSoftware: 1200, annualSupplies: 1800, maintenanceReservePercentage: 5, capitalReservePercentage: 3,
    },
    market: purchase.market, comparables: [],
  };
}

function command(input = purchaseInput()) {
  return {
    address: { streetAddress: "123 Main Street", city: "Mesa", state: "AZ", postalCode: "85201" },
    investmentInput: input,
    userProvidedAssumptionKeys: input.acquisitionType === AcquisitionType.Purchase ? ["purchase-price", "projected-adr", "projected-occupancy-percentage"] : ["monthly-lease", "projected-adr", "projected-occupancy-percentage"],
    marketRequest: { saleValuation: input.acquisitionType === AcquisitionType.Purchase, longTermRent: true },
    context: { workspaceRunId: "workspace-1", propertyResolutionId: "resolution-1", marketAnalysisId: "market-1", requestedAt: now, requestedBy: "operator-1" },
  } as const;
}

describe("runInvestmentWorkspaceAnalysis", () => {
  it("runs the canonical purchase lifecycle while keeping purchase and STR terms explicit", async () => {
    const result = await runInvestmentWorkspaceAnalysis(command(), { propertyProvider: propertyProvider(), comparableProvider: comparableProvider() });
    expect(result.propertyResolution.status).toBe("resolved");
    expect(result.marketReport.saleValuation?.estimatedValue).toBeGreaterThan(0);
    expect(result.investmentAnalysisContext.input.acquisitionType).toBe(AcquisitionType.Purchase);
    if (result.investmentAnalysisContext.input.acquisitionType === AcquisitionType.Purchase) {
      expect(result.investmentAnalysisContext.input.property.purchasePrice).toBe(400000);
      expect(result.investmentAnalysisContext.input.revenue.projectedAdr).toBe(210);
      expect(result.investmentAnalysisContext.input.revenue.projectedOccupancyPercentage).toBe(68);
    }
    expect(result.lifecycleResult.analysis.comparableAnalysis.comparables).toEqual([]);
    expect(result.lineage).toMatchObject({ propertyResolutionId: "resolution-1", marketAnalysisId: "market-1" });
  });

  it("keeps a rental lease separate from the Market rent benchmark", async () => {
    const result = await runInvestmentWorkspaceAnalysis(command(rentalInput()), { propertyProvider: propertyProvider(), comparableProvider: comparableProvider() });
    expect(result.marketReport.longTermRent?.estimatedMonthlyRent).toBeGreaterThan(0);
    expect(result.investmentAnalysisContext.input.acquisitionType).toBe(AcquisitionType.RentalArbitrage);
    if (result.investmentAnalysisContext.input.acquisitionType === AcquisitionType.RentalArbitrage) expect(result.investmentAnalysisContext.input.lease.monthlyLease).toBe(2500);
    expect(result.investmentAnalysisContext.assumptions.find(({ key }) => key === "market-monthly-rent-estimate")?.source).toBe("market");
  });

  it("rejects ambiguous properties without calling comparable acquisition", async () => {
    const comparables = comparableProvider();
    await expect(runInvestmentWorkspaceAnalysis(command(), { propertyProvider: propertyProvider([property("a"), property("b")]), comparableProvider: comparables }))
      .rejects.toMatchObject({ code: "PROPERTY_AMBIGUOUS" });
    expect(comparables.acquireComparables).not.toHaveBeenCalled();
  });

  it("rejects incomplete commands and leaves inputs unchanged", async () => {
    const input = command();
    const before = structuredClone(input);
    await expect(runInvestmentWorkspaceAnalysis({ ...input, address: { ...input.address, city: "" } }, { propertyProvider: propertyProvider(), comparableProvider: comparableProvider() }))
      .rejects.toBeInstanceOf(InvestmentWorkspaceAnalysisError);
    expect(input).toEqual(before);
  });

  it("is deterministic under fixed context and returns deeply frozen artifacts", async () => {
    const first = await runInvestmentWorkspaceAnalysis(command(), { propertyProvider: propertyProvider(), comparableProvider: comparableProvider() });
    const second = await runInvestmentWorkspaceAnalysis(command(), { propertyProvider: propertyProvider(), comparableProvider: comparableProvider() });
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.marketReport)).toBe(true);
  });
});
