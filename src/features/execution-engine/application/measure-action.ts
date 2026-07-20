import type { Outcome } from "@/platform/outcomes";
import type { ActionMeasuredImpact, ExecutiveAction } from "../compatibility";
import { toExecutiveAction, toPlatformAction } from "../compatibility";
import { createMeasuredOutcome, toLegacyActionOutcome } from "./mappers";

export type MeasureActionInput = {
  action: ExecutiveAction;
  measuredAt: string;
  measuredImpact?: ActionMeasuredImpact;
  lessonsLearned?: string[];
};

export type MeasureActionResult = Readonly<{ action: ExecutiveAction; outcome: Outcome }>;

/** Canonical measurement path: Outcome is authoritative; Action is a compatibility projection. */
export function measureActionWithOutcome(input: MeasureActionInput): MeasureActionResult {
  if (input.action.status !== "completed") throw new Error(`Cannot measure action with status "${input.action.status}".`);
  if (!input.action.outcome) throw new Error("Cannot measure an action without a completion outcome.");
  const lessons = input.lessonsLearned?.map((lesson) => lesson.trim()).filter(Boolean) ?? [];
  const hasImpact = Object.values(input.measuredImpact ?? {}).some((value) => value !== undefined);
  if (!hasImpact && lessons.length === 0) throw new Error("Action measurement must include measured impact or lessons learned.");

  const outcome = createMeasuredOutcome({ ...input, lessonsLearned: lessons });
  const legacyOutcome = toLegacyActionOutcome(outcome);
  const measured = toPlatformAction(input.action).measure(new Date(input.measuredAt), {
    measuredImpact: legacyOutcome.measuredImpact,
    lessonsLearned: legacyOutcome.lessonsLearned,
  });
  return { action: { ...toExecutiveAction(measured), measuredAt: input.measuredAt, outcome: legacyOutcome }, outcome };
}

/** @deprecated Use measureActionWithOutcome so canonical Outcome truth is retained. */
export function measureAction(input: MeasureActionInput): ExecutiveAction {
  const result = measureActionWithOutcome(input).action;
  if (!result.outcome) return result;
  const legacyOutcome = {
    summary: result.outcome.summary,
    successful: result.outcome.successful,
    ...(result.outcome.measuredImpact ? { measuredImpact: result.outcome.measuredImpact } : {}),
    ...(result.outcome.lessonsLearned ? { lessonsLearned: result.outcome.lessonsLearned } : {}),
    ...(input.action.outcome?.metadata ? { metadata: input.action.outcome.metadata } : {}),
  };
  return { ...result, outcome: legacyOutcome };
}
