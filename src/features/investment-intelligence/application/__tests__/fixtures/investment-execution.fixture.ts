import type {
  PlatformAction,
} from "@/platform/actions";

import {
  commitInvestmentRecommendation,
} from "../../commit-investment-recommendation";
import {
  planInvestmentExecution,
} from "../../plan-investment-execution";
import {
  mapInvestmentPlatformAnalysis,
} from "../../adapters/map-investment-platform-analysis";
import {
  createPurchaseLifecycleResult,
  createRentalLifecycleResult,
} from "./investment-lifecycle.fixture";

import type {
  InvestmentLifecycleResult,
} from "../../../domain";

const actionIds = {
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

export function createInvestmentExecutionFixture(
  route: "purchase" | "rental",
) {
  const lifecycleResult =
    route === "purchase"
      ? createPurchaseLifecycleResult()
      : createRentalLifecycleResult();

  return executionFixture(lifecycleResult);
}

function executionFixture(
  lifecycleResult: InvestmentLifecycleResult,
) {
  const platformAnalysis =
    mapInvestmentPlatformAnalysis(
      lifecycleResult,
      {
        runId: "investment-run-007c",
        observedAt:
          new Date("2026-02-01T10:00:00Z"),
        sourceQuality: {
          comparables: "synthetic",
          regulation: "unknown",
          utilitiesResponsibility:
            "unknown",
        },
      },
    );
  const recommendationId =
    platformAnalysis.recommendations
      .toArray()[0].id.value;
  const commitment =
    commitInvestmentRecommendation({
      lifecycleResult,
      platformAnalysis,
      recommendationId,
      response: "accept",
      actor: { id: "operator-007c" },
      context: {
        decisionId:
          `decision-007c-${lifecycleResult.acquisitionType}`,
        decidedAt:
          new Date("2026-02-01T11:00:00Z"),
      },
    });
  const plan = planInvestmentExecution({
    lifecycleResult,
    platformAnalysis,
    decision: commitment.decision,
    actor: { id: "operator-007c" },
    context: {
      planId: "plan-007c",
      workspaceId: "workspace-007c",
      plannedAt:
        new Date("2026-02-01T12:00:00Z"),
      actionIds,
    },
  });

  return {
    lifecycleResult,
    platformAnalysis,
    decision: commitment.decision,
    plan,
  };
}

export function completeInvestmentAction(
  action: PlatformAction,
): PlatformAction {
  const actor = {
    type: "user" as const,
    id: "operator-007c",
  };
  const mutation = (
    value: PlatformAction,
    occurredAt: Date,
  ) => ({
    workspaceId: value.workspaceId,
    expectedVersion: value.version,
    actor,
    occurredAt,
  });
  const committed = action.commit(
    mutation(
      action,
      new Date("2026-02-02T09:00:00Z"),
    ),
  );
  const ready = committed.markReady(
    mutation(
      committed,
      new Date("2026-02-02T10:00:00Z"),
    ),
  );
  const started = ready.start(
    mutation(
      ready,
      new Date("2026-02-02T11:00:00Z"),
    ),
  );

  return started.complete(
    mutation(
      started,
      new Date("2026-02-02T12:00:00Z"),
    ),
  );
}
