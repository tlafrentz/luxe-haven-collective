import type {
  Decision,
} from "@/platform/decisions";
import type {
  LearningInsight,
} from "@/platform/learning";
import type {
  Outcome,
} from "@/platform/outcomes";

import type {
  AcquisitionType,
  InvestmentLifecycleResult,
  InvestmentPlatformAnalysis,
} from "../../domain";
import type {
  InvestmentCommitmentActor,
  InvestmentCommitmentDecisionOutcome,
} from "./investment-commitment-types";

export type InvestmentLearningKind =
  | "confirmed"
  | "contradicted"
  | "refined"
  | "unresolved";

export type InvestmentLearningScope =
  | Readonly<{
      kind: "subject";
      subjectId: string;
    }>
  | Readonly<{
      kind: "market";
      marketId: string;
      justification: string;
    }>
  | Readonly<{
      kind: "strategy";
      acquisitionType: AcquisitionType;
      justification: string;
    }>
  | Readonly<{
      kind: "assumption-policy";
      assumptionKey: string;
      justification: string;
    }>;

export type InvestmentConfidenceImpact =
  | Readonly<{
      direction: "increase" | "decrease";
      magnitude: "minor" | "moderate" | "major";
      rationale: string;
    }>
  | Readonly<{
      direction: "none";
      rationale: string;
    }>;

export type InvestmentPolicyImpactTarget =
  | "revenue-assumption"
  | "expense-assumption"
  | "financing-assumption"
  | "regulatory-assumption"
  | "risk-policy"
  | "recommendation-policy"
  | "execution-policy";

export type InvestmentPolicyImpact =
  Readonly<{
    target: InvestmentPolicyImpactTarget;
    disposition:
      | "no-change"
      | "review"
      | "candidate-adjustment";
    rationale: string;
  }>;

export type InvestmentLearningCandidate =
  Readonly<{
    key: string;
    kind: InvestmentLearningKind;
    scope: InvestmentLearningScope;
    title: string;
    summary: string;
    outcomeIds: readonly string[];
    actionIds: readonly string[];
    assumptionReferences:
      readonly string[];
    recommendationReferences:
      readonly string[];
    sourceActorIds: readonly string[];
    confidenceImpact:
      InvestmentConfidenceImpact;
    policyImpact?: InvestmentPolicyImpact;
  }>;

export type InvestmentLearningPriorContext =
  Readonly<{
    lifecycleResult:
      InvestmentLifecycleResult;
    platformAnalysis:
      InvestmentPlatformAnalysis;
    decision: Decision<
      InvestmentCommitmentDecisionOutcome
    >;
    planId: string;
  }>;

export type InvestmentLearningContext =
  Readonly<{
    learningRunId: string;
    derivedAt: Date;
    learningIds:
      Readonly<Record<string, string>>;
    scopeOverrides?: Readonly<
      Record<
        string,
        Exclude<
          InvestmentLearningScope,
          { kind: "subject" }
        >
      >
    >;
  }>;

export type DeriveInvestmentLearningCommand =
  Readonly<{
    outcomes: readonly Outcome[];
    priorContext:
      InvestmentLearningPriorContext;
    actor: InvestmentCommitmentActor;
    context: InvestmentLearningContext;
  }>;

export type InvestmentLearningResult =
  Readonly<{
    learningRunId: string;
    subjectId: string;
    acquisitionType: AcquisitionType;
    investmentRunId: string;
    decisionId: string;
    recommendationId: string;
    planId: string;
    candidates:
      readonly InvestmentLearningCandidate[];
    learnings: readonly LearningInsight[];
  }>;
