import { describe, expect, it } from "vitest";

import { Weight } from "./weight";

describe("Weight", () => {
  it("creates a weight from a ratio", () => {
    const weight = Weight.create(0.35);

    expect(weight.value).toBe(0.35);
    expect(weight.ratio).toBe(0.35);
    expect(weight.percentage).toBe(35);
  });

  it("creates a weight from a percentage", () => {
    const weight = Weight.fromPercentage(35);

    expect(weight.ratio).toBe(0.35);
    expect(weight.percentage).toBe(35);
  });

  it("accepts inclusive ratio boundaries", () => {
    expect(Weight.create(0).isZero()).toBe(true);
    expect(Weight.create(1).isFull()).toBe(true);
  });

  it("accepts inclusive percentage boundaries", () => {
    expect(Weight.fromPercentage(0).ratio).toBe(0);
    expect(Weight.fromPercentage(100).ratio).toBe(1);
  });

  it("rejects ratios outside zero and one", () => {
    expect(() => Weight.create(-0.01)).toThrow(RangeError);
    expect(() => Weight.create(1.01)).toThrow(RangeError);
  });

  it("rejects percentages outside zero and one hundred", () => {
    expect(() => Weight.fromPercentage(-1)).toThrow(RangeError);
    expect(() => Weight.fromPercentage(101)).toThrow(RangeError);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("rejects non-finite ratios (%s)", (value) => {
    expect(() => Weight.create(value)).toThrow(TypeError);
  });

  it("compares weights by value", () => {
    expect(
      Weight.create(0.35).equals(
        Weight.fromPercentage(35),
      ),
    ).toBe(true);
  });

  it("applies the weight to a numeric value", () => {
    expect(Weight.fromPercentage(25).applyTo(80)).toBe(20);
  });

  it("rejects applying a weight to a non-finite value", () => {
    expect(() =>
      Weight.create(0.5).applyTo(Number.NaN),
    ).toThrow(TypeError);
  });

  it("remains immutable", () => {
    expect(Object.isFrozen(Weight.create(0.5))).toBe(true);
  });
});
