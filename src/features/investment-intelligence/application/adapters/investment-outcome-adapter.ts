import type { Action } from "@/platform/actions";
import { IntelligenceBuilder } from "@/platform/intelligence";
import { createOutcomeId, emptyOutcomeLineage, Outcome } from "@/platform/outcomes";

import type { InvestmentCommitment, InvestmentDecision, InvestmentMeasuredResult, InvestmentPlatformAnalysis } from "../../domain";

export type RecordInvestmentOutcomeInput = Readonly<{
  projection: InvestmentDecision;
  analysis: InvestmentPlatformAnalysis;
  commitment: InvestmentCommitment;
  completedAction: Action;
  successful: boolean;
  startedAt: Date;
  completedAt: Date;
  metrics?: Readonly<Record<string, number>>;
  notes?: readonly string[];
}>;

/** Records measured reality separately from Action completion and derives auditable Intelligence. */
export function recordInvestmentOutcome({
  projection,
  analysis,
  commitment,
  completedAction,
  successful,
  startedAt,
  completedAt,
  metrics = {},
  notes = [],
}: RecordInvestmentOutcomeInput): InvestmentMeasuredResult {
  if (!completedAction.originatesFrom(commitment.decision)) {
    throw new Error("Investment Outcome Action must originate from the acquisition Decision.");
  }
  if (completedAction.status !== "completed" && completedAction.status !== "measured") {
    throw new Error("Investment Outcome requires a completed Action.");
  }

  const lineage = emptyOutcomeLineage();
  const outcome = Outcome.create({
    id: createOutcomeId(`outcome-investment-${slug(projection.property.id)}-${slug(completedAction.id.value)}`),
    title: "Investment execution measured",
    summary: successful ? "Investment diligence completed successfully." : "Investment diligence failed.",
    type: "action",
    status: successful ? "completed" : "failed",
    successful,
    startedAt,
    completedAt,
    metrics: {
      projectedAnnualRevenue: projection.revenueProjection.projectedAnnualRevenue.amount,
      projectedAnnualCashFlow: projection.financialPerformance.annualCashFlow.amount,
      projectedCapRate: projection.financialPerformance.capRate.value,
      ...metrics,
    },
    notes,
    lineage: {
      ...lineage,
      actionIds: [completedAction.id],
      decisionIds: [commitment.decision.id],
      recommendationIds: [commitment.recommendation.id],
      evaluationIds: analysis.evaluations.toArray().map((value) => value.id),
      claimIds: analysis.claims.toArray().map((value) => value.id),
      evidenceIds: analysis.evidence.toArray().map((value) => value.id),
      observationIds: analysis.observations.toArray().map((value) => value.id),
    },
    metadata: { capability: "investment-intelligence", propertyId: projection.property.id },
  });

  const confidence = commitment.recommendation.confidence;
  const intelligence = new IntelligenceBuilder().build({
    result: {
      title: "Investment intelligence",
      summary: `Measured diligence for ${projection.property.location.address1}.`,
      reportingPeriod: { start: startedAt, end: completedAt },
      confidence,
      insights: projection.risks.map((risk) => ({
        title: risk.title,
        summary: risk.description,
        supportingOutcomes: [outcome],
        confidence,
        rationale: [risk.mitigation ?? "Investment risk policy identified this exposure."],
        businessImpact: risk.estimatedFinancialImpact ? { estimatedFinancialImpact: risk.estimatedFinancialImpact.amount } : undefined,
      })),
      opportunities: [{
        title: projection.strategy.primaryOpportunity,
        summary: projection.strategy.primaryOpportunity,
        supportingOutcomes: [outcome],
        confidence,
        rationale: ["Derived from the acquisition strategy and measured execution."],
        expectedImpact: { expectedAnnualUpside: projection.strategy.expectedAnnualUpside.amount },
      }],
      forecasts: [{
        title: "Acquisition operating forecast",
        summary: "Projected annual cash flow under the approved operating assumptions.",
        supportingOutcomes: [outcome],
        confidence,
        assumptions: ["Approved underwriting assumptions remain materially consistent."],
        rationale: ["Investment-owned underwriting projection."],
        prediction: projection.financialPerformance.annualCashFlow.amount,
        horizon: { start: completedAt, end: new Date(completedAt.getTime() + 31_536_000_000) },
      }],
      metadata: { propertyId: projection.property.id },
    },
  });

  return { outcome, intelligence };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
