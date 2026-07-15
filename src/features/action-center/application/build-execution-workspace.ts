import type {
  ActionStatus,
  ExecutiveAction,
} from "@/features/execution-engine";

import type {
  ExecutionTimelineEvent,
  ExecutionWorkspace,
  ExecutionWorkspaceNextStep,
  ExecutionWorkspaceRecord,
} from "../domain";

function buildTimeline(
  action: ExecutiveAction,
): ExecutionTimelineEvent[] {
  const events: ExecutionTimelineEvent[] = [
    {
      type: "created",
      label: "Action created",
      timestamp: action.createdAt,
      completed: true,
    },
  ];

  if (action.acceptedAt) {
    events.push({
      type: "accepted",
      label: "Action accepted",
      timestamp: action.acceptedAt,
      completed: true,
    });
  }

  if (action.startedAt) {
    events.push({
      type: "started",
      label: "Execution started",
      timestamp: action.startedAt,
      completed: true,
    });
  }

  if (action.completedAt) {
    events.push({
      type: "completed",
      label: "Execution completed",
      timestamp: action.completedAt,
      completed: true,
    });
  }

  if (action.measuredAt) {
    events.push({
      type: "measured",
      label: "Outcome measured",
      timestamp: action.measuredAt,
      completed: true,
    });
  }

  if (action.archivedAt) {
    events.push({
      type: "archived",
      label: "Action archived",
      timestamp: action.archivedAt,
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
      return "start";

    case "scheduled":
    case "in-progress":
    case "blocked":
      return "complete";

    case "completed":
      return "measure";

    case "proposed":
    case "measured":
      return "archive";

    case "archived":
      return "none";
  }
}

export function buildExecutionWorkspace({
  action,
  decisionContext,
}: ExecutionWorkspaceRecord): ExecutionWorkspace {
  return {
    id: action.id,

    outcomeTitle:
      decisionContext?.outcomeTitle ??
      action.title,

    whyNow:
      decisionContext?.whyNow ??
      action.summary,

    evidence:
      decisionContext?.evidence.map(
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
      propertyId: action.propertyId,
      source: action.source,
      type: action.type,
      priority: action.priority,
      status: action.status,
      expectedImpact:
        decisionContext?.expectedImpact,
      confidence:
        decisionContext?.confidence,
    },

    timeline: buildTimeline(action),

    learning: {
      status:
        action.status === "measured"
          ? "captured"
          : "pending",
      outcome: action.outcome
        ? {
            ...action.outcome,
            measuredImpact:
              action.outcome.measuredImpact
                ? {
                    ...action.outcome
                      .measuredImpact,
                  }
                : undefined,
            lessonsLearned:
              action.outcome.lessonsLearned
                ? [
                    ...action.outcome
                      .lessonsLearned,
                  ]
                : undefined,
          }
        : undefined,
    },

    nextStep: getNextStep(action.status),
  };
}
