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
  decision,
}: {
  decision: InvestmentReportAnalysis;
}) {
  if (
    isRentalArbitrageAnalysis(decision)
  ) {
    return (
      <RentalArbitrageInvestmentReport
        analysis={decision}
      />
    );
  }

  return (
    <PurchaseInvestmentReport
      decision={decision}
    />
  );
}
