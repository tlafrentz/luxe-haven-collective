import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const presentation = readFileSync(new URL("./portfolio-dashboard.tsx", import.meta.url), "utf8");
const mapper = readFileSync(new URL("../application/dashboard/build-portfolio-intelligence-dashboard.ts", import.meta.url), "utf8");
const query = readFileSync(new URL("../application/dashboard/get-portfolio-intelligence-dashboard.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../../../app/(dashboard)/dashboard/portfolio/page.tsx", import.meta.url), "utf8");

describe("Portfolio Intelligence dashboard architecture", () => {
  it("keeps engines, aggregates, repositories, providers, and Supabase out of presentation", () => {
    expect(presentation).not.toMatch(/evaluatePortfolioHealth|evaluateCapitalAllocation|evaluatePortfolioRecommendations|PortfolioRepository|Supabase|ProviderDto|Portfolio aggregate/i);
    expect(page).not.toMatch(/Repository|Supabase|evaluatePortfolio/);
  });

  it("performs no scoring, deployable-capital arithmetic, ranking, or recommendation generation in React", () => {
    expect(presentation).not.toMatch(/Score\.create|deployable\s*=(?!=)|\.sort\(|recommendations\.push|rankingScore|calculateWeighted/);
    expect(presentation).toContain("Advisory only");
    expect(presentation).not.toMatch(/createAction|dispatchCommand|approveAcquisition|mutatePortfolio/);
  });

  it("uses one centralized owner-scoped query with bounded source hydration", () => {
    expect(query).toContain("authorizer.authorize");
    expect(query.indexOf("authorizer.authorize")).toBeLessThan(query.indexOf("reader.read"));
    expect(query).toContain("PORTFOLIO_DASHBOARD_LIMITS.subjectReferences");
    expect(mapper).toContain("PORTFOLIO_DASHBOARD_LIMITS");
  });

  it("serializes no fingerprints, policy objects, persistence rows, or evidence bodies", () => {
    expect(presentation).not.toContain("snapshotFingerprint");
    expect(mapper).not.toMatch(/snapshotFingerprint:\s|policy:\s|PersistenceRow|evidence:\s/);
  });
});
