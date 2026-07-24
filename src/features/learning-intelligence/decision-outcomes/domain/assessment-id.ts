import { Identifier } from "@/platform/kernel";
import type { DecisionOutcomeAssessmentId } from "./assessment-model";

export const createDecisionOutcomeAssessmentId = (value: string): DecisionOutcomeAssessmentId => Identifier.create(value);
