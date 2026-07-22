import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/app/actions/investment-workspace.ts", "utf8");

describe("Investment workspace server boundary security", () => {
  it("authorizes before validation, configuration, and provider construction", () => {
    const authorization = source.indexOf("await requireRole");
    expect(authorization).toBeGreaterThan(0);
    expect(authorization).toBeLessThan(source.indexOf("investmentWorkspaceActionSchema.safeParse"));
    expect(authorization).toBeLessThan(source.indexOf("getMarketIntelligenceConfig()"));
    expect(authorization).toBeLessThan(source.indexOf("new RentCastClient"));
  });

  it("uses authenticated identity and does not accept a client actor", () => {
    expect(source).toContain("requestedBy: user.id");
    expect(source).not.toMatch(/input\.actor|input\.userId|clientActor/);
  });

  it("does not access environment variables outside the typed configuration boundary", () => {
    expect(source).not.toContain("process.env");
  });

  it("returns safe errors rather than stack traces", () => {
    expect(source).not.toMatch(/\.stack|cause:/);
    expect(source).toContain("safeError(error)");
  });
});
