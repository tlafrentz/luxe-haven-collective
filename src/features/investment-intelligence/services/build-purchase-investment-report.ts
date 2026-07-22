import {
  AcquisitionType,
  MarketTrend,
} from "../domain";

import type {
  ComparableProperty,
  InvestmentDecision,
  PropertyType,
} from "../domain";

import {
  buildInvestmentDecision,
  calculateComparableAnalysis,
  calculateExpenseProjection,
  calculateFinancialPerformance,
  calculateRevenueProjection,
} from "../application";

import type {
  InvestmentDecisionPolicies,
} from "../application";

import {
  calculateAnnualDebtService,
} from "./calculate-annual-debt-service";

export type BuildPurchaseInvestmentReportInput = {
  /**
   * Optional for backward compatibility with the existing workspace.
   * The strategy-aware dispatcher treats an omitted value as Purchase.
   */
  readonly acquisitionType?: AcquisitionType.Purchase;

  readonly property: {
    readonly id: string;
    readonly address1: string;
    readonly city: string;
    readonly state: string;
    readonly postalCode: string;
    readonly purchasePrice: number;
    readonly closingCosts: number;
    readonly furnishingBudget: number;
    readonly propertyType: PropertyType;
    readonly bedrooms: number;
    readonly bathrooms: number;
    readonly squareFeet: number;
  };

  readonly financing: {
    readonly downPaymentPercentage: number;
    readonly interestRatePercentage: number;
    readonly loanTermYears: number;
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
    readonly annualTaxes: number;
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

  readonly comparables: readonly ComparableProperty[];

  readonly policies?: InvestmentDecisionPolicies;
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

export function buildPurchaseInvestmentReport({
  property,
  financing,
  revenue,
  operating,
  market,
  comparables,
  policies,
}: BuildPurchaseInvestmentReportInput):
  InvestmentDecision & {
    readonly acquisitionType:
      AcquisitionType.Purchase;
  } {
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
          revenue.confidencePercentage ??
          80,
      },
    });

  const annualRevenue =
    revenueProjection
      .projectedAnnualRevenue.amount;

  const annualDebtService =
    calculateAnnualDebtService({
      purchasePrice:
        property.purchasePrice,
      downPaymentPercentage:
        financing
          .downPaymentPercentage,
      annualInterestRatePercentage:
        financing
          .interestRatePercentage,
      loanTermYears:
        financing.loanTermYears,
    });

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

  const expenseProjection =
    calculateExpenseProjection({
      mortgage:
        usd(annualDebtService),
      cleaning:
        usd(operating.annualCleaning),
      utilities:
        usd(
          operating.monthlyUtilities *
            12,
        ),
      insurance:
        usd(operating.annualInsurance),
      taxes:
        usd(operating.annualTaxes),
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

  const cashInvested =
    property.purchasePrice *
      (
        financing
          .downPaymentPercentage /
        100
      ) +
    property.closingCosts +
    property.furnishingBudget;

  const financialPerformance =
    calculateFinancialPerformance({
      revenueProjection,
      expenseProjection,
      purchasePrice:
        usd(property.purchasePrice),
      cashInvested:
        usd(cashInvested),
    });

  const comparableAnalysis =
    calculateComparableAnalysis({
      comparables,
      revenueProjection,
    });

  return buildInvestmentDecision({
    acquisitionType:
      AcquisitionType.Purchase,

    property: {
      id: property.id,
      location: {
        address1: property.address1,
        city: property.city,
        state: property.state,
        postalCode:
          property.postalCode,
      },
      purchasePrice:
        usd(property.purchasePrice),
      closingCosts:
        usd(property.closingCosts),
      furnishingBudget:
        usd(
          property.furnishingBudget,
        ),
      propertyType:
        property.propertyType,
      bedrooms:
        property.bedrooms,
      bathrooms:
        property.bathrooms,
      squareFeet:
        property.squareFeet,
    },

    market: {
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
    },

    assumptions: {
      downPayment: {
        value:
          financing
            .downPaymentPercentage,
      },
      interestRate: {
        value:
          financing
            .interestRatePercentage,
      },
      loanTermYears:
        financing.loanTermYears,
      averageLengthOfStay:
        revenue.averageLengthOfStay,
      managementFee: {
        value:
          operating
            .managementFeePercentage,
      },
      maintenanceReserve: {
        value:
          operating
            .maintenanceReservePercentage,
      },
      capitalReserve: {
        value:
          operating
            .capitalReservePercentage,
      },
      estimatedUtilities:
        usd(
          operating.monthlyUtilities *
            12,
        ),
      estimatedInsurance:
        usd(operating.annualInsurance),
      estimatedTaxes:
        usd(operating.annualTaxes),
    },

    revenueProjection,
    expenseProjection,
    financialPerformance,
    comparableAnalysis,
    policies,
  });
}
