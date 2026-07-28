import { describe, expect, it } from "vitest";
import { canSaveCanonicalAnalysis, classifyInvestmentWorkspaceFailure } from "./workspace-lifecycle";

describe("investment workspace lifecycle", () => {
  it.each([
    ["INVALID_INPUT", "validation"],
    ["MARKET_INTELLIGENCE_UNAVAILABLE", "provider"],
    ["AUTHORIZATION_FAILED", "authorization"],
    ["PERSISTENCE_FAILED", "persistence"],
    ["CONCURRENCY_CONFLICT", "concurrency"],
    ["SAVE_TOKEN_EXPIRED", "expired-save-token"],
    ["UNEXPECTED", "unknown"],
  ] as const)("classifies %s as %s", (code, expected) => {
    expect(classifyInvestmentWorkspaceFailure(code)).toBe(expected);
  });

  it("allows saving only a successful, unexpired canonical analysis", () => {
    const analysis = { expiresAt: new Date("2026-07-28T01:00:00.000Z") };
    expect(canSaveCanonicalAnalysis({ status: "succeeded", analysis }, new Date("2026-07-28T00:00:00.000Z"), value => value.expiresAt)).toBe(true);
    expect(canSaveCanonicalAnalysis<typeof analysis>({ status: "ready" }, new Date("2026-07-28T00:00:00.000Z"), value => value.expiresAt)).toBe(false);
    expect(canSaveCanonicalAnalysis({ status: "succeeded", analysis }, new Date("2026-07-28T02:00:00.000Z"), value => value.expiresAt)).toBe(false);
  });
});
