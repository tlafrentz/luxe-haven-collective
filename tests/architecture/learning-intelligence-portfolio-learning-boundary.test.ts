import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(process.cwd(), "src/features/learning-intelligence/portfolio-learning");
const files = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? files(path.join(directory, entry.name)) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path.join(directory, entry.name)] : [],
);
const source = (directory: string) => files(directory).map(file => fs.readFileSync(file, "utf8")).join("\n");

describe("LI-004 Portfolio Learning architecture", () => {
  const domain = source(path.join(root, "domain"));
  it("keeps the pure engine free of UI, infrastructure, providers, clocks, randomness, environment, LLMs, and ML", () => {
    expect(domain).not.toMatch(/react|next\/|supabase|from\s+["'][^"']*infrastructure|process\.env|Date\.now|new Date\(\)|Math\.random|provider DTO|openai|langchain|tensorflow|machine-learning/i);
  });
  it("consumes LI-002 and LI-003 public contracts without recalculating authoritative conclusions", () => {
    expect(domain).toMatch(/\.\.\/\.\.\/decision-outcomes/);
    expect(domain).toMatch(/\.\.\/\.\.\/recommendation-effectiveness/);
    expect(domain).not.toMatch(/evaluateDecisionOutcome\(|evaluateRecommendationEffectiveness\(|compareTarget|classify\(outcome/);
  });
  it("does not generate recommendations, modify policy, create Actions, or mutate upstream aggregates", () => {
    expect(domain).not.toMatch(/generateRecommendation|modifyPolicy|adjustRecommendation|createAction|mutateDecision|mutateOutcome|mutateAction|mutatePortfolio|mutateInvestment|mutateAcquisition/i);
  });
  it("uses Platform primitives and does not leak Portfolio Learning into upstream domains", () => {
    expect(domain).toMatch(/@\/platform\/kernel/);
    expect(domain).toMatch(/@\/platform\/scoring/);
    const upstream = [
      source(path.join(process.cwd(), "src/platform/kernel")),
      source(path.join(process.cwd(), "src/features/learning-intelligence/outcomes/domain")),
      source(path.join(process.cwd(), "src/features/learning-intelligence/decision-outcomes/domain")),
      source(path.join(process.cwd(), "src/features/learning-intelligence/recommendation-effectiveness/domain")),
    ].join("\n");
    expect(upstream).not.toMatch(/PortfolioLearningAssessment|PortfolioLearningPatternCandidate|PortfolioLearningMaturity/);
  });
});
