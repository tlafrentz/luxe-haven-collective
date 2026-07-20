import { describe, expect, it } from "vitest";

import { ScoreScale } from "./score-scale";

describe("ScoreScale", () => {
  it("creates a valid scale", () => {
    const scale = ScoreScale.create(-10, 10);

    expect(scale.minimum).toBe(-10);
    expect(scale.maximum).toBe(10);
    expect(scale.range).toBe(20);
  });

  it("provides common reusable scales", () => {
    expect(ScoreScale.ZERO_TO_ONE.minimum).toBe(0);
    expect(ScoreScale.ZERO_TO_ONE.maximum).toBe(1);
    expect(ScoreScale.ZERO_TO_FIVE.maximum).toBe(5);
    expect(ScoreScale.ZERO_TO_TEN.maximum).toBe(10);
    expect(ScoreScale.ZERO_TO_ONE_HUNDRED.maximum).toBe(100);
  });

  it("compares scales by value", () => {
    expect(
      ScoreScale.create(0, 100).equals(
        ScoreScale.ZERO_TO_ONE_HUNDRED,
      ),
    ).toBe(true);
  });

  it("rejects a maximum equal to the minimum", () => {
    expect(() => ScoreScale.create(10, 10)).toThrow(
      "Score scale maximum must be greater than its minimum.",
    );
  });

  it("rejects a maximum below the minimum", () => {
    expect(() => ScoreScale.create(10, 5)).toThrow(RangeError);
  });

  it.each([
    [Number.NaN, 100],
    [0, Number.NaN],
    [Number.POSITIVE_INFINITY, 100],
    [0, Number.NEGATIVE_INFINITY],
  ])(
    "rejects non-finite boundaries (%s, %s)",
    (minimum, maximum) => {
      expect(() => ScoreScale.create(minimum, maximum)).toThrow(
        TypeError,
      );
    },
  );

  it("evaluates values against inclusive boundaries", () => {
    const scale = ScoreScale.ZERO_TO_ONE_HUNDRED;

    expect(scale.contains(0)).toBe(true);
    expect(scale.contains(50)).toBe(true);
    expect(scale.contains(100)).toBe(true);
    expect(scale.contains(-1)).toBe(false);
    expect(scale.contains(101)).toBe(false);
    expect(scale.contains(Number.NaN)).toBe(false);
  });

  it("clamps values to the scale", () => {
    const scale = ScoreScale.ZERO_TO_ONE_HUNDRED;

    expect(scale.clamp(-20)).toBe(0);
    expect(scale.clamp(72)).toBe(72);
    expect(scale.clamp(120)).toBe(100);
  });

  it("rejects non-finite clamp values", () => {
    expect(() =>
      ScoreScale.ZERO_TO_ONE_HUNDRED.clamp(Number.NaN),
    ).toThrow(TypeError);
  });
});
