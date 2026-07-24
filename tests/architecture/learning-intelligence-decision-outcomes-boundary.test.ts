import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(process.cwd(), "src/features/learning-intelligence/decision-outcomes");
const files = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(path.join(directory, entry.name)) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path.join(directory, entry.name)] : [],
);
const source = (directory: string) => files(directory).map(file => fs.readFileSync(file, "utf8")).join("\n");

describe("LI-002 Decision Outcome architecture", () => {
  const domain = source(path.join(root, "domain"));

  it("keeps evaluation deterministic and independent from UI, persistence, providers, clocks, and environment", () => {
    expect(domain).not.toMatch(/react|next\/|supabase|from\s+["'][^"']*infrastructure|process\.env|Date\.now|new Date\(\)|Math\.random|provider DTO/i);
  });

  it("does not generate recommendations, learnings, forecasts, causal claims, or mutate source aggregates", () => {
    expect(domain).not.toMatch(/generateRecommendation|generateLearning|forecast|inferCaus|mutateOutcome|mutateDecision|mutateAction|mutatePortfolio/i);
  });

  it("depends only on public LI-001 and Platform primitives", () => {
    expect(domain).toMatch(/\.\.\/\.\.\/outcomes/);
    expect(domain).toMatch(/@\/platform\/kernel/);
    expect(domain).toMatch(/@\/platform\/scoring/);
    expect(domain).not.toMatch(/outcomes\/infrastructure|outcomes\/application/);
  });

  it("keeps assessment-specific concepts out of Platform Kernel and LI-001", () => {
    const kernel = source(path.join(process.cwd(), "src/platform/kernel"));
    const outcomes = source(path.join(process.cwd(), "src/features/learning-intelligence/outcomes/domain"));
    expect(kernel).not.toMatch(/DecisionOutcomeAssessment|OutcomeClassification|LearningReadiness/);
    expect(outcomes).not.toMatch(/DecisionOutcomeAssessment|OutcomeClassification|LearningReadiness/);
  });
});
