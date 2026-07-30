import type { StrMarketSnapshot } from "@/features/market-intelligence/str/domain";

export type MarketAssumptionState = "market-derived" | "user-accepted" | "user-overridden" | "manual" | "unavailable";
export interface SourcedAssumption {
  readonly selectedValue: number;
  readonly sourceType: "market-derived" | "user-override" | "manual" | "calculated";
  readonly marketValue?: number;
  readonly marketSnapshotId?: string;
  readonly evidenceIds: readonly string[];
  readonly acceptedAt?: string;
  readonly overriddenAt?: string;
  readonly rationale?: string;
}
export interface InvestmentAnalysisMarketContext {
  readonly subjectPropertySnapshotId: string;
  readonly marketSnapshotId?: string;
  readonly selectedAssumptions: {
    readonly adr?: SourcedAssumption; readonly occupancy?: SourcedAssumption;
    readonly annualRevenue?: SourcedAssumption; readonly seasonality?: SourcedAssumption;
  };
  readonly confidence?: StrMarketSnapshot["confidence"];
  readonly warningCodes: readonly string[];
  readonly snapshot?: StrMarketSnapshot;
}
export interface MarketAssumptionSelection {
  readonly state: MarketAssumptionState; readonly value?: number; readonly marketValue?: number;
  readonly evidenceIds: readonly string[]; readonly acceptedAt?: string; readonly overriddenAt?: string; readonly rationale?: string;
}
export interface MarketAssumptionSelections {
  readonly adr: MarketAssumptionSelection; readonly occupancy: MarketAssumptionSelection;
  readonly annualRevenue: MarketAssumptionSelection; readonly revPar: MarketAssumptionSelection;
}

const empty = (): MarketAssumptionSelection => ({ state: "unavailable", evidenceIds: [] });
export function proposeMarketAssumptions(snapshot: StrMarketSnapshot): MarketAssumptionSelections {
  const estimate = snapshot.revenueEstimate;
  const selection = (value: number | undefined, evidenceIds = estimate?.evidenceIds ?? []): MarketAssumptionSelection =>
    value === undefined ? empty() : { state: "market-derived", value, marketValue: value, evidenceIds };
  return {
    adr: selection(estimate?.projectedAdr?.amount),
    occupancy: selection(estimate?.projectedOccupancy?.value),
    annualRevenue: selection(estimate?.projectedAnnualRevenue?.amount),
    revPar: selection(estimate?.projectedRevPar?.amount),
  };
}
export function acceptMarketAssumption(value: MarketAssumptionSelection, at = new Date()): MarketAssumptionSelection {
  return value.marketValue === undefined ? value : { ...value, state: "user-accepted", value: value.marketValue, acceptedAt: at.toISOString(), overriddenAt: undefined };
}
export function overrideMarketAssumption(value: MarketAssumptionSelection, override: number, at = new Date(), rationale?: string): MarketAssumptionSelection {
  if (!Number.isFinite(override)) throw new Error("A finite underwriting assumption is required.");
  return { ...value, state: "user-overridden", value: override, overriddenAt: at.toISOString(), ...(rationale ? { rationale } : {}) };
}
export function restoreMarketAssumption(value: MarketAssumptionSelection): MarketAssumptionSelection {
  return value.marketValue === undefined ? value : { ...value, state: "market-derived", value: value.marketValue, acceptedAt: undefined, overriddenAt: undefined };
}
export function selectedAssumption(value: MarketAssumptionSelection, manualValue?: number): number | undefined {
  return value.state === "user-overridden" || value.state === "user-accepted" || value.state === "market-derived"
    ? value.value : manualValue;
}

export type SnapshotFreshness = "current" | "expiring-soon" | "stale" | "unavailable";
export function calculateSnapshotFreshness(snapshot: Pick<StrMarketSnapshot, "createdAt" | "expiresAt"> | undefined, now = new Date()): SnapshotFreshness {
  if (!snapshot) return "unavailable";
  const expiry = new Date(snapshot.expiresAt).getTime(), remaining = expiry - now.getTime();
  if (remaining <= 0) return "stale";
  const lifetime = expiry - new Date(snapshot.createdAt).getTime();
  return remaining <= Math.min(7 * 86_400_000, lifetime * 0.2) ? "expiring-soon" : "current";
}

export interface MarketSnapshotChange {
  readonly metric: "adr" | "occupancy" | "annual-revenue" | "confidence" | "comparable-count";
  readonly previous?: number; readonly current?: number; readonly absoluteChange?: number; readonly percentageChange?: number;
}
export function detectMaterialMarketChanges(previous: StrMarketSnapshot, current: StrMarketSnapshot): readonly MarketSnapshotChange[] {
  const pairs: readonly [MarketSnapshotChange["metric"], number | undefined, number | undefined][] = [
    ["adr", previous.revenueEstimate?.projectedAdr?.amount, current.revenueEstimate?.projectedAdr?.amount],
    ["occupancy", previous.revenueEstimate?.projectedOccupancy?.value, current.revenueEstimate?.projectedOccupancy?.value],
    ["annual-revenue", previous.revenueEstimate?.projectedAnnualRevenue?.amount, current.revenueEstimate?.projectedAnnualRevenue?.amount],
    ["confidence", previous.confidence.score, current.confidence.score],
    ["comparable-count", previous.comparables.filter(item => item.eligibility === "eligible").length, current.comparables.filter(item => item.eligibility === "eligible").length],
  ];
  return pairs.flatMap(([metric, before, after]) => {
    if (before === after) return [];
    const absoluteChange = before !== undefined && after !== undefined ? after - before : undefined;
    const percentageChange = absoluteChange !== undefined && before ? absoluteChange / before * 100 : undefined;
    return [{ metric, previous: before, current: after, absoluteChange, percentageChange }];
  });
}

export function buildInvestmentAnalysisMarketContext(input: {
  readonly snapshot: StrMarketSnapshot; readonly selections: MarketAssumptionSelections; readonly manualAdr?: number; readonly manualOccupancy?: number;
}): InvestmentAnalysisMarketContext {
  const toSource = (selection: MarketAssumptionSelection, manual?: number): SourcedAssumption | undefined => {
    const chosen = selectedAssumption(selection, manual); if (chosen === undefined) return undefined;
    const sourceType = selection.state === "user-overridden" ? "user-override" : selection.state === "unavailable" ? "manual" : "market-derived";
    return { selectedValue: chosen, sourceType, marketValue: selection.marketValue, marketSnapshotId: input.snapshot.id,
      evidenceIds: selection.evidenceIds, acceptedAt: selection.acceptedAt, overriddenAt: selection.overriddenAt, rationale: selection.rationale };
  };
  return {
    subjectPropertySnapshotId: input.snapshot.subjectPropertySnapshotId, marketSnapshotId: input.snapshot.id,
    selectedAssumptions: { adr: toSource(input.selections.adr, input.manualAdr), occupancy: toSource(input.selections.occupancy, input.manualOccupancy),
      annualRevenue: toSource(input.selections.annualRevenue) },
    confidence: input.snapshot.confidence, warningCodes: input.snapshot.warnings, snapshot: input.snapshot,
  };
}

export interface InvestmentMemoMarketProjection {
  readonly references: { readonly marketSnapshotId: string; readonly subjectPropertySnapshotId: string; readonly comparablePolicyVersion: string; readonly confidencePolicyVersion: string };
  readonly summary: { readonly snapshotDate: string; readonly freshness: SnapshotFreshness; readonly confidence: StrMarketSnapshot["confidence"]; readonly qualifiedComparableCount: number; readonly limitations: readonly string[] };
  readonly assumptions: readonly { readonly assumption: string; readonly usedValue?: number; readonly source: string; readonly marketValue?: number; readonly overridden: boolean }[];
  readonly topComparables: StrMarketSnapshot["comparables"];
}
export function projectInvestmentMemoMarketEvidence(context: InvestmentAnalysisMarketContext, now = new Date()): InvestmentMemoMarketProjection | undefined {
  const snapshot = context.snapshot; if (!snapshot || !context.marketSnapshotId) return undefined;
  return {
    references: { marketSnapshotId: snapshot.id, subjectPropertySnapshotId: snapshot.subjectPropertySnapshotId,
      comparablePolicyVersion: snapshot.comparablePolicyVersion, confidencePolicyVersion: "str-confidence.v1" },
    summary: { snapshotDate: snapshot.createdAt, freshness: calculateSnapshotFreshness(snapshot, now), confidence: snapshot.confidence,
      qualifiedComparableCount: snapshot.comparables.filter(item => item.eligibility === "eligible").length, limitations: snapshot.confidence.limitations },
    assumptions: Object.entries(context.selectedAssumptions).flatMap(([assumption, value]) => value ? [{
      assumption, usedValue: value.selectedValue, source: value.sourceType, marketValue: value.marketValue, overridden: value.sourceType === "user-override",
    }] : []),
    topComparables: snapshot.comparables.filter(item => item.eligibility === "eligible").sort((a, b) => b.weight - a.weight).slice(0, 5),
  };
}
