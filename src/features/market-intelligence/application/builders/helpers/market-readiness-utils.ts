export type MarketReadinessSeverity = "blocking" | "warning" | "advisory";

export interface MarketReadinessIssue {
  readonly code: string;
  readonly severity: MarketReadinessSeverity;
  readonly message: string;
  readonly recommendedAction?: string;
}

export interface MarketReadinessDimension {
  readonly name: string;
  readonly score: number;
  readonly minimumScore: number;
}

export function clampMarketScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, round(value)));
}

export function calculateWeightedScore(
  dimensions: readonly {
    readonly score: number;
    readonly weight: number;
  }[],
): number {
  const usableDimensions = dimensions.filter(
    (dimension) =>
      Number.isFinite(dimension.score) &&
      Number.isFinite(dimension.weight) &&
      dimension.weight > 0,
  );

  if (usableDimensions.length === 0) {
    return 0;
  }

  const totalWeight = usableDimensions.reduce(
    (sum, dimension) => sum + dimension.weight,
    0,
  );

  return clampMarketScore(
    usableDimensions.reduce(
      (sum, dimension) =>
        sum +
        clampMarketScore(dimension.score) * dimension.weight,
      0,
    ) / totalWeight,
  );
}

export function buildDimensionIssues(
  dimensions: readonly MarketReadinessDimension[],
): readonly MarketReadinessIssue[] {
  return dimensions
    .filter(
      (dimension) =>
        clampMarketScore(dimension.score) <
        clampMarketScore(dimension.minimumScore),
    )
    .map((dimension) => ({
      code: `low-${normalizeCode(dimension.name)}-confidence`,
      severity: "warning" as const,
      message: `${titleCase(
        dimension.name,
      )} confidence is ${clampMarketScore(
        dimension.score,
      )}, below the preferred threshold of ${clampMarketScore(
        dimension.minimumScore,
      )}.`,
      recommendedAction: `Strengthen ${dimension.name.toLowerCase()} evidence before relying on the final market conclusion.`,
    }));
}

export function deduplicateReadinessIssues(
  issues: readonly MarketReadinessIssue[],
): readonly MarketReadinessIssue[] {
  const seen = new Set<string>();
  const unique: MarketReadinessIssue[] = [];

  for (const issue of issues) {
    const key = `${issue.code}:${issue.message}`.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(Object.freeze({ ...issue }));
  }

  return Object.freeze(unique);
}

export function countIssuesBySeverity(
  issues: readonly MarketReadinessIssue[],
  severity: MarketReadinessSeverity,
): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

export function buildReadinessSummary(input: {
  readonly isDecisionReady: boolean;
  readonly issues: readonly MarketReadinessIssue[];
  readonly overallConfidence: number;
  readonly includedComparableCount: number;
}): string {
  const blockingCount = countIssuesBySeverity(
    input.issues,
    "blocking",
  );
  const warningCount = countIssuesBySeverity(
    input.issues,
    "warning",
  );

  if (input.isDecisionReady) {
    return `The market analysis is decision-ready with ${input.includedComparableCount} included comparables and overall confidence of ${clampMarketScore(
      input.overallConfidence,
    )}. ${warningCount} ${
      warningCount === 1 ? "warning remains" : "warnings remain"
    } for underwriting review.`;
  }

  return `The market analysis is not yet decision-ready. ${blockingCount} ${
    blockingCount === 1 ? "blocking issue requires" : "blocking issues require"
  } resolution, with ${warningCount} additional ${
    warningCount === 1 ? "warning" : "warnings"
  }. Overall confidence is ${clampMarketScore(
    input.overallConfidence,
  )}, supported by ${input.includedComparableCount} included comparables.`;
}

function normalizeCode(value: string): string {
  return value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function round(value: number, precision = 2): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}
