import {
  AcquisitionType,
} from "../../domain";

import type { InvestmentWorkspaceReadinessValues as InvestmentWorkspaceValues } from "../readiness";

export type LiveMetricStatus =
  | "healthy"
  | "caution"
  | "weak"
  | "neutral";

export const PRELIMINARY_PREVIEW_THRESHOLDS = Object.freeze({
  monthlyCashFlow: Object.freeze({ healthyMinimum: 300, watchMinimum: 0 }),
  annualReturn: Object.freeze({ healthyMinimum: 8, watchMinimum: 0 }),
  capRate: Object.freeze({ healthyMinimum: 5, watchMinimumExclusive: 0 }),
  leaseCoverage: Object.freeze({ healthyMinimum: 120, watchMinimum: 100 }),
  breakEvenOccupancyMargin: Object.freeze({ healthyMinimum: 10, watchMinimum: 0 }),
});

export type LiveInvestmentSummaryMetrics = {
  readonly annualRevenue: number;
  readonly annualOperatingExpenses: number;
  readonly annualNoi: number;
  readonly monthlyCashFlow: number;
  readonly returnLabel: string;
  readonly returnPercentage: number;
  readonly secondaryReturnLabel: string;
  readonly secondaryReturnPercentage: number;
  readonly breakEvenOccupancyPercentage: number;
  readonly projectedOccupancyPercentage: number;
  readonly occupancyMarginPercentage: number;
  readonly cashFlowStatus: LiveMetricStatus;
  readonly returnStatus: LiveMetricStatus;
  readonly secondaryReturnStatus: LiveMetricStatus;
  readonly breakEvenStatus: LiveMetricStatus;
};

function finiteOrZero(
  value: number,
): number {
  return Number.isFinite(value)
    ? value
    : 0;
}

function safeDivide(
  numerator: number,
  denominator: number,
): number {
  if (
    denominator <= 0 ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator)
  ) {
    return 0;
  }

  return finiteOrZero(
    numerator / denominator,
  );
}

function calculateAnnualDebtService(
  principal: number,
  annualInterestRatePercentage: number,
  loanTermYears: number,
): number {
  if (
    principal <= 0 ||
    loanTermYears <= 0 ||
    !Number.isFinite(principal) ||
    !Number.isFinite(
      annualInterestRatePercentage,
    ) ||
    !Number.isFinite(loanTermYears)
  ) {
    return 0;
  }

  const monthlyInterestRate =
    Math.max(
      annualInterestRatePercentage,
      0,
    ) /
    100 /
    12;

  const paymentCount =
    loanTermYears * 12;

  if (monthlyInterestRate === 0) {
    return finiteOrZero(
      principal /
        paymentCount *
        12,
    );
  }

  const growthFactor =
    (
      1 +
      monthlyInterestRate
    ) ** paymentCount;

  const denominator =
    growthFactor - 1;

  if (
    denominator <= 0 ||
    !Number.isFinite(growthFactor)
  ) {
    return 0;
  }

  const monthlyPayment =
    principal *
    (
      monthlyInterestRate *
      growthFactor
    ) /
    denominator;

  return finiteOrZero(
    monthlyPayment * 12,
  );
}

function statusForCashFlow(
  monthlyCashFlow: number,
): LiveMetricStatus {
  if (monthlyCashFlow < PRELIMINARY_PREVIEW_THRESHOLDS.monthlyCashFlow.watchMinimum) {
    return "weak";
  }

  if (monthlyCashFlow < PRELIMINARY_PREVIEW_THRESHOLDS.monthlyCashFlow.healthyMinimum) {
    return "caution";
  }

  return "healthy";
}

function statusForReturn(
  returnPercentage: number,
): LiveMetricStatus {
  if (returnPercentage < PRELIMINARY_PREVIEW_THRESHOLDS.annualReturn.watchMinimum) {
    return "weak";
  }

  if (returnPercentage < PRELIMINARY_PREVIEW_THRESHOLDS.annualReturn.healthyMinimum) {
    return "caution";
  }

  return "healthy";
}

function statusForCapRate(
  capRatePercentage: number,
): LiveMetricStatus {
  if (capRatePercentage <= PRELIMINARY_PREVIEW_THRESHOLDS.capRate.watchMinimumExclusive) {
    return "weak";
  }

  if (capRatePercentage < PRELIMINARY_PREVIEW_THRESHOLDS.capRate.healthyMinimum) {
    return "caution";
  }

  return "healthy";
}

function statusForLeaseCoverage(
  leaseCoveragePercentage: number,
): LiveMetricStatus {
  if (leaseCoveragePercentage < PRELIMINARY_PREVIEW_THRESHOLDS.leaseCoverage.watchMinimum) {
    return "weak";
  }

  if (leaseCoveragePercentage < PRELIMINARY_PREVIEW_THRESHOLDS.leaseCoverage.healthyMinimum) {
    return "caution";
  }

  return "healthy";
}

function statusForBreakEven(
  breakEvenOccupancyPercentage: number,
  projectedOccupancyPercentage: number,
): LiveMetricStatus {
  if (
    breakEvenOccupancyPercentage <= 0 ||
    projectedOccupancyPercentage <= 0
  ) {
    return "neutral";
  }

  const occupancyMargin =
    projectedOccupancyPercentage -
    breakEvenOccupancyPercentage;

  if (occupancyMargin < PRELIMINARY_PREVIEW_THRESHOLDS.breakEvenOccupancyMargin.watchMinimum) {
    return "weak";
  }

  if (occupancyMargin < PRELIMINARY_PREVIEW_THRESHOLDS.breakEvenOccupancyMargin.healthyMinimum) {
    return "caution";
  }

  return "healthy";
}

export function calculateLiveInvestmentSummary(
  values: InvestmentWorkspaceValues,
): LiveInvestmentSummaryMetrics {
  const projectedAdr =
    Math.max(
      finiteOrZero(values.projectedAdr),
      0,
    );

  const projectedOccupancyPercentage =
    Math.min(
      Math.max(
        finiteOrZero(
          values
            .projectedOccupancyPercentage,
        ),
        0,
      ),
      100,
    );

  const annualRevenue =
    projectedAdr *
    365 *
    (
      projectedOccupancyPercentage /
      100
    );

  const managementExpense =
    annualRevenue *
    (
      Math.max(
        finiteOrZero(
          values.managementFeePercentage,
        ),
        0,
      ) /
      100
    );

  const maintenanceReserve =
    annualRevenue *
    (
      Math.max(
        finiteOrZero(
          values
            .maintenanceReservePercentage,
        ),
        0,
      ) /
      100
    );

  const capitalReserve =
    annualRevenue *
    (
      Math.max(
        finiteOrZero(
          values
            .capitalReservePercentage,
        ),
        0,
      ) /
      100
    );

  const annualUtilities =
    values.acquisitionType ===
      AcquisitionType.RentalArbitrage &&
    values.utilitiesIncluded
      ? 0
      : Math.max(
          finiteOrZero(
            values.monthlyUtilities,
          ),
          0,
        ) * 12;

  const annualTaxes =
    values.acquisitionType ===
    AcquisitionType.Purchase
      ? Math.max(
          finiteOrZero(
            values.annualTaxes,
          ),
          0,
        )
      : 0;

  const annualInsurance =
    Math.max(
      finiteOrZero(
        values.annualInsurance,
      ),
      0,
    );

  const annualCleaning =
    Math.max(
      finiteOrZero(
        values.annualCleaning,
      ),
      0,
    );

  const annualSoftware =
    Math.max(
      finiteOrZero(
        values.annualSoftware,
      ),
      0,
    );

  const annualSupplies =
    Math.max(
      finiteOrZero(
        values.annualSupplies,
      ),
      0,
    );

  const annualOperatingExpenses =
    managementExpense +
    annualUtilities +
    annualInsurance +
    annualTaxes +
    annualCleaning +
    annualSoftware +
    annualSupplies +
    maintenanceReserve +
    capitalReserve;

  const annualNoi =
    annualRevenue -
    annualOperatingExpenses;

  const variableExpensePercentage =
    (
      Math.max(
        finiteOrZero(
          values.managementFeePercentage,
        ),
        0,
      ) +
      Math.max(
        finiteOrZero(
          values
            .maintenanceReservePercentage,
        ),
        0,
      ) +
      Math.max(
        finiteOrZero(
          values
            .capitalReservePercentage,
        ),
        0,
      )
    ) /
    100;

  const fixedOperatingExpenses =
    annualUtilities +
    annualInsurance +
    annualTaxes +
    annualCleaning +
    annualSoftware +
    annualSupplies;

  if (
    values.acquisitionType ===
    AcquisitionType.RentalArbitrage
  ) {
    const annualLease =
      Math.max(
        finiteOrZero(
          values.monthlyLease,
        ),
        0,
      ) * 12;

    const annualCashFlow =
      annualNoi - annualLease;

    const initialCashInvested =
      Math.max(
        finiteOrZero(
          values.securityDeposit,
        ),
        0,
      ) +
      Math.max(
        finiteOrZero(
          values.startupCosts,
        ),
        0,
      ) +
      Math.max(
        finiteOrZero(
          values.furnishingBudget,
        ),
        0,
      );

    const contributionMargin =
      1 -
      variableExpensePercentage;

    const breakEvenRevenue =
      contributionMargin > 0
        ? safeDivide(
            fixedOperatingExpenses +
              annualLease,
            contributionMargin,
          )
        : 0;

    const maximumAnnualRevenue =
      projectedAdr * 365;

    const breakEvenOccupancyPercentage =
      safeDivide(
        breakEvenRevenue,
        maximumAnnualRevenue,
      ) * 100;

    const returnPercentage =
      safeDivide(
        annualCashFlow,
        initialCashInvested,
      ) * 100;

    const leaseCoveragePercentage =
      safeDivide(
        annualNoi,
        annualLease,
      ) * 100;

    return {
      annualRevenue,
      annualOperatingExpenses:
        annualOperatingExpenses +
        annualLease,
      annualNoi,
      monthlyCashFlow:
        finiteOrZero(
          annualCashFlow / 12,
        ),
      returnLabel:
        "Return on initial cash",
      returnPercentage,
      secondaryReturnLabel:
        "Lease coverage",
      secondaryReturnPercentage:
        leaseCoveragePercentage,
      breakEvenOccupancyPercentage,
      projectedOccupancyPercentage,
      occupancyMarginPercentage:
        projectedOccupancyPercentage -
        breakEvenOccupancyPercentage,
      cashFlowStatus:
        statusForCashFlow(
          annualCashFlow / 12,
        ),
      returnStatus:
        statusForReturn(
          returnPercentage,
        ),
      secondaryReturnStatus:
        statusForLeaseCoverage(
          leaseCoveragePercentage,
        ),
      breakEvenStatus:
        statusForBreakEven(
          breakEvenOccupancyPercentage,
          projectedOccupancyPercentage,
        ),
    };
  }

  const purchasePrice =
    Math.max(
      finiteOrZero(
        values.purchasePrice,
      ),
      0,
    );

  const downPayment =
    purchasePrice *
    (
      Math.min(
        Math.max(
          finiteOrZero(
            values
              .downPaymentPercentage,
          ),
          0,
        ),
        100,
      ) /
      100
    );

  const loanPrincipal =
    Math.max(
      purchasePrice -
        downPayment,
      0,
    );

  const annualDebtService =
    calculateAnnualDebtService(
      loanPrincipal,
      values.interestRatePercentage,
      values.loanTermYears,
    );

  const annualCashFlow =
    annualNoi - annualDebtService;

  const initialCashInvested =
    downPayment +
    Math.max(
      finiteOrZero(
        values.closingCosts,
      ),
      0,
    ) +
    Math.max(
      finiteOrZero(
        values.furnishingBudget,
      ),
      0,
    );

  const contributionMargin =
    1 -
    variableExpensePercentage;

  const breakEvenRevenue =
    contributionMargin > 0
      ? safeDivide(
          fixedOperatingExpenses +
            annualDebtService,
          contributionMargin,
        )
      : 0;

  const maximumAnnualRevenue =
    projectedAdr * 365;

  const breakEvenOccupancyPercentage =
    safeDivide(
      breakEvenRevenue,
      maximumAnnualRevenue,
    ) * 100;

  const returnPercentage =
    safeDivide(
      annualCashFlow,
      initialCashInvested,
    ) * 100;

  const capRatePercentage =
    safeDivide(
      annualNoi,
      purchasePrice,
    ) * 100;

  return {
    annualRevenue,
    annualOperatingExpenses,
    annualNoi,
    monthlyCashFlow:
      finiteOrZero(
        annualCashFlow / 12,
      ),
    returnLabel:
      "Cash-on-cash return",
    returnPercentage,
    secondaryReturnLabel:
      "Cap rate",
    secondaryReturnPercentage:
      capRatePercentage,
    breakEvenOccupancyPercentage,
    projectedOccupancyPercentage,
    occupancyMarginPercentage:
      projectedOccupancyPercentage -
      breakEvenOccupancyPercentage,
    cashFlowStatus:
      statusForCashFlow(
        annualCashFlow / 12,
      ),
    returnStatus:
      statusForReturn(
        returnPercentage,
      ),
    secondaryReturnStatus:
      statusForCapRate(
        capRatePercentage,
      ),
    breakEvenStatus:
      statusForBreakEven(
        breakEvenOccupancyPercentage,
        projectedOccupancyPercentage,
      ),
  };
}
