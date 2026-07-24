import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Learning dashboard presentation boundary", () => {
  const source = readFileSync(new URL("./learning-intelligence-dashboard.tsx", import.meta.url), "utf8");
  it("imports no engines, aggregates, persistence, providers, or Supabase", () => {
    expect(source).not.toMatch(/evaluate-decision|evaluate-recommendation|evaluate-portfolio|repository|supabase|provider DTO|OutcomeAggregate/i);
  });
  it("performs no Outcome classification, recommendation evaluation, or learning detection", () => {
    expect(source).not.toMatch(/buildDistribution|calculateVariance|classifyOutcome|aggregateRecommendation|detectPattern|calculateMaturity|learningHealth\s*\(/i);
  });
});
