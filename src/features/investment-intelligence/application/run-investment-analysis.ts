import {
  AcquisitionType,
} from "../domain";

import type {
  InvestmentLifecycleResult,
} from "../domain";

import {
  buildPurchaseInvestmentReport,
} from "../services/build-purchase-investment-report";

import type {
  BuildPurchaseInvestmentReportInput,
} from "../services/build-purchase-investment-report";

import {
  buildRentalArbitrageInvestmentReport,
} from "../services/build-rental-arbitrage-investment-report";

import type {
  BuildRentalArbitrageInvestmentReportInput,
} from "../services/build-rental-arbitrage-investment-report";

export type RunPurchaseInvestmentAnalysisCommand =
  Readonly<
    Omit<
      BuildPurchaseInvestmentReportInput,
      "acquisitionType"
    > & {
      readonly acquisitionType:
        AcquisitionType.Purchase;
    }
  >;

export type RunRentalArbitrageInvestmentAnalysisCommand =
  Readonly<
    BuildRentalArbitrageInvestmentReportInput
  >;

export type RunInvestmentAnalysisCommand =
  | RunPurchaseInvestmentAnalysisCommand
  | RunRentalArbitrageInvestmentAnalysisCommand;

/** Canonical application boundary for all investment acquisition routes. */
export function runInvestmentAnalysis(
  command: RunInvestmentAnalysisCommand,
): InvestmentLifecycleResult {
  switch (command.acquisitionType) {
    case AcquisitionType.Purchase:
      return {
        acquisitionType:
          AcquisitionType.Purchase,
        analysis:
          buildPurchaseInvestmentReport(
            command,
          ),
      };

    case AcquisitionType.RentalArbitrage:
      return {
        acquisitionType:
          AcquisitionType.RentalArbitrage,
        analysis:
          buildRentalArbitrageInvestmentReport(
            command,
          ),
      };

    default:
      return assertNever(command);
  }
}

function assertNever(value: never): never {
  throw new TypeError(
    `Unsupported investment acquisition type: ${String(value)}`,
  );
}
