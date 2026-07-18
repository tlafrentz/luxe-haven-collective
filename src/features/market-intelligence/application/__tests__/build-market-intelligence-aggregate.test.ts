import { describe, expect, it } from "vitest";

import { MarketScore } from "../../domain/value-objects/market-score";
import { buildMarketIntelligenceAggregate } from "../builders/build-market-intelligence-aggregate";
import { createMarketIntelligenceFixtures } from "./test-market-intelligence-fixtures";

describe("buildMarketIntelligenceAggregate", () => {
  it("assembles the complete market intelligence aggregate", () => {
    const fixtures = createMarketIntelligenceFixtures();

    const result = buildMarketIntelligenceAggregate({
      reportId: "market-report-001",
      marketName: "Downtown Mesa",
      generatedAt: new Date("2026-07-18T12:00:00.000Z"),
      ...fixtures,
    });

    expect(result.aggregate.reportId).toBe(
      "market-report-001",
    );
    expect(result.aggregate.marketName).toBe(
      "Downtown Mesa",
    );
    expect(result.aggregate.overallMarketScore.value).toBeGreaterThan(
      0,
    );
    expect(result.aggregate.isDecisionReady).toBe(true);
    expect(result.readiness.isDecisionReady).toBe(true);
  });

  it("preserves an explicit overall market score", () => {
    const fixtures = createMarketIntelligenceFixtures();

    const result = buildMarketIntelligenceAggregate({
      reportId: "market-report-002",
      marketName: "Mesa",
      ...fixtures,
      overallMarketScore: MarketScore.create(91),
    });

    expect(result.aggregate.overallMarketScore.value).toBe(
      91,
    );
  });

  it("returns readiness diagnostics with the aggregate", () => {
    const fixtures = createMarketIntelligenceFixtures({
      comparableCount: 1,
      confidenceMissingData: ["Supply growth"],
    });

    const result = buildMarketIntelligenceAggregate({
      reportId: "market-report-003",
      marketName: "Mesa",
      ...fixtures,
    });

    expect(result.readiness.isDecisionReady).toBe(false);
    expect(result.readiness.blockingIssues.length).toBeGreaterThan(
      0,
    );
    expect(result.aggregate.isDecisionReady).toBe(false);
  });
});
