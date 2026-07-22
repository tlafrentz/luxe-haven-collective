export const INVESTMENT_OBSERVATION_CAPABILITY =
  "investment-intelligence";

export const INVESTMENT_OBSERVATION_TYPES = {
  acquisition: {
    type: "investment.acquisition.type",
  },

  property: {
    purchasePrice:
      "investment.property.purchase-price",
    closingCosts:
      "investment.property.closing-costs",
    furnishingBudget:
      "investment.property.furnishing-budget",
    bedrooms:
      "investment.property.bedrooms",
    bathrooms:
      "investment.property.bathrooms",
    squareFeet:
      "investment.property.square-feet",
    yearBuilt:
      "investment.property.year-built",
    hoa:
      "investment.property.hoa",
  },

  financing: {
    downPaymentPercentage:
      "investment.financing.down-payment-percentage",
  },

  market: {
    medianAdr:
      "investment.market.median-adr",
    medianOccupancy:
      "investment.market.median-occupancy",
    trend:
      "investment.market.trend",
    supplyGrowth:
      "investment.market.supply-growth",
    demandGrowth:
      "investment.market.demand-growth",
    seasonality:
      "investment.market.seasonality",
    comparablePosition:
      "investment.market.comparable-position",
    comparableConfidence:
      "investment.market.comparable-confidence",
  },

  revenue: {
    projectedAdr:
      "investment.revenue.projected-adr",
    projectedOccupancy:
      "investment.revenue.projected-occupancy",
    projectedMonthlyRevenue:
      "investment.revenue.projected-monthly",
    projectedAnnualRevenue:
      "investment.revenue.projected-annual",
    confidence:
      "investment.revenue.confidence",
  },

  expenses: {
    mortgage:
      "investment.expenses.mortgage",
    rent:
      "investment.expenses.rent",
    cleaning:
      "investment.expenses.cleaning",
    utilities:
      "investment.expenses.utilities",
    insurance:
      "investment.expenses.insurance",
    taxes:
      "investment.expenses.taxes",
    management:
      "investment.expenses.management",
    maintenance:
      "investment.expenses.maintenance",
    software:
      "investment.expenses.software",
    supplies:
      "investment.expenses.supplies",
    capitalReserve:
      "investment.expenses.capital-reserve",
    totalOperatingExpenses:
      "investment.expenses.total-operating",
    confidence:
      "investment.expenses.confidence",
  },

  financial: {
    netOperatingIncome:
      "investment.financial.net-operating-income",
    annualCashFlow:
      "investment.financial.annual-cash-flow",
    capRate:
      "investment.financial.cap-rate",
    cashOnCashReturn:
      "investment.financial.cash-on-cash-return",
    debtServiceCoverageRatio:
      "investment.financial.debt-service-coverage-ratio",
    breakEvenOccupancy:
      "investment.financial.break-even-occupancy",
    returnOnInitialInvestment:
      "investment.financial.return-on-initial-investment",
    paybackPeriodMonths:
      "investment.financial.payback-period-months",
    leaseCoverageRatio:
      "investment.financial.lease-coverage-ratio",
  },

  rentalArbitrage: {
    monthlyLease:
      "investment.rental-arbitrage.monthly-lease",
    securityDeposit:
      "investment.rental-arbitrage.security-deposit",
    startupCapital:
      "investment.rental-arbitrage.startup-capital",
    startupCosts:
      "investment.rental-arbitrage.startup-costs",
    annualLeaseExpense:
      "investment.rental-arbitrage.annual-lease-expense",
    monthlyOperatingMargin:
      "investment.rental-arbitrage.monthly-operating-margin",
    utilitiesIncluded:
      "investment.rental-arbitrage.utilities-included",
    failurePointStatus:
      "investment.rental-arbitrage.failure-point-status",
    maximumMonthlyLease:
      "investment.rental-arbitrage.maximum-monthly-lease",
    minimumOccupancy:
      "investment.rental-arbitrage.minimum-occupancy",
    stressOutcome:
      "investment.rental-arbitrage.stress-outcome",
    failedStressCount:
      "investment.rental-arbitrage.failed-stress-count",
  },

  score: {
    overall:
      "investment.score.overall",
    revenuePotential:
      "investment.score.revenue-potential",
    financialStrength:
      "investment.score.financial-strength",
    marketStrength:
      "investment.score.market-strength",
    competitivePosition:
      "investment.score.competitive-position",
    riskExposure:
      "investment.score.risk-exposure",
  },

  decision: {
    recommendation:
      "investment.decision.recommendation",
    confidence:
      "investment.decision.confidence",
  },

  risk: {
    item: "investment.risk",
  },

  evidence: {
    item: "investment.evidence",
  },

  strategy: {
    targetOfferPrice:
      "investment.strategy.target-offer-price",
    maximumPurchasePrice:
      "investment.strategy.maximum-purchase-price",
    walkAwayPrice:
      "investment.strategy.walk-away-price",
    requiredAverageDailyRate:
      "investment.strategy.required-average-daily-rate",
    requiredOccupancy:
      "investment.strategy.required-occupancy",
    requiredAnnualRevenue:
      "investment.strategy.required-annual-revenue",
    requiredNetOperatingIncome:
      "investment.strategy.required-net-operating-income",
    expectedAnnualUpside:
      "investment.strategy.expected-annual-upside",
    primaryOpportunity:
      "investment.strategy.primary-opportunity",
    primaryRisk:
      "investment.strategy.primary-risk",
    firstNinetyDayPriority:
      "investment.strategy.first-ninety-day-priority",
  },

  summary: {
    executive:
      "investment.summary",
  },
} as const;

type DeepValue<T> =
  T extends string
    ? T
    : T extends Record<string, unknown>
      ? DeepValue<T[keyof T]>
      : never;

export type InvestmentObservationType =
  DeepValue<
    typeof INVESTMENT_OBSERVATION_TYPES
  >;
