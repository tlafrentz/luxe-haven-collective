import { describe, expect, it } from "vitest";

import {
  calculateConfidence,
  calculateWeightedScore,
  ConfidenceLevel,
  ConfidenceScore,
  evaluateScoreThreshold,
  mapConfidenceLevel,
  normalizeScore,
  Score,
  ScoreBreakdown,
  ScoreComponent,
  ScoreScale,
  Weight,
  WeightedScore,
} from "../../src/platform/scoring";

describe("platform scoring public API", () => {
  it("exports the complete scoring capability", () => {
    expect(Score).toBeDefined();
    expect(ScoreScale).toBeDefined();
    expect(Weight).toBeDefined();
    expect(WeightedScore).toBeDefined();
    expect(ScoreComponent).toBeDefined();
    expect(ScoreBreakdown).toBeDefined();
    expect(ConfidenceScore).toBeDefined();
    expect(ConfidenceLevel).toBeDefined();
    expect(normalizeScore).toBeDefined();
    expect(calculateWeightedScore).toBeDefined();
    expect(calculateConfidence).toBeDefined();
    expect(mapConfidenceLevel).toBeDefined();
    expect(evaluateScoreThreshold).toBeDefined();
  });

  it("supports a complete platform scoring workflow", () => {
    const weightedScore = calculateWeightedScore([
      WeightedScore.create(
        Score.create(90),
        Weight.fromPercentage(60),
      ),
      WeightedScore.create(
        Score.create(70),
        Weight.fromPercentage(40),
      ),
    ]);

    const normalized = normalizeScore(
      weightedScore,
      ScoreScale.ZERO_TO_TEN,
    );

    const level = mapConfidenceLevel(
      ConfidenceScore.create(weightedScore.value),
    );

    expect(weightedScore.value).toBe(82);
    expect(normalized.value).toBe(8.2);
    expect(level).toBe(ConfidenceLevel.VERY_HIGH);
  });
});
