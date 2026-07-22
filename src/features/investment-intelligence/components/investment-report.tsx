import {
  AcquisitionType,
} from "../domain";

import type {
  InvestmentLifecycleResult,
} from "../domain";

import {
  PurchaseInvestmentReport,
} from "./purchase-investment-report";

import {
  RentalArbitrageInvestmentReport,
} from "./rental-arbitrage-investment-report";

export function InvestmentReport({
  result,
}: {
  result: InvestmentLifecycleResult;
}) {
  if (
    result.acquisitionType ===
    AcquisitionType.RentalArbitrage
  ) {
    return (
      <RentalArbitrageInvestmentReport
        result={result}
      />
    );
  }

  return (
    <PurchaseInvestmentReport
      result={result}
    />
  );
}
