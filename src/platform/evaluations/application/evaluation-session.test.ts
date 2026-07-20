import { describe, expect, it } from "vitest";

import { EvaluationCollection } from "../domain";
import {
  EvaluationDiagnostics,
  EvaluationSession,
} from "./evaluation-session";

describe("EvaluationSession", () => {
  it("creates an immutable empty execution result", () => {
    const session = EvaluationSession.create({
      startedAt: new Date("2026-07-19T20:00:00.000Z"),
      completedAt: new Date("2026-07-19T20:00:01.000Z"),
      claimsProcessed: 0,
      evaluationsCreated: 0,
      claimsSkipped: 0,
      claimsFailed: 0,
      evaluationCollection: EvaluationCollection.empty(),
      diagnostics: EvaluationDiagnostics.create(),
    });

    expect(session.durationMs).toBe(1000);
    expect(session.succeeded).toBe(true);
    expect(Object.isFrozen(session)).toBe(true);
    expect(Object.isFrozen(session.diagnostics.warnings)).toBe(true);
  });

  it("protects session accounting invariants", () => {
    expect(() =>
      EvaluationSession.create({
        startedAt: new Date("2026-07-19T20:00:00.000Z"),
        completedAt: new Date("2026-07-19T20:00:01.000Z"),
        claimsProcessed: 2,
        evaluationsCreated: 0,
        claimsSkipped: 0,
        claimsFailed: 0,
        evaluationCollection: EvaluationCollection.empty(),
        diagnostics: EvaluationDiagnostics.create(),
      }),
    ).toThrow(
      "Evaluation session outcomes must equal the number of Claims processed.",
    );
  });
});
