import type {
  ActionOutcome,
  ActionStatus,
  Action,
} from "@/platform/actions";

import type {
  ExecutionTimelineEvent,
  ExecutionWorkspace,
  ExecutionWorkspaceNextStep,
  ExecutionWorkspaceRecord,
} from "../domain";

function buildTimeline(
  action: Action,
): ExecutionTimelineEvent[] {
  const events: ExecutionTimelineEvent[] = [
    {
      type: "created",
      label: "Action created",
      timestamp: action.createdAt.toISOString(),
      completed: true,
    },
  ];

  if (action.acceptedAt) {
    events.push({
      type: "accepted",
      label: "Action accepted",
      timestamp: action.acceptedAt.toISOString(),
      completed: true,
    });
  }

  if (action.startedAt) {
    events.push({
      type: "started",
      label: "Execution started",
      timestamp: action.startedAt.toISOString(),
      completed: true,
    });
  }

  if (action.completedAt) {
    events.push({
      type: "completed",
      label: "Execution completed",
      timestamp: action.completedAt.toISOString(),
      completed: true,
    });
  }

  if (action.measuredAt) {
    events.push({
      type: "measured",
      label: "Outcome measured",
      timestamp: action.measuredAt.toISOString(),
      completed: true,
    });
  }

  if (action.archivedAt) {
    events.push({
      type: "archived",
      label: "Action archived",
      timestamp: action.archivedAt.toISOString(),
      completed: true,
    });
  }

  return events.sort(
    (left, right) =>
      new Date(left.timestamp).getTime() -
      new Date(right.timestamp).getTime(),
  );
}

function getNextStep(
  status: ActionStatus,
): ExecutionWorkspaceNextStep {
  switch (status) {
    case "accepted":
    case "scheduled":
      return "start";

    case "in-progress":
    case "blocked":
      return "complete";

    case "completed":
      return "measure";

    case "measured":
      return "archive";

    case "proposed":
    case "archived":
      return "none";
  }
}

function cloneActionOutcome(outcome: ActionOutcome): ActionOutcome {
  return {
    summary: outcome.summary,
    successful: outcome.successful,
    ...(outcome.measuredImpact
      ? { measuredImpact: { ...outcome.measuredImpact } }
      : {}),
    ...(outcome.lessonsLearned
      ? { lessonsLearned: [...outcome.lessonsLearned] }
      : {}),
    ...(outcome.metadata
      ? { metadata: { ...outcome.metadata } }
      : {}),
  };
}

export function buildExecutionWorkspace(
  record: ExecutionWorkspaceRecord,
): ExecutionWorkspace {
  const action = record.action;
  const platformOutcome = record.outcome;
  const actionOutcome = action.outcome;
  const context = record.decisionContext;

  void platformOutcome;

  return {
    id: action.id.value,

    outcomeTitle:
      context?.outcomeTitle ??
      action.title,

    whyNow:
      context?.whyNow ??
      action.summary,

    evidence:
      context?.evidence.map(
        (item) => ({
          ...item,
        }),
      ) ?? [],

    recommendedAction: {
      title: action.title,
      summary: action.summary,
    },

    metadata: {
      ownerName: action.owner.displayName,
      ownerType: action.owner.type,
      propertyId:
        typeof action.metadata.legacyPropertyId === "string"
          ? action.metadata.legacyPropertyId
          : null,
      source:
        typeof action.metadata.source === "string"
          ? action.metadata.source
          : null,
      type: action.type,
      priority: action.priority,
      status: action.status,
      ...(context?.expectedImpact
        ? { expectedImpact: context.expectedImpact }
        : {}),
      ...(context?.confidence
        ? { confidence: context.confidence }
        : {}),
    },

    timeline: buildTimeline(action),

    learning: {
      status:
        action.measuredAt ||
        actionOutcome?.measuredImpact ||
        actionOutcome?.lessonsLearned?.length
          ? "captured"
          : "pending",
      ...(actionOutcome
        ? { outcome: cloneActionOutcome(actionOutcome) }
        : {}),
    },

    nextStep: getNextStep(action.status),
  };
}
