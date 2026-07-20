import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapMarketValuation,
} from "../mappers/map-market-valuation";

import {
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

import {
  createComparableSubject,
  createMarketValuation,
  GENERATED_AT,
} from "./market-observation-test-fixtures";

describe("mapMarketValuation", () => {
  it("maps value range and confidence metrics", () => {
    const observations =
      mapMarketValuation(
        createMarketValuation(),
        createComparableSubject(),
        GENERATED_AT,
      );

    expect(observations).toHaveLength(9);

    const estimated =
      observations.find(
        (observation) =>
          observation.type ===
          MARKET_OBSERVATION_TYPES
            .estimatedValue,
      );

    expect(estimated?.value).toBe(
      410000,
    );
    expect(estimated?.unit?.type).toBe(
      "currency",
    );

    const confidence =
      observations.find(
        (observation) =>
          observation.type ===
          MARKET_OBSERVATION_TYPES
            .valuationConfidence,
      );

    expect(confidence?.value).toBe(82);
    expect(
      confidence?.metadata,
    ).toMatchObject({
      confidenceLevel: "high",
      excludedComparableCount: 1,
    });
  });
});
