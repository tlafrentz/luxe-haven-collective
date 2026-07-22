import type {
  MarketAnalysisReport,
  MarketPropertyLookupAddress,
  MarketPropertyResolutionResult,
  MarketComparableProvider,
  MarketPropertyResolutionProvider,
} from "@/features/market-intelligence";

import type { InvestmentLifecycleResult } from "../../domain";
import type { RunInvestmentAnalysisCommand } from "../run-investment-analysis";
import type { InvestmentAnalysisContext } from "./investment-analysis-context-types";
import type { InvestmentAppliedLearningContext } from "./investment-learning-application-types";
import type { InvestmentMarketContext } from "./investment-market-context-types";

export type InvestmentWorkspaceStage =
  | "setup"
  | "resolving-property"
  | "property-review"
  | "running-market-analysis"
  | "market-review"
  | "configuring-investment"
  | "running-investment-analysis"
  | "decision-review"
  | "error";

export type InvestmentWorkspaceRunContext = Readonly<{
  workspaceRunId: string;
  propertyResolutionId: string;
  marketAnalysisId: string;
  requestedAt: Date;
  requestedBy?: string;
}>;

export type RunInvestmentWorkspaceAnalysisCommand = Readonly<{
  address: MarketPropertyLookupAddress;
  investmentInput: RunInvestmentAnalysisCommand;
  userProvidedAssumptionKeys: readonly string[];
  marketRequest: Readonly<{
    saleValuation: boolean;
    longTermRent: boolean;
  }>;
  appliedLearningContext?: InvestmentAppliedLearningContext;
  context: InvestmentWorkspaceRunContext;
}>;

export type RunInvestmentWorkspaceAnalysisDependencies = Readonly<{
  propertyProvider: MarketPropertyResolutionProvider;
  comparableProvider: MarketComparableProvider;
}>;

export type InvestmentWorkspaceLineage = Readonly<{
  workspaceRunId: string;
  propertyResolutionId: string;
  marketAnalysisId: string;
  investmentSubjectId: string;
  marketEvidenceIds: readonly string[];
}>;

export type InvestmentWorkspaceAnalysisResult = Readonly<{
  propertyResolution: MarketPropertyResolutionResult;
  marketReport: MarketAnalysisReport;
  investmentMarketContext: InvestmentMarketContext;
  investmentAnalysisContext: InvestmentAnalysisContext;
  lifecycleResult: InvestmentLifecycleResult;
  lineage: InvestmentWorkspaceLineage;
}>;

export type InvestmentWorkspaceErrorCode =
  | "INVALID_INPUT"
  | "PROPERTY_NOT_FOUND"
  | "PROPERTY_AMBIGUOUS"
  | "PROPERTY_UNSUPPORTED"
  | "MARKET_PROVIDER_UNAVAILABLE"
  | "MARKET_RATE_LIMITED"
  | "MARKET_ANALYSIS_INSUFFICIENT"
  | "INVESTMENT_ANALYSIS_FAILED"
  | "UNEXPECTED_ERROR";

export type InvestmentWorkspaceActionResult =
  | Readonly<{ ok: true; result: InvestmentWorkspaceAnalysisResult }>
  | Readonly<{
      ok: false;
      error: Readonly<{
        code: InvestmentWorkspaceErrorCode;
        message: string;
        retryable: boolean;
        alternatives?: MarketPropertyResolutionResult["alternatives"];
      }>;
    }>;
