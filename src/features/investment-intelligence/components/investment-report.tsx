import {
  AcquisitionType,
} from "../domain";

import type {
  InvestmentDecision,
  RentalArbitrageInvestmentAnalysis,
} from "../domain";

import {
  PurchaseInvestmentReport,
} from "./purchase-investment-report";

import {
  RentalArbitrageInvestmentReport,
} from "./rental-arbitrage-investment-report";

export type InvestmentReportAnalysis =
  | InvestmentDecision
  | RentalArbitrageInvestmentAnalysis;

function isRentalArbitrageAnalysis(
  analysis: InvestmentReportAnalysis,
): analysis is RentalArbitrageInvestmentAnalysis {
  return (
    analysis.acquisitionType ===
      AcquisitionType.RentalArbitrage &&
    "lease" in analysis.expenseProjection &&
    "leaseCoverageRatio" in
      analysis.financialPerformance
  );
}

export function InvestmentReport({
  analysis,
}: {
  analysis: InvestmentReportAnalysis;
}) {
  if (
    isRentalArbitrageAnalysis(analysis)
  ) {
    return (
      <RentalArbitrageInvestmentReport
        analysis={analysis}
      />
    );
  }

  return (
    <PurchaseInvestmentReport
      decision={analysis}
    />
  );
}
