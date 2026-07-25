import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
describe("PI-001G learning boundaries", () => {
  const builder = readFileSync(resolve("src/features/portfolio-intelligence/application/outcomes/build-outcomes.ts"), "utf8");
  const contracts = readFileSync(resolve("src/features/portfolio-intelligence/application/outcomes/contracts.ts"), "utf8");
  const migration = readFileSync(resolve("supabase/migrations/20260725180000_portfolio_outcomes_learning.sql"), "utf8");
  const presentation = readFileSync(resolve("src/features/portfolio-intelligence/presentation/portfolio-outcomes.tsx"), "utf8");
  it("adapts canonical Decision Outcome assessments and does not calculate metric variance", () => {
    expect(contracts).toContain("DecisionOutcomeAssessment");
    expect(builder).toContain("objective.variance");
    expect(builder).not.toContain("calculateVariance(");
  });
  it("keeps historical expectations and reviews immutable", () => {
    expect(contracts).toContain("immutable: true");
    expect(migration).toContain("portfolio_outcome_immutable");
    expect(migration).not.toMatch(/update public\\.portfolio_decision_outcome_reviews/i);
  });
  it("appends versioned knowledge with RLS and idempotent receipts", () => {
    expect(migration).toContain("portfolio_learning_records");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("portfolio_learning_command_receipts");
    expect(migration).toContain("payload_hash");
  });
  it("keeps outcome calculations out of presentation", () => {
    expect(presentation).not.toMatch(/calculateVariance|evaluateDecisionOutcome|\.from\(/);
  });
});
