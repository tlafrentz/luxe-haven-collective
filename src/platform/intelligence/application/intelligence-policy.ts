import type { ActionCollection } from "../../actions";
import type { AutomationHistory } from "../../automations";
import type { ClaimCollection } from "../../claims";
import type { DecisionCollection } from "../../decisions";
import type { EvaluationCollection } from "../../evaluations";
import type { EvidenceCollection } from "../../evidence";
import type { ObservationCollection, ObservationValue } from "../../observations";
import type { Outcome, OutcomeCollection } from "../../outcomes";
import type { RecommendationCollection } from "../../recommendations";
import type { ConfidenceAssessment } from "../../scoring";
import type { WorkflowCollection } from "../../workflows";
import type { AnomalyId, ForecastId, InsightId, OpportunityId, TrendDirection, TrendId, TrendPoint } from "../domain";

export type IntelligenceRecordSet = Readonly<{
  outcomes: OutcomeCollection;
  observations?: ObservationCollection; evidence?: EvidenceCollection; claims?: ClaimCollection;
  evaluations?: EvaluationCollection; recommendations?: RecommendationCollection; decisions?: DecisionCollection;
  actions?: ActionCollection; workflows?: WorkflowCollection; automations?: AutomationHistory;
  historical?: Readonly<Record<string, readonly ObservationValue[]>>;
}>;
type ExplainableResult = Readonly<{
  title: string; summary: string; supportingOutcomes: readonly Outcome[]; confidence: ConfidenceAssessment;
  assumptions?: readonly string[]; rationale: readonly string[];
}>;
export type InsightResult = ExplainableResult & Readonly<{ id?: InsightId; businessImpact?: Readonly<Record<string, number>> }>;
export type TrendResult = ExplainableResult & Readonly<{ id?: TrendId; metric: string; direction: TrendDirection; points: readonly TrendPoint[] }>;
export type OpportunityResult = ExplainableResult & Readonly<{ id?: OpportunityId; expectedImpact: Readonly<Record<string, number>> }>;
export type ForecastResult = ExplainableResult & Readonly<{ id?: ForecastId; prediction: ObservationValue; horizon: Readonly<{ start: Date; end: Date }>; supportingIntelligenceIds?: readonly { value: string }[] }>;
export type AnomalyResult = ExplainableResult & Readonly<{ id?: AnomalyId; expected: ObservationValue; actual: ObservationValue; deviation?: number; explanation: string }>;
export type IntelligencePolicyResult = Readonly<{
  title: string; summary: string; reportingPeriod: Readonly<{ start: Date; end: Date }>;
  insights?: readonly InsightResult[]; trends?: readonly TrendResult[]; opportunities?: readonly OpportunityResult[];
  forecasts?: readonly ForecastResult[]; anomalies?: readonly AnomalyResult[]; confidence?: ConfidenceAssessment;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export type IntelligencePolicyContext = Readonly<{ records: IntelligenceRecordSet }>;
export interface IntelligencePolicy {
  readonly name: string; readonly version?: string;
  supports(context: IntelligencePolicyContext): boolean | Promise<boolean>;
  analyze(context: IntelligencePolicyContext): IntelligencePolicyResult | undefined | Promise<IntelligencePolicyResult | undefined>;
}
