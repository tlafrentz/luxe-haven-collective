import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PlatformAction,
  createActionId,
  createWorkspaceId,
} from "@/platform/actions";
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
  recordInvestmentActionOutcome,
} from "./record-investment-action-outcome";

import type {
  PlatformActionSource,
} from "@/platform/actions";
import type {
  InvestmentOutcomeDisposition,
  RecordInvestmentActionOutcomeCommand,
} from "./types";

function outcomeCommand(
  route: "purchase" | "rental" =
    "purchase",
): RecordInvestmentActionOutcomeCommand {
  const fixture =
    createInvestmentExecutionFixture(route);
  const action = completeInvestmentAction(
    fixture.plan.actions.find(
      ({ sources }) =>
        sources.some(
          ({ capability, sourceId }) =>
            capability ===
              "investment-execution-intent" &&
            sourceId ===
              (route === "purchase"
                ? "verify-str-regulations"
                : "confirm-utilities-responsibility"),
        ),
    ) ?? fixture.plan.actions[0],
  );

  return {
    action,
    platformAnalysis:
      fixture.platformAnalysis,
    decision: fixture.decision,
    finding: {
      disposition: "unfavorable",
      summary:
        route === "purchase"
          ? "Short-term rentals are prohibited at the property."
          : "The tenant must pay all utilities.",
      details:
        "The completed review identified a material operating constraint.",
      source: {
        kind:
          route === "purchase"
            ? "regulatory-review"
            : "contract-review",
        reference: "document-007c",
      },
    },
    actor: {
      id: "operator-007c",
      displayName: "Outcome Operator",
    },
    context: {
      outcomeId: "outcome-007c",
      recordedAt:
        new Date("2026-02-02T13:00:00Z"),
    },
  };
}

describe("recordInvestmentActionOutcome", () => {
  it("captures one unfavorable purchase Outcome without changing completed Action state", () => {
    const command = outcomeCommand();
    const result =
      recordInvestmentActionOutcome(command);

    expect(result.acquisitionType).toBe(
      AcquisitionType.Purchase,
    );
    expect(result.outcome.id.value).toBe(
      "outcome-007c",
    );
    expect(result.outcome.status).toBe(
      "completed",
    );
    expect(result.outcome.successful).toBe(
      true,
    );
    expect(result.outcome.result.disposition)
      .toBe("unfavorable");
    expect(command.action.status).toBe(
      "completed",
    );
    expect(result.outcome.lineage.actionIds)
      .toEqual([command.action.id]);
    expect(
      result.outcome.lineage.decisionIds
        .map(({ value }) => value),
    ).toEqual([command.decision.id.value]);
    expect(
      result.outcome.lineage
        .recommendationIds[0].value,
    ).toBe(result.recommendationId);
    expect(result.outcome.metadata).toMatchObject({
      executionPlanId: "plan-007c",
      investmentRunId:
        "investment-run-007c",
      intentKey:
        "verify-str-regulations",
      recordedByActorId:
        "operator-007c",
      disposition: "unfavorable",
    });
    expect("learning" in result).toBe(false);
    expect("action" in result).toBe(false);
    expect("decision" in result).toBe(false);
  });

  it("captures a rental-specific finding without purchase inputs", () => {
    const result =
      recordInvestmentActionOutcome(
        outcomeCommand("rental"),
      );

    expect(result.acquisitionType).toBe(
      AcquisitionType.RentalArbitrage,
    );
    expect(result.intentKey).toBe(
      "confirm-utilities-responsibility",
    );
    expect(result.outcome.summary).toContain(
      "utilities",
    );
  });

  it.each([
    "favorable",
    "unfavorable",
    "neutral",
    "inconclusive",
  ] as const)(
    "preserves the explicit %s business disposition independently of completion",
    (disposition: InvestmentOutcomeDisposition) => {
      const command = outcomeCommand();
      const result =
        recordInvestmentActionOutcome({
          ...command,
          finding: {
            ...command.finding,
            disposition,
          },
        });

      expect(result.outcome.result.disposition)
        .toBe(disposition);
      expect(result.outcome.successful).toBe(
        true,
      );
    },
  );

  it("records actual, assumed, and derived variance measurements separately", () => {
    const command = outcomeCommand();
    const result =
      recordInvestmentActionOutcome({
        ...command,
        finding: {
          disposition: "unfavorable",
          summary:
            "Insurance is available above the underwriting assumption.",
          measurements: [
            {
              key:
                "annual-insurance-premium",
              label:
                "Annual insurance premium",
              value: 4800,
              assumedValue: 2400,
              unit: "USD",
              period: "annual",
            },
          ],
          assumptionReferences: [
            "operating.annualInsurance",
          ],
          source: {
            kind: "quote",
            reference: "quote-1",
          },
        },
      });

    expect(result.measurements[0]).toEqual({
      key: "annual-insurance-premium",
      label: "Annual insurance premium",
      value: 4800,
      assumedValue: 2400,
      variance: 2400,
      unit: "USD",
      period: "annual",
    });
    expect(result.outcome.metrics).toMatchObject({
      "annual-insurance-premium": 4800,
      "annual-insurance-premium.assumed":
        2400,
      "annual-insurance-premium.variance":
        2400,
    });
  });

  it("rejects draft and cancelled Actions", () => {
    const command = outcomeCommand();
    const fixture =
      createInvestmentExecutionFixture(
        "purchase",
      );
    const draft = fixture.plan.actions[0];
    const cancelled = draft.cancel({
      workspaceId: draft.workspaceId,
      expectedVersion: draft.version,
      actor: {
        type: "user",
        id: "operator-007c",
      },
      occurredAt:
        new Date("2026-02-02T09:00:00Z"),
    });

    expect(() =>
      recordInvestmentActionOutcome({
        ...command,
        action: draft,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_OUTCOME_ACTION_NOT_COMPLETED",
      }),
    );
    expect(() =>
      recordInvestmentActionOutcome({
        ...command,
        action: cancelled,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_OUTCOME_ACTION_CANCELLED",
      }),
    );
  });

  it("rejects completed non-Investment Actions", () => {
    const command = outcomeCommand();
    const createdAt =
      new Date("2026-02-01T12:00:00Z");
    const actor = {
      type: "user" as const,
      id: "operator-007c",
    };
    const draft = PlatformAction.createDraft({
      id: createActionId("other-action"),
      workspaceId:
        createWorkspaceId("workspace-007c"),
      title: "Other work",
      actionType: "operations.review",
      priority: "normal",
      owner: {
        type: "system",
        id: "operations",
      },
      sources: [
        {
          type: "manual",
          recordedAt: createdAt,
          recordedBy: actor,
        },
      ],
      createdAt,
      createdBy: actor,
    });
    const completed =
      completeInvestmentAction(draft);

    expect(() =>
      recordInvestmentActionOutcome({
        ...command,
        action: completed,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_OUTCOME_ACTION_NOT_INVESTMENT",
      }),
    );
  });

  it("rejects mismatched Decision, route, and run artifacts", () => {
    const purchase = outcomeCommand(
      "purchase",
    );
    const rental = outcomeCommand("rental");
    const mismatchedRun = {
      ...purchase.platformAnalysis,
      lineage: {
        ...purchase.platformAnalysis.lineage,
        runId: "unrelated-run",
      },
    };

    expect(() =>
      recordInvestmentActionOutcome({
        ...purchase,
        decision: rental.decision,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_OUTCOME_DECISION_LINEAGE_MISSING",
      }),
    );
    expect(() =>
      recordInvestmentActionOutcome({
        ...purchase,
        platformAnalysis:
          rental.platformAnalysis,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_OUTCOME_ROUTE_LINEAGE_MISSING",
      }),
    );
    expect(() =>
      recordInvestmentActionOutcome({
        ...purchase,
        platformAnalysis: mismatchedRun,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_OUTCOME_RUN_LINEAGE_MISSING",
      }),
    );
  });

  it.each([
    [
      "decision",
      "investment-intelligence",
      "INVESTMENT_OUTCOME_DECISION_LINEAGE_MISSING",
    ],
    [
      "recommendation",
      "investment-intelligence",
      "INVESTMENT_OUTCOME_RECOMMENDATION_LINEAGE_MISSING",
    ],
    [
      "automation",
      "investment-execution-plan",
      "INVESTMENT_OUTCOME_PLAN_LINEAGE_MISSING",
    ],
    [
      "api",
      "investment-platform-run",
      "INVESTMENT_OUTCOME_RUN_LINEAGE_MISSING",
    ],
    [
      "manual",
      "investment-subject:",
      "INVESTMENT_OUTCOME_SUBJECT_LINEAGE_MISSING",
    ],
    [
      "automation",
      "investment-execution-intent",
      "INVESTMENT_OUTCOME_INTENT_LINEAGE_MISSING",
    ],
  ] as const)(
    "rejects missing %s/%s lineage",
    (type, capability, code) => {
      const command = outcomeCommand();
      const sources = command.action.sources.filter(
        (source) =>
          !(
            source.type === type &&
            (capability.endsWith(":")
              ? source.capability?.startsWith(
                  capability,
                )
              : source.capability === capability)
          ),
      );
      const action = withSources(
        command.action,
        sources,
      );

      expect(() =>
        recordInvestmentActionOutcome({
          ...command,
          action,
        }),
      ).toThrowError(
        expect.objectContaining({ code }),
      );
    },
  );

  it("rejects an already-linked primary Outcome", () => {
    const command = outcomeCommand();
    const action = command.action.linkOutcome({
      workspaceId:
        command.action.workspaceId,
      expectedVersion:
        command.action.version,
      actor: {
        type: "user",
        id: "operator-007c",
      },
      occurredAt:
        new Date("2026-02-02T12:30:00Z"),
      outcomeId:
        Identifier.create("prior-outcome"),
      linkType: "result",
    });

    expect(() =>
      recordInvestmentActionOutcome({
        ...command,
        action,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_OUTCOME_DUPLICATE_PRIMARY_OUTCOME",
      }),
    );
  });

  it("validates measurement values and duplicate keys", () => {
    const command = outcomeCommand();

    for (const measurements of [
      [
        {
          key: "premium",
          label: "Premium",
          value: Number.NaN,
          unit: "USD" as const,
        },
      ],
      [
        {
          key: "premium",
          label: "Premium",
          value: 100,
          unit: "USD" as const,
        },
        {
          key: "premium",
          label: "Premium again",
          value: 200,
          unit: "USD" as const,
        },
      ],
    ]) {
      expect(() =>
        recordInvestmentActionOutcome({
          ...command,
          finding: {
            ...command.finding,
            measurements,
          },
        }),
      ).toThrowError(
        expect.objectContaining({
          code:
            "INVESTMENT_OUTCOME_INVALID_MEASUREMENT",
        }),
      );
    }
  });

  it("records a measurement without inventing an assumption or variance", () => {
    const command = outcomeCommand("rental");
    const result =
      recordInvestmentActionOutcome({
        ...command,
        finding: {
          ...command.finding,
          measurements: [
            {
              key: "confirmed-monthly-rent",
              label: "Confirmed monthly rent",
              value: 2200,
              unit: "USD",
              period: "monthly",
            },
          ],
        },
      });

    expect(result.measurements[0]).toEqual({
      key: "confirmed-monthly-rent",
      label: "Confirmed monthly rent",
      value: 2200,
      unit: "USD",
      period: "monthly",
    });
    expect(
      result.outcome.metrics[
        "confirmed-monthly-rent.variance"
      ],
    ).toBeUndefined();
  });

  it("is deterministic for the same completed Action and context", () => {
    const command = outcomeCommand();

    expect(
      recordInvestmentActionOutcome(command),
    ).toEqual(
      recordInvestmentActionOutcome(command),
    );
  });
});

function withSources(
  action: PlatformAction,
  sources: readonly PlatformActionSource[],
): PlatformAction {
  return PlatformAction.reconstitute({
    id: action.id,
    workspaceId: action.workspaceId,
    title: action.title,
    ...(action.description
      ? { description: action.description }
      : {}),
    ...(action.actionType
      ? { actionType: action.actionType }
      : {}),
    status: action.status,
    priority: action.priority,
    owner: action.owner,
    assignments: action.assignments,
    schedule: action.scheduleValue,
    sources,
    history: action.history,
    outcomeReferences:
      action.outcomeReferences,
    createdAt: action.createdAt,
    createdBy: action.createdBy,
    updatedAt: action.updatedAt,
    version: action.version,
  });
}
