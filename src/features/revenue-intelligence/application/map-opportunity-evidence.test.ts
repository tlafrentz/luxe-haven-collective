import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapOpportunityEvidence,
} from "./map-opportunity-evidence";
import {
  createRevenueOpportunity,
  RECORDED_AT,
} from "./test-fixtures";

describe("mapOpportunityEvidence", () => {
  it("maps evidence and preserves traceability metadata", () => {
    const observations =
      mapOpportunityEvidence(
        createRevenueOpportunity(),
        RECORDED_AT,
      );

    expect(observations).toHaveLength(2);

    const occupancyRate =
      observations.find(
        (observation) =>
          observation.type.endsWith(
            "weekday-occupancy-rate",
          ),
      );

    expect(occupancyRate?.value).toBe(42);
    expect(occupancyRate?.unit?.type).toBe(
      "percentage",
    );
    expect(
      occupancyRate?.source.referenceId,
    ).toBe("opportunity-001");
    expect(
      occupancyRate?.metadata,
    ).toMatchObject({
      detectorId:
        "low-weekday-occupancy-detector",
      evidenceKey:
        "weekday-occupancy-rate",
      confidence: "high",
    });
  });

  it("preserves zero and boolean evidence values", () => {
    const opportunity =
      createRevenueOpportunity();

    const observations =
      mapOpportunityEvidence(
        {
          ...opportunity,
          evidence: [
            {
              key: "unpaid-count",
              label: "Unpaid reservation count",
              value: 0,
              unit: "count",
            },
            {
              key: "payment-captured",
              label: "Payment captured",
              value: false,
            },
          ],
        },
        RECORDED_AT,
      );

    expect(observations[0]?.value).toBe(0);
    expect(observations[1]?.value).toBe(
      false,
    );
  });
});
