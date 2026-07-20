import { Identifier } from "../../kernel";

export type LearningReportId = Identifier; export type LearningInsightId = Identifier; export type PolicyImprovementId = Identifier;
export type ScoringImprovementId = Identifier; export type ConfidenceCalibrationId = Identifier;
function create(prefix: string, value?: string): Identifier { return Identifier.create(value ?? `${prefix}-${crypto.randomUUID()}`); }
export const createLearningReportId = (value?: string): LearningReportId => create("learning-report", value);
export const createLearningInsightId = (value?: string): LearningInsightId => create("learning-insight", value);
export const createPolicyImprovementId = (value?: string): PolicyImprovementId => create("policy-improvement", value);
export const createScoringImprovementId = (value?: string): ScoringImprovementId => create("scoring-improvement", value);
export const createConfidenceCalibrationId = (value?: string): ConfidenceCalibrationId => create("confidence-calibration", value);
