import { describe, expect, it } from "vitest";

import { TrendDirection } from "../../../domain/enums/trend-direction";
import {
  calculateMomentumScore,
  deriveOverallTrend,
  scoreTrendDirection,
} from "../../builders/helpers/trend-utils";

describe("trend-utils", () => {
  it("scores positive and negative trend directions", () => {
    expect(
      scoreTrendDirection(TrendDirection.StronglyPositive),
    ).toBeGreaterThan(
      scoreTrendDirection(TrendDirection.Positive),
    );
    expect(
      scoreTrendDirection(TrendDirection.Negative),
    ).toBeLessThan(0);
  });

  it("derives the closest supplied direction", () => {
    const direction = deriveOverallTrend([
      {
        direction: TrendDirection.StronglyPositive,
        weight: 0.5,
      },
      {
        direction: TrendDirection.Positive,
        weight: 0.5,
      },
    ]);

    expect([
      TrendDirection.Positive,
      TrendDirection.StronglyPositive,
    ]).toContain(direction);
  });

  it("maps balanced evidence to a neutral momentum score", () => {
    expect(
      calculateMomentumScore([
        {
          direction: TrendDirection.Positive,
          weight: 0.5,
        },
        {
          direction: TrendDirection.Negative,
          weight: 0.5,
        },
      ]),
    ).toBe(50);
  });
});
