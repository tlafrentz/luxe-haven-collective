import type { ActionCollection } from "../../actions";
import type { AutomationHistory } from "../../automations";
import type { DecisionCollection } from "../../decisions";
import type { IntelligenceCollection, IntelligenceReport } from "../../intelligence";
import type { ObservationValue } from "../../observations";
import type { Outcome, OutcomeCollection } from "../../outcomes";
import type { ConfidenceAssessment, ConfidenceScore } from "../../scoring";
import type { ConfidenceCalibrationId, LearningInsightId, LearningInsightType, PolicyImprovementId, ScoringFactorChange, ScoringImprovementId } from "../domain";

export type LearningRecordSet = Readonly<{ intelligence: IntelligenceCollection; outcomes: OutcomeCollection; decisions?: DecisionCollection; actions?: ActionCollection; automations?: AutomationHistory; historical?: Readonly<Record<string, readonly ObservationValue[]>> }>;
type ExplainableLearningResult = Readonly<{ title: string; summary: string; supportingOutcomes: readonly Outcome[]; supportingIntelligence: readonly IntelligenceReport[]; assumptions?: readonly string[]; rationale: readonly string[]; confidence: ConfidenceAssessment }>;
export type LearningInsightResult = ExplainableLearningResult & Readonly<{ id?: LearningInsightId; type: LearningInsightType }>;
export type PolicyImprovementResult = ExplainableLearningResult & Readonly<{ id?: PolicyImprovementId; targetPolicy: string; proposedChanges: Readonly<Record<string, ObservationValue>>; expectedImpact?: Readonly<Record<string, number>> }>;
export type ScoringImprovementResult = ExplainableLearningResult & Readonly<{ id?: ScoringImprovementId; targetModel: string; changes: readonly ScoringFactorChange[] }>;
export type ConfidenceCalibrationResult = ExplainableLearningResult & Readonly<{ id?: ConfidenceCalibrationId; estimatedConfidence: ConfidenceScore; observedAccuracy: ConfidenceScore; recommendedConfidence: ConfidenceScore; sampleSize: number }>;
export type LearningPolicyResult = Readonly<{ reportingPeriod: Readonly<{ start: Date; end: Date }>; summary: string; insights?: readonly LearningInsightResult[]; policyImprovements?: readonly PolicyImprovementResult[]; scoringImprovements?: readonly ScoringImprovementResult[]; confidenceCalibrations?: readonly ConfidenceCalibrationResult[]; confidence?: ConfidenceAssessment; metadata?: Readonly<Record<string, ObservationValue>> }>;
export type LearningPolicyContext = Readonly<{ records: LearningRecordSet }>;
export interface LearningPolicy { readonly name: string; readonly version?: string; supports(context: LearningPolicyContext): boolean | Promise<boolean>; learn(context: LearningPolicyContext): LearningPolicyResult | undefined | Promise<LearningPolicyResult | undefined>; }
