import { describe, expect, it } from "vitest";

import { Identifier } from "../../kernel";
import {
  DecisionBuildError,
  DecisionBuilder,
} from "./decision-builder";

enum AcquisitionOutcome {
  BUY = "buy",
  WAIT = "wait",
  PASS = "pass",
}

describe("DecisionBuilder", () => {
  it("builds a complete decision", () => {
    const decision = DecisionBuilder
      .create<AcquisitionOutcome>()
      .withId(Identifier.create("decision-001"))
      .forType("acquisition")
      .withOutcome(AcquisitionOutcome.BUY)
      .inContext({
        subjectType: "property",
        subjectId: "mesa-downtown-retreat",
        effectiveAt: new Date(
          "2026-07-19T12:00:00.000Z",
        ),
        scenario: "purchase",
      })
      .because({
        summary: "The property meets the acquisition threshold.",
        supportingReasons: ["Strong market demand."],
      })
      .considering([
        {
          key: "buy",
          label: "Buy",
          outcome: AcquisitionOutcome.BUY,
          rank: 1,
          score: 88,
          summary: "Proceed at the modeled price.",
        },
        {
          key: "wait",
          label: "Wait",
          outcome: AcquisitionOutcome.WAIT,
          rank: 2,
          score: 72,
          summary: "Wait for improved financing.",
        },
        {
          key: "pass",
          label: "Pass",
          outcome: AcquisitionOutcome.PASS,
          rank: 3,
          score: 41,
          summary: "Do not acquire under current conditions.",
        },
      ])
      .at(new Date("2026-07-19T12:05:00.000Z"))
      .build();

    expect(decision.type).toBe("acquisition");
    expect(decision.outcome).toBe(AcquisitionOutcome.BUY);
    expect(decision.options?.size).toBe(3);
    expect(decision.selectedOption?.score).toBe(88);
  });

  it("reports all missing required fields", () => {
    expect.assertions(3);

    try {
      DecisionBuilder
        .create<AcquisitionOutcome>()
        .build();
    } catch (error) {
      expect(error).toBeInstanceOf(DecisionBuildError);
      expect(
        (error as DecisionBuildError).missingFields,
      ).toEqual([
        "type",
        "outcome",
        "context",
        "rationale",
        "decidedAt",
      ]);
      expect((error as Error).message).toBe(
        "Cannot build decision. Missing required fields: type, outcome, context, rationale, decidedAt.",
      );
    }
  });

  it("rejects an outcome absent from evaluated options", () => {
    expect(() =>
      DecisionBuilder
        .create<AcquisitionOutcome>()
        .forType("acquisition")
        .withOutcome(AcquisitionOutcome.PASS)
        .inContext({
          subjectType: "property",
          subjectId: "mesa",
          effectiveAt: new Date(),
        })
        .because({
          summary: "Pass.",
        })
        .considering([
          {
            key: "buy",
            label: "Buy",
            outcome: AcquisitionOutcome.BUY,
            rank: 1,
            score: 88,
            summary: "Proceed.",
          },
        ])
        .at(new Date())
        .build(),
    ).toThrow(
      "Decision outcome must exist in the evaluated options.",
    );
  });

  it("copies the supplied decision date", () => {
    const decidedAt = new Date(
      "2026-07-19T12:05:00.000Z",
    );

    const decision = DecisionBuilder
      .create<AcquisitionOutcome>()
      .forType("acquisition")
      .withOutcome(AcquisitionOutcome.BUY)
      .inContext({
        subjectType: "property",
        subjectId: "mesa",
        effectiveAt: new Date(),
      })
      .because({
        summary: "Proceed.",
      })
      .at(decidedAt)
      .build();

    decidedAt.setUTCFullYear(2030);

    expect(decision.decidedAt.toISOString()).toBe(
      "2026-07-19T12:05:00.000Z",
    );
  });
});
