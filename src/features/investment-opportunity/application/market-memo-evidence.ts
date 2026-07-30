import type { StrMarketSnapshot, StrMarketSnapshotRepository } from "@/features/market-intelligence/str/domain";
import type { OpportunityAnalysis } from "../domain";

export async function loadHistoricalMarketSnapshot(input: {
  readonly analysis: OpportunityAnalysis; readonly ownerId: string; readonly workspaceId: string;
}, repository: StrMarketSnapshotRepository): Promise<StrMarketSnapshot | null> {
  const snapshotId = input.analysis.lineage.marketSnapshotId;
  if (!snapshotId) return null;
  const snapshot = await repository.findById(snapshotId, { ownerId: input.ownerId, workspaceId: input.workspaceId });
  if (!snapshot || snapshot.subjectPropertySnapshotId !== input.analysis.lineage.subjectPropertySnapshotId) return null;
  return snapshot;
}

export function projectOpportunityMarketMemo(analysis: OpportunityAnalysis, snapshot: StrMarketSnapshot) {
  if (analysis.lineage.marketSnapshotId !== snapshot.id || analysis.lineage.subjectPropertySnapshotId !== snapshot.subjectPropertySnapshotId) {
    throw new Error("MEMO_MARKET_LINEAGE_MISMATCH");
  }
  const assumptions = analysis.props.resultSnapshot.assumptions ?? [];
  const find = (key: string) => assumptions.find(item => item.key === key);
  return Object.freeze({
    references: Object.freeze({
      investmentAnalysisId: analysis.props.investmentAnalysisId, marketSnapshotId: snapshot.id,
      subjectPropertySnapshotId: snapshot.subjectPropertySnapshotId, assumptionVersion: analysis.lineage.assumptionVersion ?? "unknown",
      comparablePolicyVersion: analysis.lineage.comparablePolicyVersion ?? snapshot.comparablePolicyVersion,
      confidenceVersion: analysis.lineage.confidenceVersion ?? "unknown",
    }),
    summary: Object.freeze({
      snapshotDate: snapshot.createdAt, confidence: snapshot.confidence, projectedAdr: snapshot.revenueEstimate?.projectedAdr,
      projectedOccupancy: snapshot.revenueEstimate?.projectedOccupancy, projectedAnnualRevenue: snapshot.revenueEstimate?.projectedAnnualRevenue,
      qualifiedComparableCount: snapshot.comparables.filter(item => item.eligibility === "eligible").length,
      limitations: Object.freeze([...snapshot.confidence.limitations, ...snapshot.warnings]),
    }),
    assumptionLineage: Object.freeze([
      ["ADR", find("projected-adr"), snapshot.revenueEstimate?.projectedAdr?.amount],
      ["Occupancy", find("projected-occupancy-percentage"), snapshot.revenueEstimate?.projectedOccupancy?.value],
    ].map(([label, selected, marketValue]) => {
      const value = selected as (typeof assumptions)[number] | undefined;
      return Object.freeze({ assumption: label as string, usedValue: value?.value, source: value?.source ?? "unavailable",
        marketValue: marketValue as number | undefined, override: Boolean(value?.explicitlyOverridden) });
    })),
    topComparables: Object.freeze(snapshot.comparables.filter(item => item.eligibility === "eligible").sort((a, b) => b.weight - a.weight).slice(0, 5)),
  });
}
