import type { ActionOutcome } from "@/platform/actions";
import { createOutcomeId, emptyOutcomeLineage, Outcome } from "@/platform/outcomes";
import { createActionId } from "@/platform/actions";
import type { ActionMeasuredImpact, ExecutiveAction } from "../../compatibility";

export type CreateMeasuredOutcomeInput = Readonly<{
  action: ExecutiveAction;
  measuredAt: string;
  measuredImpact?: ActionMeasuredImpact;
  lessonsLearned?: readonly string[];
}>;

/** Maps legacy measurement input into the canonical execution-truth artifact. */
export function createMeasuredOutcome(input: CreateMeasuredOutcomeInput): Outcome {
  const notes = [...(input.action.outcome?.lessonsLearned ?? []), ...(input.lessonsLearned ?? [])].map((lesson) => lesson.trim()).filter(Boolean);
  const metrics = Object.fromEntries(Object.entries({ ...input.action.outcome?.measuredImpact, ...input.measuredImpact }).filter((entry): entry is [string, number] => entry[1] !== undefined));
  const lineage = emptyOutcomeLineage();
  return Outcome.create({
    id: createOutcomeId(`outcome-${input.action.id}`),
    title: `${input.action.title} outcome`,
    summary: input.action.outcome?.summary ?? `Measured result for ${input.action.title}.`,
    type: "action",
    status: "completed",
    successful: input.action.outcome?.successful ?? true,
    startedAt: new Date(input.action.startedAt ?? input.action.acceptedAt ?? input.action.createdAt),
    completedAt: new Date(input.measuredAt),
    metrics,
    notes,
    lineage: { ...lineage, actionIds: [createActionId(input.action.id)] },
    metadata: { compatibilitySource: "execution-engine" },
  });
}

/** Temporary combined projection for callers that still expect measurement on Action. */
export function toLegacyActionOutcome(outcome: Outcome): ActionOutcome {
  return {
    summary: outcome.summary,
    successful: outcome.successful,
    ...(Object.keys(outcome.metrics).length > 0 ? { measuredImpact: outcome.metrics } : {}),
    ...(outcome.notes.length > 0 ? { lessonsLearned: outcome.notes } : {}),
    metadata: { canonicalOutcomeId: outcome.id.value },
  };
}
