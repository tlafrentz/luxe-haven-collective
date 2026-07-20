import { describe, expect, it } from "vitest";

import { Score } from "./score";
import { Weight } from "./weight";
import { ScoreComponent } from "./score-component";

describe("ScoreComponent", () => {
  it("creates a named weighted score component", () => {
    const component = ScoreComponent.create({
      key: "market-strength",
      label: "Market Strength",
      description: "Demand and competitive position.",
      score: Score.create(88),
      weight: Weight.fromPercentage(35),
    });

    expect(component.key).toBe("market-strength");
    expect(component.label).toBe("Market Strength");
    expect(component.description).toBe(
      "Demand and competitive position.",
    );
    expect(component.score.value).toBe(88);
    expect(component.weight.percentage).toBe(35);
  });

  it("trims key, label, and description", () => {
    const component = ScoreComponent.create({
      key: "  market-strength  ",
      label: "  Market Strength  ",
      description: "  Strong demand.  ",
      score: Score.create(88),
      weight: Weight.fromPercentage(35),
    });

    expect(component.key).toBe("market-strength");
    expect(component.label).toBe("Market Strength");
    expect(component.description).toBe("Strong demand.");
  });

  it("omits an empty description", () => {
    const component = ScoreComponent.create({
      key: "market-strength",
      label: "Market Strength",
      description: "   ",
      score: Score.create(88),
      weight: Weight.fromPercentage(35),
    });

    expect(component.description).toBeUndefined();
  });

  it("rejects an empty key", () => {
    expect(() =>
      ScoreComponent.create({
        key: "   ",
        label: "Market Strength",
        score: Score.create(88),
        weight: Weight.fromPercentage(35),
      }),
    ).toThrow("Score component key cannot be empty.");
  });

  it("rejects an empty label", () => {
    expect(() =>
      ScoreComponent.create({
        key: "market-strength",
        label: "   ",
        score: Score.create(88),
        weight: Weight.fromPercentage(35),
      }),
    ).toThrow("Score component label cannot be empty.");
  });

  it("exposes its weighted score", () => {
    const component = ScoreComponent.create({
      key: "market-strength",
      label: "Market Strength",
      score: Score.create(80),
      weight: Weight.fromPercentage(25),
    });

    expect(component.weightedScore.contribution).toBe(20);
  });

  it("compares by complete value", () => {
    const first = ScoreComponent.create({
      key: "market-strength",
      label: "Market Strength",
      score: Score.create(80),
      weight: Weight.fromPercentage(25),
    });
    const second = ScoreComponent.create({
      key: "market-strength",
      label: "Market Strength",
      score: Score.create(80),
      weight: Weight.fromPercentage(25),
    });

    expect(first.equals(second)).toBe(true);
  });
});
