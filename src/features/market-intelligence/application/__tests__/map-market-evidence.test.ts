import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapMarketEvidence,
} from "../mappers/map-market-evidence";

import {
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

import {
  createMarketAnalysisReport,
  GENERATED_AT,
} from "./market-observation-test-fixtures";

describe("mapMarketEvidence", () => {
  it("maps evidence and preserves source traceability", () => {
    const report =
      createMarketAnalysisReport();

    const observations =
      mapMarketEvidence(
        report.evidence,
        report.analysis.subject,
        report.generatedAt,
        GENERATED_AT,
      );

    expect(observations).toHaveLength(2);

    const provider =
      observations.find(
        (observation) =>
          observation.type ===
          MARKET_OBSERVATION_TYPES
            .evidenceProvider,
      );

    expect(provider?.value).toBe(
      "RentCast",
    );
    expect(
      provider?.source.referenceId,
    ).toBe("rentcast");
  });
});
