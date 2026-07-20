import { describe, expect, it } from "vitest";

import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../../scoring";
import { DecisionRationale } from "./decision-rationale";

describe("DecisionRationale", () => {
  it("creates structured rationale", () => {
    const rationale = DecisionRationale.create({
      summary: "The property meets the acquisition threshold.",
      supportingReasons: [
        "Strong market demand.",
        "Healthy debt coverage.",
      ],
      assumptions: ["Current financing terms remain available."],
      risks: ["Local regulation may change."],
    });

    expect(rationale.summary).toBe(
      "The property meets the acquisition threshold.",
    );
    expect(rationale.supportingReasons).toHaveLength(2);
    expect(rationale.hasAssumptions()).toBe(true);
    expect(rationale.hasRisks()).toBe(true);
  });

  it("normalizes and deduplicates entries", () => {
    const rationale = DecisionRationale.create({
      summary: " Proceed. ",
      supportingReasons: [
        " Strong demand. ",
        "",
        "Strong demand.",
      ],
    });

    expect(rationale.summary).toBe("Proceed.");
    expect(rationale.supportingReasons).toEqual([
      "Strong demand.",
    ]);
  });

  it("retains a platform confidence assessment", () => {
    const confidence = ConfidenceAssessment.create({
      score: ConfidenceScore.create(84),
      level: ConfidenceLevel.VERY_HIGH,
      rationale: ["Strong evidence coverage."],
    });

    const rationale = DecisionRationale.create({
      summary: "Proceed.",
      confidence,
    });

    expect(rationale.confidence?.score.value).toBe(84);
    expect(rationale.confidence?.level).toBe(
      ConfidenceLevel.VERY_HIGH,
    );
    expect(rationale.confidence?.rationale).toEqual([
      "Strong evidence coverage.",
    ]);
  });

  it("supports omitted collections and confidence", () => {
    const rationale = DecisionRationale.create({
      summary: "Wait.",
    });

    expect(rationale.supportingReasons).toEqual([]);
    expect(rationale.assumptions).toEqual([]);
    expect(rationale.risks).toEqual([]);
    expect(rationale.confidence).toBeUndefined();
  });

  it("rejects an empty summary", () => {
    expect(() =>
      DecisionRationale.create({
        summary: " ",
      }),
    ).toThrow(
      "Decision rationale summary cannot be empty.",
    );
  });

  it("protects itself from source-array mutation", () => {
    const risks = ["Regulatory uncertainty."];

    const rationale = DecisionRationale.create({
      summary: "Proceed carefully.",
      risks,
    });

    risks.push("Later mutation.");

    expect(rationale.risks).toEqual([
      "Regulatory uncertainty.",
    ]);
  });

  it("compares by complete value", () => {
    const first = DecisionRationale.create({
      summary: "Proceed.",
      risks: ["Regulatory uncertainty."],
    });
    const second = DecisionRationale.create({
      summary: "Proceed.",
      risks: ["Regulatory uncertainty."],
    });

    expect(first.equals(second)).toBe(true);
  });
});
