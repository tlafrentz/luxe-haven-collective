import { describe, expect, it } from "vitest";

import {
  averageDefined,
  clampScore,
  weightedAverage,
} from "../../builders/helpers/number-utils";

describe("number-utils", () => {
  it("clamps scores to the supported range", () => {
    expect(clampScore(-10)).toBe(0);
    expect(clampScore(72.456)).toBe(72.46);
    expect(clampScore(140)).toBe(100);
  });

  it("averages only defined values", () => {
    expect(averageDefined([20, undefined, 40])).toBe(30);
    expect(averageDefined([undefined])).toBeUndefined();
  });

  it("calculates weighted averages from usable values", () => {
    expect(
      weightedAverage([
        { value: 80, weight: 0.75 },
        { value: 40, weight: 0.25 },
      ]),
    ).toBe(70);
  });
});
