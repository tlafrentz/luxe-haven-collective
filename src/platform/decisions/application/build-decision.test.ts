import { describe, expect, it } from "vitest";

import { buildDecision } from "./build-decision";

describe("buildDecision", () => {
  it("provides a functional construction API", () => {
    const decision = buildDecision({
      type: "revenue-pricing",
      outcome: "increase",
      context: {
        subjectType: "property",
        subjectId: "mesa",
        effectiveAt: new Date(
          "2026-07-19T12:00:00.000Z",
        ),
      },
      rationale: {
        summary: "Weekend demand supports a price increase.",
      },
      decidedAt: new Date(
        "2026-07-19T12:05:00.000Z",
      ),
    });

    expect(decision.outcome).toBe("increase");
  });
});
