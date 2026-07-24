import { Identifier } from "@/platform/kernel";
import type {
  OutcomeEvidenceId, OutcomeExpectationId, OutcomeId, OutcomeMeasurementId,
  OutcomeMeasurementPlanId, OutcomeMeasurementWindowId, OutcomeMetricKey,
  OutcomeOwnerId, OutcomeQualitativeObservationId,
} from "./outcome-model";

export const createOutcomeId = (value: string): OutcomeId => Identifier.create(value);
export const createOutcomeOwnerId = (value: string): OutcomeOwnerId => Identifier.create(value);
export const createOutcomeExpectationId = (value: string): OutcomeExpectationId => Identifier.create(value);
export const createOutcomeMeasurementPlanId = (value: string): OutcomeMeasurementPlanId => Identifier.create(value);
export const createOutcomeMeasurementWindowId = (value: string): OutcomeMeasurementWindowId => Identifier.create(value);
export const createOutcomeMeasurementId = (value: string): OutcomeMeasurementId => Identifier.create(value);
export const createOutcomeQualitativeObservationId = (value: string): OutcomeQualitativeObservationId => Identifier.create(value);
export const createOutcomeEvidenceId = (value: string): OutcomeEvidenceId => Identifier.create(value);
export const createOutcomeMetricKey = (value: string): OutcomeMetricKey => Identifier.create(value);
