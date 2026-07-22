import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Outcome,
  createOutcomeId,
} from "@/platform/outcomes";
import {
  Identifier,
} from "@/platform/kernel";

import {
  AcquisitionType,
} from "../domain";
import {
  completeInvestmentAction,
  createInvestmentExecutionFixture,
} from "./__tests__/fixtures/investment-execution.fixture";
import {
  deriveInvestmentLearning,
} from "./derive-investment-learning";
import {
  recordInvestmentActionOutcome,
} from "./record-investment-action-outcome";

import type {
  InvestmentOutcomeDisposition,
  InvestmentOutcomeMeasurement,
} from "./types";
import type {
  Outcome as PlatformOutcome,
} from "@/platform/outcomes";

function recordedOutcome({
  route = "purchase",
  intentKey,
  outcomeId,
  disposition,
  summary,
  measurements,
}: {
  route?: "purchase" | "rental";
  intentKey: string;
  outcomeId: string;
  disposition: InvestmentOutcomeDisposition;
  summary: string;
  measurements?:
    readonly InvestmentOutcomeMeasurement[];
}) {
  const fixture =
    createInvestmentExecutionFixture(route);
  const action = fixture.plan.actions.find(
    ({ sources }) =>
      sources.some(
        ({ capability, sourceId }) =>
          capability ===
            "investment-execution-intent" &&
          sourceId === intentKey,
      ),
  );
  if (!action) {
    throw new Error(
      `Missing fixture Action for ${intentKey}.`,
    );
  }
  const result =
    recordInvestmentActionOutcome({
      action:
        completeInvestmentAction(action),
      platformAnalysis:
        fixture.platformAnalysis,
      decision: fixture.decision,
      finding: {
        disposition,
        summary,
        ...(measurements
          ? { measurements }
          : {}),
        assumptionReferences:
          measurements?.map(
            ({ key }) => key,
          ) ?? [],
        source: {
          kind: "operator-observation",
          reference: `source-${outcomeId}`,
        },
      },
      actor: {
        id: "outcome-operator",
      },
      context: {
        outcomeId,
        recordedAt:
          new Date("2026-02-02T13:00:00Z"),
      },
    });

  return {
    outcome: result.outcome,
    fixture,
  };
}

function learningCommand(
  outcomes: readonly PlatformOutcome[],
  fixture: ReturnType<
    typeof createInvestmentExecutionFixture
  >,
  learningIds:
    Readonly<Record<string, string>>,
) {
  return {
    outcomes,
    priorContext: {
      lifecycleResult:
        fixture.lifecycleResult,
      platformAnalysis:
        fixture.platformAnalysis,
      decision: fixture.decision,
      planId: fixture.plan.id,
    },
    actor: {
      id: "learning-operator",
      displayName: "Learning Operator",
    },
    context: {
      learningRunId:
        "investment-learning-run-007d",
      derivedAt:
        new Date("2026-02-03T12:00:00Z"),
      learningIds,
    },
  } as const;
}

describe("deriveInvestmentLearning", () => {
  it("confirms a purchase assumption within the documented five-percent tolerance", () => {
    const { outcome, fixture } =
      recordedOutcome({
        intentKey:
          "confirm-insurance-and-costs",
        outcomeId:
          "outcome-insurance-confirmed",
        disposition: "favorable",
        summary:
          "The insurance quote closely matches underwriting.",
        measurements: [
          {
            key:
              "annual-insurance-premium",
            label:
              "Annual insurance premium",
            value: 2450,
            assumedValue: 2400,
            unit: "USD",
            period: "annual",
          },
        ],
      });
    const key =
      "subject:investment-platform-purchase:assumption:annual-insurance-premium:confirmed";
    const result = deriveInvestmentLearning(
      learningCommand(
        [outcome],
        fixture,
        { [key]: "learning-insurance-confirmed" },
      ),
    );

    expect(result.candidates[0]).toMatchObject({
      key,
      kind: "confirmed",
      scope: {
        kind: "subject",
        subjectId:
          "investment-platform-purchase",
      },
      confidenceImpact: {
        direction: "increase",
        magnitude: "minor",
      },
      policyImpact: {
        target: "expense-assumption",
        disposition: "no-change",
      },
    });
    expect(result.learnings[0].id.value)
      .toBe("learning-insurance-confirmed");
    expect(
      result.learnings[0].explainability
        .supportingOutcomeIds,
    ).toEqual([outcome.id]);
  });

  it("contradicts a materially understated purchase repair assumption", () => {
    const { outcome, fixture } =
      recordedOutcome({
        intentKey:
          "complete-property-inspection",
        outcomeId: "outcome-repairs",
        disposition: "unfavorable",
        summary:
          "Inspection identified substantial immediate repairs.",
        measurements: [
          {
            key: "immediate-repair-cost",
            label: "Immediate repairs",
            value: 25000,
            assumedValue: 5000,
            unit: "USD",
            period: "one-time",
          },
        ],
      });
    const key =
      "subject:investment-platform-purchase:assumption:immediate-repair-cost:contradicted";
    const result = deriveInvestmentLearning(
      learningCommand(
        [outcome],
        fixture,
        { [key]: "learning-repairs" },
      ),
    );

    expect(result.candidates[0]).toMatchObject({
      kind: "contradicted",
      confidenceImpact: {
        direction: "decrease",
        magnitude: "major",
      },
      policyImpact: {
        target: "expense-assumption",
        disposition: "review",
      },
    });
  });

  it("contradicts a rental expense assumption using the narrower rent tolerance", () => {
    const { outcome, fixture } =
      recordedOutcome({
        route: "rental",
        intentKey:
          "validate-lease-economics",
        outcomeId: "outcome-rent",
        disposition: "unfavorable",
        summary:
          "Confirmed rent exceeds the assumed lease expense.",
        measurements: [
          {
            key: "confirmed-monthly-rent",
            label: "Confirmed monthly rent",
            value: 2900,
            assumedValue: 2500,
            unit: "USD",
            period: "monthly",
          },
        ],
      });
    const key =
      "subject:investment-platform-rental:assumption:confirmed-monthly-rent:contradicted";
    const result = deriveInvestmentLearning(
      learningCommand(
        [outcome],
        fixture,
        { [key]: "learning-rent" },
      ),
    );

    expect(result.acquisitionType).toBe(
      AcquisitionType.RentalArbitrage,
    );
    expect(result.candidates[0]).toMatchObject({
      kind: "contradicted",
      policyImpact: {
        target: "expense-assumption",
      },
    });
  });

  it.each([
    [
      "favorable",
      "confirmed",
      "increase",
    ],
    [
      "unfavorable",
      "contradicted",
      "decrease",
    ],
    ["neutral", "refined", "increase"],
    [
      "inconclusive",
      "unresolved",
      "none",
    ],
  ] as const)(
    "maps an explicit %s regulation finding to %s learning",
    (disposition, kind, direction) => {
      const { outcome, fixture } =
        recordedOutcome({
          intentKey:
            "verify-str-regulations",
          outcomeId:
            `outcome-regulation-${disposition}`,
          disposition,
          summary:
            disposition === "inconclusive"
              ? "The municipality has not issued a definitive interpretation."
              : `Regulatory review was ${disposition}.`,
        });
      const key =
        `subject:investment-platform-purchase:regulatory-permission:${kind}`;
      const result = deriveInvestmentLearning(
        learningCommand(
          [outcome],
          fixture,
          {
            [key]:
              `learning-regulation-${disposition}`,
          },
        ),
      );

      expect(result.candidates[0].kind)
        .toBe(kind);
      expect(
        result.candidates[0]
          .confidenceImpact.direction,
      ).toBe(direction);
      expect(result.learnings[0].metadata)
        .toMatchObject({
          learningKind: kind,
          decisionId:
            fixture.decision.id.value,
          executionPlanId: fixture.plan.id,
          sourceActorIds: [
            "outcome-operator",
          ],
        });
    },
  );

  it("derives unrelated findings independently", () => {
    const regulation = recordedOutcome({
      intentKey: "verify-str-regulations",
      outcomeId: "outcome-regulation",
      disposition: "unfavorable",
      summary: "STR use is prohibited.",
    });
    const insurance = recordedOutcome({
      intentKey:
        "confirm-insurance-and-costs",
      outcomeId: "outcome-insurance",
      disposition: "favorable",
      summary: "Insurance matched the model.",
      measurements: [
        {
          key: "annual-insurance-premium",
          label: "Annual insurance premium",
          value: 2400,
          assumedValue: 2400,
          unit: "USD",
          period: "annual",
        },
      ],
    });
    const result = deriveInvestmentLearning(
      learningCommand(
        [regulation.outcome, insurance.outcome],
        regulation.fixture,
        {
          "subject:investment-platform-purchase:regulatory-permission:contradicted":
            "learning-regulation",
          "subject:investment-platform-purchase:assumption:annual-insurance-premium:confirmed":
            "learning-insurance",
        },
      ),
    );

    expect(result.candidates).toHaveLength(2);
    expect(result.learnings).toHaveLength(2);
  });

  it("deduplicates the same semantic fact and preserves both Outcomes", () => {
    const first = recordedOutcome({
      intentKey: "verify-str-regulations",
      outcomeId: "outcome-regulation-1",
      disposition: "unfavorable",
      summary: "STR use is prohibited.",
    });
    const second = recordedOutcome({
      intentKey: "verify-str-regulations",
      outcomeId: "outcome-regulation-2",
      disposition: "unfavorable",
      summary: "A second review confirmed the prohibition.",
    });
    const key =
      "subject:investment-platform-purchase:regulatory-permission:contradicted";
    const result = deriveInvestmentLearning(
      learningCommand(
        [first.outcome, second.outcome],
        first.fixture,
        { [key]: "learning-regulation" },
      ),
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].outcomeIds)
      .toEqual([
        "outcome-regulation-1",
        "outcome-regulation-2",
      ]);
    expect(
      result.learnings[0].explainability
        .supportingOutcomeIds,
    ).toEqual([
      first.outcome.id,
      second.outcome.id,
    ]);
  });

  it.each([
    [
      "propertyId",
      "other-property",
      "INVESTMENT_LEARNING_SUBJECT_MISMATCH",
    ],
    [
      "acquisitionType",
      AcquisitionType.RentalArbitrage,
      "INVESTMENT_LEARNING_ROUTE_MISMATCH",
    ],
    [
      "investmentRunId",
      "other-run",
      "INVESTMENT_LEARNING_RUN_MISMATCH",
    ],
    [
      "decisionId",
      "other-decision",
      "INVESTMENT_LEARNING_DECISION_MISMATCH",
    ],
    [
      "recommendationId",
      "other-recommendation",
      "INVESTMENT_LEARNING_RECOMMENDATION_MISMATCH",
    ],
    [
      "executionPlanId",
      "other-plan",
      "INVESTMENT_LEARNING_PLAN_MISMATCH",
    ],
  ] as const)(
    "rejects mixed %s lineage",
    (field, value, code) => {
      const first = recordedOutcome({
        intentKey:
          "verify-str-regulations",
        outcomeId: "outcome-first",
        disposition: "favorable",
        summary: "Regulations confirmed.",
      });
      const mixed = withMetadata(
        first.outcome,
        field,
        value,
        "outcome-mixed",
      );

      expect(() =>
        deriveInvestmentLearning(
          learningCommand(
            [first.outcome, mixed],
            first.fixture,
            {},
          ),
        ),
      ).toThrowError(
        expect.objectContaining({ code }),
      );
    },
  );

  it("rejects empty, duplicate, and prior-context-mismatched input", () => {
    const recorded = recordedOutcome({
      intentKey: "verify-str-regulations",
      outcomeId: "outcome-validation",
      disposition: "favorable",
      summary: "Regulations confirmed.",
    });
    const empty = learningCommand(
      [],
      recorded.fixture,
      {},
    );
    const duplicate = learningCommand(
      [recorded.outcome, recorded.outcome],
      recorded.fixture,
      {},
    );
    const mismatch = {
      ...learningCommand(
        [recorded.outcome],
        recorded.fixture,
        {},
      ),
      priorContext: {
        ...learningCommand(
          [recorded.outcome],
          recorded.fixture,
          {},
        ).priorContext,
        planId: "other-plan",
      },
    };

    expect(() => deriveInvestmentLearning(empty))
      .toThrowError(
        expect.objectContaining({
          code:
            "INVESTMENT_LEARNING_OUTCOMES_EMPTY",
        }),
      );
    expect(() =>
      deriveInvestmentLearning(duplicate),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_LEARNING_DUPLICATE_OUTCOME",
      }),
    );
    expect(() =>
      deriveInvestmentLearning(mismatch),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_LEARNING_PRIOR_CONTEXT_MISMATCH",
      }),
    );
  });

  it("requires unique deterministic Learning IDs", () => {
    const first = recordedOutcome({
      intentKey: "verify-str-regulations",
      outcomeId: "outcome-regulation",
      disposition: "unfavorable",
      summary: "STR use is prohibited.",
    });
    const insurance = recordedOutcome({
      intentKey:
        "confirm-insurance-and-costs",
      outcomeId: "outcome-insurance",
      disposition: "favorable",
      summary: "Insurance was confirmed.",
      measurements: [
        {
          key: "annual-insurance-premium",
          label: "Premium",
          value: 2400,
          assumedValue: 2400,
          unit: "USD",
        },
      ],
    });
    const outcomes = [
      first.outcome,
      insurance.outcome,
    ];

    expect(() =>
      deriveInvestmentLearning(
        learningCommand(
          outcomes,
          first.fixture,
          {},
        ),
      ),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_LEARNING_ID_MISSING",
      }),
    );
    expect(() =>
      deriveInvestmentLearning(
        learningCommand(
          outcomes,
          first.fixture,
          {
            "subject:investment-platform-purchase:regulatory-permission:contradicted":
              "learning-duplicate",
            "subject:investment-platform-purchase:assumption:annual-insurance-premium:confirmed":
              "learning-duplicate",
          },
        ),
      ),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_LEARNING_DUPLICATE_ID",
      }),
    );
  });

  it("requires explicit justification for broader scope", () => {
    const recorded = recordedOutcome({
      intentKey:
        "confirm-insurance-and-costs",
      outcomeId: "outcome-scope",
      disposition: "unfavorable",
      summary: "Insurance differed.",
      measurements: [
        {
          key: "annual-insurance-premium",
          label: "Premium",
          value: 4800,
          assumedValue: 2400,
          unit: "USD",
        },
      ],
    });
    const key =
      "subject:investment-platform-purchase:assumption:annual-insurance-premium:contradicted";
    const base = learningCommand(
      [recorded.outcome],
      recorded.fixture,
      { [key]: "learning-scope" },
    );

    expect(() =>
      deriveInvestmentLearning({
        ...base,
        context: {
          ...base.context,
          scopeOverrides: {
            [key]: {
              kind: "assumption-policy",
              assumptionKey:
                "annual-insurance-premium",
              justification: "   ",
            },
          },
        },
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_LEARNING_INVALID_SCOPE",
      }),
    );

    const scoped = deriveInvestmentLearning({
      ...base,
      context: {
        ...base.context,
        scopeOverrides: {
          [key]: {
            kind: "assumption-policy",
            assumptionKey:
              "annual-insurance-premium",
            justification:
              "A separately governed review approved this candidate for assumption-policy consideration.",
          },
        },
      },
    });
    expect(scoped.candidates[0].scope)
      .toMatchObject({
        kind: "assumption-policy",
        assumptionKey:
          "annual-insurance-premium",
      });
  });

  it("is deterministic and does not return or mutate downstream artifacts", () => {
    const recorded = recordedOutcome({
      intentKey: "verify-str-regulations",
      outcomeId: "outcome-deterministic",
      disposition: "inconclusive",
      summary: "Interpretation remains open.",
    });
    const key =
      "subject:investment-platform-purchase:regulatory-permission:unresolved";
    const command = learningCommand(
      [recorded.outcome],
      recorded.fixture,
      { [key]: "learning-deterministic" },
    );
    const before = recorded.outcome;
    const first = deriveInvestmentLearning(
      command,
    );

    expect(first).toEqual(
      deriveInvestmentLearning(command),
    );
    expect(recorded.outcome).toBe(before);
    expect("actions" in first).toBe(false);
    expect("outcomes" in first).toBe(false);
    expect("decisions" in first).toBe(false);
    expect("recommendations" in first).toBe(
      false,
    );
    expect("analysis" in first).toBe(false);
  });
});

function withMetadata(
  outcome: PlatformOutcome,
  key: string,
  value: string,
  id: string,
): PlatformOutcome {
  return Outcome.create({
    id: createOutcomeId(id),
    title: outcome.title,
    summary: outcome.summary,
    type: outcome.type,
    status: outcome.status,
    successful: outcome.successful,
    startedAt: outcome.startedAt,
    ...(outcome.completedAt
      ? { completedAt: outcome.completedAt }
      : {}),
    metrics: outcome.metrics,
    result: outcome.result,
    notes: outcome.notes,
    lineage: {
      ...outcome.lineage,
      ...(key === "decisionId"
        ? {
            decisionIds: [
              Identifier.create(value),
            ],
          }
        : {}),
      ...(key === "recommendationId"
        ? {
            recommendationIds: [
              Identifier.create(value),
            ],
          }
        : {}),
    },
    metadata: {
      ...outcome.metadata,
      [key]: value,
    },
  });
}
