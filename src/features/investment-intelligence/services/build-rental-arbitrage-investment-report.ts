import {
  AcquisitionType,
  MarketTrend,
} from "../domain";

import type {
  ComparableProperty,
  PropertyType,
  RentalArbitrageInvestmentAnalysis,
} from "../domain";

import {
  assessRentalArbitrageRisks,
} from "../application/assess-rental-arbitrage-risks";

import {
  buildRentalArbitrageEvidence,
} from "../application/build-rental-arbitrage-evidence";

import {
  calculateComparableAnalysis,
  calculateRevenueProjection,
} from "../application";

import {
  evaluateRentalArbitrageDecision,
} from "../application/evaluate-rental-arbitrage-decision";

import {
  calculateRentalArbitrageFinancialPerformance,
} from "./calculate-rental-arbitrage-financial-performance";

export type BuildRentalArbitrageInvestmentReportInput = {
  readonly acquisitionType:
    AcquisitionType.RentalArbitrage;

  readonly property: {
    readonly id: string;
    readonly address1: string;
    readonly city: string;
    readonly state: string;
    readonly postalCode: string;
    readonly furnishingBudget: number;
    readonly propertyType: PropertyType;
    readonly bedrooms: number;
    readonly bathrooms: number;
    readonly squareFeet: number;
  };

  readonly lease: {
    readonly monthlyLease: number;
    readonly securityDeposit: number;
    readonly leaseTermMonths: number;
    readonly startupCosts: number;
    readonly utilitiesIncluded: boolean;
  };

  readonly revenue: {
    readonly projectedAdr: number;
    readonly projectedOccupancyPercentage: number;
    readonly averageLengthOfStay: number;
    readonly confidencePercentage?: number;
  };

  readonly operating: {
    readonly managementFeePercentage: number;
    readonly monthlyUtilities: number;
    readonly annualInsurance: number;
    readonly annualCleaning: number;
    readonly annualSoftware: number;
    readonly annualSupplies: number;
    readonly maintenanceReservePercentage: number;
    readonly capitalReservePercentage: number;
  };

  readonly market: {
    readonly name: string;
    readonly submarket?: string;
    readonly medianAdr: number;
    readonly medianOccupancyPercentage: number;
    readonly trend?: MarketTrend;
  };

  readonly comparables:
    readonly ComparableProperty[];
};

function usd(amount: number) {
  return {
    amount:
      Math.round(
        (amount + Number.EPSILON) * 100,
      ) / 100,
    currency: "USD" as const,
  };
}

export function buildRentalArbitrageInvestmentReport({
  property,
  lease,
  revenue,
  operating,
  market,
  comparables,
}: BuildRentalArbitrageInvestmentReportInput): RentalArbitrageInvestmentAnalysis {
  const revenueConfidence =
    revenue.confidencePercentage ??
    80;

  const revenueProjection =
    calculateRevenueProjection({
      projectedAdr:
        usd(revenue.projectedAdr),
      projectedOccupancy: {
        value:
          revenue
            .projectedOccupancyPercentage,
      },
      confidence: {
        value:
          revenueConfidence,
      },
    });

  const annualRevenue =
    revenueProjection
      .projectedAnnualRevenue.amount;

  const managementExpense =
    annualRevenue *
    (
      operating
        .managementFeePercentage /
      100
    );

  const maintenanceExpense =
    annualRevenue *
    (
      operating
        .maintenanceReservePercentage /
      100
    );

  const capitalReserveExpense =
    annualRevenue *
    (
      operating
        .capitalReservePercentage /
      100
    );

  const assumptions = {
    acquisitionType:
      AcquisitionType.RentalArbitrage,
    monthlyLease:
      usd(lease.monthlyLease),
    securityDeposit:
      usd(lease.securityDeposit),
    leaseTermMonths:
      lease.leaseTermMonths,
    furnishingBudget:
      usd(property.furnishingBudget),
    startupCosts:
      usd(lease.startupCosts),
    utilitiesIncluded:
      lease.utilitiesIncluded,
  } as const;

  const marketSnapshot = {
    market: market.name,
    submarket:
      market.submarket,
    medianAdr:
      usd(market.medianAdr),
    medianOccupancy: {
      value:
        market
          .medianOccupancyPercentage,
    },
    trend:
      market.trend ??
      MarketTrend.Stable,
  } as const;

  const {
    expenseProjection,
    financialPerformance,
  } =
    calculateRentalArbitrageFinancialPerformance({
      revenueProjection,
      monthlyLease:
        assumptions.monthlyLease,
      securityDeposit:
        assumptions.securityDeposit,
      furnishingBudget:
        assumptions.furnishingBudget,
      startupCosts:
        assumptions.startupCosts,
      cleaning:
        usd(operating.annualCleaning),
      utilities:
        usd(
          lease.utilitiesIncluded
            ? 0
            : operating.monthlyUtilities *
                12,
        ),
      insurance:
        usd(operating.annualInsurance),
      management:
        usd(managementExpense),
      maintenance:
        usd(maintenanceExpense),
      software:
        usd(operating.annualSoftware),
      supplies:
        usd(operating.annualSupplies),
      capitalReserve:
        usd(capitalReserveExpense),
      confidence: {
        value: 80,
      },
    });

  const comparableAnalysis =
    calculateComparableAnalysis({
      comparables,
      revenueProjection,
    });

  const riskAssessment =
    assessRentalArbitrageRisks({
      assumptions,
      financialPerformance,
      market: marketSnapshot,
    });

  const supportingEvidence =
    buildRentalArbitrageEvidence({
      revenueProjection,
      financialPerformance,
      comparableAnalysis,
      market: marketSnapshot,
    });

  const decision =
    evaluateRentalArbitrageDecision({
      revenueProjection,
      financialPerformance,
      comparableAnalysis,
      market: marketSnapshot,
      riskExposure:
        riskAssessment.riskExposure,
      risks: riskAssessment.risks,
      supportingEvidence,
    });

  return {
    acquisitionType:
      AcquisitionType.RentalArbitrage,

    property: {
      id: property.id,
      location: {
        address1: property.address1,
        city: property.city,
        state: property.state,
        postalCode:
          property.postalCode,
      },
      furnishingBudget:
        usd(property.furnishingBudget),
      propertyType:
        property.propertyType,
      bedrooms:
        property.bedrooms,
      bathrooms:
        property.bathrooms,
      squareFeet:
        property.squareFeet,
    },

    market: marketSnapshot,
    assumptions,
    revenueProjection,
    expenseProjection,
    financialPerformance,
    comparableAnalysis,

    score: decision.score,
    risks: riskAssessment.risks,
    supportingEvidence,

    recommendation:
      decision.recommendation,
    confidence:
      decision.confidence,
  };
}
