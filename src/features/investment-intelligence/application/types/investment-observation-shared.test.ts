import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createInvestmentObservationSubject,
} from "./investment-observation-shared";

import {
  createInvestmentDecision,
} from "../__tests__/fixtures/investment-decision.fixture";

describe(
  "createInvestmentObservationSubject",
  () => {
    it("uses the analyzed property as the canonical subject", () => {
      const subject =
        createInvestmentObservationSubject(
          createInvestmentDecision(),
        );

      expect(subject).toEqual({
        type: "property",
        id: "property-001",
      });
    });
  },
);
