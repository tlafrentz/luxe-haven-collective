import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapBookingPerformance,
} from "./map-booking-performance";
import {
  REVENUE_OBSERVATION_TYPES,
} from "./revenue-observation-types";
import {
  createPropertyPerformance,
  RECORDED_AT,
} from "./test-fixtures";

describe("mapBookingPerformance", () => {
  it("maps booking metrics with their correct units", () => {
    const observations =
      mapBookingPerformance(
        createPropertyPerformance(),
        RECORDED_AT,
      );

    expect(observations).toHaveLength(7);

    const leadTime =
      observations.find(
        (observation) =>
          observation.type ===
          REVENUE_OBSERVATION_TYPES
            .averageBookingLeadTime,
      );

    expect(leadTime?.value).toBe(19);
    expect(leadTime?.unit?.type).toBe(
      "days",
    );
  });
});
