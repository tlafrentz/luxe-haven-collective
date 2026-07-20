import { describe, expect, it } from "vitest";

import { Score } from "../domain/score";
import {
  evaluateScoreThreshold,
  type ScoreThreshold,
} from "./score-thresholds";

const thresholds = [
  { minimum: 80, value: "very-high" },
  { minimum: 60, value: "high" },
  { minimum: 40, value: "moderate" },
  { minimum: 20, value: "low" },
  { minimum: 0, value: "very-low" },
] as const satisfies readonly ScoreThreshold<string>[];

describe("evaluateScoreThreshold", () => {
  it.each([
    [100, "very-high"],
    [80, "very-high"],
    [79.999, "high"],
    [60, "high"],
    [40, "moderate"],
    [20, "low"],
    [0, "very-low"],
  ])("maps %s to %s", (value, expected) => {
    expect(
      evaluateScoreThreshold(
        Score.create(value),
        thresholds,
      ),
    ).toBe(expected);
  });

  it("rejects an empty threshold collection", () => {
    expect(() =>
      evaluateScoreThreshold(Score.create(50), []),
    ).toThrow(
      "Score threshold evaluation requires at least one threshold.",
    );
  });

  it("rejects thresholds outside the score scale", () => {
    expect(() =>
      evaluateScoreThreshold(Score.create(50), [
        { minimum: 101, value: "high" },
        { minimum: 0, value: "low" },
      ]),
    ).toThrow(
      "Score threshold minimum must fall within the score scale.",
    );
  });

  it("rejects thresholds in ascending order", () => {
    expect(() =>
      evaluateScoreThreshold(Score.create(50), [
        { minimum: 0, value: "low" },
        { minimum: 80, value: "high" },
      ]),
    ).toThrow(
      "Score thresholds must be ordered from highest minimum to lowest minimum.",
    );
  });

  it("rejects duplicate thresholds", () => {
    expect(() =>
      evaluateScoreThreshold(Score.create(50), [
        { minimum: 80, value: "high" },
        { minimum: 80, value: "low" },
      ]),
    ).toThrow(
      "Score thresholds must be ordered from highest minimum to lowest minimum.",
    );
  });

  it("rejects non-finite thresholds", () => {
    expect(() =>
      evaluateScoreThreshold(Score.create(50), [
        { minimum: Number.NaN, value: "high" },
      ]),
    ).toThrow(TypeError);
  });
});
