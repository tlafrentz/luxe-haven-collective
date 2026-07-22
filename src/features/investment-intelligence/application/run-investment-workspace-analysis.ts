import {
  buildDefaultMarketAnalysisPolicies,
  resolveMarketProperty,
  runMarketAnalysis,
} from "@/features/market-intelligence";
import type { MarketProperty } from "@/features/market-intelligence";
import { PlatformError } from "@/platform/kernel";

import { PropertyType } from "../domain";
import { buildInvestmentAnalysisContext } from "./build-investment-analysis-context";
import { buildInvestmentMarketContext } from "./build-investment-market-context";
import { runInvestmentAnalysis } from "./run-investment-analysis";

import type { RunInvestmentAnalysisCommand } from "./run-investment-analysis";
import type {
  InvestmentWorkspaceAnalysisResult,
  InvestmentWorkspaceErrorCode,
  RunInvestmentWorkspaceAnalysisCommand,
  RunInvestmentWorkspaceAnalysisDependencies,
} from "./types/investment-workspace-types";

export class InvestmentWorkspaceAnalysisError extends PlatformError {
  public readonly alternatives?: InvestmentWorkspaceAnalysisResult["propertyResolution"]["alternatives"];

  public constructor(
    code: InvestmentWorkspaceErrorCode,
    message: string,
    alternatives?: InvestmentWorkspaceAnalysisResult["propertyResolution"]["alternatives"],
  ) {
    super(code, message);
    this.alternatives = alternatives;
  }
}

/** Canonical server-side composition boundary for the live Investment workspace. */
export async function runInvestmentWorkspaceAnalysis(
  command: RunInvestmentWorkspaceAnalysisCommand,
  dependencies: RunInvestmentWorkspaceAnalysisDependencies,
): Promise<InvestmentWorkspaceAnalysisResult> {
  validateCommand(command);
  const propertyResolution = await resolveMarketProperty({
    address: command.address,
    context: {
      resolutionId: command.context.propertyResolutionId,
      requestedAt: command.context.requestedAt,
      requestedBy: command.context.requestedBy,
    },
  }, { provider: dependencies.propertyProvider });

  if (propertyResolution.status !== "resolved") {
    const code = propertyResolution.status === "ambiguous"
      ? "PROPERTY_AMBIGUOUS"
      : propertyResolution.status === "unsupported"
        ? "PROPERTY_UNSUPPORTED"
        : "PROPERTY_NOT_FOUND";
    throw new InvestmentWorkspaceAnalysisError(
      code,
      propertyResolution.status === "ambiguous"
        ? "Multiple properties match this address. Refine the address before continuing."
        : propertyResolution.status === "unsupported"
          ? "The resolved property type is not supported for Market analysis."
          : "The property could not be resolved from available Market data.",
      propertyResolution.alternatives,
    );
  }

  const propertyType = mapPropertyType(
    propertyResolution.property.characteristics.propertyType,
    command.investmentInput.property.propertyType,
  );
  const marketReport = await runMarketAnalysis({
    propertyResolution,
    analyses: {
      saleValuation: { enabled: command.marketRequest.saleValuation },
      longTermRent: { enabled: command.marketRequest.longTermRent },
    },
    policies: buildDefaultMarketAnalysisPolicies(propertyResolution.property.characteristics.propertyType),
    context: {
      analysisId: command.context.marketAnalysisId,
      analyzedAt: command.context.requestedAt,
      requestedBy: command.context.requestedBy,
    },
  }, { comparableProvider: dependencies.comparableProvider });
  const investmentMarketContext = buildInvestmentMarketContext(marketReport);
  const investmentInput = withResolvedSubject(command.investmentInput, propertyResolution.property, propertyType);
  const investmentAnalysisContext = buildInvestmentAnalysisContext({
    input: investmentInput,
    userProvidedAssumptionKeys: command.userProvidedAssumptionKeys,
    appliedLearning: command.appliedLearningContext,
    marketContext: investmentMarketContext,
  });
  const lifecycleResult = runInvestmentAnalysis(investmentAnalysisContext.input);
  return deepFreeze({
    propertyResolution,
    marketReport,
    investmentMarketContext,
    investmentAnalysisContext,
    lifecycleResult,
    lineage: {
      workspaceRunId: command.context.workspaceRunId,
      propertyResolutionId: propertyResolution.resolutionId,
      marketAnalysisId: marketReport.analysisId,
      investmentSubjectId: investmentAnalysisContext.input.property.id,
      marketEvidenceIds: [...investmentMarketContext.lineage.evidenceIds],
    },
  });
}

function withResolvedSubject(
  input: RunInvestmentAnalysisCommand,
  subject: MarketProperty,
  propertyType: PropertyType,
): RunInvestmentAnalysisCommand {
  const address = subject.address;
  const characteristics = subject.characteristics;
  const property = {
    ...input.property,
    id: subject.id,
    address1: address.addressLine1 ?? address.formatted,
    city: address.city ?? input.property.city,
    state: address.state ?? input.property.state,
    postalCode: address.postalCode ?? input.property.postalCode,
    propertyType,
    bedrooms: characteristics.bedrooms ?? input.property.bedrooms,
    bathrooms: characteristics.bathrooms ?? input.property.bathrooms,
    squareFeet: characteristics.squareFeet ?? input.property.squareFeet,
  };
  return { ...input, property } as RunInvestmentAnalysisCommand;
}

function mapPropertyType(value: string | undefined, fallback: PropertyType): PropertyType {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (normalized.includes("single")) return PropertyType.SingleFamily;
  if (normalized.includes("multi")) return PropertyType.MultiFamily;
  if (normalized.includes("condo")) return PropertyType.Condo;
  if (normalized.includes("town")) return PropertyType.Townhome;
  if (normalized.includes("cabin")) return PropertyType.Cabin;
  if (normalized.includes("apartment")) return PropertyType.Apartment;
  return fallback;
}

function validateCommand(command: RunInvestmentWorkspaceAnalysisCommand): void {
  if (!command.context.workspaceRunId.trim() || !command.context.propertyResolutionId.trim() || !command.context.marketAnalysisId.trim()) {
    throw new InvestmentWorkspaceAnalysisError("INVALID_INPUT", "Workspace run identity is required.");
  }
  if (Number.isNaN(command.context.requestedAt.getTime()) || !command.address.streetAddress.trim() || !command.address.city.trim() || !command.address.state.trim() || !command.address.postalCode.trim()) {
    throw new InvestmentWorkspaceAnalysisError("INVALID_INPUT", "A complete property address is required.");
  }
  if (!command.marketRequest.saleValuation && !command.marketRequest.longTermRent) {
    throw new InvestmentWorkspaceAnalysisError("INVALID_INPUT", "Select at least one supported Market analysis.");
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
