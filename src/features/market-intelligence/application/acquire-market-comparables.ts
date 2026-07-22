import type { MarketComparableAcquisitionResult, MarketComparableCandidate, MarketComparableDataGap, MarketComparableProvenance, AcquireMarketComparablesCommand } from "../domain/comparable-acquisition";
import type { MarketComparableProvider, MarketComparableProviderCandidate } from "./providers/market-comparable-provider";
import { buildMarketComparableSearchCriteria } from "./build-market-comparable-search-criteria";
import { normalizeProviderAddress } from "./normalize-market-address";

export interface AcquireMarketComparablesDependencies { readonly provider: MarketComparableProvider }

export async function acquireMarketComparables(command: AcquireMarketComparablesCommand, dependencies: AcquireMarketComparablesDependencies): Promise<MarketComparableAcquisitionResult> {
  validateCommand(command);
  const criteria = buildMarketComparableSearchCriteria(command.subject, command.purpose, command.criteria, command.context.requestedAt);
  const base = { acquisitionId: command.context.acquisitionId, subjectId: command.subject.id, purpose: command.purpose, criteria, requestedAt: new Date(command.context.requestedAt.getTime()), completedAt: new Date(command.context.requestedAt.getTime()) };
  if (command.purpose === "short-term-rental-performance") return deepFreeze({ ...base, status: "unsupported" as const, candidates: [], excludedSubjectCandidateIds: [], dataGaps: [], provenance: [] });

  const purpose: "sale-valuation" | "long-term-rent" = command.purpose;
  const providerResult = await dependencies.provider.acquireComparables({ subject: cloneSubject(command.subject), purpose, criteria });
  if (!providerResult.ok) throw providerResult.error;
  const mapped = providerResult.data.candidates.map((candidate) => mapCandidate(candidate, purpose, providerResult.data.provider, providerResult.data.retrievedAt));
  const excluded = mapped.filter((candidate) => isSubject(candidate, command.subject));
  const candidates = deduplicate(mapped.filter((candidate) => !isSubject(candidate, command.subject))).sort(compareCandidates);
  const provenance = candidates.flatMap((candidate) => candidate.provenance).sort(compareProvenance);
  const dataGaps = uniqueGaps(candidates.flatMap((candidate) => candidate.dataGaps));
  return deepFreeze({ ...base, status: candidates.length ? "acquired" as const : "empty" as const, candidates, excludedSubjectCandidateIds: excluded.map((candidate) => candidate.id).sort(), dataGaps, provenance });
}

function validateCommand(command: AcquireMarketComparablesCommand): void {
  if (!command.context.acquisitionId.trim()) throw new Error("Market comparable acquisition id is required.");
  if (!command.subject.id.trim()) throw new Error("A resolved Market subject is required.");
  if (Number.isNaN(command.context.requestedAt.getTime())) throw new Error("Market comparable request time must be valid.");
}

function mapCandidate(source: MarketComparableProviderCandidate, purpose: "sale-valuation" | "long-term-rent", provider: MarketComparableProvenance["provider"], retrievedAt?: Date): MarketComparableCandidate {
  const status = source.listingStatus ?? "unknown";
  const provenance: MarketComparableProvenance = { provider, externalId: source.externalId, dataset: purpose === "sale-valuation" ? "sale-avm-comparables" : "long-term-rent-avm-comparables", retrievedAt: retrievedAt ? new Date(retrievedAt.getTime()) : undefined, sourceRank: source.sourceRank };
  const candidate: MarketComparableCandidate = {
    id: `${provider}:${source.externalId}:${purpose}`, purpose, providerReferences: [{ provider, externalId: source.externalId }], address: { ...source.address },
    propertyType: source.propertyType, bedrooms: source.bedrooms, bathrooms: source.bathrooms, squareFeet: source.squareFeet, yearBuilt: source.yearBuilt,
    latitude: source.latitude, longitude: source.longitude, distanceMiles: source.distanceMiles,
    ...(purpose === "sale-valuation" && source.price !== undefined ? { listing: { price: source.price, status, ...(source.listedAt ? { listedAt: new Date(source.listedAt.getTime()) } : {}), daysOnMarket: source.daysOnMarket } } : {}),
    ...(purpose === "long-term-rent" && source.price !== undefined ? { rental: { monthlyRent: source.price, status, ...(source.listedAt ? { listedAt: new Date(source.listedAt.getTime()) } : {}), daysOnMarket: source.daysOnMarket } } : {}),
    sourceRank: source.sourceRank, dataGaps: [], provenance: [provenance],
  };
  return { ...candidate, dataGaps: gapsFor(candidate, retrievedAt) };
}

function gapsFor(candidate: MarketComparableCandidate, retrievedAt?: Date): readonly MarketComparableDataGap[] {
  const gaps: MarketComparableDataGap[] = [];
  if (!candidate.propertyType) gaps.push(gap("COMPARABLE_PROPERTY_TYPE_MISSING", "Comparable property type is missing."));
  if (candidate.bedrooms === undefined) gaps.push(gap("COMPARABLE_BEDROOM_COUNT_MISSING", "Comparable bedroom count is missing."));
  if (candidate.bathrooms === undefined) gaps.push(gap("COMPARABLE_BATHROOM_COUNT_MISSING", "Comparable bathroom count is missing."));
  if (candidate.squareFeet === undefined) gaps.push(gap("COMPARABLE_SQUARE_FOOTAGE_MISSING", "Comparable square footage is missing."));
  if (candidate.latitude === undefined || candidate.longitude === undefined) gaps.push(gap("COMPARABLE_COORDINATES_MISSING", "Comparable coordinates are missing."));
  if (candidate.purpose === "sale-valuation" && !candidate.listing) gaps.push(gap("COMPARABLE_PRICE_MISSING", "Comparable sale/listing price is missing."));
  if (candidate.purpose === "sale-valuation" && candidate.listing?.status === "sold" && !candidate.listing.listedAt) gaps.push(gap("COMPARABLE_TRANSACTION_DATE_MISSING", "Comparable transaction date is missing."));
  if (candidate.purpose === "long-term-rent" && !candidate.rental) gaps.push(gap("COMPARABLE_RENT_MISSING", "Comparable monthly rent is missing."));
  if ((candidate.listing?.status ?? candidate.rental?.status ?? "unknown") === "unknown") gaps.push(gap("COMPARABLE_LISTING_STATUS_MISSING", "Comparable listing status is missing.", "informational"));
  if (!retrievedAt) gaps.push(gap("COMPARABLE_PROVIDER_TIMESTAMP_MISSING", "Comparable provider timestamp is missing.", "informational"));
  return Object.freeze(uniqueGaps(gaps));
}

function deduplicate(candidates: readonly MarketComparableCandidate[]): MarketComparableCandidate[] {
  const groups = new Map<string, MarketComparableCandidate[]>();
  for (const candidate of candidates) { const key = `${candidate.providerReferences[0]?.provider}:${candidate.providerReferences[0]?.externalId}:${candidate.purpose}`; groups.set(key, [...(groups.get(key) ?? []), candidate]); }
  return [...groups.values()].map((group) => mergeGroup(group));
}

function mergeGroup(group: readonly MarketComparableCandidate[]): MarketComparableCandidate {
  const ordered = [...group].sort(compareCandidates);
  const first = ordered[0];
  if (ordered.length === 1) return first;
  const prices = new Set(ordered.map((item) => item.listing?.price ?? item.rental?.monthlyRent).filter((value) => value !== undefined));
  const conflict = prices.size > 1 ? [gap("COMPARABLE_CONFLICTING_PROVIDER_RECORD", "Duplicate provider records contain conflicting prices.")] : [];
  return { ...first, dataGaps: uniqueGaps([...ordered.flatMap((item) => item.dataGaps), ...conflict]), provenance: [...ordered.flatMap((item) => item.provenance)].sort(compareProvenance) };
}

function isSubject(candidate: MarketComparableCandidate, subject: AcquireMarketComparablesCommand["subject"]): boolean {
  if (candidate.providerReferences.some((reference) => subject.providerReferences.some((subjectReference) => reference.provider === subjectReference.provider && reference.externalId === subjectReference.externalId))) return true;
  const candidateAddress = normalizeProviderAddress(candidate.address);
  const subjectAddress = normalizeProviderAddress(subject.address);
  return Boolean(candidateAddress && subjectAddress && candidateAddress.comparisonKey === subjectAddress.comparisonKey);
}

function cloneSubject(subject: AcquireMarketComparablesCommand["subject"]): AcquireMarketComparablesCommand["subject"] { return { id: subject.id, providerReferences: subject.providerReferences.map((item) => ({ ...item })), address: { ...subject.address }, characteristics: { ...subject.characteristics }, financialFacts: { ...subject.financialFacts }, ...(subject.coordinates ? { coordinates: { ...subject.coordinates } } : {}) }; }
function gap(code: MarketComparableDataGap["code"], description: string, severity: MarketComparableDataGap["severity"] = "material"): MarketComparableDataGap { return { code, description, severity }; }
function uniqueGaps(gaps: readonly MarketComparableDataGap[]): MarketComparableDataGap[] { return [...new Map(gaps.map((item) => [item.code, item])).values()].sort((a, b) => a.code.localeCompare(b.code)); }
function compareCandidates(a: MarketComparableCandidate, b: MarketComparableCandidate): number { return (a.distanceMiles ?? Number.POSITIVE_INFINITY) - (b.distanceMiles ?? Number.POSITIVE_INFINITY) || (b.listing?.listedAt?.getTime() ?? b.rental?.listedAt?.getTime() ?? 0) - (a.listing?.listedAt?.getTime() ?? a.rental?.listedAt?.getTime() ?? 0) || a.address.formatted.localeCompare(b.address.formatted) || a.id.localeCompare(b.id) || (a.sourceRank ?? Number.POSITIVE_INFINITY) - (b.sourceRank ?? Number.POSITIVE_INFINITY); }
function compareProvenance(a: MarketComparableProvenance, b: MarketComparableProvenance): number { return (a.externalId ?? "").localeCompare(b.externalId ?? "") || (a.sourceRank ?? 0) - (b.sourceRank ?? 0); }
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
