import { describe, expect, it } from "vitest";

import { Score } from "../domain/score";
import { ScoreScale } from "../domain/score-scale";
import { normalizeScore } from "./normalize-score";

describe("normalizeScore", () => {
  it("normalizes equivalent scores across scales", () => {
    const normalized = normalizeScore(
      Score.create(4, ScoreScale.ZERO_TO_FIVE),
      ScoreScale.ZERO_TO_ONE_HUNDRED,
    );

    expect(normalized.value).toBe(80);
    expect(
      normalized.scale.equals(
        ScoreScale.ZERO_TO_ONE_HUNDRED,
      ),
    ).toBe(true);
  });

  it("supports scales with non-zero minimums", () => {
    const normalized = normalizeScore(
      Score.create(3, ScoreScale.create(1, 5)),
      ScoreScale.ZERO_TO_ONE_HUNDRED,
    );

    expect(normalized.value).toBe(50);
  });

  it("preserves boundary positions", () => {
    expect(
      normalizeScore(
        Score.create(1, ScoreScale.create(1, 5)),
        ScoreScale.ZERO_TO_ONE_HUNDRED,
      ).value,
    ).toBe(0);

    expect(
      normalizeScore(
        Score.create(5, ScoreScale.create(1, 5)),
        ScoreScale.ZERO_TO_ONE_HUNDRED,
      ).value,
    ).toBe(100);
  });
});
