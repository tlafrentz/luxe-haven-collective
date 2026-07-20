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
  mapSupportingEvidence,
} from "./map-supporting-evidence";

describe("mapSupportingEvidence", () => {
  it("maps one observation per evidence item", () => {
    const decision =
      createInvestmentDecision();

    const observations =
      mapSupportingEvidence(
        decision.supportingEvidence,
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      );

    expect(observations).toHaveLength(1);

    const observation = observations[0];

    expect(observation.type).toBe(
      INVESTMENT_OBSERVATION_TYPES
        .evidence.item,
    );
    expect(observation.label).toBe(
      decision.supportingEvidence[0].title,
    );
    expect(observation.value).toBe(
      decision.supportingEvidence[0]
        .description,
    );
    expect(observation.metadata).toEqual({
      evidenceId: "evidence-001",
      evidenceType: "market-trend",
      direction: "positive",
      evidenceSource:
        "Market Intelligence",
      confidence: "high",
    });
  });

  it("supports decisions without evidence", () => {
    const decision =
      createInvestmentDecision();

    expect(
      mapSupportingEvidence(
        [],
        decision,
        new Date(
          "2026-07-19T18:00:00.000Z",
        ),
      ),
    ).toEqual([]);
  });
});
