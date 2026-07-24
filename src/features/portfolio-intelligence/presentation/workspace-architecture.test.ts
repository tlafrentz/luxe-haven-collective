import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const presentation = readFileSync(new URL("./portfolio-workspace.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../app/(dashboard)/dashboard/portfolio/page.tsx", import.meta.url), "utf8");
const contracts = readFileSync(new URL("../application/workspace/contracts.ts", import.meta.url), "utf8");

describe("Portfolio workspace architecture", () => {
  it("keeps infrastructure and assessment engines out of presentation", () => {
    expect(presentation).not.toMatch(/supabase|evaluatePortfolioHealth|evaluateCapitalAllocation|PortfolioRepository|process\.env/);
    expect(page).not.toMatch(/supabase|Repository|evaluatePortfolioHealth|evaluateCapitalAllocation/);
  });

  it("uses bounded projections with no persistence or provider rows", () => {
    expect(contracts).toContain("PORTFOLIO_WORKSPACE_LIMITS");
    expect(contracts).not.toMatch(/Supabase|PersistenceRow|ProviderDto/);
    expect(presentation).not.toContain("snapshotFingerprint");
  });

  it("does not expose mutation, Action, recommendation, or execution controls", () => {
    expect(presentation).not.toMatch(/createAction|dispatchCommand|approveAcquisition|mutatePortfolio/);
    expect(presentation).toContain("assessment—not an approval or execution command");
  });
});
