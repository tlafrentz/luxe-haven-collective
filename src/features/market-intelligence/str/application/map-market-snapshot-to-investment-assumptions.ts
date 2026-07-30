import type { StrMarketSnapshot } from "../domain";

export interface MarketAssumptionSource {
  readonly sourceType: "market-snapshot"; readonly sourceId: string; readonly evidenceIds: readonly string[];
  readonly confidence: { readonly score: number; readonly level: "low" | "moderate" | "high" }; readonly proposedAt: string;
}
export interface StrInvestmentAssumptionProposal {
  readonly adr?: number; readonly occupancyPercentage?: number; readonly annualRevenue?: number;
  readonly seasonality?: StrMarketSnapshot["seasonality"]; readonly source: MarketAssumptionSource;
}
export interface SelectedStrAssumptions {
  readonly adr: number; readonly occupancyPercentage: number; readonly annualRevenue?: number;
  readonly seasonality?: StrMarketSnapshot["seasonality"]; readonly source: "market-derived-proposal" | "user-override" | "manual";
  readonly marketSnapshotId?: string; readonly overriddenFields: readonly ("adr" | "occupancy" | "seasonality")[];
}

export function mapMarketSnapshotToInvestmentAssumptions(snapshot: StrMarketSnapshot, proposedAt = new Date()): StrInvestmentAssumptionProposal {
  const estimate = snapshot.revenueEstimate;
  return {
    adr: estimate?.projectedAdr?.amount, occupancyPercentage: estimate?.projectedOccupancy?.value,
    annualRevenue: estimate?.projectedAnnualRevenue?.amount, seasonality: snapshot.seasonality,
    source: { sourceType: "market-snapshot", sourceId: snapshot.id, evidenceIds: estimate?.evidenceIds ?? snapshot.evidenceIds,
      confidence: snapshot.confidence, proposedAt: proposedAt.toISOString() },
  };
}

export function selectStrAssumptions(input: {
  readonly proposal?: StrInvestmentAssumptionProposal; readonly manual: { adr: number; occupancyPercentage: number };
  readonly overrides?: { adr?: number; occupancyPercentage?: number; seasonality?: StrMarketSnapshot["seasonality"] | null };
}): SelectedStrAssumptions {
  if (!input.proposal) return { ...input.manual, source: "manual", overriddenFields: [] };
  const overriddenFields: ("adr" | "occupancy" | "seasonality")[] = [];
  if (input.overrides?.adr !== undefined) overriddenFields.push("adr");
  if (input.overrides?.occupancyPercentage !== undefined) overriddenFields.push("occupancy");
  if (input.overrides?.seasonality !== undefined) overriddenFields.push("seasonality");
  return {
    adr: input.overrides?.adr ?? input.proposal.adr ?? input.manual.adr,
    occupancyPercentage: input.overrides?.occupancyPercentage ?? input.proposal.occupancyPercentage ?? input.manual.occupancyPercentage,
    annualRevenue: input.proposal.annualRevenue,
    seasonality: input.overrides?.seasonality === null ? undefined : input.overrides?.seasonality ?? input.proposal.seasonality,
    source: overriddenFields.length ? "user-override" : "market-derived-proposal",
    marketSnapshotId: input.proposal.source.sourceId, overriddenFields,
  };
}

export function assessStrReadiness(input: { snapshot?: StrMarketSnapshot; providerRequired?: boolean; providerError?: "authentication" | "unsupported-geography" | "unavailable" }): {
  status: "ready" | "ready-with-warnings" | "incomplete" | "blocked"; messages: readonly string[];
} {
  if (input.providerError === "authentication") return { status: "blocked", messages: ["Live market intelligence requires administrative configuration."] };
  if (!input.snapshot) return input.providerRequired ? { status: "blocked", messages: ["Live STR evidence is required but unavailable."] }
    : { status: "ready-with-warnings", messages: ["Continue with manual STR assumptions."] };
  if (!input.snapshot.revenueEstimate) return { status: "incomplete", messages: ["The market snapshot has no usable revenue estimate."] };
  const eligible = input.snapshot.comparables.filter((item) => item.eligibility === "eligible").length;
  const warnings = [...(eligible < 8 ? [`Only ${eligible} qualified comparables support this estimate.`] : []), ...(!input.snapshot.seasonality ? ["Seasonality is unavailable."] : []), ...input.snapshot.query.missingInputs.map((field) => `${field} was unavailable.`)];
  return { status: warnings.length ? "ready-with-warnings" : "ready", messages: warnings };
}
