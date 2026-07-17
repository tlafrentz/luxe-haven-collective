import type {
  PurchaseFailurePoints,
  PurchaseInvestmentAnalysis,
  PurchaseResilienceStatus,
} from "../domain";

const AVAILABLE_NIGHTS = 365;

function round(value: number): number {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100;
}

function usd(amount: number) {
  return {
    amount: round(amount),
    currency: "USD" as const,
  };
}

function percentage(value: number) {
  return { value: round(value) };
}

function calculateMonthlyPaymentFactor({
  annualInterestRatePercentage,
  loanTermYears,
}: {
  annualInterestRatePercentage: number;
  loanTermYears: number;
}): number {
  const payments = loanTermYears * 12;

  if (annualInterestRatePercentage === 0) {
    return 1 / payments;
  }

  const monthlyRate =
    annualInterestRatePercentage / 100 / 12;
  const growth =
    (1 + monthlyRate) ** payments;

  return (
    monthlyRate * growth
  ) / (growth - 1);
}

function determineStatus({
  cashFlow,
  occupancyMargin,
  adrMarginPercentage,
}: {
  cashFlow: number;
  occupancyMargin: number;
  adrMarginPercentage: number;
}): PurchaseResilienceStatus {
  if (cashFlow <= 0) {
    return "failing";
  }

  if (
    occupancyMargin < 5 ||
    adrMarginPercentage < 5
  ) {
    return "fragile";
  }

  if (
    occupancyMargin < 12 ||
    adrMarginPercentage < 12
  ) {
    return "moderate";
  }

  return "strong";
}

export function calculatePurchaseFailurePoints(
  analysis: PurchaseInvestmentAnalysis,
): PurchaseFailurePoints {
  const annualRevenue =
    analysis.revenueProjection.projectedAnnualRevenue.amount;
  const adr =
    analysis.revenueProjection.projectedAdr.amount;
  const occupancy =
    analysis.revenueProjection.projectedOccupancy.value;
  const annualOperatingExpenses =
    analysis.expenseProjection.totalOperatingExpenses.amount;
  const annualDebtService =
    analysis.expenseProjection.mortgage.amount;
  const purchasePrice =
    analysis.property.purchasePrice.amount;
  const downPaymentPercentage =
    analysis.assumptions.downPayment.value;
  const interestRate =
    analysis.assumptions.interestRate.value;
  const loanTermYears =
    analysis.assumptions.loanTermYears;

  const totalRequiredRevenue =
    annualOperatingExpenses +
    annualDebtService;

  const minimumSustainableAdr =
    totalRequiredRevenue /
    (
      AVAILABLE_NIGHTS *
      (occupancy / 100)
    );

  const minimumSustainableOccupancy =
    totalRequiredRevenue /
    (adr * AVAILABLE_NIGHTS) *
    100;

  const maximumAnnualOperatingExpenses =
    annualRevenue -
    annualDebtService;

  const operatingExpenseCapacity =
    maximumAnnualOperatingExpenses -
    annualOperatingExpenses;

  const maximumAnnualDebtService =
    annualRevenue -
    annualOperatingExpenses;

  const debtServiceCapacity =
    maximumAnnualDebtService -
    annualDebtService;

  const monthlyPaymentFactor =
    calculateMonthlyPaymentFactor({
      annualInterestRatePercentage:
        interestRate,
      loanTermYears,
    });

  const maximumSupportedLoanAmount =
    monthlyPaymentFactor === 0
      ? 0
      : (
          maximumAnnualDebtService /
          12
        ) /
        monthlyPaymentFactor;

  const financedPercentage =
    1 - downPaymentPercentage / 100;

  const maximumSupportedPurchasePrice =
    financedPercentage === 0
      ? purchasePrice
      : maximumSupportedLoanAmount /
        financedPercentage;

  const adrSafetyMargin =
    adr - minimumSustainableAdr;

  const adrSafetyMarginPercentage =
    adr === 0
      ? 0
      : (adrSafetyMargin / adr) * 100;

  const occupancySafetyMargin =
    occupancy -
    minimumSustainableOccupancy;

  const purchasePriceSafetyMargin =
    maximumSupportedPurchasePrice -
    purchasePrice;

  const resilienceStatus =
    determineStatus({
      cashFlow:
        analysis.financialPerformance
          .annualCashFlow.amount,
      occupancyMargin:
        occupancySafetyMargin,
      adrMarginPercentage:
        adrSafetyMarginPercentage,
    });

  const summary =
    resilienceStatus === "failing"
      ? "The current underwriting does not produce positive annual cash flow."
      : `The purchase plan can absorb approximately ${round(
          occupancySafetyMargin,
        )} occupancy points or ${round(
          adrSafetyMarginPercentage,
        )}% of ADR compression before annual cash flow reaches zero.`;

  return {
    minimumSustainableAdr:
      usd(minimumSustainableAdr),
    adrSafetyMargin:
      usd(adrSafetyMargin),
    adrSafetyMarginPercentage:
      percentage(
        adrSafetyMarginPercentage,
      ),
    minimumSustainableOccupancy:
      percentage(
        minimumSustainableOccupancy,
      ),
    occupancySafetyMargin:
      percentage(
        occupancySafetyMargin,
      ),
    maximumAnnualOperatingExpenses:
      usd(
        maximumAnnualOperatingExpenses,
      ),
    operatingExpenseCapacity:
      usd(operatingExpenseCapacity),
    maximumAnnualDebtService:
      usd(maximumAnnualDebtService),
    debtServiceCapacity:
      usd(debtServiceCapacity),
    maximumSupportedLoanAmount:
      usd(maximumSupportedLoanAmount),
    maximumSupportedPurchasePrice:
      usd(
        maximumSupportedPurchasePrice,
      ),
    purchasePriceSafetyMargin:
      usd(purchasePriceSafetyMargin),
    resilienceStatus,
    summary,
  };
}
