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
  previousValue?: InvestmentLearningAppliedValue;
  proposedValue?: InvestmentLearningAppliedValue;
  riskSeverity?: "informational" | "material" | "blocking";
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
  previousValue?: InvestmentLearningAppliedValue;
  appliedValue?: InvestmentLearningAppliedValue;
  riskSeverity?: "informational" | "material" | "blocking";
  rationale: string;
  limitations: readonly string[];
  approvedBy: InvestmentCommitmentActor;
  approvedAt: Date;
  effectiveFrom?: Date;
  expiresAt?: Date;
  sourceSubjectIds: readonly string[];
  sourceOutcomeIds: readonly string[];
  sourceInvestmentRunIds: readonly string[];
  sourceAcquisitionTypes: readonly AcquisitionType[];
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

export type InvestmentAssumptionOverride = Readonly<{
  assumptionKey: string;
  operation: "replace" | "adjust";
  previousValue?: InvestmentLearningAppliedValue;
  appliedValue: InvestmentLearningAppliedValue;
  applicationId: string;
  rationale: string;
}>;

export type InvestmentConstraint = Readonly<{
  key: string;
  description: string;
  applicationId: string;
}>;

export type InvestmentRiskContext = Readonly<{
  key: string;
  description: string;
  severity: "informational" | "material" | "blocking";
  applicationId: string;
}>;

export type AppliedLearningReference = Readonly<{
  applicationId: string;
  learningInsightIds: readonly string[];
  outcomeIds: readonly string[];
  investmentRunIds: readonly string[];
  approvalDecisionId: string;
}>;

export type InvestmentAppliedLearningContext = Readonly<{
  applicationIds: readonly string[];
  assumptionOverrides: readonly InvestmentAssumptionOverride[];
  constraints: readonly InvestmentConstraint[];
  resolvedDataGaps: readonly string[];
  persistentRisks: readonly InvestmentRiskContext[];
  lineage: readonly AppliedLearningReference[];
}>;

export type BuildInvestmentAppliedLearningContextCommand = Readonly<{
  subjectId: string;
  acquisitionType: AcquisitionType;
  marketId?: string;
  applications: readonly InvestmentLearningApplication[];
  analysisDate: Date;
}>;
