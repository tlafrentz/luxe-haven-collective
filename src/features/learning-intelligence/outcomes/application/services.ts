import { Result, type ResultType } from "@/platform/kernel";
import { Outcome, OutcomeDomainError } from "../domain";
import type { OutcomeId, OutcomeOwnerId } from "../domain";
import type {
  AttachOutcomeEvidenceCommand, CancelOutcomeCommand, CloseOutcomeCommand,
  CloseOutcomeMeasurementWindowCommand, CompleteOutcomeMeasurementCommand,
  MarkOutcomeInconclusiveCommand, PlanOutcomeCommand, RecordOutcomeMeasurementCommand,
  RecordOutcomeQualitativeObservationCommand, StartOutcomeMeasurementCommand,
  SupersedeOutcomeCommand, UpdateOutcomeAttributionCommand,
} from "./commands";
import type { OutcomeApplicationError, OutcomeAuthorization, OutcomeRepository, OutcomeRepositoryError } from "./contracts";

type Dependencies = Readonly<{ repository: OutcomeRepository; authorization: OutcomeAuthorization }>;
type Existing = Readonly<{ ownerId: OutcomeOwnerId; outcomeId: OutcomeId; expectedVersion: number; idempotencyKey: string }>;

export async function planOutcome(dependencies: Dependencies, command: PlanOutcomeCommand): Promise<ResultType<Outcome, OutcomeApplicationError>> {
  if (!await dependencies.authorization.canCreateOutcome(command.ownerId, command.subject)) return Result.fail({ code: "OUTCOME_NOT_AUTHORIZED" });
  const duplicate = await dependencies.repository.existsByOrigin(command.ownerId, command.origin);
  if (duplicate.isFailure) return Result.fail(mapRepositoryError(duplicate.error));
  if (duplicate.value) return Result.fail({ code: "OUTCOME_DUPLICATE_ORIGIN" });
  try {
    const outcome = Outcome.plan(command);
    const saved = await dependencies.repository.save(outcome, null);
    return saved.isFailure ? Result.fail(mapRepositoryError(saved.error)) : Result.ok(outcome);
  } catch (error) {
    return Result.fail(mapUnexpected(error));
  }
}

export const startOutcomeMeasurement = (dependencies: Dependencies, command: StartOutcomeMeasurementCommand) =>
  mutate(dependencies, command, outcome => outcome.startMeasurement(ctx(command.startedAt, command.idempotencyKey)));
export const recordOutcomeMeasurement = (dependencies: Dependencies, command: RecordOutcomeMeasurementCommand) =>
  mutate(dependencies, command, outcome => outcome.recordMeasurement(command.measurement, ctx(command.recordedAt, command.idempotencyKey)));
export const recordOutcomeQualitativeObservation = (dependencies: Dependencies, command: RecordOutcomeQualitativeObservationCommand) =>
  mutate(dependencies, command, outcome => outcome.recordQualitativeObservation(command.observation, ctx(command.recordedAt, command.idempotencyKey)));
export const attachOutcomeEvidence = (dependencies: Dependencies, command: AttachOutcomeEvidenceCommand) =>
  mutate(dependencies, command, outcome => outcome.attachEvidence(command.evidence, ctx(command.attachedAt, command.idempotencyKey)));
export const updateOutcomeAttribution = (dependencies: Dependencies, command: UpdateOutcomeAttributionCommand) =>
  mutate(dependencies, command, outcome => outcome.updateAttribution(command.attribution, ctx(command.updatedAt, command.idempotencyKey)));
export const closeOutcomeMeasurementWindow = (dependencies: Dependencies, command: CloseOutcomeMeasurementWindowCommand) =>
  mutate(dependencies, command, outcome => outcome.closeWindow(command.windowId, ctx(command.closedAt, command.idempotencyKey)));
export const completeOutcomeMeasurement = (dependencies: Dependencies, command: CompleteOutcomeMeasurementCommand) =>
  mutate(dependencies, command, outcome => outcome.completeMeasurement(ctx(command.completedAt, command.idempotencyKey)));
export const markOutcomeInconclusive = (dependencies: Dependencies, command: MarkOutcomeInconclusiveCommand) =>
  mutate(dependencies, command, outcome => outcome.markInconclusive(command.reason, command.dataGaps, ctx(command.markedAt, command.idempotencyKey)));
export const closeOutcome = (dependencies: Dependencies, command: CloseOutcomeCommand) =>
  mutate(dependencies, command, outcome => outcome.close(ctx(command.closedAt, command.idempotencyKey)));
export const cancelOutcome = (dependencies: Dependencies, command: CancelOutcomeCommand) =>
  mutate(dependencies, command, outcome => outcome.cancel(command.reason, ctx(command.cancelledAt, command.idempotencyKey)));
export const supersedeOutcome = (dependencies: Dependencies, command: SupersedeOutcomeCommand) =>
  mutate(dependencies, command, outcome => outcome.supersede(command.supersedingOutcomeId, command.reason, ctx(command.supersededAt, command.idempotencyKey)));

async function mutate(dependencies: Dependencies, command: Existing, behavior: (outcome: Outcome) => void): Promise<ResultType<Outcome, OutcomeApplicationError>> {
  if (!await dependencies.authorization.canModifyOutcome(command.ownerId, command.outcomeId)) return Result.fail({ code: "OUTCOME_NOT_AUTHORIZED" });
  const loaded = await dependencies.repository.findById(command.ownerId, command.outcomeId);
  if (loaded.isFailure) return Result.fail(mapRepositoryError(loaded.error));
  if (!loaded.value) return Result.fail({ code: "OUTCOME_NOT_FOUND" });
  if (loaded.value.props.acceptedIdempotencyKeys.includes(command.idempotencyKey)) return Result.ok(loaded.value);
  if (loaded.value.version !== command.expectedVersion) return Result.fail({ code: "OUTCOME_VERSION_CONFLICT", currentVersion: loaded.value.version });
  try {
    behavior(loaded.value);
    const saved = await dependencies.repository.save(loaded.value, command.expectedVersion);
    return saved.isFailure ? Result.fail(mapRepositoryError(saved.error)) : Result.ok(loaded.value);
  } catch (error) {
    return Result.fail(mapUnexpected(error));
  }
}
function ctx(occurredAt: Date, idempotencyKey: string) { return { occurredAt, idempotencyKey }; }
function mapRepositoryError(error: OutcomeRepositoryError): OutcomeApplicationError {
  if (error.code === "OUTCOME_VERSION_CONFLICT") return error;
  if (error.code === "OUTCOME_REPOSITORY_UNAVAILABLE") return error;
  if (error.code === "OUTCOME_DUPLICATE_ID") return { code: "OUTCOME_INPUT_INVALID", field: "outcomeId", reason: "duplicate" };
  return { code: "OUTCOME_UNEXPECTED" };
}
function mapUnexpected(error: unknown): OutcomeApplicationError {
  if (!(error instanceof OutcomeDomainError)) return { code: "OUTCOME_UNEXPECTED" };
  if (error.code === "OUTCOME_INVALID_TRANSITION" || error.code === "OUTCOME_IMMUTABLE") return { code: "OUTCOME_INVALID_TRANSITION", from: error.details?.from, to: error.details?.to };
  if (error.code === "OUTCOME_EXPECTATION_INVALID") return { code: "OUTCOME_EXPECTATION_INVALID", expectationId: error.details?.referenceId };
  if (error.code === "OUTCOME_MEASUREMENT_INVALID") return { code: "OUTCOME_MEASUREMENT_INVALID", measurementId: error.details?.referenceId };
  if (error.code === "OUTCOME_WINDOW_INVALID") return { code: "OUTCOME_WINDOW_INVALID", windowId: error.details?.referenceId };
  if (error.code === "OUTCOME_EVIDENCE_INSUFFICIENT") return { code: "OUTCOME_EVIDENCE_INSUFFICIENT" };
  return { code: "OUTCOME_INPUT_INVALID", field: error.details?.field, reason: error.message };
}
