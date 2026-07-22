import type {
  Decision,
} from "@/platform/decisions";
import type {
  Recommendation,
} from "@/platform/recommendations";

import type {
  AcquisitionType,
  InvestmentLifecycleResult,
  InvestmentPlatformAnalysis,
} from "../../domain";

export type InvestmentCommitmentResponse =
  | "accept"
  | "reject"
  | "defer";

export type InvestmentCommitmentDecisionOutcome =
  | "accepted"
  | "rejected"
  | "deferred";

export type InvestmentCommitmentActor =
  Readonly<{
    id: string;
    displayName?: string;
  }>;

export type InvestmentCommitmentContext =
  Readonly<{
    decisionId: string;
    decidedAt: Date;
  }>;

export type CommitInvestmentRecommendationCommand =
  Readonly<{
    lifecycleResult:
      InvestmentLifecycleResult;
    platformAnalysis:
      InvestmentPlatformAnalysis;
    recommendationId: string;
    response:
      InvestmentCommitmentResponse;
    rationale?: string;
    actor: InvestmentCommitmentActor;
    context: InvestmentCommitmentContext;
  }>;

export type InvestmentCommitmentResult =
  Readonly<{
    acquisitionType: AcquisitionType;
    response:
      InvestmentCommitmentResponse;
    platformRunId: string;
    recommendationId: string;
    recommendation: Recommendation;
    decision: Decision<
      InvestmentCommitmentDecisionOutcome
    >;
  }>;
