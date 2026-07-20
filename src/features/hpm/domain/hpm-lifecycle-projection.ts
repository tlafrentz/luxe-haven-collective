import type { Action, ActionCollection } from "@/platform/actions";
import type { ClaimCollection } from "@/platform/claims";
import type { DecisionCollection } from "@/platform/decisions";
import type { EvaluationCollection } from "@/platform/evaluations";
import type { EvidenceCollection } from "@/platform/evidence";
import type { IntelligenceCollection } from "@/platform/intelligence";
import type { LearningCollection, LearningReport } from "@/platform/learning";
import type { ObservationCollection } from "@/platform/observations";
import type { Outcome, OutcomeCollection } from "@/platform/outcomes";
import type { RecommendationCollection } from "@/platform/recommendations";
import type { Score, ScoreBreakdown } from "@/platform/scoring";

import type { HpmHealthStatus, HpmPillar } from "./index";

export type HpmCanonicalInputs = Readonly<{
  observations: ObservationCollection;
  evidence: EvidenceCollection;
  claims: ClaimCollection;
  evaluations: EvaluationCollection;
  recommendations: RecommendationCollection;
  decisions: DecisionCollection;
  actions: ActionCollection;
  outcomes: OutcomeCollection;
  intelligence: IntelligenceCollection;
  learning: LearningCollection;
  pillarScores?: ReadonlyMap<HpmPillar, Score>;
  executive?: Readonly<{ leadingPriorityId?: string; priorityCount: number }>;
  analytics?: Readonly<{ generatedAt: Date; metricCount: number }>;
}>;

export type HpmImprovementCycleStatus = "decided" | "executing" | "measured" | "learned";

export type HpmImprovementCycle = Readonly<{
  outcome: Outcome;
  actions: readonly Action[];
  learning: readonly LearningReport[];
  recommendationIds: readonly string[];
  decisionIds: readonly string[];
  status: HpmImprovementCycleStatus;
  hasCompleteExecutionLineage: boolean;
}>;

export type HpmOperatingHealth = Readonly<{
  score: Score | null;
  breakdown: ScoreBreakdown | null;
  status: HpmHealthStatus;
  dataCoverage: number;
  unresolvedDecisions: number;
  activeActions: number;
  executionCompletion: number | null;
  successfulOutcomes: number;
  failedOutcomes: number;
  realizedImpact: Readonly<Record<string, number>>;
  improvementMomentum: number | null;
  learningVelocity: number;
}>;

export type HpmLifecycleProjection = Readonly<{
  generatedAt: Date;
  see: Readonly<{ observations: ObservationCollection; outcomes: OutcomeCollection }>;
  understand: Readonly<{ evidence: EvidenceCollection; claims: ClaimCollection; evaluations: EvaluationCollection; intelligence: IntelligenceCollection }>;
  decide: Readonly<{ recommendations: RecommendationCollection; decisions: DecisionCollection }>;
  execute: Readonly<{ actions: ActionCollection }>;
  learn: Readonly<{ measuredOutcomes: OutcomeCollection; intelligence: IntelligenceCollection; learning: LearningCollection }>;
  health: HpmOperatingHealth;
  cycles: readonly HpmImprovementCycle[];
  currentPriorityId?: string;
  dataGaps: readonly string[];
}>;
