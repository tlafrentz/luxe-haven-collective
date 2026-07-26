import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("FI-001B Financial Overview boundary", () => {
  const page = readFileSync(resolve("src/app/(dashboard)/dashboard/financial/page.tsx"), "utf8");
  const presentation = readFileSync(resolve("src/features/financial-intelligence/presentation/financial-overview.tsx"), "utf8");
  const builder = readFileSync(resolve("src/features/financial-intelligence/application/overview/build-financial-overview.ts"), "utf8");
  it("uses one application route boundary without presentation repositories or SQL", () => {
    expect(page).toContain("getFinancialOverviewRouteState");
    expect(page).not.toMatch(/Supabase|Repository|select\(|from\("/);
    expect(presentation).not.toMatch(/Supabase|Repository|select\(|from\("/);
  });
  it("consumes the canonical Financial Read Model without querying bookings or providers", () => {
    expect(builder).toContain("FinancialReadModel");
    expect(builder).not.toMatch(/bookings|@supabase|createClient/);
  });
  it("does not create recommendations, accounting entries, or duplicate workflows", () => {
    expect(builder).not.toMatch(/createRecommendation|createDecision|createAction|journalEntry/i);
  });
});
