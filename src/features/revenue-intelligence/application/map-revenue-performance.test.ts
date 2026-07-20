import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapRevenuePerformance,
} from "./map-revenue-performance";
import {
  REVENUE_OBSERVATION_TYPES,
} from "./revenue-observation-types";
import {
  createPropertyPerformance,
  RECORDED_AT,
} from "./test-fixtures";

describe("mapRevenuePerformance", () => {
  it("maps the revenue performance snapshot", () => {
    const observations =
      mapRevenuePerformance(
        createPropertyPerformance(),
        RECORDED_AT,
      );

    expect(observations).toHaveLength(4);

    const grossRevenue =
      observations.find(
        (observation) =>
          observation.type ===
          REVENUE_OBSERVATION_TYPES.grossRevenue,
      );

    expect(grossRevenue?.value).toBe(12000);
    expect(grossRevenue?.unit?.type).toBe(
      "currency",
    );
    expect(
      grossRevenue?.concerns(
        "property",
        "property-001",
      ),
    ).toBe(true);
  });
});
