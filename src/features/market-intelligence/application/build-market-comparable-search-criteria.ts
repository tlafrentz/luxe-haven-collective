import type { MarketComparablePurpose, MarketComparableSearchCriteria, MarketComparableSearchCriteriaInput, MarketNumberRange } from "../domain/comparable-acquisition";
import type { MarketProperty } from "../domain/property-resolution";

const MAX_RADIUS = 25;
const MAX_LIMIT = 25;

export function buildMarketComparableSearchCriteria(subject: MarketProperty, purpose: MarketComparablePurpose, input: MarketComparableSearchCriteriaInput = {}, requestedAt: Date): MarketComparableSearchCriteria {
  const radiusMiles = input.radiusMiles ?? 5;
  const limit = input.limit ?? 15;
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > MAX_RADIUS) throw new Error("Market comparable radius must be greater than 0 and at most 25 miles.");
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error("Market comparable limit must be an integer between 1 and 25.");
  validateRange(input.bedroomRange, "bedroom", true);
  validateRange(input.bathroomRange, "bathroom", false);
  validateRange(input.squareFeetRange, "square-footage", false, true);
  if (input.occurredAfter && input.occurredAfter.getTime() > requestedAt.getTime()) throw new Error("Market comparable occurrence cutoff cannot be in the future.");
  const bedrooms = input.bedroomRange ?? subjectRange(subject.characteristics.bedrooms, 1, 0);
  const bathrooms = input.bathroomRange ?? subjectRange(subject.characteristics.bathrooms, 1, 0);
  const squareFeet = input.squareFeetRange ?? subjectRange(subject.characteristics.squareFeet, Math.max(250, (subject.characteristics.squareFeet ?? 0) * 0.2), 1);
  const occurredAfter = input.occurredAfter ? new Date(input.occurredAfter.getTime()) : new Date(Date.UTC(requestedAt.getUTCFullYear() - 1, requestedAt.getUTCMonth(), requestedAt.getUTCDate()));
  const listingStatuses = input.listingStatuses ?? (purpose === "sale-valuation" ? ["active", "inactive", "sold"] as const : ["active"] as const);
  return deepFreeze({ radiusMiles, limit, propertyTypes: [...(input.propertyTypes ?? (subject.characteristics.propertyType ? [subject.characteristics.propertyType] : []))].sort(), ...(bedrooms ? { bedroomRange: bedrooms } : {}), ...(bathrooms ? { bathroomRange: bathrooms } : {}), ...(squareFeet ? { squareFeetRange: squareFeet } : {}), occurredAfter, listingStatuses: [...new Set(listingStatuses)].sort() });
}

function subjectRange(value: number | undefined, delta: number, floor: number): MarketNumberRange | undefined { return value === undefined ? undefined : { minimum: Math.max(floor, value - delta), maximum: value + delta }; }
function validateRange(range: MarketNumberRange | undefined, label: string, integer: boolean, positive = false): void {
  if (!range) return;
  if (!Number.isFinite(range.minimum) || !Number.isFinite(range.maximum) || range.minimum > range.maximum || range.minimum < (positive ? 1 : 0) || (integer && (!Number.isInteger(range.minimum) || !Number.isInteger(range.maximum)))) throw new Error(`Market comparable ${label} range is invalid.`);
}
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
