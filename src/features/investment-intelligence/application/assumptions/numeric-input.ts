export type NumericInputDraftStatus = "empty" | "valid" | "incomplete" | "invalid";

export type NumericInputDraft = Readonly<{
  text: string;
  normalizedValue: number | null;
  status: NumericInputDraftStatus;
  error?: string;
}>;

export type NumericAssumptionPolicy = Readonly<{
  kind: "integer" | "decimal" | "currency" | "percentage";
  minimum?: number;
  maximum?: number;
  decimalPlaces: number;
  allowEmpty: boolean;
  emptyMeaning: "missing" | "zero" | "use-default";
  normalizeOn: "blur" | "submit";
}>;

const currency = (allowEmpty = false): NumericAssumptionPolicy => ({ kind: "currency", minimum: 0, decimalPlaces: 2, allowEmpty, emptyMeaning: "missing", normalizeOn: "blur" });
const zeroCurrency = (): NumericAssumptionPolicy => ({ ...currency(true), emptyMeaning: "zero" });
const percentage = (allowEmpty = false): NumericAssumptionPolicy => ({ kind: "percentage", minimum: 0, maximum: 100, decimalPlaces: 2, allowEmpty, emptyMeaning: allowEmpty ? "missing" : "zero", normalizeOn: "blur" });
const integer = (minimum = 0, allowEmpty = false): NumericAssumptionPolicy => ({ kind: "integer", minimum, decimalPlaces: 0, allowEmpty, emptyMeaning: allowEmpty ? "missing" : "zero", normalizeOn: "blur" });

export const INVESTMENT_NUMERIC_ASSUMPTION_POLICIES = Object.freeze({
  bedrooms: integer(1), bathrooms: { kind: "decimal", minimum: 0.5, decimalPlaces: 1, allowEmpty: false, emptyMeaning: "missing", normalizeOn: "blur" }, squareFeet: integer(1),
  purchasePrice: currency(), closingCosts: currency(), furnishingBudget: currency(), downPaymentPercentage: percentage(), interestRatePercentage: { ...percentage(), decimalPlaces: 3 }, loanTermYears: integer(1),
  monthlyLease: currency(), securityDeposit: zeroCurrency(), leaseTermMonths: integer(1), startupCosts: zeroCurrency(),
  projectedAdr: currency(), projectedOccupancyPercentage: percentage(), averageLengthOfStay: { kind: "decimal", minimum: 1, decimalPlaces: 1, allowEmpty: false, emptyMeaning: "missing", normalizeOn: "blur" },
  managementFeePercentage: { ...percentage(true), emptyMeaning: "zero" }, monthlyUtilities: currency(), annualInsurance: currency(), annualTaxes: currency(), annualCleaning: currency(), annualSoftware: currency(), annualSupplies: currency(), maintenanceReservePercentage: percentage(), capitalReservePercentage: percentage(),
} satisfies Readonly<Record<string, NumericAssumptionPolicy>>);

export function parseNumericAssumptionDraft(text: string, policy: NumericAssumptionPolicy): NumericInputDraft {
  const trimmed = text.trim();
  if (trimmed === "") return { text, normalizedValue: null, status: "empty", ...(!policy.allowEmpty ? { error: "A value is required." } : {}) };
  if (/^[+-]?(?:\d+\.?|\.\d*)$/.test(trimmed) && (trimmed.endsWith(".") || trimmed === "." || trimmed === "+." || trimmed === "-.")) return { text, normalizedValue: null, status: "incomplete" };
  const unformatted = trimmed.replaceAll(",", "").replace(/^\$/, "").trim();
  if (!/^[+-]?(?:\d+|\d*\.\d+)$/.test(unformatted)) return { text, normalizedValue: null, status: "invalid", error: "Enter a valid number." };
  const value = Number(unformatted);
  if (!Number.isFinite(value)) return { text, normalizedValue: null, status: "invalid", error: "Enter a valid number." };
  if (policy.kind === "integer" && !Number.isInteger(value)) return { text, normalizedValue: null, status: "invalid", error: "Enter a whole number." };
  if (policy.minimum !== undefined && value < policy.minimum) return { text, normalizedValue: null, status: "invalid", error: `Enter ${policy.minimum} or more.` };
  if (policy.maximum !== undefined && value > policy.maximum) return { text, normalizedValue: null, status: "invalid", error: `Enter ${policy.maximum} or less.` };
  const decimals = unformatted.split(".")[1]?.length ?? 0;
  if (decimals > policy.decimalPlaces) return { text, normalizedValue: null, status: "invalid", error: `Use no more than ${policy.decimalPlaces} decimal places.` };
  return { text, normalizedValue: value, status: "valid" };
}

export function normalizeNumericAssumptionDraft(text: string, policy: NumericAssumptionPolicy): NumericInputDraft {
  const parsed = parseNumericAssumptionDraft(text, policy);
  if (parsed.status === "empty" && policy.emptyMeaning === "zero") return { text: "0", normalizedValue: 0, status: "valid" };
  if (parsed.status !== "valid" || parsed.normalizedValue === null) return parsed;
  const rounded = Number(parsed.normalizedValue.toFixed(policy.decimalPlaces));
  return { text: String(rounded), normalizedValue: rounded, status: "valid" };
}
