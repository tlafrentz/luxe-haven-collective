import { describe, expect, it } from "vitest";
import { hpmContextSearch, parseHpmWorkspaceQuery } from "./hpm-workspace-context";

describe("HPM workspace URL context", () => {
  it("validates scope, dates, filters, and cursor server-side", () => {
    const value = parseHpmWorkspaceQuery({ scopeId: "property-1", from: "2026-07-01", to: "2026-08-01", stage: "execute,invalid,learn", classification: "blocked,overdue,unknown", cursor: "safe_cursor" }, new Date("2026-08-09T12:00:00Z"));
    expect(value).toMatchObject({ scopeType: "property", scopeId: "property-1", from: "2026-07-01", to: "2026-08-01", stages: ["execute", "learn"], classifications: ["blocked", "overdue"], cursor: "safe_cursor" });
  });

  it("applies canonical defaults and excludes unsafe state", () => {
    const value = parseHpmWorkspaceQuery({ scopeId: "../../foreign", from: "bad", asOf: "token" }, new Date("2026-08-09T12:00:00Z"));
    expect(value.scopeType).toBe("portfolio");
    expect(value.scopeId).toBeUndefined();
    expect(value.from).toBe("2026-07-10");
    expect(value.to).toBe("2026-08-09");
    expect(value.asOf).toBe("2026-08-09T23:59:59.999Z");
  });

  it("round-trips only safe shareable state", () => {
    const value = parseHpmWorkspaceQuery({ scopeId: "property-1", stage: "see", classification: "required-review" }, new Date("2026-08-09T12:00:00Z"));
    const search = hpmContextSearch(value);
    expect(search).toContain("scope=property");
    expect(search).toContain("scopeId=property-1");
    expect(search).not.toMatch(/token|note|payload/);
  });
});
