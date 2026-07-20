import { describe, expect, it } from "vitest";

import { Identifier } from "../../kernel";
import { Decision } from "./decision";
import { DecisionContext } from "./decision-context";
import { DecisionRationale } from "./decision-rationale";

enum AcquisitionOutcome {
  BUY = "buy",
  WAIT = "wait",
  PASS = "pass",
}

const decidedAt = new Date(
  "2026-07-19T12:05:00.000Z",
);

function createInput() {
  return {
    type: "acquisition",
    outcome: AcquisitionOutcome.PASS,
    context: {
      subjectType: "property",
      subjectId: "mesa-downtown-retreat",
      effectiveAt: new Date(
        "2026-07-19T12:00:00.000Z",
      ),
      scenario: "purchase",
    },
    rationale: {
      summary: "The modeled return is below target.",
      supportingReasons: [
        "Cash-on-cash return misses the threshold.",
      ],
    },
    decidedAt,
  } as const;
}

describe("Decision", () => {
  it("creates a typed platform decision", () => {
    const decision = Decision.create(createInput());

    expect(decision.type).toBe("acquisition");
    expect(decision.outcome).toBe(
      AcquisitionOutcome.PASS,
    );
    expect(decision.context.subjectId).toBe(
      "mesa-downtown-retreat",
    );
    expect(decision.rationale.summary).toBe(
      "The modeled return is below target.",
    );
    expect(decision.decidedAt.toISOString()).toBe(
      "2026-07-19T12:05:00.000Z",
    );
  });

  it("supports preconstructed context and rationale", () => {
    const context = DecisionContext.create({
      subjectType: "property",
      subjectId: "mesa-downtown-retreat",
      effectiveAt: new Date(
        "2026-07-19T12:00:00.000Z",
      ),
    });

    const rationale = DecisionRationale.create({
      summary: "Proceed.",
    });

    const decision = Decision.create({
      type: "acquisition",
      outcome: AcquisitionOutcome.BUY,
      context,
      rationale,
      decidedAt,
    });

    expect(decision.context).toBe(context);
    expect(decision.rationale).toBe(rationale);
  });

  it("checks outcomes without narrowing the method parameter too far", () => {
    const decision = Decision.create(createInput());

    expect(
      decision.isOutcome(AcquisitionOutcome.PASS),
    ).toBe(true);
    expect(
      decision.isOutcome(AcquisitionOutcome.BUY),
    ).toBe(false);
  });

  it("preserves entity identity", () => {
    const id = Identifier.create("decision-001");

    const first = Decision.create({
      ...createInput(),
      id,
    });

    const second = Decision.create({
      ...createInput(),
      id,
      outcome: AcquisitionOutcome.BUY,
    });

    expect(first.equals(second)).toBe(true);
  });

  it("copies the supplied decision date", () => {
    const sourceDate = new Date(
      "2026-07-19T12:05:00.000Z",
    );

    const decision = Decision.create({
      ...createInput(),
      decidedAt: sourceDate,
    });

    sourceDate.setUTCFullYear(2030);

    expect(decision.decidedAt.toISOString()).toBe(
      "2026-07-19T12:05:00.000Z",
    );
  });

  it("rejects empty type and outcome", () => {
    expect(() =>
      Decision.create({
        ...createInput(),
        type: " ",
      }),
    ).toThrow("Decision type cannot be empty.");

    expect(() =>
      Decision.create({
        ...createInput(),
        outcome: " " as AcquisitionOutcome,
      }),
    ).toThrow("Decision outcome cannot be empty.");
  });

  it("rejects an invalid decision date", () => {
    expect(() =>
      Decision.create({
        ...createInput(),
        decidedAt: new Date("invalid"),
      }),
    ).toThrow("Decision date must be valid.");
  });
});
