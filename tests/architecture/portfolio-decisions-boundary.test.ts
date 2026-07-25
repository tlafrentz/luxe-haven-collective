import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PI-001F governance boundaries", () => {
  const builder = readFileSync(resolve("src/features/portfolio-intelligence/application/decisions/build-candidates.ts"), "utf8");
  const workflow = readFileSync(resolve("src/features/portfolio-intelligence/application/decisions/decision-workflow.ts"), "utf8");
  const handoff = readFileSync(resolve("src/features/portfolio-intelligence/application/decisions/action-center-handoff.ts"), "utf8");
  const page = readFileSync(resolve("src/app/(dashboard)/dashboard/portfolio/decisions/page.tsx"), "utf8");
  const migration = readFileSync(resolve("supabase/migrations/20260725173000_portfolio_recommendation_reviews.sql"), "utf8");
  it("consumes PI-001E findings and does not recreate risk or composition logic", () => {
    expect(builder).toContain("findings.prioritized");
    expect(builder).not.toMatch(/evaluatePortfolioRisk|evaluateConcentration|buildPortfolioProjection/);
  });
  it("creates canonical Platform Decisions only after human approval", () => {
    expect(workflow).toContain("Decision.create");
    expect(workflow).toContain("DecisionMode.HUMAN_APPROVED");
    expect(workflow).toContain('decision.status !== "approved"');
  });
  it("hands editable execution plans to canonical Action Center with lineage", () => {
    expect(handoff).toContain("PlatformActionProvider");
    expect(handoff).toContain('type: "decision"');
    expect(handoff).toContain("sourceFindingIds");
  });
  it("keeps presentation behind one application runtime", () => {
    expect(page).toContain("getPortfolioDecisionsRouteState");
    expect(page).not.toMatch(/Supabase|\.from\(|riskReductionPolicy/);
  });
  it("enforces RLS, owner approval, idempotency receipts, and optimistic concurrency", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("references public.owners(id)");
    expect(migration).toContain("role = 'owner'");
    expect(migration).toContain("portfolio_decision_command_receipts");
    expect(migration).toContain("payload_hash");
    expect(migration).toContain("errcode = '40001'");
  });
});
