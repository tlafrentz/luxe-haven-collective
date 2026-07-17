import {
  AcquisitionType,
} from "../domain";

import type {
  InvestmentDecision,
  RentalArbitrageInvestmentAnalysis,
} from "../domain";

import {
  buildPurchaseInvestmentReport,
} from "./build-purchase-investment-report";

import type {
  BuildPurchaseInvestmentReportInput,
} from "./build-purchase-investment-report";

import {
  buildRentalArbitrageInvestmentReport,
} from "./build-rental-arbitrage-investment-report";

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
  if (
    input.acquisitionType ===
    AcquisitionType.RentalArbitrage
  ) {
    return buildRentalArbitrageInvestmentReport(
      input,
    );
  }

  return buildPurchaseInvestmentReport(
    input,
  );
}
