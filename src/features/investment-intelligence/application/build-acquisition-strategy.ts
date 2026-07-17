import type {
  AcquisitionRecommendation,
  AcquisitionStrategy,
  ExpenseProjection,
  FinancialPerformance,
  InvestmentAssumptions,
  InvestmentRisk,
  InvestmentScore,
  PropertyProfile,
  RevenueProjection,
  SupportingEvidence,
} from "../domain";

import {
  EvidenceDirection,
  RiskSeverity,
} from "../domain";

export type AcquisitionStrategyPolicy = {
  readonly targetCapRate: number;
  readonly targetCashOnCashReturn: number;
  readonly targetDebtServiceCoverageRatio: number;
  readonly targetOfferDiscountPercentage: number;
  readonly walkAwayPremiumPercentage: number;
};

export const DEFAULT_ACQUISITION_STRATEGY_POLICY:
  AcquisitionStrategyPolicy = {
    targetCapRate: 6,
    targetCashOnCashReturn: 8,
    targetDebtServiceCoverageRatio: 1.2,
    targetOfferDiscountPercentage: 3,
    walkAwayPremiumPercentage: 0.25,
  };

export type BuildAcquisitionStrategyInput = {
  readonly property: PropertyProfile;
  readonly assumptions: InvestmentAssumptions;
  readonly revenueProjection: RevenueProjection;
  readonly expenseProjection: ExpenseProjection;
  readonly financialPerformance: FinancialPerformance;
  readonly score: InvestmentScore;
  readonly recommendation: AcquisitionRecommendation;
  readonly risks: readonly InvestmentRisk[];
  readonly supportingEvidence:
    readonly SupportingEvidence[];
  readonly policy?: AcquisitionStrategyPolicy;
};

function roundCurrency(amount: number): number {
  return (
    Math.round(
      (amount + Number.EPSILON) * 100,
    ) / 100
  );
}

function usd(amount: number) {
  return {
    amount: roundCurrency(amount),
    currency: "USD" as const,
  };
}

function monthlyPaymentFactor(
  annualInterestRatePercentage: number,
  loanTermYears: number,
): number {
  const numberOfPayments =
    loanTermYears * 12;

  if (numberOfPayments <= 0) {
    return 0;
  }

  const monthlyRate =
    annualInterestRatePercentage /
    100 /
    12;

  if (monthlyRate === 0) {
    return 1 / numberOfPayments;
  }

  const growth =
    Math.pow(
      1 + monthlyRate,
      numberOfPayments,
    );

  return (
    (monthlyRate * growth) /
    (growth - 1)
  );
}

function calculateMaximumPurchasePrice({
  property,
  assumptions,
  financialPerformance,
  policy,
}: {
  readonly property: PropertyProfile;
  readonly assumptions: InvestmentAssumptions;
  readonly financialPerformance: FinancialPerformance;
  readonly policy: AcquisitionStrategyPolicy;
}): number {
  const noi =
    financialPerformance
      .netOperatingIncome.amount;

  const capRateMaximum =
    policy.targetCapRate > 0
      ? noi /
        (
          policy.targetCapRate /
          100
        )
      : Number.POSITIVE_INFINITY;

  const downPaymentRate =
    assumptions.downPayment.value /
    100;

  const financedRate =
    1 - downPaymentRate;

  const paymentFactor =
    monthlyPaymentFactor(
      assumptions.interestRate.value,
      assumptions.loanTermYears,
    );

  const maximumAnnualDebtService =
    policy
      .targetDebtServiceCoverageRatio >
    0
      ? noi /
        policy
          .targetDebtServiceCoverageRatio
      : Number.POSITIVE_INFINITY;

  const dscrMaximum =
    financedRate > 0 &&
    paymentFactor > 0
      ? (
          maximumAnnualDebtService /
          12 /
          paymentFactor
        ) /
        financedRate
      : Number.POSITIVE_INFINITY;

  const fixedCashInvestment =
    property.closingCosts.amount +
    property.furnishingBudget.amount;

  const currentAnnualDebtService =
    expenseProjectionDebtService(
      financialPerformance,
      property,
      assumptions,
    );

  const operatingExpensesExcludingDebt =
    Math.max(
      0,
      financialPerformance
        .netOperatingIncome.amount -
        financialPerformance
          .annualCashFlow.amount -
        currentAnnualDebtService,
    );

  void operatingExpensesExcludingDebt;

  const annualCashFlowBeforeDebt =
    financialPerformance
      .annualCashFlow.amount +
    currentAnnualDebtService;

  const cocTarget =
    policy.targetCashOnCashReturn /
    100;

  const annualDebtServicePerDollar =
    financedRate *
    paymentFactor *
    12;

  const cocDenominatorCoefficient =
    annualDebtServicePerDollar +
    cocTarget * downPaymentRate;

  const cocMaximum =
    cocDenominatorCoefficient > 0
      ? (
          annualCashFlowBeforeDebt -
          cocTarget *
            fixedCashInvestment
        ) /
        cocDenominatorCoefficient
      : Number.POSITIVE_INFINITY;

  const candidates = [
    capRateMaximum,
    dscrMaximum,
    cocMaximum,
  ].filter(
    (value) =>
      Number.isFinite(value) &&
      value > 0,
  );

  if (candidates.length === 0) {
    return property.purchasePrice.amount;
  }

  return Math.min(...candidates);
}

function expenseProjectionDebtService(
  financialPerformance:
    FinancialPerformance,
  property: PropertyProfile,
  assumptions: InvestmentAssumptions,
): number {
  const financedRate =
    1 -
    assumptions.downPayment.value /
      100;

  if (financedRate <= 0) {
    return 0;
  }

  const paymentFactor =
    monthlyPaymentFactor(
      assumptions.interestRate.value,
      assumptions.loanTermYears,
    );

  return (
    property.purchasePrice.amount *
    financedRate *
    paymentFactor *
    12
  );
}

function selectPrimaryRisk(
  risks: readonly InvestmentRisk[],
): string {
  const severityRank: Record<
    RiskSeverity,
    number
  > = {
    [RiskSeverity.Critical]: 4,
    [RiskSeverity.High]: 3,
    [RiskSeverity.Medium]: 2,
    [RiskSeverity.Low]: 1,
  };

  const primary = [...risks].sort(
    (left, right) =>
      severityRank[right.severity] -
      severityRank[left.severity],
  )[0];

  return (
    primary?.title ??
    "No material acquisition risk identified."
  );
}

function selectPrimaryOpportunity(
  supportingEvidence:
    readonly SupportingEvidence[],
): string {
  const positive =
    supportingEvidence.find(
      ({ direction }) =>
        direction ===
        EvidenceDirection.Positive,
    );

  return (
    positive?.title ??
    "Execute the modeled operating plan and protect projected returns."
  );
}

function buildPriorities({
  financialPerformance,
  score,
}: {
  readonly financialPerformance:
    FinancialPerformance;
  readonly score: InvestmentScore;
}): readonly string[] {
  const priorities: string[] = [];

  if (
    score.revenuePotential.value <
    70
  ) {
    priorities.push(
      "Validate ADR and occupancy assumptions against the strongest comparable properties.",
    );
  }

  if (
    financialPerformance
      .debtServiceCoverageRatio <
    1.3
  ) {
    priorities.push(
      "Protect debt-service coverage by controlling fixed costs and preserving cash reserves.",
    );
  }

  if (
    score.competitivePosition.value <
    70
  ) {
    priorities.push(
      "Strengthen the listing, positioning, photography, and guest experience before launch.",
    );
  }

  if (priorities.length < 3) {
    priorities.push(
      "Implement dynamic pricing and review performance weekly during the first 90 days.",
    );
  }

  if (priorities.length < 3) {
    priorities.push(
      "Track ADR, occupancy, RevPAR, NOI, and cash flow against underwriting assumptions.",
    );
  }

  return priorities.slice(0, 3);
}

export function buildAcquisitionStrategy({
  property,
  assumptions,
  revenueProjection,
  financialPerformance,
  score,
  risks,
  supportingEvidence,
  policy =
    DEFAULT_ACQUISITION_STRATEGY_POLICY,
}: BuildAcquisitionStrategyInput): AcquisitionStrategy {
  const maximumPurchasePrice =
    calculateMaximumPurchasePrice({
      property,
      assumptions,
      financialPerformance,
      policy,
    });

  const targetOfferPrice =
    maximumPurchasePrice *
    (
      1 -
      policy
        .targetOfferDiscountPercentage /
        100
    );

  const walkAwayPrice =
    maximumPurchasePrice *
    (
      1 +
      policy
        .walkAwayPremiumPercentage /
        100
    );

  const projectedAnnualRevenue =
    revenueProjection
      .projectedAnnualRevenue.amount;

  const projectedOccupancy =
    revenueProjection
      .projectedOccupancy.value;

  const projectedAdr =
    revenueProjection
      .projectedAdr.amount;

  const requiredOccupancy =
    financialPerformance
      .breakEvenOccupancy.value;

  const requiredAdr =
    projectedOccupancy > 0
      ? projectedAdr *
        (
          requiredOccupancy /
          projectedOccupancy
        )
      : projectedAdr;

  const requiredAnnualRevenue =
    projectedOccupancy > 0
      ? projectedAnnualRevenue *
        (
          requiredOccupancy /
          projectedOccupancy
        )
      : projectedAnnualRevenue;

  const requiredNetOperatingIncome =
    financialPerformance
      .debtServiceCoverageRatio > 0
      ? (
          financialPerformance
            .netOperatingIncome.amount /
          financialPerformance
            .debtServiceCoverageRatio
        ) *
        policy
          .targetDebtServiceCoverageRatio
      : financialPerformance
          .netOperatingIncome.amount;

  const expectedAnnualUpside =
    Math.max(
      0,
      projectedAnnualRevenue -
        requiredAnnualRevenue,
    );

  return {
    targetOfferPrice:
      usd(targetOfferPrice),
    maximumPurchasePrice:
      usd(maximumPurchasePrice),
    walkAwayPrice:
      usd(walkAwayPrice),

    requiredAverageDailyRate:
      usd(requiredAdr),
    requiredOccupancy: {
      value:
        Math.round(
          (
            requiredOccupancy +
            Number.EPSILON
          ) *
            100,
        ) / 100,
    },
    requiredAnnualRevenue:
      usd(requiredAnnualRevenue),
    requiredNetOperatingIncome:
      usd(requiredNetOperatingIncome),

    expectedAnnualUpside:
      usd(expectedAnnualUpside),

    primaryOpportunity:
      selectPrimaryOpportunity(
        supportingEvidence,
      ),
    primaryRisk:
      selectPrimaryRisk(risks),

    firstNinetyDayPriorities:
      buildPriorities({
        financialPerformance,
        score,
      }),
  };
}
