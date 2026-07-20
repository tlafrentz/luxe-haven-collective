import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createInvestmentDecision,
} from "../__tests__/fixtures/investment-decision.fixture";

import {
  INVESTMENT_OBSERVATION_CAPABILITY,
  INVESTMENT_OBSERVATION_TYPES,
} from "../types/investment-observation-types";

import {
  InvestmentObservationProvider,
} from "./investment-observation-provider";

describe(
  "InvestmentObservationProvider",
  () => {
    it(
      "combines the complete investment observation set",
      () => {
        const recordedAt =
          new Date(
            "2026-07-19T18:00:00.000Z",
          );

        const provider =
          new InvestmentObservationProvider(
            () => recordedAt,
          );

        const observations =
          provider.build(
            createInvestmentDecision(),
          );

        expect(provider.capability).toBe(
          INVESTMENT_OBSERVATION_CAPABILITY,
        );

        expect(observations.size).toBe(45);

        expect(
          observations
            .ofType(
              INVESTMENT_OBSERVATION_TYPES
                .risk.item,
            )
            .size,
        ).toBe(1);

        expect(
          observations
            .ofType(
              INVESTMENT_OBSERVATION_TYPES
                .evidence.item,
            )
            .size,
        ).toBe(1);

        expect(
          observations
            .ofType(
              INVESTMENT_OBSERVATION_TYPES
                .summary.executive,
            )
            .size,
        ).toBe(1);

        expect(
          observations.toArray().every(
            (observation) =>
              observation.recordedAt
                .getTime() ===
              recordedAt.getTime(),
          ),
        ).toBe(true);
      },
    );

    it(
      "keeps the summary when risks and evidence are absent",
      () => {
        const input =
          createInvestmentDecision();

        const provider =
          new InvestmentObservationProvider(
            () =>
              new Date(
                "2026-07-19T18:00:00.000Z",
              ),
          );

        const observations =
          provider.build({
            ...input,
            risks: [],
            supportingEvidence: [],
          });

        expect(observations.size).toBe(43);

        expect(
          observations
            .ofType(
              INVESTMENT_OBSERVATION_TYPES
                .risk.item,
            )
            .size,
        ).toBe(0);

        expect(
          observations
            .ofType(
              INVESTMENT_OBSERVATION_TYPES
                .evidence.item,
            )
            .size,
        ).toBe(0);

        expect(
          observations
            .ofType(
              INVESTMENT_OBSERVATION_TYPES
                .summary.executive,
            )
            .size,
        ).toBe(1);
      },
    );

    it(
      "rejects an invalid observation clock",
      () => {
        const provider =
          new InvestmentObservationProvider(
            () => new Date("invalid"),
          );

        expect(() =>
          provider.build(
            createInvestmentDecision(),
          ),
        ).toThrow(
          "Investment observation clock must return a valid date.",
        );
      },
    );
  },
);
