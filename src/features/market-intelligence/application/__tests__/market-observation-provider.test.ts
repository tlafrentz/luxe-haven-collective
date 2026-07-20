import {
  describe,
  expect,
  it,
} from "vitest";

import {
  MarketAnalysisReport,
} from "../../domain/entities/market-analysis-report";

import {
  MarketObservationProvider,
} from "../providers/market-observation-provider";

import {
  MARKET_OBSERVATION_CAPABILITY,
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

import {
  createMarketAnalysisReport,
} from "./market-observation-test-fixtures";

describe("MarketObservationProvider", () => {
  it("combines market analysis observations", () => {
    const provider =
      new MarketObservationProvider();

    const observations =
      provider.build(
        createMarketAnalysisReport(),
      );

    expect(provider.capability).toBe(
      MARKET_OBSERVATION_CAPABILITY,
    );

    expect(observations.size).toBe(18);

    expect(
      observations
        .ofType(
          MARKET_OBSERVATION_TYPES
            .estimatedValue,
        )
        .size,
    ).toBe(1);

    expect(
      observations
        .ofType(
          MARKET_OBSERVATION_TYPES.summary,
        )
        .size,
    ).toBe(1);
  });

  it("supports reports without findings or evidence", () => {
    const provider =
      new MarketObservationProvider();

    const report =
      createMarketAnalysisReport();

    const reportWithoutFindingsOrEvidence =
      new MarketAnalysisReport({
        analysis: report.analysis,
        valuation: report.valuation,
        summary: report.summary,
        findings: [],
        evidence: [],
        generatedAt: report.generatedAt,
      });

    const observations =
      provider.build(
        reportWithoutFindingsOrEvidence,
      );

    expect(observations.size).toBe(14);

    expect(
      observations
        .ofType(
          MARKET_OBSERVATION_TYPES
            .findingStrength,
        )
        .size,
    ).toBe(0);

    expect(
      observations
        .ofType(
          MARKET_OBSERVATION_TYPES
            .findingRisk,
        )
        .size,
    ).toBe(0);

    expect(
      observations
        .ofType(
          MARKET_OBSERVATION_TYPES
            .evidenceSubjectProperty,
        )
        .size,
    ).toBe(0);

    expect(
      observations
        .ofType(
          MARKET_OBSERVATION_TYPES
            .evidenceProvider,
        )
        .size,
    ).toBe(0);

    expect(
      observations
        .ofType(
          MARKET_OBSERVATION_TYPES.summary,
        )
        .size,
    ).toBe(1);
  });
});
