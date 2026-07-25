import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
describe("PI-001C property comparison boundary", () => {
  const page = readFileSync(resolve("src/app/(dashboard)/dashboard/portfolio/properties/page.tsx"),"utf8");
  const presentation = readFileSync(resolve("src/features/portfolio-intelligence/presentation/portfolio-property-comparison.tsx"),"utf8");
  const overview = readFileSync(resolve("src/features/portfolio-intelligence/application/overview/build-portfolio-overview.ts"),"utf8");
  it("uses one application route boundary and no presentation data repositories", () => {
    expect(page).toContain("getPortfolioPropertyComparisonRouteState");
    expect(page).not.toMatch(/Supabase|Repository|select\(|from\("/);
    expect(presentation).not.toMatch(/Supabase|Repository/);
  });
  it("keeps recommendations, decisions, concentration, risk, and universal scores out", () => {
    expect(presentation).not.toMatch(/Best Property|Worst Property|health score|risk score/i);
    expect(presentation).toContain("do not create recommendations or decisions");
  });
  it("makes Portfolio Overview consume the PI-001C contribution builder", () => {
    expect(overview).toContain("buildPortfolioPropertyComparison");
    expect(overview).not.toMatch(/revenueChange = revenue/);
  });
});
