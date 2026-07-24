import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Continuous Improvement presentation boundary", () => {
  const source = readFileSync(new URL("./continuous-improvement-workspace.tsx", import.meta.url), "utf8");
  it("does not import engines, aggregates, persistence, providers, or Supabase", () => {
    expect(source).not.toMatch(/evaluate-decision|evaluate-recommendation|evaluate-portfolio|outcome\.ts|repository|supabase|provider DTO/i);
  });
  it("does not classify, aggregate, or calculate variance in React", () => {
    expect(source).not.toMatch(/varianceSummary|buildDistribution|classification\s*=(?!=)|aggregateRecommendation|detectPattern|calculateMaturity/i);
  });
});
