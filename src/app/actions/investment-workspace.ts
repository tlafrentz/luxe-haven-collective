"use server";

import { requireRole } from "@/lib/auth/session";
import {
  InvestmentWorkspaceAnalysisError,
  runInvestmentWorkspaceAnalysis,
} from "@/features/investment-intelligence";
import type {
  InvestmentWorkspaceActionResult,
  RunInvestmentWorkspaceAnalysisCommand,
} from "@/features/investment-intelligence";
import { ProviderError, ProviderErrorCode } from "@/features/market-intelligence/application/providers/provider-error";
import { RentCastClient } from "@/features/market-intelligence/infrastructure/rentcast/rentcast-client";
import { RentCastComparableProvider } from "@/features/market-intelligence/infrastructure/rentcast/rentcast-comparable-provider";
import { RentCastPropertyProvider } from "@/features/market-intelligence/infrastructure/rentcast/rentcast-property-provider";

type InvestmentWorkspaceActionInput = Omit<RunInvestmentWorkspaceAnalysisCommand, "context"> & Readonly<{
  clientRequestId: string;
}>;

export async function analyzeInvestmentWorkspace(
  input: InvestmentWorkspaceActionInput,
): Promise<InvestmentWorkspaceActionResult> {
  const { user } = await requireRole(["admin", "owner"]);
  const requestedAt = new Date();
  const runId = crypto.randomUUID();
  try {
    const client = new RentCastClient({ apiKey: process.env.RENTCAST_API_KEY ?? "" });
    const result = await runInvestmentWorkspaceAnalysis({
      address: input.address,
      investmentInput: input.investmentInput,
      userProvidedAssumptionKeys: input.userProvidedAssumptionKeys,
      marketRequest: input.marketRequest,
      appliedLearningContext: input.appliedLearningContext,
      context: {
        workspaceRunId: `workspace:${runId}`,
        propertyResolutionId: `resolution:${runId}`,
        marketAnalysisId: `market:${runId}`,
        requestedAt,
        requestedBy: user.id,
      },
    }, {
      propertyProvider: new RentCastPropertyProvider({ client }),
      comparableProvider: new RentCastComparableProvider({ client }),
    });
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: safeError(error) };
  }
}

function safeError(error: unknown): Extract<InvestmentWorkspaceActionResult, { ok: false }>["error"] {
  if (error instanceof InvestmentWorkspaceAnalysisError) {
    return {
      code: error.code as Extract<InvestmentWorkspaceActionResult, { ok: false }>["error"]["code"],
      message: error.message,
      retryable: false,
      ...(error.alternatives ? { alternatives: error.alternatives } : {}),
    };
  }
  if (error instanceof ProviderError) {
    const rateLimited = error.code === ProviderErrorCode.RateLimited;
    return {
      code: rateLimited ? "MARKET_RATE_LIMITED" : "MARKET_PROVIDER_UNAVAILABLE",
      message: rateLimited
        ? "Market data is temporarily unavailable because the provider request limit was reached. Your assumptions were preserved."
        : "Market data is temporarily unavailable. Your assumptions were preserved and you can retry.",
      retryable: error.retryable || rateLimited,
    };
  }
  return {
    code: "UNEXPECTED_ERROR",
    message: "The workspace analysis could not be completed. Your assumptions were preserved.",
    retryable: true,
  };
}
