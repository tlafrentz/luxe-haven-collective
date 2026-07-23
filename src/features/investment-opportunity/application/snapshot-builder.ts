import type { InvestmentLifecycleResult } from "@/features/investment-intelligence";
import { AcquisitionType } from "@/features/investment-intelligence";
import type { OpportunityAnalysisSnapshot, OpportunityMoneySnapshot, OpportunityMetricSnapshot } from "../domain";

const money = (value: { amount: number; currency: "USD" }, source: OpportunityMoneySnapshot["source"] = "derived"): OpportunityMoneySnapshot => Object.freeze({ ...value, source });
const metric = (value: number, source: OpportunityMetricSnapshot["source"] = "derived"): OpportunityMetricSnapshot => Object.freeze({ value, source });

/** Pure, deterministic projection of the public Investment Intelligence result. */
export function buildOpportunityAnalysisSnapshot(result: InvestmentLifecycleResult, analyzedAt: Date): OpportunityAnalysisSnapshot {
  const analysis = result.analysis;
  const common = {
    schemaVersion: "1" as const,
    route: result.acquisitionType,
    subject: Object.freeze({ id: analysis.property.id, normalizedAddress: Object.freeze({ address1: analysis.property.location.address1, ...(analysis.property.location.address2 ? { address2: analysis.property.location.address2 } : {}), city: analysis.property.location.city, state: analysis.property.location.state, postalCode: analysis.property.location.postalCode }) }),
    recommendation: Object.freeze({ recommendation: analysis.recommendation, summary: `Investment Intelligence recommendation: ${analysis.recommendation}.`, rationale: Object.freeze(analysis.supportingEvidence.map(e => e.title)), conditions: Object.freeze([]) }),
    score: Object.freeze({ value: analysis.score.overall.value, scaleMinimum: 0, scaleMaximum: analysis.score.overall.max }),
    confidence: Object.freeze({ level: analysis.confidence }),
    market: Object.freeze({ name: analysis.market.market, ...(analysis.market.submarket ? { submarket: analysis.market.submarket } : {}), medianAdr: money(analysis.market.medianAdr, "market"), medianOccupancy: metric(analysis.market.medianOccupancy.value, "market"), trend: analysis.market.trend }),
    risks: Object.freeze(analysis.risks.map(risk => Object.freeze({ id: risk.id, title: risk.title, description: risk.description, severity: risk.severity, probability: risk.probability.value, ...(risk.mitigation ? { mitigation: risk.mitigation } : {}) }))),
    dataGaps: Object.freeze([]),
    evidence: Object.freeze(analysis.supportingEvidence.map(e => Object.freeze({ id: e.id, title: e.title, source: e.source, confidence: e.confidence }))),
    analyzedAt: new Date(analyzedAt),
  };
  if (result.acquisitionType === AcquisitionType.Purchase) {
    const purchase = result.analysis;
    const initial = purchase.property.purchasePrice.amount + purchase.property.closingCosts.amount + purchase.property.furnishingBudget.amount;
    return Object.freeze({ ...common, financials: Object.freeze({ purchasePrice: money(purchase.property.purchasePrice, "user"), projectedAnnualRevenue: money(purchase.revenueProjection.projectedAnnualRevenue), projectedAdr: money(purchase.revenueProjection.projectedAdr), projectedOccupancy: metric(purchase.revenueProjection.projectedOccupancy.value), operatingExpenses: money(purchase.expenseProjection.totalOperatingExpenses), netOperatingIncome: money(purchase.financialPerformance.netOperatingIncome), annualCashFlow: money(purchase.financialPerformance.annualCashFlow), capRate: metric(purchase.financialPerformance.capRate.value), cashOnCashReturn: metric(purchase.financialPerformance.cashOnCashReturn.value), initialCashRequired: money({ amount: initial, currency: "USD" }, "derived") }) });
  }
  const rental = result.analysis;
  return Object.freeze({ ...common, financials: Object.freeze({ proposedMonthlyLease: money(rental.assumptions.monthlyLease, "user"), projectedAnnualRevenue: money(rental.revenueProjection.projectedAnnualRevenue), projectedAdr: money(rental.revenueProjection.projectedAdr), projectedOccupancy: metric(rental.revenueProjection.projectedOccupancy.value), operatingExpenses: money(rental.expenseProjection.totalOperatingExpenses), annualCashFlow: money(rental.financialPerformance.annualCashFlow), cashOnCashReturn: metric(rental.financialPerformance.cashOnCashReturn.value), initialCashRequired: money(rental.financialPerformance.initialCashInvested, "derived") }) });
}
