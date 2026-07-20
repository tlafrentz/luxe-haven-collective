import { describe, expect, it } from "vitest";

import { ConfidenceLevel } from "../domain/confidence-level";
import { ConfidenceScore } from "../domain/confidence-score";
import { Weight } from "../domain/weight";
import { calculateConfidence } from "./calculate-confidence";

describe("calculateConfidence", () => {
  it("calculates weighted confidence", () => {
    const assessment = calculateConfidence([
      {
        score: ConfidenceScore.create(90),
        weight: Weight.fromPercentage(60),
        rationale: "Strong provider agreement.",
      },
      {
        score: ConfidenceScore.create(70),
        weight: Weight.fromPercentage(40),
        rationale: "Moderate sample depth.",
      },
    ]);

    expect(assessment.score.value).toBe(82);
    expect(assessment.level).toBe(
      ConfidenceLevel.VERY_HIGH,
    );
    expect(assessment.rationale).toEqual([
      "Strong provider agreement.",
      "Moderate sample depth.",
    ]);
  });

  it("ignores blank rationale entries", () => {
    const assessment = calculateConfidence([
      {
        score: ConfidenceScore.create(80),
        weight: Weight.fromPercentage(50),
        rationale: " ",
      },
      {
        score: ConfidenceScore.create(60),
        weight: Weight.fromPercentage(50),
      },
    ]);

    expect(assessment.rationale).toEqual([]);
  });

  it("rejects an empty factor collection", () => {
    expect(() => calculateConfidence([])).toThrow(
      "Confidence calculation requires at least one factor.",
    );
  });

  it("rejects weights below one hundred percent", () => {
    expect(() =>
      calculateConfidence([
        {
          score: ConfidenceScore.create(80),
          weight: Weight.fromPercentage(40),
        },
        {
          score: ConfidenceScore.create(60),
          weight: Weight.fromPercentage(40),
        },
      ]),
    ).toThrow(
      "Confidence factor weights must total 100%.",
    );
  });

  it("rejects weights above one hundred percent", () => {
    expect(() =>
      calculateConfidence([
        {
          score: ConfidenceScore.create(80),
          weight: Weight.fromPercentage(60),
        },
        {
          score: ConfidenceScore.create(60),
          weight: Weight.fromPercentage(60),
        },
      ]),
    ).toThrow(
      "Confidence factor weights must total 100%.",
    );
  });
});
