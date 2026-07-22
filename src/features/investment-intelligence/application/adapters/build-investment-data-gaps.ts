import {
  AcquisitionType,
  ConfidenceLevel,
} from "../../domain";

import type {
  InvestmentDataGap,
  InvestmentLifecycleResult,
} from "../../domain";

import type {
  InvestmentPlatformRunContext,
} from "./investment-platform-run-context";

export function buildInvestmentDataGaps(
  result: InvestmentLifecycleResult,
  context: InvestmentPlatformRunContext,
): readonly InvestmentDataGap[] {
  const gaps: InvestmentDataGap[] = [];

  if (
    !context.upstream?.market &&
    !context.upstream?.revenue
  ) {
    gaps.push({
      code: "missing-upstream-lineage",
      subject: result.analysis.property.id,
      description:
        "No canonical market or revenue upstream artifacts were supplied for this analysis run.",
      severity: "informational",
    });
  }

  const comparableQuality =
    context.sourceQuality?.comparables ??
    "unknown";

  if (comparableQuality !== "verified") {
    gaps.push({
      code:
        comparableQuality === "synthetic"
          ? "synthetic-comparables"
          : "unverified-comparable-source",
      subject: result.analysis.property.id,
      description:
        comparableQuality === "synthetic"
          ? "The analysis uses substituted or synthetic comparable inputs."
          : "The comparable input source has not been verified.",
      severity: "material",
      sourceField: "comparables",
    });
  }

  if (
    result.analysis.comparableAnalysis
      .confidence === ConfidenceLevel.Low ||
    result.analysis.comparableAnalysis
      .confidence === ConfidenceLevel.VeryLow
  ) {
    gaps.push({
      code: "weak-comparable-confidence",
      subject: result.analysis.property.id,
      description:
        "The comparable set provides low-confidence support for the underwriting assumptions.",
      severity: "material",
      sourceField: "comparables",
    });
  }

  if (
    context.sourceQuality?.regulation !==
    "verified"
  ) {
    gaps.push({
      code: "missing-regulation-source",
      subject: result.analysis.property.id,
      description:
        "No verified regulation source was supplied for this analysis run.",
      severity: "material",
      sourceField: "market.regulation",
    });
  }

  if (
    result.acquisitionType ===
      AcquisitionType.RentalArbitrage &&
    context.sourceQuality
      ?.utilitiesResponsibility !==
      "verified"
  ) {
    gaps.push({
      code:
        "missing-utilities-responsibility",
      subject: result.analysis.property.id,
      description:
        "Utilities responsibility has not been verified against the proposed lease.",
      severity: "material",
      sourceField:
        "lease.utilitiesIncluded",
    });
  }

  return Object.freeze(gaps);
}
