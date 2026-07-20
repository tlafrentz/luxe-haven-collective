import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapMarketSummary,
} from "../mappers/map-market-summary";

import {
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

import {
  createMarketAnalysisReport,
  GENERATED_AT,
} from "./market-observation-test-fixtures";

describe("mapMarketSummary", () => {
  it("maps the executive market summary", () => {
    const report =
      createMarketAnalysisReport();

    const observations =
      mapMarketSummary(
        report,
        GENERATED_AT,
      );

    expect(observations).toHaveLength(1);
    expect(observations[0]?.type).toBe(
      MARKET_OBSERVATION_TYPES.summary,
    );
    expect(observations[0]?.value).toBe(
      report.summary,
    );
    expect(
      observations[0]?.metadata,
    ).toMatchObject({
      confidenceScore: 82,
      confidenceLevel: "high",
      riskCount: 1,
      dataGapCount: 0,
    });
  });
});
