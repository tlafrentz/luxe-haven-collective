import type {
  RentalArbitrageInvestmentAnalysis,
  RentalArbitrageStressEventType,
  RentalArbitrageStressOutcome,
  RentalArbitrageStressTest,
  RentalArbitrageStressTestSummary,
} from "../domain";

const AVAILABLE_NIGHTS = 365;

interface StressDefinition {
  readonly type:
    RentalArbitrageStressEventType;
  readonly title: string;
  readonly description: string;
  readonly adrChangePercentage: number;
  readonly occupancyChangePoints: number;
  readonly operatingExpenseChangePercentage:
    number;
}

const STRESS_DEFINITIONS:
  readonly StressDefinition[] = [
    {
      type: "supply-surge",
      title: "New supply enters the market",
      description:
        "Competing short-term rental supply increases, placing simultaneous pressure on rate and occupancy.",
      adrChangePercentage: -8,
      occupancyChangePoints: -6,
      operatingExpenseChangePercentage: 2,
    },
    {
      type: "demand-slowdown",
      title: "Seasonal demand weakens",
      description:
        "Travel demand softens beyond the current operating forecast and occupied nights decline materially.",
      adrChangePercentage: -5,
      occupancyChangePoints: -10,
      operatingExpenseChangePercentage: 0,
    },
    {
      type: "price-compression",
      title: "Market pricing compresses",
      description:
        "Hotels and nearby rentals lower rates, reducing achievable ADR while occupancy also softens.",
      adrChangePercentage: -12,
      occupancyChangePoints: -4,
      operatingExpenseChangePercentage: 0,
    },
    {
      type: "regulatory-constraint",
      title: "Regulation reduces sellable nights",
      description:
        "Local restrictions, permit limits, or operating constraints reduce effective occupancy and add compliance cost.",
      adrChangePercentage: 0,
      occupancyChangePoints: -18,
      operatingExpenseChangePercentage: 3,
    },
    {
      type: "cleaning-cost-inflation",
      title: "Cleaning costs increase",
      description:
        "Turnover labor and cleaning supply costs rise without a corresponding increase in guest-paid fees.",
      adrChangePercentage: 0,
      occupancyChangePoints: 0,
      operatingExpenseChangePercentage: 8,
    },
    {
      type: "insurance-cost-inflation",
      title: "Insurance costs increase",
      description:
        "Insurance and risk-related operating costs rise materially during the lease term.",
      adrChangePercentage: 0,
      occupancyChangePoints: 0,
      operatingExpenseChangePercentage: 5,
    },
    {
      type: "pricing-underperformance",
      title: "Dynamic pricing underperforms",
      description:
        "The operating plan fails to achieve projected pricing and loses occupancy while attempting to protect ADR.",
      adrChangePercentage: -10,
      occupancyChangePoints: -5,
      operatingExpenseChangePercentage: 0,
    },
  ];

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

function clampPercentage(
  value: number,
): number {
  return Math.min(
    100,
    Math.max(0, value),
  );
}

function determineOutcome({
  annualCashFlow,
  cashFlowMargin,
}: {
  readonly annualCashFlow: number;
  readonly cashFlowMargin: number;
}): RentalArbitrageStressOutcome {
  if (annualCashFlow <= 0) {
    return "fails";
  }

  if (cashFlowMargin < 10) {
    return "pressured";
  }

  return "resilient";
}

function buildInterpretation({
  outcome,
  title,
  annualCashFlow,
}: {
  readonly outcome:
    RentalArbitrageStressOutcome;
  readonly title: string;
  readonly annualCashFlow: number;
}): string {
  const formattedCashFlow =
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(annualCashFlow);

  switch (outcome) {
    case "fails":
      return `${title} pushes modeled annual cash flow to ${formattedCashFlow}, causing the operating plan to fail.`;

    case "pressured":
      return `${title} leaves only ${formattedCashFlow} of annual cash flow and materially reduces the plan's margin for error.`;

    case "resilient":
      return `${title} reduces performance, but the plan remains cash-flow positive at ${formattedCashFlow} annually.`;
  }
}

function buildStressTest(
  analysis:
    RentalArbitrageInvestmentAnalysis,
  definition: StressDefinition,
): RentalArbitrageStressTest {
  const baseAdr =
    analysis.revenueProjection
      .projectedAdr.amount;

  const baseOccupancy =
    analysis.revenueProjection
      .projectedOccupancy.value;

  const baseAnnualCashFlow =
    analysis.financialPerformance
      .annualCashFlow.amount;

  const annualLeaseExpense =
    analysis.financialPerformance
      .annualLeaseExpense.amount;

  const annualOperatingExpenses =
    analysis.financialPerformance
      .annualOperatingExpenses.amount;

  const stressedAdr =
    baseAdr *
    (
      1 +
      definition.adrChangePercentage /
        100
    );

  const stressedOccupancy =
    clampPercentage(
      baseOccupancy +
        definition.occupancyChangePoints,
    );

  const stressedAnnualRevenue =
    stressedAdr *
    AVAILABLE_NIGHTS *
    (
      stressedOccupancy /
      100
    );

  const stressedAnnualOperatingExpenses =
    annualOperatingExpenses *
    (
      1 +
      definition
        .operatingExpenseChangePercentage /
        100
    );

  const stressedAnnualCashFlow =
    stressedAnnualRevenue -
    annualLeaseExpense -
    stressedAnnualOperatingExpenses;

  const annualCashFlowChange =
    stressedAnnualCashFlow -
    baseAnnualCashFlow;

  const cashFlowMargin =
    stressedAnnualRevenue === 0
      ? 0
      : (
          stressedAnnualCashFlow /
          stressedAnnualRevenue
        ) * 100;

  const leaseCoverageRatio =
    annualLeaseExpense === 0
      ? 0
      : (
          stressedAnnualRevenue -
          stressedAnnualOperatingExpenses
        ) /
        annualLeaseExpense;

  const outcome =
    determineOutcome({
      annualCashFlow:
        stressedAnnualCashFlow,
      cashFlowMargin,
    });

  return {
    id: definition.type,
    type: definition.type,
    title: definition.title,
    description:
      definition.description,
    assumptions: {
      adrChangePercentage:
        definition.adrChangePercentage,
      occupancyChangePoints:
        definition.occupancyChangePoints,
      operatingExpenseChangePercentage:
        definition
          .operatingExpenseChangePercentage,
    },
    stressedAdr:
      usd(stressedAdr),
    stressedOccupancy:
      percentage(
        stressedOccupancy,
      ),
    stressedAnnualRevenue:
      usd(stressedAnnualRevenue),
    stressedAnnualOperatingExpenses:
      usd(
        stressedAnnualOperatingExpenses,
      ),
    stressedAnnualCashFlow:
      usd(stressedAnnualCashFlow),
    annualCashFlowChange:
      usd(annualCashFlowChange),
    cashFlowMargin:
      percentage(cashFlowMargin),
    leaseCoverageRatio:
      roundRatio(
        leaseCoverageRatio,
      ),
    outcome,
    interpretation:
      buildInterpretation({
        outcome,
        title: definition.title,
        annualCashFlow:
          stressedAnnualCashFlow,
      }),
  };
}

function determineOverallOutcome(
  tests:
    readonly RentalArbitrageStressTest[],
): RentalArbitrageStressOutcome {
  const failedCount =
    tests.filter(
      ({ outcome }) =>
        outcome === "fails",
    ).length;

  const pressuredCount =
    tests.filter(
      ({ outcome }) =>
        outcome === "pressured",
    ).length;

  if (
    failedCount >= 3 ||
    tests[0]?.stressedAnnualCashFlow
      .amount < -5000
  ) {
    return "fails";
  }

  if (
    failedCount > 0 ||
    pressuredCount >= 3
  ) {
    return "pressured";
  }

  return "resilient";
}

function buildSummary(
  outcome:
    RentalArbitrageStressOutcome,
  mostDamagingStress:
    RentalArbitrageStressTest,
  failedStressCount: number,
): string {
  switch (outcome) {
    case "fails":
      return `${failedStressCount} modeled market stresses eliminate annual cash flow. The largest modeled threat is ${mostDamagingStress.title.toLowerCase()}.`;

    case "pressured":
      return `The operating plan survives some shocks but fails or becomes fragile under others. The largest modeled threat is ${mostDamagingStress.title.toLowerCase()}.`;

    case "resilient":
      return `The operating plan remains cash-flow positive across every modeled market stress. The largest modeled threat is ${mostDamagingStress.title.toLowerCase()}.`;
  }
}

export function buildRentalArbitrageStressTests(
  analysis:
    RentalArbitrageInvestmentAnalysis,
): RentalArbitrageStressTestSummary {
  const tests =
    STRESS_DEFINITIONS
      .map(
        (definition) =>
          buildStressTest(
            analysis,
            definition,
          ),
      )
      .sort(
        (left, right) =>
          left.stressedAnnualCashFlow
            .amount -
          right.stressedAnnualCashFlow
            .amount,
      );

  const mostDamagingStress =
    tests[0];

  if (!mostDamagingStress) {
    throw new Error(
      "Rental arbitrage stress testing requires at least one stress definition.",
    );
  }

  const failedStressCount =
    tests.filter(
      ({ outcome }) =>
        outcome === "fails",
    ).length;

  const pressuredStressCount =
    tests.filter(
      ({ outcome }) =>
        outcome === "pressured",
    ).length;

  const resilientStressCount =
    tests.filter(
      ({ outcome }) =>
        outcome === "resilient",
    ).length;

  const overallOutcome =
    determineOverallOutcome(
      tests,
    );

  return {
    tests,
    mostDamagingStress,
    failedStressCount,
    pressuredStressCount,
    resilientStressCount,
    overallOutcome,
    summary:
      buildSummary(
        overallOutcome,
        mostDamagingStress,
        failedStressCount,
      ),
  };
}
