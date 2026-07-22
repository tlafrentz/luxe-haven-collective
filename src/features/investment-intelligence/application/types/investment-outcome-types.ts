import type {
  PlatformAction,
} from "@/platform/actions";
import type {
  Decision,
} from "@/platform/decisions";
import type {
  Outcome,
} from "@/platform/outcomes";

import type {
  AcquisitionType,
  InvestmentPlatformAnalysis,
} from "../../domain";
import type {
  InvestmentCommitmentActor,
  InvestmentCommitmentDecisionOutcome,
} from "./investment-commitment-types";

export type InvestmentOutcomeDisposition =
  | "favorable"
  | "unfavorable"
  | "neutral"
  | "inconclusive";

export type InvestmentOutcomeMeasurementUnit =
  | "USD"
  | "percent"
  | "days"
  | "months"
  | "count"
  | "ratio";

export type InvestmentOutcomeMeasurementPeriod =
  | "monthly"
  | "annual"
  | "one-time";

export type InvestmentOutcomeMeasurement =
  Readonly<{
    key: string;
    label: string;
    value: number;
    unit: InvestmentOutcomeMeasurementUnit;
    period?: InvestmentOutcomeMeasurementPeriod;
    assumedValue?: number;
    variance?: number;
  }>;

export type InvestmentOutcomeFindingSource =
  Readonly<{
    kind:
      | "document"
      | "inspection"
      | "quote"
      | "regulatory-review"
      | "contract-review"
      | "operator-observation"
      | "external-provider";
    reference?: string;
  }>;

export type InvestmentOutcomeFinding =
  Readonly<{
    disposition:
      InvestmentOutcomeDisposition;
    summary: string;
    details?: string;
    measurements?:
      readonly InvestmentOutcomeMeasurement[];
    assumptionReferences?: readonly string[];
    evidenceReferences?: readonly string[];
    source?: InvestmentOutcomeFindingSource;
  }>;

export type InvestmentOutcomeCaptureContext =
  Readonly<{
    outcomeId: string;
    recordedAt: Date;
  }>;

export type RecordInvestmentActionOutcomeCommand =
  Readonly<{
    action: PlatformAction;
    platformAnalysis:
      InvestmentPlatformAnalysis;
    decision: Decision<
      InvestmentCommitmentDecisionOutcome
    >;
    finding: InvestmentOutcomeFinding;
    actor: InvestmentCommitmentActor;
    context:
      InvestmentOutcomeCaptureContext;
  }>;

export type InvestmentActionOutcomeResult =
  Readonly<{
    acquisitionType: AcquisitionType;
    actionId: string;
    decisionId: string;
    recommendationId: string;
    planId: string;
    investmentRunId: string;
    subjectId: string;
    intentKey: string;
    measurements:
      readonly InvestmentOutcomeMeasurement[];
    outcome: Outcome;
  }>;
