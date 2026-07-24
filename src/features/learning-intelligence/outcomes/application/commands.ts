import type {
  OutcomeAttribution, OutcomeDataGap, OutcomeEvidenceReference, OutcomeId,
  OutcomeInconclusiveReason, OutcomeMeasurement, OutcomeMeasurementWindowId,
  OutcomeOwnerId, OutcomeQualitativeObservation,
} from "../domain";
import type { PlanOutcomeInput } from "../domain";

export type PlanOutcomeCommand = PlanOutcomeInput;
type ExistingCommand = Readonly<{ ownerId: OutcomeOwnerId; outcomeId: OutcomeId; expectedVersion: number; idempotencyKey: string }>;
export type StartOutcomeMeasurementCommand = ExistingCommand & Readonly<{ startedAt: Date }>;
export type RecordOutcomeMeasurementCommand = ExistingCommand & Readonly<{ measurement: OutcomeMeasurement; recordedAt: Date }>;
export type RecordOutcomeQualitativeObservationCommand = ExistingCommand & Readonly<{ observation: OutcomeQualitativeObservation; recordedAt: Date }>;
export type AttachOutcomeEvidenceCommand = ExistingCommand & Readonly<{ evidence: OutcomeEvidenceReference; attachedAt: Date }>;
export type UpdateOutcomeAttributionCommand = ExistingCommand & Readonly<{ attribution: OutcomeAttribution; updatedAt: Date }>;
export type CloseOutcomeMeasurementWindowCommand = ExistingCommand & Readonly<{ windowId: OutcomeMeasurementWindowId; closedAt: Date }>;
export type CompleteOutcomeMeasurementCommand = ExistingCommand & Readonly<{ completedAt: Date }>;
export type MarkOutcomeInconclusiveCommand = ExistingCommand & Readonly<{ reason: OutcomeInconclusiveReason; dataGaps: readonly OutcomeDataGap[]; markedAt: Date }>;
export type CloseOutcomeCommand = ExistingCommand & Readonly<{ closedAt: Date }>;
export type CancelOutcomeCommand = ExistingCommand & Readonly<{ reason: string; cancelledAt: Date }>;
export type SupersedeOutcomeCommand = ExistingCommand & Readonly<{ supersedingOutcomeId: OutcomeId; reason: string; supersededAt: Date }>;
