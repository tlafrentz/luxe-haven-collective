import {
  describe,
  expect,
  it,
} from "vitest";

import {
  REVENUE_OBSERVATION_CAPABILITY,
  REVENUE_OBSERVATION_TYPES,
} from "./revenue-observation-types";
import {
  RevenueObservationProvider,
} from "./revenue-observation-provider";
import {
  createRevenueIntelligence,
} from "./test-fixtures";

describe("RevenueObservationProvider", () => {
  it("combines performance and opportunity observations", () => {
    const provider =
      new RevenueObservationProvider();

    const observations = provider.build(
      createRevenueIntelligence(),
    );

    expect(provider.capability).toBe(
      REVENUE_OBSERVATION_CAPABILITY,
    );
    expect(observations.size).toBe(16);
    expect(
      observations
        .ofType(
          REVENUE_OBSERVATION_TYPES.grossRevenue,
        )
        .size,
    ).toBe(1);
    expect(
      observations
        .toArray()
        .filter((observation) =>
          observation.type.startsWith(
            `${REVENUE_OBSERVATION_TYPES.opportunityEvidence}.`,
          ),
        ),
    ).toHaveLength(2);
  });

  it("returns only performance observations without opportunities", () => {
    const provider =
      new RevenueObservationProvider();
    const input =
      createRevenueIntelligence();

    const observations = provider.build({
      ...input,
      opportunityReport: {
        ...input.opportunityReport,
        opportunities: [],
      },
    });

    expect(observations.size).toBe(14);
  });

  it("rejects an invalid generated timestamp", () => {
    const provider =
      new RevenueObservationProvider();

    expect(() =>
      provider.build({
        ...createRevenueIntelligence(),
        generatedAt: "not-a-date",
      }),
    ).toThrow(
      "Revenue intelligence generatedAt must be a valid date string.",
    );
  });
});
