import { Money } from "@/platform/kernel";
import type { FinancialConfidence } from "../../domain";
import type {
  FinancialCondition, FinancialMetricChange, FinancialOverviewBuildInput,
  FinancialValueQualification, LiquiditySummary, ProfitabilitySummary,
} from "./contracts";

export const FINANCIAL_OVERVIEW_POLICY_VERSION = "financial-overview-policy-v1";
export const FINANCIAL_OVERVIEW_THRESHOLDS = Object.freeze({
  minimumExpenseCoverage: .8, strongMargin: .25, nearBreakEvenMargin: .05,
  materialAbsoluteMinorUnits: 10_000, materialRevenueShare: .02,
});

export function qualification(measured: Money, estimated: Money, projected: Money, forecast: Money): FinancialValueQualification {
  const present = [
    measured.amount !== 0 ? "measured" : null, estimated.amount !== 0 ? "estimated" : null,
    projected.amount !== 0 ? "projected" : null, forecast.amount !== 0 ? "forecast" : null,
  ].filter(Boolean);
  return present.length > 1 ? "mixed" : (present[0] as FinancialValueQualification | undefined) ?? "measured";
}

export function metricChange(current: Money | null, previous: Money | null, favorableWhenIncreasing: boolean): FinancialMetricChange | undefined {
  if (!current || !previous) return undefined;
  const amount = current.subtract(previous);
  const stable = amount.minorUnits === 0;
  const improved = favorableWhenIncreasing ? amount.amount > 0 : amount.amount < 0;
  if (Math.abs(previous.minorUnits) < FINANCIAL_OVERVIEW_THRESHOLDS.materialAbsoluteMinorUnits) {
    return { amount, kind: previous.minorUnits === 0 && current.minorUnits !== 0 ? "new" : "absolute-only", direction: stable ? "stable" : improved ? "improved" : "declined" };
  }
  return { amount, percentageChange: amount.amount / Math.abs(previous.amount), kind: "absolute-and-percentage", direction: stable ? "stable" : improved ? "improved" : "declined" };
}

export function profitability(noi: Money | null, margin: number | null, confidence: FinancialConfidence): ProfitabilitySummary {
  if (!noi || margin === null) return { status: "insufficient-evidence", noi: { qualification: "unavailable", limitation: "Reliable operating expenses are required." }, margin: { qualification: "unavailable", limitation: "Reliable revenue and expenses are required." }, explanation: "Profitability cannot be established from the available evidence.", confidence: "insufficient-evidence" };
  const status = margin >= FINANCIAL_OVERVIEW_THRESHOLDS.strongMargin ? "strongly-profitable" : margin >= FINANCIAL_OVERVIEW_THRESHOLDS.nearBreakEvenMargin ? "profitable" : margin >= 0 ? "near-break-even" : "unprofitable";
  return { status, noi: { money: noi, qualification: "measured" }, margin: { percentage: margin, qualification: "measured" }, explanation: status === "unprofitable" ? "Recognized operating expenses exceed recognized revenue." : `Operating performance is ${status.replace("-", " ")} for this period.`, confidence };
}

export function liquidity(input: FinancialOverviewBuildInput): LiquiditySummary {
  if (!input.canViewCash) return { status: "insufficient-evidence", cash: { qualification: "unavailable", limitation: "Cash balances are restricted for this role." }, movement: { qualification: "unavailable", limitation: "Cash movement is restricted for this role." }, reserveTargetConfigured: false, explanation: "Property financial summaries are available, but workspace liquidity is restricted.", confidence: "insufficient-evidence" };
  if (!input.cash) return { status: "insufficient-evidence", cash: { qualification: "unavailable", limitation: "Connect or import a cash-account balance." }, movement: { qualification: "unavailable", limitation: "A reliable cash source is required." }, reserveTargetConfigured: false, explanation: "Cash position is unavailable and is not inferred from operating income.", confidence: "insufficient-evidence" };
  const coverage = input.cash.reserveTarget && input.cash.reserveTarget.amount > 0 ? input.cash.balance.amount / input.cash.reserveTarget.amount : undefined;
  const status = input.cash.balance.amount < 0 ? "critical" : coverage !== undefined && coverage < 1 ? "tight" : input.cash.netMovement.amount < 0 ? "adequate" : "strong";
  return { status, cash: { money: input.cash.balance, qualification: input.cash.qualification, asOf: input.cash.asOf }, movement: { money: input.cash.netMovement, qualification: input.cash.qualification }, reserveCoverageMonths: coverage, reserveTargetConfigured: Boolean(input.cash.reserveTarget), explanation: input.cash.netMovement.amount < 0 ? "Cash declined during the period; this movement remains distinct from NOI." : "Cash was stable or increased during the period.", confidence: input.cash.confidence };
}

export function condition(input: Readonly<{ profitability: ProfitabilitySummary; liquidity: LiquiditySummary; confidence: FinancialConfidence; stale: boolean; adversePlan: boolean; expenseIncrease: boolean; evidenceIds: readonly string[] }>): FinancialCondition {
  const limitations = [
    ...(input.profitability.status === "insufficient-evidence" ? ["Profitability evidence is incomplete."] : []),
    ...(input.liquidity.status === "insufficient-evidence" ? ["Liquidity evidence is unavailable or restricted."] : []),
    ...(input.stale ? ["One or more financial sources are stale."] : []),
  ];
  const positives = [
    ...(["strongly-profitable", "profitable"].includes(input.profitability.status) ? ["Operating income is positive."] : []),
    ...(["strong", "adequate"].includes(input.liquidity.status) ? ["Available liquidity is not under immediate pressure."] : []),
  ];
  const status = input.profitability.status === "insufficient-evidence"
    ? "insufficient-evidence"
    : input.liquidity.status === "critical" || input.profitability.status === "unprofitable"
      ? "at-risk"
      : input.liquidity.status === "tight" || input.adversePlan || input.expenseIncrease || input.stale
        ? "attention-needed"
        : input.profitability.status === "strongly-profitable" && input.liquidity.status === "strong"
          ? "strong" : "stable";
  const summary = status === "insufficient-evidence" ? "Financial condition cannot be established until operating-expense coverage is reliable."
    : status === "at-risk" ? "A material profitability or liquidity condition requires immediate inspection."
      : status === "attention-needed" ? "Operating results remain interpretable, but deterioration or a data limitation requires attention."
        : status === "strong" ? "Profitability and supported liquidity are materially positive without a dominant limiting condition."
          : "No material positive or negative financial condition dominates the selected period.";
  return { status, summary, positiveDrivers: positives, limitingConditions: limitations, confidence: input.confidence, evidenceIds: input.evidenceIds, destination: "#financial-attention", policyVersion: FINANCIAL_OVERVIEW_POLICY_VERSION };
}
