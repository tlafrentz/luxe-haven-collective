import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapMarketFindings,
} from "../mappers/map-market-findings";

import {
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

import {
  createMarketAnalysisReport,
  GENERATED_AT,
} from "./market-observation-test-fixtures";

describe("mapMarketFindings", () => {
  it("maps findings by semantic type", () => {
    const report =
      createMarketAnalysisReport();

    const observations =
      mapMarketFindings(
        report.findings,
        report.analysis.subject,
        report.generatedAt,
        GENERATED_AT,
      );

    expect(observations).toHaveLength(2);

    expect(
      observations.some(
        (observation) =>
          observation.type ===
          MARKET_OBSERVATION_TYPES
            .findingStrength,
      ),
    ).toBe(true);

    expect(
      observations.some(
        (observation) =>
          observation.type ===
          MARKET_OBSERVATION_TYPES
            .findingRisk,
      ),
    ).toBe(true);
  });
});
