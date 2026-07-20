import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapOccupancyPerformance,
} from "./map-occupancy-performance";
import {
  REVENUE_OBSERVATION_TYPES,
} from "./revenue-observation-types";
import {
  createPropertyPerformance,
  RECORDED_AT,
} from "./test-fixtures";

describe("mapOccupancyPerformance", () => {
  it("maps occupancy metrics with their correct units", () => {
    const observations =
      mapOccupancyPerformance(
        createPropertyPerformance(),
        RECORDED_AT,
      );

    expect(observations).toHaveLength(3);

    const occupancyRate =
      observations.find(
        (observation) =>
          observation.type ===
          REVENUE_OBSERVATION_TYPES.occupancyRate,
      );

    expect(occupancyRate?.value).toBe(70);
    expect(occupancyRate?.unit?.type).toBe(
      "percentage",
    );
  });
});
