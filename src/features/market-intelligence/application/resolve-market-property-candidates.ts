import type { MarketPropertyProviderCandidate } from "./providers/market-property-resolution-provider";
import type { MarketPropertyMismatch, MarketPropertyMatchReason, MarketPropertyResolutionCandidate, NormalizedMarketAddress } from "../domain/property-resolution";
import { normalizeProviderAddress } from "./normalize-market-address";

export type MarketPropertyCandidateResolution =
  | Readonly<{ status: "resolved"; candidate: MarketPropertyResolutionCandidate; alternatives: readonly MarketPropertyResolutionCandidate[] }>
  | Readonly<{ status: "ambiguous" | "not-found"; alternatives: readonly MarketPropertyResolutionCandidate[] }>;

export function resolveMarketPropertyCandidates(
  requested: NormalizedMarketAddress,
  candidates: readonly MarketPropertyProviderCandidate[],
  mapProperty: (candidate: MarketPropertyProviderCandidate) => MarketPropertyResolutionCandidate["property"],
): MarketPropertyCandidateResolution {
  const evaluated = candidates.map((candidate) => evaluate(requested, candidate, mapProperty)).sort(compareCandidates);
  const eligible = evaluated.filter((candidate) => candidate.matchScore >= 80 && candidate.mismatches.length === 0);
  if (eligible.length === 0) return Object.freeze({ status: "not-found", alternatives: Object.freeze(evaluated) });
  const best = eligible[0];
  const tied = eligible.filter((candidate) => candidate.matchScore === best.matchScore);
  if (tied.length > 1) return Object.freeze({ status: "ambiguous", alternatives: Object.freeze(tied) });
  return Object.freeze({ status: "resolved", candidate: best, alternatives: Object.freeze(evaluated.slice(1)) });
}

function evaluate(requested: NormalizedMarketAddress, candidate: MarketPropertyProviderCandidate, mapProperty: (candidate: MarketPropertyProviderCandidate) => MarketPropertyResolutionCandidate["property"]): MarketPropertyResolutionCandidate {
  const provider = normalizeProviderAddress(candidate.property.address);
  const reasons: MarketPropertyMatchReason[] = [];
  const mismatches: MarketPropertyMismatch[] = [];
  let score = 0;
  if (!provider) return Object.freeze({ property: mapProperty(candidate), matchScore: 0, matchReasons: Object.freeze(reasons), mismatches: Object.freeze(["street", "city", "state", "postal-code"] as MarketPropertyMismatch[]) });
  const [requestStreet, requestCity, requestState, requestPostal] = requested.comparisonKey.split("|");
  const [providerStreet, providerCity, providerState, providerPostal] = provider.comparisonKey.split("|");
  if (requestStreet === providerStreet) { score += 55; reasons.push(requested.display.addressLine1 === provider.display.addressLine1 ? "exact-address" : "normalized-address"); } else mismatches.push("street");
  if (requestCity === providerCity) { score += 10; reasons.push("city-match"); } else mismatches.push("city");
  if (requestState === providerState) { score += 10; reasons.push("state-match"); } else mismatches.push("state");
  if (requestPostal === providerPostal) { score += 20; reasons.push("postal-code-match"); } else mismatches.push("postal-code");
  if (requested.unit || provider.unit) {
    if (requested.unit === provider.unit) { score += 5; reasons.push("unit-match"); } else mismatches.push("unit");
  } else score += 5;
  return Object.freeze({ property: mapProperty(candidate), matchScore: score, matchReasons: Object.freeze(reasons), mismatches: Object.freeze(mismatches) });
}

function compareCandidates(a: MarketPropertyResolutionCandidate, b: MarketPropertyResolutionCandidate): number {
  return b.matchScore - a.matchScore || (a.property.providerReferences[0]?.externalId ?? a.property.id).localeCompare(b.property.providerReferences[0]?.externalId ?? b.property.id);
}
