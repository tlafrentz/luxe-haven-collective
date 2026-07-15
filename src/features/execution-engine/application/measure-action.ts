import type {
  ActionMeasuredImpact,
  ExecutiveAction,
} from "../domain";

export type MeasureActionInput = {
  action: ExecutiveAction;
  measuredAt: string;
  measuredImpact?: ActionMeasuredImpact;
  lessonsLearned?: string[];
};

function hasMeasuredImpact(
  measuredImpact?: ActionMeasuredImpact,
): boolean {
  return (
    measuredImpact !== undefined &&
    Object.values(measuredImpact).some(
      (value) => value !== undefined,
    )
  );
}

function getMeaningfulLessons(
  lessonsLearned?: string[],
): string[] {
  return (
    lessonsLearned
      ?.map((lesson) => lesson.trim())
      .filter((lesson) => lesson.length > 0) ??
    []
  );
}

export function measureAction({
  action,
  measuredAt,
  measuredImpact,
  lessonsLearned,
}: MeasureActionInput): ExecutiveAction {
  if (action.status !== "completed") {
    throw new Error(
      `Cannot measure action with status "${action.status}".`,
    );
  }

  if (!action.outcome) {
    throw new Error(
      "Cannot measure an action without a completion outcome.",
    );
  }

  const meaningfulLessons =
    getMeaningfulLessons(lessonsLearned);

  if (
    !hasMeasuredImpact(measuredImpact) &&
    meaningfulLessons.length === 0
  ) {
    throw new Error(
      "Action measurement must include measured impact or lessons learned.",
    );
  }

  const existingImpact =
    action.outcome.measuredImpact;

  const existingLessons =
    action.outcome.lessonsLearned ?? [];

  return {
    ...action,
    status: "measured",
    measuredAt,
    outcome: {
      ...action.outcome,
      measuredImpact:
        existingImpact || measuredImpact
          ? {
              ...existingImpact,
              ...measuredImpact,
            }
          : undefined,
      lessonsLearned: [
        ...existingLessons,
        ...meaningfulLessons,
      ],
    },
  };
}
