import {
  PlatformError,
} from "@/platform/kernel";

import {
  AcquisitionType,
  MarketTrend,
} from "../domain";

import type {
  BuildInvestmentAnalysisContextCommand,
  InvestmentAnalysisAssumption,
  InvestmentAnalysisContext,
  InvestmentAnalysisInput,
} from "./types/investment-analysis-context-types";
import type {
  AppliedLearningReference,
  InvestmentConstraint,
  InvestmentRiskContext,
} from "./types/investment-learning-application-types";
import {
  assessInvestmentMarketEvidenceUsability,
} from "./build-investment-market-context";

export type InvestmentAnalysisContextErrorCode =
  | "INVESTMENT_ANALYSIS_CONTEXT_DUPLICATE_USER_KEY"
  | "INVESTMENT_ANALYSIS_CONTEXT_UNSUPPORTED_ASSUMPTION"
  | "INVESTMENT_ANALYSIS_CONTEXT_INVALID_OVERRIDE"
  | "INVESTMENT_ANALYSIS_CONTEXT_CONFLICT"
  | "INVESTMENT_ANALYSIS_CONTEXT_LINEAGE_MISMATCH";

export class InvestmentAnalysisContextError extends PlatformError {
  public constructor(
    code: InvestmentAnalysisContextErrorCode,
    message: string,
  ) {
    super(code, message);
  }
}

type AssumptionDefinition = Readonly<{
  path: readonly string[];
  defaultValue?: number | string | boolean;
}>;

const SHARED_ASSUMPTIONS: Readonly<Record<string, AssumptionDefinition>> = {
  "furnishing-budget": { path: ["property", "furnishingBudget"] },
  "projected-adr": { path: ["revenue", "projectedAdr"] },
  "projected-occupancy-percentage": { path: ["revenue", "projectedOccupancyPercentage"] },
  "average-length-of-stay": { path: ["revenue", "averageLengthOfStay"] },
  "revenue-confidence-percentage": { path: ["revenue", "confidencePercentage"], defaultValue: 80 },
  "management-fee-percentage": { path: ["operating", "managementFeePercentage"] },
  "monthly-utilities": { path: ["operating", "monthlyUtilities"] },
  "annual-insurance-premium": { path: ["operating", "annualInsurance"] },
  "annual-cleaning": { path: ["operating", "annualCleaning"] },
  "annual-software": { path: ["operating", "annualSoftware"] },
  "annual-supplies": { path: ["operating", "annualSupplies"] },
  "maintenance-reserve-percentage": { path: ["operating", "maintenanceReservePercentage"] },
  "capital-reserve-percentage": { path: ["operating", "capitalReservePercentage"] },
  "market-median-adr": { path: ["market", "medianAdr"] },
  "market-median-occupancy-percentage": { path: ["market", "medianOccupancyPercentage"] },
  "market-trend": { path: ["market", "trend"], defaultValue: MarketTrend.Stable },
};

const PURCHASE_ASSUMPTIONS: Readonly<Record<string, AssumptionDefinition>> = {
  ...SHARED_ASSUMPTIONS,
  "purchase-price": { path: ["property", "purchasePrice"] },
  "closing-costs": { path: ["property", "closingCosts"] },
  "down-payment-percentage": { path: ["financing", "downPaymentPercentage"] },
  "interest-rate-percentage": { path: ["financing", "interestRatePercentage"] },
  "loan-term-years": { path: ["financing", "loanTermYears"] },
  "annual-property-taxes": { path: ["operating", "annualTaxes"] },
};

const RENTAL_ASSUMPTIONS: Readonly<Record<string, AssumptionDefinition>> = {
  ...SHARED_ASSUMPTIONS,
  "monthly-lease": { path: ["lease", "monthlyLease"] },
  "security-deposit": { path: ["lease", "securityDeposit"] },
  "lease-term-months": { path: ["lease", "leaseTermMonths"] },
  "startup-costs": { path: ["lease", "startupCosts"] },
  "utilities-included": { path: ["lease", "utilitiesIncluded"] },
};

/** Composes source-neutral canonical inputs without evaluating Investment policy. */
export function buildInvestmentAnalysisContext(
  command: BuildInvestmentAnalysisContextCommand,
): InvestmentAnalysisContext {
  const definitions = command.input.acquisitionType === AcquisitionType.Purchase
    ? PURCHASE_ASSUMPTIONS
    : RENTAL_ASSUMPTIONS;
  const userKeys = validateUserKeys(command.userProvidedAssumptionKeys, definitions);
  const appliedLearning = command.appliedLearning;
  validateAppliedLineage(appliedLearning);
  const marketContext = command.marketContext;
  if (marketContext && marketContext.subjectId !== command.input.property.id) {
    fail("INVESTMENT_ANALYSIS_CONTEXT_LINEAGE_MISMATCH", "Market context subject must match the Investment subject.");
  }
  const marketUsability = marketContext
    ? assessInvestmentMarketEvidenceUsability(marketContext)
    : undefined;

  let input = cloneInput(command.input);
  const assumptions = new Map<string, InvestmentAnalysisAssumption>();

  for (const [key, definition] of Object.entries(definitions)) {
    const current = readPath(input, definition.path) ?? definition.defaultValue;
    if (current === undefined) continue;
    if (!isAssumptionValue(current)) {
      fail("INVESTMENT_ANALYSIS_CONTEXT_INVALID_OVERRIDE", `Canonical assumption ${key} must be scalar.`);
    }
    if (definition.defaultValue !== undefined && readPath(input, definition.path) === undefined) {
      input = writePath(input, definition.path, definition.defaultValue);
    }
    assumptions.set(key, {
      key,
      value: current,
      source: userKeys.has(key) ? "user" : "system-default",
    });
  }

  if (marketContext?.saleValuation?.estimatedValue !== undefined && marketUsability?.saleValuation !== "unusable") {
    assumptions.set("market-value", {
      key: "market-value",
      value: marketContext.saleValuation.estimatedValue,
      source: "market",
      marketAnalysisId: marketContext.marketAnalysisId,
      marketEvidenceIds: marketContext.lineage.evidenceIds,
      confidenceScore: marketContext.saleValuation.confidenceScore,
    });
  }

  if (marketContext?.longTermRent?.estimatedMonthlyRent !== undefined && marketUsability?.longTermRent !== "unusable") {
    assumptions.set("market-monthly-rent-estimate", {
      key: "market-monthly-rent-estimate",
      value: marketContext.longTermRent.estimatedMonthlyRent,
      source: "market",
      marketAnalysisId: marketContext.marketAnalysisId,
      marketEvidenceIds: marketContext.lineage.evidenceIds,
      confidenceScore: marketContext.longTermRent.confidenceScore,
    });
    if (command.input.acquisitionType === AcquisitionType.RentalArbitrage && !userKeys.has("monthly-lease")) {
      input = writePath(input, RENTAL_ASSUMPTIONS["monthly-lease"].path, marketContext.longTermRent.estimatedMonthlyRent);
      assumptions.set("monthly-lease", {
        key: "monthly-lease",
        value: marketContext.longTermRent.estimatedMonthlyRent,
        source: "market",
        marketAnalysisId: marketContext.marketAnalysisId,
        marketEvidenceIds: marketContext.lineage.evidenceIds,
        confidenceScore: marketContext.longTermRent.confidenceScore,
      });
    }
  }

  for (const override of appliedLearning?.assumptionOverrides ?? []) {
    const definition = definitions[override.assumptionKey];
    if (!definition) {
      fail("INVESTMENT_ANALYSIS_CONTEXT_UNSUPPORTED_ASSUMPTION", `Applied Learning assumption ${override.assumptionKey} is not supported by this acquisition route.`);
    }
    if (userKeys.has(override.assumptionKey)) continue;
    const current = readPath(input, definition.path) ?? definition.defaultValue;
    const next = resolveOverride(current, override.operation, override.appliedValue.value);
    validateValueCompatibility(current, next, override.assumptionKey);
    input = writePath(input, definition.path, next);
    assumptions.set(override.assumptionKey, {
      key: override.assumptionKey,
      value: next,
      source: "applied-learning",
      applicationId: override.applicationId,
    });
  }

  return deepFreeze({
    input,
    assumptions: [...assumptions.values()].sort((first, second) => first.key.localeCompare(second.key)),
    constraints: dedupeByKey(appliedLearning?.constraints ?? [], "constraint"),
    resolvedDataGaps: [...new Set(appliedLearning?.resolvedDataGaps ?? [])].sort(),
    persistentRiskContext: dedupeByKey(appliedLearning?.persistentRisks ?? [], "risk"),
    lineage: [...(appliedLearning?.lineage ?? [])]
      .map(cloneReference)
      .sort((first, second) => first.applicationId.localeCompare(second.applicationId)),
    ...(marketContext ? { marketContext: structuredClone(marketContext) } : {}),
    ...(marketUsability ? { marketEvidenceUsability: marketUsability } : {}),
  });
}

function validateUserKeys(
  keys: readonly string[],
  definitions: Readonly<Record<string, AssumptionDefinition>>,
): ReadonlySet<string> {
  const normalized = keys.map((key) => key.trim());
  if (new Set(normalized).size !== normalized.length) {
    fail("INVESTMENT_ANALYSIS_CONTEXT_DUPLICATE_USER_KEY", "User-provided assumption keys must be unique.");
  }
  for (const key of normalized) {
    if (!definitions[key]) {
      fail("INVESTMENT_ANALYSIS_CONTEXT_UNSUPPORTED_ASSUMPTION", `User-provided assumption ${key} is not supported by this acquisition route.`);
    }
  }
  return new Set(normalized);
}

function validateAppliedLineage(context: BuildInvestmentAnalysisContextCommand["appliedLearning"]): void {
  if (!context) return;
  const applicationIds = new Set(context.applicationIds);
  const lineageIds = new Set(context.lineage.map(({ applicationId }) => applicationId));
  if (applicationIds.size !== context.applicationIds.length || lineageIds.size !== context.lineage.length) {
    fail("INVESTMENT_ANALYSIS_CONTEXT_LINEAGE_MISMATCH", "Applied Learning application and lineage IDs must be unique.");
  }
  if (applicationIds.size !== lineageIds.size || [...applicationIds].some((id) => !lineageIds.has(id))) {
    fail("INVESTMENT_ANALYSIS_CONTEXT_LINEAGE_MISMATCH", "Every applied Learning Application requires exactly one lineage reference.");
  }
  const referenced = [
    ...context.assumptionOverrides.map(({ applicationId }) => applicationId),
    ...context.constraints.map(({ applicationId }) => applicationId),
    ...context.persistentRisks.map(({ applicationId }) => applicationId),
  ];
  if (referenced.some((id) => !applicationIds.has(id))) {
    fail("INVESTMENT_ANALYSIS_CONTEXT_LINEAGE_MISMATCH", "Every applied item must reference an included Learning Application.");
  }
}

function resolveOverride(
  current: unknown,
  operation: "replace" | "adjust",
  applied: number | string | boolean,
): number | string | boolean {
  if (operation === "replace") return applied;
  if (typeof current !== "number" || typeof applied !== "number") {
    fail("INVESTMENT_ANALYSIS_CONTEXT_INVALID_OVERRIDE", "Adjustment overrides require numeric current and adjustment values.");
  }
  return current + applied;
}

function validateValueCompatibility(current: unknown, next: unknown, key: string): void {
  if (typeof current !== typeof next || (typeof next === "number" && !Number.isFinite(next))) {
    fail("INVESTMENT_ANALYSIS_CONTEXT_INVALID_OVERRIDE", `Applied Learning value is incompatible with ${key}.`);
  }
  if (key === "market-trend" && !Object.values(MarketTrend).includes(next as MarketTrend)) {
    fail("INVESTMENT_ANALYSIS_CONTEXT_INVALID_OVERRIDE", "Applied market trend is invalid.");
  }
}

function cloneInput(input: InvestmentAnalysisInput): InvestmentAnalysisInput {
  return structuredClone(input);
}

function readPath(input: InvestmentAnalysisInput, path: readonly string[]): unknown {
  let value: unknown = input;
  for (const segment of path) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as Readonly<Record<string, unknown>>)[segment];
  }
  return value;
}

function writePath(
  input: InvestmentAnalysisInput,
  path: readonly string[],
  value: number | string | boolean,
): InvestmentAnalysisInput {
  const [group, field] = path;
  return {
    ...input,
    [group]: {
      ...(input as unknown as Readonly<Record<string, Readonly<Record<string, unknown>>>>)[group],
      [field]: value,
    },
  } as InvestmentAnalysisInput;
}

function dedupeByKey<T extends InvestmentConstraint | InvestmentRiskContext>(
  values: readonly T[],
  label: string,
): readonly T[] {
  const byKey = new Map<string, T>();
  for (const value of values) {
    const existing = byKey.get(value.key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(value)) {
      fail("INVESTMENT_ANALYSIS_CONTEXT_CONFLICT", `Applied Learning ${label} ${value.key} conflicts.`);
    }
    byKey.set(value.key, { ...value });
  }
  return [...byKey.values()].sort((first, second) => first.key.localeCompare(second.key));
}

function cloneReference(reference: AppliedLearningReference): AppliedLearningReference {
  return {
    ...reference,
    learningInsightIds: [...reference.learningInsightIds].sort(),
    outcomeIds: [...reference.outcomeIds].sort(),
    investmentRunIds: [...reference.investmentRunIds].sort(),
  };
}

function isAssumptionValue(value: unknown): value is number | string | boolean {
  return typeof value === "number" || typeof value === "string" || typeof value === "boolean";
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function fail(code: InvestmentAnalysisContextErrorCode, message: string): never {
  throw new InvestmentAnalysisContextError(code, message);
}
