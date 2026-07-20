import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapComparableAnalysis,
} from "../mappers/map-comparable-analysis";

import {
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

import {
  createComparableAnalysis,
  GENERATED_AT,
} from "./market-observation-test-fixtures";

describe("mapComparableAnalysis", () => {
  it("maps comparable analysis metrics", () => {
    const observations =
      mapComparableAnalysis(
        createComparableAnalysis(),
        GENERATED_AT,
      );

    expect(observations).toHaveLength(4);

    const count =
      observations.find(
        (observation) =>
          observation.type ===
          MARKET_OBSERVATION_TYPES
            .comparableCount,
      );

    expect(count?.value).toBe(2);
    expect(count?.unit?.type).toBe(
      "count",
    );
    expect(
      count?.concerns(
        "property",
        "property-001",
      ),
    ).toBe(true);
  });
});
