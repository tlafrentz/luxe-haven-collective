import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Decision,
} from "@/platform/decisions";
import {
  Identifier,
} from "@/platform/kernel";

import {
  AcquisitionType,
  RiskSeverity,
} from "../domain";
import {
  createPurchaseLifecycleResult,
  createRentalLifecycleResult,
} from "./__tests__/fixtures/investment-lifecycle.fixture";
import {
  mapInvestmentPlatformAnalysis,
} from "./adapters/map-investment-platform-analysis";
import {
  commitInvestmentRecommendation,
} from "./commit-investment-recommendation";
import {
  planInvestmentExecution,
} from "./plan-investment-execution";

import type {
  InvestmentLifecycleResult,
  InvestmentPlatformAnalysis,
} from "../domain";
import type {
  InvestmentCommitmentResponse,
  PlanInvestmentExecutionCommand,
} from "./types";

const plannedAt =
  new Date("2026-02-02T12:00:00Z");

const allActionIds = {
  "validate-market-comparables":
    "action-validate-market-comparables",
  "verify-str-regulations":
    "action-verify-str-regulations",
  "complete-property-inspection":
    "action-complete-property-inspection",
  "validate-financing":
    "action-validate-financing",
  "confirm-insurance-and-costs":
    "action-confirm-insurance-and-costs",
  "refresh-purchase-underwriting":
    "action-refresh-purchase-underwriting",
  "confirm-final-purchase-thresholds":
    "action-confirm-final-purchase-thresholds",
  "prepare-acquisition-offer":
    "action-prepare-acquisition-offer",
  "verify-landlord-permission":
    "action-verify-landlord-permission",
  "confirm-utilities-responsibility":
    "action-confirm-utilities-responsibility",
  "validate-lease-economics":
    "action-validate-lease-economics",
  "validate-setup-capital":
    "action-validate-setup-capital",
  "obtain-rental-insurance":
    "action-obtain-rental-insurance",
  "refresh-rental-underwriting":
    "action-refresh-rental-underwriting",
  "execute-approved-lease":
    "action-execute-approved-lease",
  "prepare-operational-launch":
    "action-prepare-operational-launch",
} as const;

function analysis(
  result: InvestmentLifecycleResult,
  runId = "investment-run-007b",
): InvestmentPlatformAnalysis {
  return mapInvestmentPlatformAnalysis(
    result,
    {
      runId,
      observedAt:
        new Date("2026-02-01T12:00:00Z"),
      sourceQuality: {
        comparables: "synthetic",
        regulation: "unknown",
        utilitiesResponsibility:
          "unknown",
      },
    },
  );
}

function committedCommand(
  lifecycleResult: InvestmentLifecycleResult,
  response:
    InvestmentCommitmentResponse =
      "accept",
): PlanInvestmentExecutionCommand {
  const platformAnalysis =
    analysis(lifecycleResult);
  const recommendationId =
    platformAnalysis.recommendations
      .toArray()[0].id.value;
  const commitment =
    commitInvestmentRecommendation({
      lifecycleResult,
      platformAnalysis,
      recommendationId,
      response,
      rationale:
        "Proceed according to the accepted diligence policy.",
      actor: {
        id: "operator-007b",
        displayName: "Operator",
      },
      context: {
        decisionId:
          `decision-${lifecycleResult.acquisitionType}`,
        decidedAt:
          new Date("2026-02-02T10:00:00Z"),
      },
    });

  return {
    lifecycleResult,
    platformAnalysis,
    decision: commitment.decision,
    actor: {
      id: "operator-007b",
      displayName: "Operator",
    },
    context: {
      planId:
        `plan-${lifecycleResult.acquisitionType}`,
      workspaceId: "workspace-007b",
      plannedAt,
      actionIds: allActionIds,
    },
  };
}

describe("planInvestmentExecution", () => {
  it("creates a purchase plan with diligence, dependencies, and draft Actions", () => {
    const command = committedCommand(
      createPurchaseLifecycleResult(),
    );
    const plan =
      planInvestmentExecution(command);
    const keys = plan.intents.map(
      ({ key }) => key,
    );

    expect(plan.acquisitionType).toBe(
      AcquisitionType.Purchase,
    );
    expect(plan.decisionId).toBe(
      command.decision.id.value,
    );
    expect(plan.recommendationId).toBe(
      command.decision
        .recommendationIds[0].value,
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        "validate-market-comparables",
        "verify-str-regulations",
        "complete-property-inspection",
        "validate-financing",
        "refresh-purchase-underwriting",
        "confirm-final-purchase-thresholds",
      ]),
    );
    expect(keys).not.toContain(
      "verify-landlord-permission",
    );
    expect(
      plan.intents.find(
        ({ key }) =>
          key ===
          "refresh-purchase-underwriting",
      )?.dependencies,
    ).toContain("validate-financing");
    expect(plan.actions).toHaveLength(
      plan.intents.length,
    );
    expect(
      plan.actions.every(
        ({ status }) => status === "draft",
      ),
    ).toBe(true);
    expect("outcomes" in plan).toBe(false);
    expect("learning" in plan).toBe(false);
  });

  it("creates a rental plan driven by lease, utilities, and stress analysis", () => {
    const plan = planInvestmentExecution(
      committedCommand(
        createRentalLifecycleResult(),
      ),
    );
    const keys = plan.intents.map(
      ({ key }) => key,
    );

    expect(plan.acquisitionType).toBe(
      AcquisitionType.RentalArbitrage,
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        "verify-landlord-permission",
        "confirm-utilities-responsibility",
        "validate-lease-economics",
        "refresh-rental-underwriting",
        "execute-approved-lease",
      ]),
    );
    expect(keys).not.toContain(
      "validate-financing",
    );
    expect(keys).not.toContain(
      "complete-property-inspection",
    );
    expect(
      plan.intents.find(
        ({ key }) =>
          key ===
          "refresh-rental-underwriting",
      )?.sourceReferences,
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^stress-tests:/,
        ),
      ]),
    );
  });

  it.each([
    "reject",
    "defer",
  ] as const)(
    "rejects a %s Decision",
    (response) => {
      const command = committedCommand(
        createPurchaseLifecycleResult(),
        response,
      );

      expect(() =>
        planInvestmentExecution(command),
      ).toThrowError(
        expect.objectContaining({
          code:
            "INVESTMENT_EXECUTION_DECISION_NOT_ACCEPTED",
        }),
      );
    },
  );

  it("rejects route mismatches", () => {
    const purchase = committedCommand(
      createPurchaseLifecycleResult(),
    );
    const rental =
      createRentalLifecycleResult();

    expect(() =>
      planInvestmentExecution({
        ...purchase,
        lifecycleResult: rental,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_EXECUTION_ROUTE_MISMATCH",
      }),
    );
  });

  it("rejects subject and run mismatches", () => {
    const purchaseLifecycle =
      createPurchaseLifecycleResult();
    const original = committedCommand(
      purchaseLifecycle,
    );
    const mismatchedSubject = {
      ...purchaseLifecycle,
      analysis: {
        ...purchaseLifecycle.analysis,
        property: {
          ...purchaseLifecycle.analysis.property,
          id: "unrelated-property",
        },
      },
    } satisfies InvestmentLifecycleResult;
    const mismatchedRun = {
      ...original.platformAnalysis,
      lineage: {
        ...original.platformAnalysis.lineage,
        runId: "unrelated-run",
      },
    } satisfies InvestmentPlatformAnalysis;

    expect(() =>
      planInvestmentExecution({
        ...original,
        lifecycleResult:
          mismatchedSubject,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_EXECUTION_SUBJECT_MISMATCH",
      }),
    );
    expect(() =>
      planInvestmentExecution({
        ...original,
        platformAnalysis: mismatchedRun,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_EXECUTION_RUN_MISMATCH",
      }),
    );
  });

  it("rejects a Decision referencing an unrelated recommendation", () => {
    const original = committedCommand(
      createPurchaseLifecycleResult(),
    );
    const decision = Decision.create({
      id: original.decision.id,
      type: original.decision.type,
      outcome: original.decision.outcome,
      context: original.decision.context,
      rationale: original.decision.rationale,
      decidedAt:
        original.decision.decidedAt,
      title: original.decision.title,
      summary: original.decision.summary,
      mode: original.decision.mode,
      priority: original.decision.priority,
      confidence:
        original.decision.confidence,
      recommendationIds: [
        Identifier.create(
          "unrelated-recommendation",
        ),
      ],
      metadata: {
        ...original.decision.metadata,
        recommendationId:
          "unrelated-recommendation",
      },
    });

    expect(() =>
      planInvestmentExecution({
        ...original,
        decision,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_EXECUTION_RECOMMENDATION_MISMATCH",
      }),
    );
  });

  it("uses risk references to explain financing validation", () => {
    const original =
      createPurchaseLifecycleResult();
    const lifecycle = {
      ...original,
      analysis: {
        ...original.analysis,
        risks: [
          ...original.analysis.risks,
          {
            id: "high-leverage",
            title: "High leverage",
            description:
              "Debt leverage requires lender validation.",
            severity: RiskSeverity.High,
            probability: { value: 70 },
          },
        ],
      },
    } satisfies InvestmentLifecycleResult;
    const plan = planInvestmentExecution(
      committedCommand(lifecycle),
    );

    expect(
      plan.intents.find(
        ({ key }) =>
          key === "validate-financing",
      )?.sourceReferences,
    ).toContain("risk:high-leverage");
  });

  it("requires one unique deterministic Action ID per intent", () => {
    const original = committedCommand(
      createPurchaseLifecycleResult(),
    );
    const missing = {
      ...original.context,
      actionIds: {},
    };
    const duplicate = {
      ...original.context,
      actionIds: Object.fromEntries(
        Object.keys(allActionIds).map(
          (key) => [key, "action-duplicate"],
        ),
      ),
    };

    expect(() =>
      planInvestmentExecution({
        ...original,
        context: missing,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_EXECUTION_ACTION_ID_MISSING",
      }),
    );
    expect(() =>
      planInvestmentExecution({
        ...original,
        context: duplicate,
      }),
    ).toThrowError(
      expect.objectContaining({
        code:
          "INVESTMENT_EXECUTION_DUPLICATE_ACTION_ID",
      }),
    );
  });

  it("is deterministic and emits an acyclic dependency graph", () => {
    const command = committedCommand(
      createRentalLifecycleResult(),
    );
    const first =
      planInvestmentExecution(command);
    const positions = new Map(
      first.intents.map(({ key }, index) => [
        key,
        index,
      ]),
    );

    expect(first).toEqual(
      planInvestmentExecution(command),
    );
    for (const value of first.intents) {
      for (const dependency of value.dependencies) {
        expect(positions.get(dependency))
          .toBeLessThan(
            positions.get(value.key) ?? 0,
          );
      }
    }
  });
});
