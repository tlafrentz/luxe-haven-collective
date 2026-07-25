import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PI-001B Portfolio Overview boundary", () => {
  const page = readFileSync(resolve("src/app/(dashboard)/dashboard/portfolio/page.tsx"), "utf8");
  const presentation = readFileSync(resolve("src/features/portfolio-intelligence/presentation/portfolio-overview.tsx"), "utf8");
  const policy = readFileSync(resolve("src/features/portfolio-intelligence/application/overview/policies.ts"), "utf8");
  it("uses one application route boundary without presentation repositories or SQL", () => {
    expect(page).toContain("getPortfolioOverviewRouteState");
    expect(page).not.toMatch(/Supabase|Repository|from\("|select\(/);
    expect(presentation).not.toMatch(/Supabase|Repository/);
  });
  it("centralizes materiality thresholds outside presentation", () => {
    expect(policy).toContain("PORTFOLIO_OVERVIEW_POLICY");
    expect(presentation).not.toMatch(/materialRevenue|severeRevenue|minimumComparison/);
  });
  it("does not reimplement executive ranking or recommendations", () => {
    expect(presentation).not.toMatch(/Executive Intelligence|recommendation engine|rank score/i);
  });
});
