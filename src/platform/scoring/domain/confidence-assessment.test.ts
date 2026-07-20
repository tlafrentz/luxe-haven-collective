import { describe, expect, it } from "vitest";

import { ConfidenceLevel } from "./confidence-level";
import { ConfidenceAssessment } from "./confidence-assessment";
import { ConfidenceScore } from "./confidence-score";

describe("ConfidenceAssessment", () => {
  it("maps its confidence level automatically", () => {
    const assessment = ConfidenceAssessment.create({
      score: ConfidenceScore.create(82),
      rationale: ["Strong provider agreement."],
    });

    expect(assessment.level).toBe(
      ConfidenceLevel.VERY_HIGH,
    );
  });

  it("supports an explicit confidence level", () => {
    const assessment = ConfidenceAssessment.create({
      score: ConfidenceScore.create(82),
      level: ConfidenceLevel.HIGH,
      rationale: ["Conservative manual override."],
    });

    expect(assessment.level).toBe(ConfidenceLevel.HIGH);
  });

  it("normalizes rationale entries", () => {
    const assessment = ConfidenceAssessment.create({
      score: ConfidenceScore.create(72),
      rationale: [
        "  Strong comparable count.  ",
        "",
        "Strong comparable count.",
        "  Recent provider data. ",
      ],
    });

    expect(assessment.rationale).toEqual([
      "Strong comparable count.",
      "Recent provider data.",
    ]);
  });

  it("supports an empty rationale collection", () => {
    const assessment = ConfidenceAssessment.create({
      score: ConfidenceScore.create(72),
      rationale: [],
    });

    expect(assessment.hasRationale()).toBe(false);
  });

  it("reports when rationale is available", () => {
    const assessment = ConfidenceAssessment.create({
      score: ConfidenceScore.create(72),
      rationale: ["Recent provider data."],
    });

    expect(assessment.hasRationale()).toBe(true);
  });

  it("compares complete assessments by value", () => {
    const first = ConfidenceAssessment.create({
      score: ConfidenceScore.create(72),
      rationale: ["Recent provider data."],
    });
    const second = ConfidenceAssessment.create({
      score: ConfidenceScore.create(72),
      rationale: ["Recent provider data."],
    });

    expect(first.equals(second)).toBe(true);
  });

  it("protects itself from later source-array mutation", () => {
    const rationale = ["Recent provider data."];

    const assessment = ConfidenceAssessment.create({
      score: ConfidenceScore.create(72),
      rationale,
    });

    rationale.push("Later mutation.");

    expect(assessment.rationale).toEqual([
      "Recent provider data.",
    ]);
  });

  it("is immutable", () => {
    expect(
      Object.isFrozen(
        ConfidenceAssessment.create({
          score: ConfidenceScore.create(72),
          rationale: ["Recent provider data."],
        }),
      ),
    ).toBe(true);
  });
});
