import type {
  FailurePointStatus,
  RentalArbitrageFailurePoints,
  RentalArbitrageInvestmentAnalysis,
} from "../domain";

const AVAILABLE_NIGHTS = 365;

function roundCurrency(
  amount: number,
): number {
  return (
    Math.round(
      (amount + Number.EPSILON) * 100,
    ) / 100
  );
}

function roundRatio(
  value: number,
): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function usd(amount: number) {
  return {
    amount: roundCurrency(amount),
    currency: "USD" as const,
  };
}

function percentage(value: number) {
  return {
    value: roundRatio(value),
  };
}

function determineStatus({
  leaseMarginPercentage,
  occupancyMarginPoints,
  adrMarginPercentage,
}: {
  readonly leaseMarginPercentage: number;
  readonly occupancyMarginPoints: number;
  readonly adrMarginPercentage: number;
}): FailurePointStatus {
  if (
    leaseMarginPercentage <= 0 ||
    occupancyMarginPoints <= 0 ||
    adrMarginPercentage <= 0
  ) {
    return "at-risk";
  }

  if (
    leaseMarginPercentage >= 25 &&
    occupancyMarginPoints >= 12 &&
    adrMarginPercentage >= 15
  ) {
    return "strong-buffer";
  }

  if (
    leaseMarginPercentage >= 12 &&
    occupancyMarginPoints >= 7 &&
    adrMarginPercentage >= 8
  ) {
    return "moderate-buffer";
  }

  return "thin-buffer";
}

function buildSummary(
  status: FailurePointStatus,
): string {
  switch (status) {
    case "strong-buffer":
      return "The operating plan has a strong margin before lease, occupancy, or ADR reaches its modeled failure point.";

    case "moderate-buffer":
      return "The operating plan has a workable but finite cushion against weaker revenue or higher fixed occupancy cost.";

    case "thin-buffer":
      return "The operating plan remains viable, but relatively small changes in lease cost, occupancy, or ADR could eliminate cash flow.";

    case "at-risk":
      return "The operating plan is at or beyond at least one modeled failure point and does not have a dependable safety margin.";
  }
}

export function calculateRentalArbitrageFailurePoints(
  analysis:
    RentalArbitrageInvestmentAnalysis,
): RentalArbitrageFailurePoints {
  const annualRevenue =
    analysis.financialPerformance
      .annualGrossRevenue.amount;

  const annualOperatingExpenses =
    analysis.financialPerformance
      .annualOperatingExpenses.amount;

  const annualLeaseExpense =
    analysis.financialPerformance
      .annualLeaseExpense.amount;

  const currentMonthlyLease =
    annualLeaseExpense / 12;

  const totalAnnualExpenses =
    analysis.financialPerformance
      .totalAnnualExpenses.amount;

  const projectedAdr =
    analysis.revenueProjection
      .projectedAdr.amount;

  const projectedOccupancy =
    analysis.revenueProjection
      .projectedOccupancy.value;

  const maximumAnnualLease =
    Math.max(
      0,
      annualRevenue -
        annualOperatingExpenses,
    );

  const maximumMonthlyLease =
    maximumAnnualLease / 12;

  const monthlyLeaseSafetyMargin =
    maximumMonthlyLease -
    currentMonthlyLease;

  const monthlyLeaseSafetyMarginPercentage =
    currentMonthlyLease === 0
      ? 0
      : (
          monthlyLeaseSafetyMargin /
          currentMonthlyLease
        ) * 100;

  const minimumOccupancy =
    projectedAdr === 0
      ? 100
      : (
          totalAnnualExpenses /
          (
            projectedAdr *
            AVAILABLE_NIGHTS
          )
        ) * 100;

  const occupancySafetyMarginPoints =
    projectedOccupancy -
    minimumOccupancy;

  const occupiedNights =
    AVAILABLE_NIGHTS *
    (
      projectedOccupancy /
      100
    );

  const minimumAdr =
    occupiedNights === 0
      ? 0
      : totalAnnualExpenses /
        occupiedNights;

  const adrSafetyMargin =
    projectedAdr -
    minimumAdr;

  const adrSafetyMarginPercentage =
    projectedAdr === 0
      ? 0
      : (
          adrSafetyMargin /
          projectedAdr
        ) * 100;

  const operatingExpenseSafetyMargin =
    annualRevenue -
    annualLeaseExpense -
    annualOperatingExpenses;

  const status =
    determineStatus({
      leaseMarginPercentage:
        monthlyLeaseSafetyMarginPercentage,
      occupancyMarginPoints:
        occupancySafetyMarginPoints,
      adrMarginPercentage:
        adrSafetyMarginPercentage,
    });

  return {
    maximumMonthlyLease:
      usd(maximumMonthlyLease),
    monthlyLeaseSafetyMargin:
      usd(monthlyLeaseSafetyMargin),
    monthlyLeaseSafetyMarginPercentage:
      percentage(
        monthlyLeaseSafetyMarginPercentage,
      ),
    minimumOccupancy:
      percentage(minimumOccupancy),
    occupancySafetyMarginPoints:
      roundRatio(
        occupancySafetyMarginPoints,
      ),
    minimumAdr:
      usd(minimumAdr),
    adrSafetyMargin:
      usd(adrSafetyMargin),
    adrSafetyMarginPercentage:
      percentage(
        adrSafetyMarginPercentage,
      ),
    operatingExpenseSafetyMargin:
      usd(
        operatingExpenseSafetyMargin,
      ),
    status,
    summary:
      buildSummary(status),
  };
}
