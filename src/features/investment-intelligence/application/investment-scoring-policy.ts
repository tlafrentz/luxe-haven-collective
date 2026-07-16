export type InvestmentScoringPolicy = {
  readonly targetCapRate: number;
  readonly targetCashOnCashReturn: number;
  readonly targetDebtServiceCoverageRatio: number;
  readonly targetMarketOccupancy: number;
  readonly fullRevenueUpsidePercentage: number;
};

export const DEFAULT_INVESTMENT_SCORING_POLICY: InvestmentScoringPolicy = {
  targetCapRate: 8,
  targetCashOnCashReturn: 12,
  targetDebtServiceCoverageRatio: 1.5,
  targetMarketOccupancy: 70,
  fullRevenueUpsidePercentage: 20,
};
