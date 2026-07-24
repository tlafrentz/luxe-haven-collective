import { describe, expect, it } from "vitest";

import { Money, Percentage } from "../index";

describe("platform business primitives", () => {
  it("represents immutable USD money", () => {
    expect(Money.usd(40).add(Money.usd(2)).amount).toBe(42);
    expect(Money.zero().currency).toBe("USD");
    expect(() => Money.usd(Number.NaN)).toThrow(TypeError);
  });

  it("bounds percentages and exposes a ratio", () => {
    expect(Percentage.create(42).ratio).toBe(0.42);
    expect(() => Percentage.create(-1)).toThrow(RangeError);
    expect(() => Percentage.create(101)).toThrow(RangeError);
  });
});
