import { describe, expect, it } from "vitest";

import { Score } from "./score";
import { ScoreScale } from "./score-scale";

describe("Score", () => {
  it("uses the zero-to-one-hundred scale by default", () => {
    const score = Score.create(82);

    expect(score.value).toBe(82);
    expect(score.minimum).toBe(0);
    expect(score.maximum).toBe(100);
  });

  it("supports custom scales", () => {
    const score = Score.create(4.5, ScoreScale.ZERO_TO_FIVE);

    expect(score.value).toBe(4.5);
    expect(score.scale.equals(ScoreScale.ZERO_TO_FIVE)).toBe(true);
  });

  it("accepts inclusive scale boundaries", () => {
    expect(Score.create(0).value).toBe(0);
    expect(Score.create(100).value).toBe(100);
  });

  it("rejects values below the scale", () => {
    expect(() => Score.create(-1)).toThrow(
      "Score must be between 0 and 100, inclusive.",
    );
  });

  it("rejects values above the scale", () => {
    expect(() => Score.create(101)).toThrow(RangeError);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("rejects non-finite values (%s)", (value) => {
    expect(() => Score.create(value)).toThrow(TypeError);
  });

  it("compares scores by value and scale", () => {
    expect(Score.create(50).equals(Score.create(50))).toBe(true);

    expect(
      Score.create(0.5, ScoreScale.ZERO_TO_ONE).equals(
        Score.create(50, ScoreScale.ZERO_TO_ONE_HUNDRED),
      ),
    ).toBe(false);
  });

  it("creates clamped scores", () => {
    expect(Score.clamp(-10).value).toBe(0);
    expect(Score.clamp(110).value).toBe(100);
  });

  it("converts a score to a zero-to-one ratio", () => {
    expect(Score.create(25).toRatio()).toBe(0.25);

    expect(
      Score.create(3, ScoreScale.create(1, 5)).toRatio(),
    ).toBe(0.5);
  });

  it("normalizes equivalent values across scales", () => {
    const normalized = Score.create(4, ScoreScale.ZERO_TO_FIVE)
      .normalizeTo(ScoreScale.ZERO_TO_ONE_HUNDRED);

    expect(normalized.value).toBe(80);
    expect(
      normalized.scale.equals(
        ScoreScale.ZERO_TO_ONE_HUNDRED,
      ),
    ).toBe(true);
  });

  it("rounds to a requested precision", () => {
    const score = Score.create(82.4567);

    expect(score.round().value).toBe(82);
    expect(score.round(2).value).toBe(82.46);
  });

  it("rejects invalid decimal precision", () => {
    expect(() => Score.create(82).round(-1)).toThrow(
      "Score decimal places must be a non-negative integer.",
    );

    expect(() => Score.create(82).round(1.5)).toThrow(
      RangeError,
    );
  });

  it("remains immutable", () => {
    expect(Object.isFrozen(Score.create(82))).toBe(true);
  });
});
