import { describe, expect, it } from "vitest";

import { Score } from "./score";
import { ScoreScale } from "./score-scale";
import { Weight } from "./weight";
import { WeightedScore } from "./weighted-score";

describe("WeightedScore", () => {
  it("stores a score and weight", () => {
    const weighted = WeightedScore.create(
      Score.create(80),
      Weight.fromPercentage(25),
    );

    expect(weighted.score.value).toBe(80);
    expect(weighted.weight.percentage).toBe(25);
  });

  it("calculates a contribution on the score scale", () => {
    const weighted = WeightedScore.create(
      Score.create(80),
      Weight.fromPercentage(25),
    );

    expect(weighted.contribution).toBe(20);
  });

  it("calculates a normalized contribution", () => {
    const weighted = WeightedScore.create(
      Score.create(4, ScoreScale.ZERO_TO_FIVE),
      Weight.fromPercentage(25),
    );

    expect(weighted.normalizedContribution).toBe(0.2);
  });

  it("treats equivalent relative scores consistently", () => {
    const first = WeightedScore.create(
      Score.create(80),
      Weight.fromPercentage(25),
    );
    const second = WeightedScore.create(
      Score.create(4, ScoreScale.ZERO_TO_FIVE),
      Weight.fromPercentage(25),
    );

    expect(first.normalizedContribution).toBe(
      second.normalizedContribution,
    );
  });

  it("compares by score and weight", () => {
    expect(
      WeightedScore.create(
        Score.create(80),
        Weight.fromPercentage(25),
      ).equals(
        WeightedScore.create(
          Score.create(80),
          Weight.fromPercentage(25),
        ),
      ),
    ).toBe(true);
  });

  it("is immutable", () => {
    expect(
      Object.isFrozen(
        WeightedScore.create(
          Score.create(80),
          Weight.fromPercentage(25),
        ),
      ),
    ).toBe(true);
  });
});
