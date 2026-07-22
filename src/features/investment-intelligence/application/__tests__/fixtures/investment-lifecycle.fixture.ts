import {
  AcquisitionType,
  MarketTrend,
  PropertyType,
} from "../../../domain";

import {
  runInvestmentAnalysis,
} from "../../run-investment-analysis";

const shared = {
  revenue: {
    projectedAdr: 200,
    projectedOccupancyPercentage: 75,
    averageLengthOfStay: 4,
    confidencePercentage: 80,
  },
  operating: {
    managementFeePercentage: 10,
    monthlyUtilities: 300,
    annualInsurance: 1800,
    annualCleaning: 7200,
    annualSoftware: 1200,
    annualSupplies: 1800,
    maintenanceReservePercentage: 5,
    capitalReservePercentage: 3,
  },
  market: {
    name: "Mesa",
    submarket: "Downtown",
    medianAdr: 180,
    medianOccupancyPercentage: 70,
    trend: MarketTrend.Stable,
  },
  comparables: [
    {
      id: "comparable-1",
      distanceMiles: 0.8,
      bedrooms: 2,
      bathrooms: 1,
      averageDailyRate: {
        amount: 180,
        currency: "USD",
      },
      occupancy: { value: 70 },
      rating: { value: 4.8, max: 5 },
      reviewCount: 100,
      amenities: ["Kitchen", "Parking"],
    },
  ],
} as const;

export function createPurchaseLifecycleResult() {
  const result = runInvestmentAnalysis({
    acquisitionType:
      AcquisitionType.Purchase,
    property: {
      id: "investment-platform-purchase",
      address1: "123 Main Street",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
      purchasePrice: 425000,
      closingCosts: 12000,
      furnishingBudget: 25000,
      propertyType:
        PropertyType.Apartment,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
    },
    financing: {
      downPaymentPercentage: 25,
      interestRatePercentage: 6.5,
      loanTermYears: 30,
    },
    operating: {
      ...shared.operating,
      annualTaxes: 4200,
    },
    revenue: shared.revenue,
    market: shared.market,
    comparables: shared.comparables,
  });

  if (
    result.acquisitionType !==
    AcquisitionType.Purchase
  ) {
    throw new Error(
      "Expected purchase lifecycle result.",
    );
  }

  return result;
}

export function createRentalLifecycleResult() {
  const result = runInvestmentAnalysis({
    acquisitionType:
      AcquisitionType.RentalArbitrage,
    property: {
      id: "investment-platform-rental",
      address1: "456 Main Street",
      city: "Mesa",
      state: "AZ",
      postalCode: "85201",
      furnishingBudget: 15000,
      propertyType:
        PropertyType.Apartment,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 950,
    },
    lease: {
      monthlyLease: 2000,
      securityDeposit: 2000,
      leaseTermMonths: 12,
      startupCosts: 3000,
      utilitiesIncluded: false,
    },
    operating: shared.operating,
    revenue: shared.revenue,
    market: shared.market,
    comparables: shared.comparables,
  });

  if (
    result.acquisitionType !==
    AcquisitionType.RentalArbitrage
  ) {
    throw new Error(
      "Expected rental lifecycle result.",
    );
  }

  return result;
}
