import {
  AcquisitionType,
} from "../domain";

import type {
  InvestmentDecision,
  RentalArbitrageInvestmentAnalysis,
} from "../domain";

import {
  runInvestmentAnalysis,
} from "../application/run-investment-analysis";

import type {
  RunInvestmentAnalysisCommand,
} from "../application/run-investment-analysis";

import type {
  BuildPurchaseInvestmentReportInput,
} from "./build-purchase-investment-report";

import type {
  BuildRentalArbitrageInvestmentReportInput,
} from "./build-rental-arbitrage-investment-report";

export type BuildInvestmentReportInput =
  | BuildPurchaseInvestmentReportInput
  | BuildRentalArbitrageInvestmentReportInput;

export function buildInvestmentReport(
  input: BuildRentalArbitrageInvestmentReportInput,
): RentalArbitrageInvestmentAnalysis;

export function buildInvestmentReport(
  input: BuildPurchaseInvestmentReportInput,
): InvestmentDecision;

export function buildInvestmentReport(
  input: BuildInvestmentReportInput,
):
  | InvestmentDecision
  | RentalArbitrageInvestmentAnalysis {
  const command: RunInvestmentAnalysisCommand =
    input.acquisitionType ===
    AcquisitionType.RentalArbitrage
      ? input
      : {
          ...input,
          acquisitionType:
            AcquisitionType.Purchase,
        };

  return runInvestmentAnalysis(command)
    .analysis;
}
