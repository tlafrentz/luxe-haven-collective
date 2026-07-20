import { describe, expect, it } from "vitest";

import { Score } from "../domain/score";
import { ScoreScale } from "../domain/score-scale";
import { Weight } from "../domain/weight";
import { WeightedScore } from "../domain/weighted-score";
import { calculateWeightedScore } from "./calculate-weighted-score";

describe("calculateWeightedScore", () => {
  it("calculates a weighted composite score", () => {
    const result = calculateWeightedScore([
      WeightedScore.create(
        Score.create(90),
        Weight.fromPercentage(40),
      ),
      WeightedScore.create(
        Score.create(80),
        Weight.fromPercentage(35),
      ),
      WeightedScore.create(
        Score.create(70),
        Weight.fromPercentage(25),
      ),
    ]);

    expect(result.value).toBe(81.5);
  });

  it("supports custom score scales", () => {
    const scale = ScoreScale.create(1, 5);

    const result = calculateWeightedScore([
      WeightedScore.create(
        Score.create(5, scale),
        Weight.fromPercentage(50),
      ),
      WeightedScore.create(
        Score.create(3, scale),
        Weight.fromPercentage(50),
      ),
    ]);

    expect(result.value).toBe(4);
    expect(result.scale.equals(scale)).toBe(true);
  });

  it("rejects an empty collection", () => {
    expect(() => calculateWeightedScore([])).toThrow(
      "Weighted score calculation requires at least one value.",
    );
  });

  it("rejects mixed scales", () => {
    expect(() =>
      calculateWeightedScore([
        WeightedScore.create(
          Score.create(80),
          Weight.fromPercentage(50),
        ),
        WeightedScore.create(
          Score.create(4, ScoreScale.ZERO_TO_FIVE),
          Weight.fromPercentage(50),
        ),
      ]),
    ).toThrow(
      "Weighted scores must use the same score scale.",
    );
  });

  it("rejects weights that do not total one hundred percent", () => {
    expect(() =>
      calculateWeightedScore([
        WeightedScore.create(
          Score.create(80),
          Weight.fromPercentage(40),
        ),
        WeightedScore.create(
          Score.create(60),
          Weight.fromPercentage(40),
        ),
      ]),
    ).toThrow(
      "Weighted score weights must total 100%.",
    );
  });
});
