import { describe, expect, it } from "vitest";

import { ConfidenceScore } from "./confidence-score";

describe("ConfidenceScore", () => {
  it("creates a confidence score on a zero-to-one-hundred scale", () => {
    const confidence = ConfidenceScore.create(82);

    expect(confidence.value).toBe(82);
    expect(confidence.score.minimum).toBe(0);
    expect(confidence.score.maximum).toBe(100);
  });

  it("accepts inclusive boundaries", () => {
    expect(ConfidenceScore.create(0).value).toBe(0);
    expect(ConfidenceScore.create(100).value).toBe(100);
  });

  it("rejects values outside the scale", () => {
    expect(() => ConfidenceScore.create(-1)).toThrow(RangeError);
    expect(() => ConfidenceScore.create(101)).toThrow(RangeError);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("rejects non-finite values (%s)", (value) => {
    expect(() => ConfidenceScore.create(value)).toThrow(TypeError);
  });

  it("creates clamped confidence scores", () => {
    expect(ConfidenceScore.clamp(-20).value).toBe(0);
    expect(ConfidenceScore.clamp(120).value).toBe(100);
  });

  it("converts confidence to a ratio", () => {
    expect(ConfidenceScore.create(75).toRatio()).toBe(0.75);
  });

  it("rounds confidence scores", () => {
    expect(ConfidenceScore.create(82.456).round(2).value).toBe(
      82.46,
    );
  });

  it("compares by value", () => {
    expect(
      ConfidenceScore.create(82).equals(
        ConfidenceScore.create(82),
      ),
    ).toBe(true);
  });

  it("is immutable", () => {
    expect(
      Object.isFrozen(ConfidenceScore.create(82)),
    ).toBe(true);
  });
});
