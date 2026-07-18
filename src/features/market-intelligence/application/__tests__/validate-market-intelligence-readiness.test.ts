import { describe, expect, it } from "vitest";

import { validateMarketIntelligenceReadiness } from "../builders/validate-market-intelligence-readiness";
import { createMarketIntelligenceFixtures } from "./test-market-intelligence-fixtures";

describe("validateMarketIntelligenceReadiness", () => {
  it("marks complete evidence as decision-ready", () => {
    const fixtures = createMarketIntelligenceFixtures();

    const readiness =
      validateMarketIntelligenceReadiness(fixtures);

    expect(readiness.isDecisionReady).toBe(true);
    expect(readiness.blockingIssues).toEqual([]);
    expect(readiness.summary).toContain(
      "decision-ready",
    );
  });

  it("blocks readiness when comparable evidence is insufficient", () => {
    const fixtures = createMarketIntelligenceFixtures({
      comparableCount: 2,
    });

    const readiness =
      validateMarketIntelligenceReadiness(fixtures);

    expect(readiness.isDecisionReady).toBe(false);
    expect(
      readiness.blockingIssues.some(
        (issue) =>
          issue.code ===
          "insufficient-comparable-evidence",
      ),
    ).toBe(true);
  });

  it("blocks readiness when material confidence gaps remain", () => {
    const fixtures = createMarketIntelligenceFixtures({
      confidenceMissingData: ["Booking pace"],
    });

    const readiness =
      validateMarketIntelligenceReadiness(fixtures);

    expect(readiness.isDecisionReady).toBe(false);
    expect(
      readiness.blockingIssues.some(
        (issue) =>
          issue.code === "material-confidence-gaps",
      ),
    ).toBe(true);
  });

  it("surfaces warnings without blocking an otherwise ready report", () => {
    const fixtures = createMarketIntelligenceFixtures({
      demandMissingInformation: ["Booking pace"],
      trendConflicts: ["Occupancy is declining."],
    });

    const readiness =
      validateMarketIntelligenceReadiness(fixtures);

    expect(readiness.isDecisionReady).toBe(true);
    expect(readiness.warnings.length).toBeGreaterThan(0);
  });
});
