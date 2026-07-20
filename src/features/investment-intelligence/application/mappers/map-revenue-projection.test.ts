import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createInvestmentDecision,
} from "../__tests__/fixtures/investment-decision.fixture";

import {
  INVESTMENT_OBSERVATION_TYPES,
} from "../types/investment-observation-types";

import {
  mapRevenueProjection,
} from "./map-revenue-projection";

describe("mapRevenueProjection", () => {
  it("maps the complete revenue projection", () => {
    const decision =
      createInvestmentDecision();

    const recordedAt =
      new Date("2026-07-19T18:00:00.000Z");

    const observations =
      mapRevenueProjection(
        decision.revenueProjection,
        decision,
        recordedAt,
      );

    expect(observations).toHaveLength(5);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .revenue.projectedAdr,
      ),
    ).toBe(195);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .revenue.projectedOccupancy,
      ),
    ).toBe(70);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .revenue.projectedMonthlyRevenue,
      ),
    ).toBe(4151);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .revenue.projectedAnnualRevenue,
      ),
    ).toBe(49812);

    expect(
      observationValue(
        observations,
        INVESTMENT_OBSERVATION_TYPES
          .revenue.confidence,
      ),
    ).toBe(82);

    for (const observation of observations) {
      expect(observation.subject.type).toBe(
        "property",
      );
      expect(observation.subject.id).toBe(
        "property-001",
      );
      expect(observation.observedAt).toEqual(
        recordedAt,
      );
      expect(observation.recordedAt).toEqual(
        recordedAt,
      );
      expect(observation.hasProvenance).toBe(
        true,
      );
    }
  });
});

function observationValue(
  observations: ReturnType<
    typeof mapRevenueProjection
  >,
  type: string,
): unknown {
  return observations.find(
    (observation) =>
      observation.type === type,
  )?.value;
}
