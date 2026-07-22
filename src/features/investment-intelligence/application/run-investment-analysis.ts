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

import {
  buildPurchaseScenarios,
} from "./build-purchase-scenarios";

import {
  buildRentalArbitrageScenarios,
} from "./build-rental-arbitrage-scenarios";

import {
  buildRentalArbitrageStressTests,
} from "./build-rental-arbitrage-stress-tests";

import {
  calculatePurchaseFailurePoints,
} from "./calculate-purchase-failure-points";

import {
  calculateRentalArbitrageFailurePoints,
} from "./calculate-rental-arbitrage-failure-points";

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
    case AcquisitionType.Purchase: {
      const analysis =
        buildPurchaseInvestmentReport(
          command,
        );

      return {
        acquisitionType:
          AcquisitionType.Purchase,
        analysis,
        derivedAnalysis: {
          scenarios:
            buildPurchaseScenarios(
              analysis,
            ),
          failurePoints:
            calculatePurchaseFailurePoints(
              analysis,
            ),
        },
      };
    }

    case AcquisitionType.RentalArbitrage: {
      const analysis =
        buildRentalArbitrageInvestmentReport(
          command,
        );

      return {
        acquisitionType:
          AcquisitionType.RentalArbitrage,
        analysis,
        derivedAnalysis: {
          scenarios:
            buildRentalArbitrageScenarios(
              analysis,
            ),
          failurePoints:
            calculateRentalArbitrageFailurePoints(
              analysis,
            ),
          stressTests:
            buildRentalArbitrageStressTests(
              analysis,
            ),
        },
      };
    }

    default:
      return assertNever(command);
  }
}

function assertNever(value: never): never {
  throw new TypeError(
    `Unsupported investment acquisition type: ${String(value)}`,
  );
}
