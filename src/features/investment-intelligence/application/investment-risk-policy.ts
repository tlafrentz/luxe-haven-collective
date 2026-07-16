export type InvestmentRiskPolicy = {
  readonly minimumDebtServiceCoverageRatio: number;
  readonly warningDebtServiceCoverageRatio: number;
  readonly criticalBreakEvenOccupancy: number;
  readonly highBreakEvenOccupancy: number;
  readonly warningBreakEvenOccupancy: number;
  readonly minimumCapRate: number;
  readonly maximumAdrPremiumPercentage: number;
  readonly maximumOccupancyPremiumPoints: number;
};

export const DEFAULT_INVESTMENT_RISK_POLICY: InvestmentRiskPolicy = {
  minimumDebtServiceCoverageRatio: 1,
  warningDebtServiceCoverageRatio: 1.25,
  criticalBreakEvenOccupancy: 80,
  highBreakEvenOccupancy: 70,
  warningBreakEvenOccupancy: 60,
  minimumCapRate: 4,
  maximumAdrPremiumPercentage: 20,
  maximumOccupancyPremiumPoints: 10,
};
