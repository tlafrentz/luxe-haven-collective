import {
  PlatformAction,
  createActionHistoryId,
  createActionId,
  createWorkspaceId,
} from "@/platform/actions";

import type {
  AcquisitionType,
} from "../../domain";
import type {
  InvestmentCommitmentActor,
  InvestmentExecutionIntent,
  InvestmentExecutionPlanningContext,
} from "../types";

export type InvestmentExecutionLineage =
  Readonly<{
    acquisitionType: AcquisitionType;
    subjectId: string;
    decisionId: string;
    recommendationId: string;
    investmentRunId: string;
  }>;

/** The sole Investment adapter that translates feature intents into Actions. */
export function mapInvestmentExecutionPlanToActions(
  intents:
    readonly InvestmentExecutionIntent[],
  lineage: InvestmentExecutionLineage,
  actor: InvestmentCommitmentActor,
  context:
    InvestmentExecutionPlanningContext,
): readonly PlatformAction[] {
  const actionActor = {
    type: "user" as const,
    id: actor.id,
  };

  return intents.map((intent) => {
    const actionIdValue =
      context.actionIds[intent.key];

    return PlatformAction.createDraft({
      id: createActionId(actionIdValue),
      creationHistoryId:
        createActionHistoryId(
          `${actionIdValue}-created`,
        ),
      workspaceId:
        createWorkspaceId(
          context.workspaceId,
        ),
      title: intent.title,
      description:
        `${intent.description} Rationale: ${intent.rationale}`,
      actionType:
        `investment.${intent.category}`,
      priority: intent.priority,
      owner: {
        type: "system",
        id: "investment-execution-planning",
      },
      sources: [
        {
          type: "decision",
          sourceId: lineage.decisionId,
          capability:
            "investment-intelligence",
          recordedAt: context.plannedAt,
          recordedBy: actionActor,
        },
        {
          type: "recommendation",
          sourceId:
            lineage.recommendationId,
          capability:
            "investment-intelligence",
          recordedAt: context.plannedAt,
          recordedBy: actionActor,
        },
        {
          type: "automation",
          sourceId: context.planId,
          capability:
            "investment-execution-plan",
          recordedAt: context.plannedAt,
          recordedBy: actionActor,
        },
        {
          type: "automation",
          sourceId: intent.key,
          capability:
            "investment-execution-intent",
          recordedAt: context.plannedAt,
          recordedBy: actionActor,
        },
        {
          type: "api",
          sourceId:
            lineage.investmentRunId,
          capability:
            "investment-platform-run",
          recordedAt: context.plannedAt,
          recordedBy: actionActor,
        },
        {
          type: "manual",
          sourceId: lineage.subjectId,
          capability:
            `investment-subject:${lineage.acquisitionType}`,
          recordedAt: context.plannedAt,
          recordedBy: actionActor,
        },
      ],
      createdAt: context.plannedAt,
      createdBy: actionActor,
      commandId: context.planId,
    });
  });
}
