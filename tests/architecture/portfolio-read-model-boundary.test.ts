import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PI-001A Portfolio read boundary", () => {
  const domain = readFileSync(resolve("src/features/portfolio/domain/read-model.ts"), "utf8");
  const application = readFileSync(resolve("src/features/portfolio/application/read-model.ts"), "utf8");

  it("keeps the projection free of persistence, presentation, and interpretation", () => {
    expect(domain).not.toMatch(/@supabase|components|presentation|recommendation|ranking|score:/i);
    expect(application).not.toMatch(/@supabase|components|presentation|sql/i);
  });

  it("exposes one canonical projection and computed repository operations", () => {
    expect(domain).toContain("export type PortfolioProjection");
    expect(application).toContain("buildPortfolioProjection");
    expect(application).toContain("getPortfolioProjection");
  });
});
