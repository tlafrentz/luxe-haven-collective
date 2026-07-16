export type InvestmentEvidencePolicy = {
  readonly strongCapRate: number;
  readonly strongCashOnCashReturn: number;
  readonly healthyDebtServiceCoverageRatio: number;
  readonly strongAnnualCashFlow: number;
  readonly meaningfulRevenueUpside: number;
  readonly materialAdrPremiumPercentage: number;
  readonly materialOccupancyPremiumPoints: number;
};

export const DEFAULT_INVESTMENT_EVIDENCE_POLICY: InvestmentEvidencePolicy = {
  strongCapRate: 8,
  strongCashOnCashReturn: 12,
  healthyDebtServiceCoverageRatio: 1.5,
  strongAnnualCashFlow: 12000,
  meaningfulRevenueUpside: 5000,
  materialAdrPremiumPercentage: 5,
  materialOccupancyPremiumPoints: 5,
};
