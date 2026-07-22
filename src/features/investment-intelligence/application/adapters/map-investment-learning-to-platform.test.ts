import {
  describe,
  expect,
  it,
} from "vitest";

import {
  completeInvestmentAction,
  createInvestmentExecutionFixture,
} from "../__tests__/fixtures/investment-execution.fixture";
import {
  recordInvestmentActionOutcome,
} from "../record-investment-action-outcome";
import {
  mapInvestmentLearningToPlatform,
} from "./map-investment-learning-to-platform";

describe("mapInvestmentLearningToPlatform", () => {
  it("creates deterministic Outcome-backed Learning with complete provenance", () => {
    const fixture =
      createInvestmentExecutionFixture(
        "purchase",
      );
    const action = completeInvestmentAction(
      fixture.plan.actions.find(
        ({ sources }) =>
          sources.some(
            ({ capability, sourceId }) =>
              capability ===
                "investment-execution-intent" &&
              sourceId ===
                "verify-str-regulations",
          ),
      )!,
    );
    const outcome =
      recordInvestmentActionOutcome({
        action,
        platformAnalysis:
          fixture.platformAnalysis,
        decision: fixture.decision,
        finding: {
          disposition: "unfavorable",
          summary:
            "Short-term rentals are prohibited.",
          assumptionReferences: [
            "market.regulation",
          ],
        },
        actor: { id: "outcome-actor" },
        context: {
          outcomeId:
            "outcome-learning-adapter",
          recordedAt:
            new Date("2026-02-02T13:00:00Z"),
        },
      }).outcome;
    const key =
      "subject:investment-platform-purchase:regulatory-permission:contradicted";
    const candidate = {
      key,
      kind: "contradicted" as const,
      scope: {
        kind: "subject" as const,
        subjectId:
          fixture.plan.subjectId,
      },
      title:
        "Contradicted learning: regulatory permission",
      summary:
        "Short-term rentals are prohibited.",
      outcomeIds: [outcome.id.value],
      actionIds: [action.id.value],
      assumptionReferences: [
        "market.regulation",
      ],
      recommendationReferences: [
        fixture.plan.recommendationId,
      ],
      sourceActorIds: ["outcome-actor"],
      confidenceImpact: {
        direction: "decrease" as const,
        magnitude: "major" as const,
        rationale:
          "Reality contradicts the operating assumption.",
      },
      policyImpact: {
        target:
          "regulatory-assumption" as const,
        disposition: "review" as const,
        rationale:
          "Review the regulatory assumption policy.",
      },
    };
    const command = {
      outcomes: [outcome],
      priorContext: {
        lifecycleResult:
          fixture.lifecycleResult,
        platformAnalysis:
          fixture.platformAnalysis,
        decision: fixture.decision,
        planId: fixture.plan.id,
      },
      actor: {
        id: "learning-actor",
      },
      context: {
        learningRunId:
          "learning-run-adapter",
        derivedAt:
          new Date("2026-02-03T12:00:00Z"),
        learningIds: {
          [key]: "learning-adapter",
        },
      },
    };

    const first =
      mapInvestmentLearningToPlatform(
        candidate,
        [outcome],
        command,
      );
    const second =
      mapInvestmentLearningToPlatform(
        candidate,
        [outcome],
        command,
      );

    expect(first).toEqual(second);
    expect(first.id.value).toBe(
      "learning-adapter",
    );
    expect(first.type).toBe(
      "unsuccessful-pattern",
    );
    expect(
      first.explainability
        .supportingOutcomeIds,
    ).toEqual([outcome.id]);
    expect(
      first.explainability
        .supportingIntelligenceIds,
    ).toEqual([]);
    expect(first.metadata).toMatchObject({
      learningRunId:
        "learning-run-adapter",
      derivedByActorId: "learning-actor",
      sourceActorIds: ["outcome-actor"],
      learningKind: "contradicted",
      executionPlanId: fixture.plan.id,
    });
  });
});
