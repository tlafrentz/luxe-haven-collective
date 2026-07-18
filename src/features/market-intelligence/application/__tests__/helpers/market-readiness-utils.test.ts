import { describe, expect, it } from "vitest";

import {
  buildDimensionIssues,
  calculateWeightedScore,
  deduplicateReadinessIssues,
} from "../../builders/helpers/market-readiness-utils";

describe("market-readiness-utils", () => {
  it("calculates a normalized weighted score", () => {
    expect(
      calculateWeightedScore([
        { score: 80, weight: 3 },
        { score: 60, weight: 1 },
      ]),
    ).toBe(75);
  });

  it("builds confidence-dimension warnings", () => {
    const issues = buildDimensionIssues([
      {
        name: "supply",
        score: 42,
        minimumScore: 50,
      },
      {
        name: "demand",
        score: 80,
        minimumScore: 50,
      },
    ]);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe(
      "low-supply-confidence",
    );
  });

  it("deduplicates identical readiness issues", () => {
    const issue = {
      code: "test",
      severity: "warning" as const,
      message: "Test warning.",
    };

    expect(
      deduplicateReadinessIssues([issue, issue]),
    ).toHaveLength(1);
  });
});
