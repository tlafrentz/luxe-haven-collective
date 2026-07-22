import type {
  PlatformAction,
} from "@/platform/actions";
import type {
  Decision,
} from "@/platform/decisions";

import type {
  AcquisitionType,
  InvestmentLifecycleResult,
  InvestmentPlatformAnalysis,
} from "../../domain";
import type {
  InvestmentCommitmentActor,
  InvestmentCommitmentDecisionOutcome,
} from "./investment-commitment-types";

export type InvestmentExecutionCategory =
  | "market-validation"
  | "financial-validation"
  | "regulatory-diligence"
  | "property-diligence"
  | "financing"
  | "insurance"
  | "contracting"
  | "operational-readiness"
  | "final-approval";

export type InvestmentExecutionPriority =
  | "critical"
  | "high"
  | "normal"
  | "low";

export type InvestmentExecutionIntent =
  Readonly<{
    key: string;
    title: string;
    description: string;
    category: InvestmentExecutionCategory;
    priority: InvestmentExecutionPriority;
    sequence: number;
    required: boolean;
    dependencies: readonly string[];
    rationale: string;
    sourceReferences: readonly string[];
  }>;

export type InvestmentExecutionPlanningContext =
  Readonly<{
    planId: string;
    workspaceId: string;
    plannedAt: Date;
    actionIds:
      Readonly<Record<string, string>>;
  }>;

export type PlanInvestmentExecutionCommand =
  Readonly<{
    lifecycleResult:
      InvestmentLifecycleResult;
    platformAnalysis:
      InvestmentPlatformAnalysis;
    decision: Decision<
      InvestmentCommitmentDecisionOutcome
    >;
    actor: InvestmentCommitmentActor;
    context:
      InvestmentExecutionPlanningContext;
  }>;

export type InvestmentExecutionPlan =
  Readonly<{
    id: string;
    acquisitionType: AcquisitionType;
    subjectId: string;
    decisionId: string;
    recommendationId: string;
    investmentRunId: string;
    plannedAt: Date;
    intents:
      readonly InvestmentExecutionIntent[];
    actions: readonly PlatformAction[];
  }>;
