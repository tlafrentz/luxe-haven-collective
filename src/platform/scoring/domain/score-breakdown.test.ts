import { describe, expect, it } from "vitest";

import { Score } from "./score";
import { ScoreBreakdown } from "./score-breakdown";
import { ScoreComponent } from "./score-component";
import { ScoreScale } from "./score-scale";
import { Weight } from "./weight";

function createComponent(
  key: string,
  score: number,
  weightPercentage: number,
): ScoreComponent {
  return ScoreComponent.create({
    key,
    label: key,
    score: Score.create(score),
    weight: Weight.fromPercentage(weightPercentage),
  });
}

describe("ScoreBreakdown", () => {
  it("calculates a composite weighted score", () => {
    const breakdown = ScoreBreakdown.create({
      key: "investment-score",
      label: "Investment Score",
      components: [
        createComponent("market", 90, 40),
        createComponent("revenue", 80, 35),
        createComponent("risk", 70, 25),
      ],
    });

    expect(breakdown.score.value).toBe(81.5);
    expect(breakdown.totalWeightPercentage).toBe(100);
  });

  it("preserves component order", () => {
    const breakdown = ScoreBreakdown.create({
      key: "investment-score",
      label: "Investment Score",
      components: [
        createComponent("market", 90, 50),
        createComponent("risk", 70, 50),
      ],
    });

    expect(
      breakdown.components.map((component) => component.key),
    ).toEqual(["market", "risk"]);
  });

  it("finds a component by key", () => {
    const market = createComponent("market", 90, 50);
    const breakdown = ScoreBreakdown.create({
      key: "investment-score",
      label: "Investment Score",
      components: [
        market,
        createComponent("risk", 70, 50),
      ],
    });

    expect(breakdown.getComponent("market")?.equals(market)).toBe(
      true,
    );
    expect(breakdown.getComponent("missing")).toBeUndefined();
  });

  it("supports non-zero minimum score scales", () => {
    const scale = ScoreScale.create(1, 5);
    const breakdown = ScoreBreakdown.create({
      key: "quality",
      label: "Quality",
      components: [
        ScoreComponent.create({
          key: "experience",
          label: "Experience",
          score: Score.create(5, scale),
          weight: Weight.fromPercentage(50),
        }),
        ScoreComponent.create({
          key: "service",
          label: "Service",
          score: Score.create(3, scale),
          weight: Weight.fromPercentage(50),
        }),
      ],
    });

    expect(breakdown.score.value).toBe(4);
    expect(breakdown.score.scale.equals(scale)).toBe(true);
  });

  it("rejects an empty component collection", () => {
    expect(() =>
      ScoreBreakdown.create({
        key: "investment-score",
        label: "Investment Score",
        components: [],
      }),
    ).toThrow(
      "Score breakdown requires at least one component.",
    );
  });

  it("rejects duplicate component keys", () => {
    expect(() =>
      ScoreBreakdown.create({
        key: "investment-score",
        label: "Investment Score",
        components: [
          createComponent("market", 90, 50),
          createComponent("market", 70, 50),
        ],
      }),
    ).toThrow(
      'Score breakdown component key "market" is duplicated.',
    );
  });

  it("rejects components with different scales", () => {
    expect(() =>
      ScoreBreakdown.create({
        key: "investment-score",
        label: "Investment Score",
        components: [
          createComponent("market", 90, 50),
          ScoreComponent.create({
            key: "rating",
            label: "Rating",
            score: Score.create(
              4,
              ScoreScale.ZERO_TO_FIVE,
            ),
            weight: Weight.fromPercentage(50),
          }),
        ],
      }),
    ).toThrow(
      "Score breakdown components must use the same score scale.",
    );
  });

  it("rejects weights below one hundred percent", () => {
    expect(() =>
      ScoreBreakdown.create({
        key: "investment-score",
        label: "Investment Score",
        components: [
          createComponent("market", 90, 40),
          createComponent("risk", 70, 40),
        ],
      }),
    ).toThrow(
      "Score breakdown component weights must total 100%.",
    );
  });

  it("rejects weights above one hundred percent", () => {
    expect(() =>
      ScoreBreakdown.create({
        key: "investment-score",
        label: "Investment Score",
        components: [
          createComponent("market", 90, 60),
          createComponent("risk", 70, 60),
        ],
      }),
    ).toThrow(
      "Score breakdown component weights must total 100%.",
    );
  });

  it("compares complete breakdowns by value", () => {
    const first = ScoreBreakdown.create({
      key: "investment-score",
      label: "Investment Score",
      components: [
        createComponent("market", 90, 50),
        createComponent("risk", 70, 50),
      ],
    });
    const second = ScoreBreakdown.create({
      key: "investment-score",
      label: "Investment Score",
      components: [
        createComponent("market", 90, 50),
        createComponent("risk", 70, 50),
      ],
    });

    expect(first.equals(second)).toBe(true);
  });

  it("protects itself from later source-array mutation", () => {
    const components = [
      createComponent("market", 90, 50),
      createComponent("risk", 70, 50),
    ];

    const breakdown = ScoreBreakdown.create({
      key: "investment-score",
      label: "Investment Score",
      components,
    });

    components.pop();

    expect(breakdown.components).toHaveLength(2);
  });

  it("rejects an empty key or label", () => {
    const components = [
      createComponent("market", 90, 50),
      createComponent("risk", 70, 50),
    ];

    expect(() =>
      ScoreBreakdown.create({
        key: " ",
        label: "Investment Score",
        components,
      }),
    ).toThrow("Score breakdown key cannot be empty.");

    expect(() =>
      ScoreBreakdown.create({
        key: "investment-score",
        label: " ",
        components,
      }),
    ).toThrow("Score breakdown label cannot be empty.");
  });
});
