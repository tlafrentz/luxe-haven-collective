import { ComparableIntelligence } from "../../domain/entities/comparable-intelligence";
import { DemandIntelligence } from "../../domain/entities/demand-intelligence";
import { MarketConfidence } from "../../domain/entities/market-confidence";
import { MarketTrendIntelligence } from "../../domain/entities/market-trend-intelligence";
import { NeighborhoodIntelligence } from "../../domain/entities/neighborhood-intelligence";
import { PropertyIntelligence } from "../../domain/entities/property-intelligence";
import { SupplyIntelligence } from "../../domain/entities/supply-intelligence";
import {
  buildDimensionIssues,
  buildReadinessSummary,
  deduplicateReadinessIssues,
  type MarketReadinessIssue,
} from "./helpers/market-readiness-utils";

export interface ValidateMarketIntelligenceReadinessInput {
  readonly property: PropertyIntelligence;
  readonly comparables: ComparableIntelligence;
  readonly neighborhood: NeighborhoodIntelligence;
  readonly supply: SupplyIntelligence;
  readonly demand: DemandIntelligence;
  readonly trends: MarketTrendIntelligence;
  readonly confidence: MarketConfidence;
  readonly minimumOverallConfidence?: number;
  readonly minimumComparableCount?: number;
  readonly minimumDimensionConfidence?: number;
}

export interface MarketIntelligenceReadiness {
  readonly isDecisionReady: boolean;
  readonly issues: readonly MarketReadinessIssue[];
  readonly blockingIssues: readonly MarketReadinessIssue[];
  readonly warnings: readonly MarketReadinessIssue[];
  readonly advisories: readonly MarketReadinessIssue[];
  readonly summary: string;
}

export function validateMarketIntelligenceReadiness(
  input: ValidateMarketIntelligenceReadinessInput,
): MarketIntelligenceReadiness {
  const minimumOverallConfidence =
    input.minimumOverallConfidence ?? 50;
  const minimumComparableCount =
    input.minimumComparableCount ?? 3;
  const minimumDimensionConfidence =
    input.minimumDimensionConfidence ?? 50;

  const issues: MarketReadinessIssue[] = [];

  if (
    input.comparables.includedComparableCount <
    minimumComparableCount
  ) {
    issues.push({
      code: "insufficient-comparable-evidence",
      severity: "blocking",
      message: `Only ${input.comparables.includedComparableCount} included comparables are available; at least ${minimumComparableCount} are required.`,
      recommendedAction:
        "Expand the comparable search or validate additional nearby properties.",
    });
  }

  if (
    input.confidence.overall.value <
    minimumOverallConfidence
  ) {
    issues.push({
      code: "low-overall-confidence",
      severity: "blocking",
      message: `Overall market confidence is ${input.confidence.overall.value}, below the required threshold of ${minimumOverallConfidence}.`,
      recommendedAction:
        "Resolve the weakest confidence dimensions before making an acquisition decision.",
    });
  }

  if (input.confidence.hasMaterialGaps) {
    issues.push({
      code: "material-confidence-gaps",
      severity: "blocking",
      message: `${input.confidence.missingData.length} material ${
        input.confidence.missingData.length === 1
          ? "confidence gap remains"
          : "confidence gaps remain"
      }.`,
      recommendedAction:
        "Collect or validate the missing market evidence.",
    });
  }

  issues.push(
    ...buildDimensionIssues([
      {
        name: "property",
        score: input.confidence.property.value,
        minimumScore: minimumDimensionConfidence,
      },
      {
        name: "comparables",
        score: input.confidence.comparables.value,
        minimumScore: minimumDimensionConfidence,
      },
      {
        name: "neighborhood",
        score: input.confidence.neighborhood.value,
        minimumScore: minimumDimensionConfidence,
      },
      {
        name: "supply",
        score: input.confidence.supply.value,
        minimumScore: minimumDimensionConfidence,
      },
      {
        name: "demand",
        score: input.confidence.demand.value,
        minimumScore: minimumDimensionConfidence,
      },
      {
        name: "trends",
        score: input.confidence.trends.value,
        minimumScore: minimumDimensionConfidence,
      },
    ]),
  );

  if (input.property.hasMaterialUnknowns) {
    issues.push({
      code: "property-unknowns",
      severity: "warning",
      message: `${input.property.missingInformation.length} property ${
        input.property.missingInformation.length === 1
          ? "data point remains"
          : "data points remain"
      } unresolved.`,
      recommendedAction:
        "Complete the subject property profile before final underwriting.",
    });
  }

  if (input.neighborhood.hasMaterialUnknowns) {
    issues.push({
      code: "neighborhood-unknowns",
      severity: "warning",
      message: `${input.neighborhood.missingInformation.length} neighborhood ${
        input.neighborhood.missingInformation.length === 1
          ? "dimension remains"
          : "dimensions remain"
      } unresolved.`,
      recommendedAction:
        "Validate the missing neighborhood demand drivers.",
    });
  }

  if (input.supply.hasMaterialUnknowns) {
    issues.push({
      code: "supply-unknowns",
      severity: "warning",
      message: `${input.supply.missingInformation.length} supply ${
        input.supply.missingInformation.length === 1
          ? "metric remains"
          : "metrics remain"
      } unresolved.`,
      recommendedAction:
        "Confirm inventory volume, operator mix, and supply growth.",
    });
  }

  if (input.demand.hasMaterialUnknowns) {
    issues.push({
      code: "demand-unknowns",
      severity: "warning",
      message: `${input.demand.missingInformation.length} demand ${
        input.demand.missingInformation.length === 1
          ? "metric remains"
          : "metrics remain"
      } unresolved.`,
      recommendedAction:
        "Confirm occupancy, ADR, RevPAR, and booking pace evidence.",
    });
  }

  if (input.trends.hasMaterialUnknowns) {
    issues.push({
      code: "trend-unknowns",
      severity: "warning",
      message: `${input.trends.missingInformation.length} trend ${
        input.trends.missingInformation.length === 1
          ? "signal remains"
          : "signals remain"
      } unresolved.`,
      recommendedAction:
        "Expand the trend history or provider coverage.",
    });
  }

  if (input.trends.hasConflictingEvidence) {
    issues.push({
      code: "conflicting-trend-evidence",
      severity: "warning",
      message: `${input.trends.conflictingSignals.length} ${
        input.trends.conflictingSignals.length === 1
          ? "trend signal conflicts"
          : "trend signals conflict"
      } with the overall market direction.`,
      recommendedAction:
        "Stress-test the conclusion against the conflicting trend evidence.",
    });
  }

  if (!input.property.hasValuation) {
    issues.push({
      code: "property-valuation-unavailable",
      severity: "advisory",
      message:
        "The property intelligence does not contain a valuation range.",
      recommendedAction:
        "Add valuation evidence before using the report for purchase-price negotiation.",
    });
  }

  const uniqueIssues = deduplicateReadinessIssues(issues);
  const blockingIssues = uniqueIssues.filter(
    (issue) => issue.severity === "blocking",
  );
  const warnings = uniqueIssues.filter(
    (issue) => issue.severity === "warning",
  );
  const advisories = uniqueIssues.filter(
    (issue) => issue.severity === "advisory",
  );

  const isDecisionReady = blockingIssues.length === 0;

  return Object.freeze({
    isDecisionReady,
    issues: uniqueIssues,
    blockingIssues: Object.freeze(blockingIssues),
    warnings: Object.freeze(warnings),
    advisories: Object.freeze(advisories),
    summary: buildReadinessSummary({
      isDecisionReady,
      issues: uniqueIssues,
      overallConfidence: input.confidence.overall.value,
      includedComparableCount:
        input.comparables.includedComparableCount,
    }),
  });
}
