import { Result, type ResultType } from "@/platform/kernel";
import type { OutcomeId, OutcomeOwnerId } from "../../outcomes";
import {
  DecisionOutcomeError, evaluateDecisionOutcome,
  type DecisionOutcomeAssessment, type DecisionOutcomeAssessmentId, type DecisionOutcomePolicy,
} from "../domain";
import type {
  DecisionOutcomeApplicationError, DecisionOutcomeAssessmentRepository,
  DecisionOutcomeAuthorization, DecisionOutcomeOutcomeReader, DecisionOutcomeRepositoryError,
} from "./contracts";

export type EvaluateDecisionOutcomeCommand = Readonly<{
  ownerId: OutcomeOwnerId;
  outcomeId: OutcomeId;
  assessmentId: DecisionOutcomeAssessmentId;
  policy: DecisionOutcomePolicy;
  evaluatedAt: Date;
  eventId: string;
  expectedAssessmentVersion: number | null;
  correlationId?: string;
}>;
type Dependencies = Readonly<{
  outcomes: DecisionOutcomeOutcomeReader;
  assessments: DecisionOutcomeAssessmentRepository;
  authorization: DecisionOutcomeAuthorization;
}>;

export async function evaluateDecisionOutcomeService(
  dependencies: Dependencies,
  command: EvaluateDecisionOutcomeCommand,
): Promise<ResultType<DecisionOutcomeAssessment, DecisionOutcomeApplicationError>> {
  if (!await dependencies.authorization.canEvaluateOutcome(command.ownerId, command.outcomeId)) return Result.fail({ code: "ASSESSMENT_NOT_AUTHORIZED" });
  const loaded = await dependencies.outcomes.getOutcome(command.ownerId, command.outcomeId);
  if (loaded.isFailure) return Result.fail(mapRepository(loaded.error));
  if (!loaded.value) return Result.fail({ code: "OUTCOME_NOT_FOUND" });
  const previous = await dependencies.assessments.findLatestByOutcome(command.ownerId, command.outcomeId);
  if (previous.isFailure) return Result.fail(mapRepository(previous.error));
  if ((previous.value?.version ?? null) !== command.expectedAssessmentVersion) {
    return Result.fail({ code: "ASSESSMENT_VERSION_CONFLICT", ...(previous.value ? { currentVersion: previous.value.version } : {}) });
  }
  try {
    const assessment = evaluateDecisionOutcome({
      assessmentId: command.assessmentId, outcome: loaded.value, policy: command.policy,
      evaluatedAt: command.evaluatedAt, eventId: command.eventId,
      ...(previous.value ? { previousAssessment: previous.value } : {}),
    });
    const saved = await dependencies.assessments.save(assessment, command.expectedAssessmentVersion);
    return saved.isFailure ? Result.fail(mapRepository(saved.error)) : Result.ok(assessment);
  } catch (error) {
    if (error instanceof DecisionOutcomeError) return Result.fail({ code: "OUTCOME_NOT_EVALUABLE", reason: error.message });
    return Result.fail({ code: "ASSESSMENT_UNEXPECTED", correlationId: command.correlationId });
  }
}
function mapRepository(error: DecisionOutcomeRepositoryError): DecisionOutcomeApplicationError {
  if (error.code === "ASSESSMENT_VERSION_CONFLICT") return error;
  if (error.code === "ASSESSMENT_REPOSITORY_UNAVAILABLE") return error;
  return { code: "ASSESSMENT_UNEXPECTED" };
}
