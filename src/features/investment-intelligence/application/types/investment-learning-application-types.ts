import type {
  Decision,
} from "@/platform/decisions";
import type {
  LearningInsight,
} from "@/platform/learning";

import type {
  AcquisitionType,
} from "../../domain";
import type {
  InvestmentCommitmentActor,
} from "./investment-commitment-types";

export type LearningApplicationStatus =
  | "proposed"
  | "approved"
  | "rejected"
  | "deferred"
  | "applied"
  | "expired"
  | "superseded";

export type InvestmentLearningApplicationTarget =
  | Readonly<{
      kind: "subject-assumption";
      subjectId: string;
      assumptionKey: string;
    }>
  | Readonly<{
      kind: "subject-strategy";
      subjectId: string;
      acquisitionType: AcquisitionType;
    }>
  | Readonly<{
      kind: "market-assumption-candidate";
      marketId: string;
      assumptionKey: string;
    }>
  | Readonly<{
      kind: "execution-policy-candidate";
      acquisitionType: AcquisitionType;
      policyKey: string;
    }>
  | Readonly<{
      kind: "confidence-calibration-candidate";
      capability: "investment-intelligence";
      dimension: string;
    }>;

export type InvestmentLearningApplicationMode =
  | "replace-assumption"
  | "adjust-assumption"
  | "add-constraint"
  | "resolve-data-gap"
  | "add-risk-context"
  | "calibration-candidate"
  | "policy-review-candidate";

export type InvestmentLearningAppliedValue = Readonly<{
  value: number | string | boolean;
  unit?: string;
}>;

export type InvestmentLearningApplicationProposal = Readonly<{
  id: string;
  status: Extract<
    LearningApplicationStatus,
    "proposed" | "rejected" | "deferred" | "superseded"
  >;
  learningInsightIds: readonly string[];
  target: InvestmentLearningApplicationTarget;
  mode: InvestmentLearningApplicationMode;
  proposedValue?: InvestmentLearningAppliedValue;
  rationale: string;
  evidenceSummary: string;
  limitations: readonly string[];
  effectiveFrom?: Date;
  expiresAt?: Date;
  supersedesApplicationId?: string;
  proposedBy: InvestmentCommitmentActor;
  proposedAt: Date;
}>;

export type InvestmentLearningReviewDisposition =
  | "approve"
  | "reject"
  | "defer";

export type InvestmentLearningApplicationDecisionOutcome =
  | "approved"
  | "rejected"
  | "deferred";

export type InvestmentLearningReview = Readonly<{
  id: string;
  proposalId: string;
  disposition: InvestmentLearningReviewDisposition;
  rationale: string;
  reviewer: InvestmentCommitmentActor;
  reviewedAt: Date;
  decision: Decision<
    InvestmentLearningApplicationDecisionOutcome
  >;
}>;

export type InvestmentLearningApplication = Readonly<{
  id: string;
  version: number;
  status: Extract<
    LearningApplicationStatus,
    "approved" | "applied" | "expired" | "superseded"
  >;
  approvalDecisionId: string;
  learningInsightIds: readonly string[];
  target: InvestmentLearningApplicationTarget;
  mode: InvestmentLearningApplicationMode;
  appliedValue?: InvestmentLearningAppliedValue;
  rationale: string;
  limitations: readonly string[];
  approvedBy: InvestmentCommitmentActor;
  approvedAt: Date;
  effectiveFrom?: Date;
  expiresAt?: Date;
  sourceSubjectIds: readonly string[];
  sourceOutcomeIds: readonly string[];
  sourceInvestmentRunIds: readonly string[];
  supersedesApplicationId?: string;
}>;

export type InvestmentLearningApplicationReviewContext = Readonly<{
  reviewId: string;
  decisionId: string;
  applicationId: string;
  reviewedAt: Date;
  existingApplications?: readonly InvestmentLearningApplication[];
}>;

export type ReviewInvestmentLearningApplicationCommand = Readonly<{
  proposal: InvestmentLearningApplicationProposal;
  learnings: readonly LearningInsight[];
  disposition: InvestmentLearningReviewDisposition;
  rationale: string;
  reviewer: InvestmentCommitmentActor;
  context: InvestmentLearningApplicationReviewContext;
}>;

export type InvestmentLearningApplicationReviewResult = Readonly<{
  review: InvestmentLearningReview;
  application?: InvestmentLearningApplication;
}>;

/** Future input contract. II-008A does not build or consume this context. */
export type InvestmentAppliedLearningContext = Readonly<{
  applicationIds: readonly string[];
  assumptionOverrides: readonly Readonly<{
    subjectId: string;
    assumptionKey: string;
    value: number | string | boolean;
    unit?: string;
  }>[];
  constraints: readonly Readonly<{
    subjectId: string;
    description: string;
  }>[];
  resolvedDataGaps: readonly string[];
  riskContexts: readonly Readonly<{
    subjectId: string;
    description: string;
  }>[];
}>;
