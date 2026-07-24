import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(process.cwd(), "src/features/learning-intelligence/recommendation-effectiveness");
const files = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(path.join(directory, entry.name)) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path.join(directory, entry.name)] : [],
);
const source = (directory: string) => files(directory).map(file => fs.readFileSync(file, "utf8")).join("\n");

describe("LI-003 Recommendation Effectiveness architecture", () => {
  const domain = source(path.join(root, "domain"));

  it("keeps aggregation deterministic and free of UI, infrastructure, providers, clocks, randomness, and environment", () => {
    expect(domain).not.toMatch(/react|next\/|supabase|from\s+["'][^"']*infrastructure|process\.env|Date\.now|new Date\(\)|Math\.random|provider DTO/i);
  });
  it("consumes LI-002 classifications without recalculating outcomes or variance", () => {
    expect(domain).toMatch(/\.\.\/\.\.\/decision-outcomes/);
    expect(domain).not.toMatch(/calculateVariance|evaluateDecisionOutcome\(|compareTarget|ObjectiveAssessment/);
  });
  it("does not generate recommendations, adjust policy, create actions or learning, or mutate upstream state", () => {
    expect(domain).not.toMatch(/generateRecommendation|adjustRecommendation|modifyPolicy|createAction|generateLearning|mutateOutcome|mutateDecision|mutatePortfolio/i);
  });
  it("keeps effectiveness concepts out of Platform Kernel, LI-001, and LI-002", () => {
    const upstream = [
      source(path.join(process.cwd(), "src/platform/kernel")),
      source(path.join(process.cwd(), "src/features/learning-intelligence/outcomes/domain")),
      source(path.join(process.cwd(), "src/features/learning-intelligence/decision-outcomes/domain")),
    ].join("\n");
    expect(upstream).not.toMatch(/RecommendationEffectivenessAssessment|RecommendationRepeatabilityAssessment|RecommendationLearningReadiness/);
  });
});
