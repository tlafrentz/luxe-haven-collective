import type { MarketComparableCandidate } from "../domain/comparable-acquisition";
import type { MarketComparableEligibilityAssessment, MarketComparableEligibilityPolicy, MarketComparableReason } from "../domain/comparable-qualification";
import type { MarketProperty } from "../domain/property-resolution";
import { normalizeProviderAddress } from "./normalize-market-address";

export function assessMarketComparableEligibility(subject: MarketProperty, candidate: MarketComparableCandidate, policy: MarketComparableEligibilityPolicy, evaluatedAt: Date): MarketComparableEligibilityAssessment {
  const excluded: MarketComparableReason[] = [];
  const unresolved: MarketComparableReason[] = [];
  if (isSubject(subject, candidate)) excluded.push(reason("COMPARABLE_SUBJECT_MATCH", "Candidate resolves to the subject property."));
  const propertyType = candidate.propertyType;
  if (!propertyType) unresolved.push(reason("COMPARABLE_PROPERTY_TYPE_UNRESOLVED", "Property type is unavailable."));
  else if (policy.allowedPropertyTypes.length && !policy.allowedPropertyTypes.some((type) => normalize(type) === normalize(propertyType))) excluded.push(reason("COMPARABLE_UNSUPPORTED_PROPERTY_TYPE", "Property type is outside the qualification policy."));
  if (candidate.distanceMiles !== undefined && candidate.distanceMiles > policy.maximumDistanceMiles) excluded.push(reason("COMPARABLE_DISTANCE_EXCEEDED", "Distance exceeds the policy maximum."));
  else if (policy.requireCoordinates && (candidate.latitude === undefined || candidate.longitude === undefined)) unresolved.push(reason("COMPARABLE_COORDINATES_UNRESOLVED", "Coordinates required by policy are unavailable."));
  if (policy.requirePrice && !candidate.listing) excluded.push(reason("COMPARABLE_PRICE_MISSING", "Sale/listing price is required."));
  if (policy.requireMonthlyRent && !candidate.rental) excluded.push(reason("COMPARABLE_RENT_MISSING", "Monthly rent is required."));
  const evidenceAt = candidate.listing?.listedAt ?? candidate.rental?.listedAt;
  if (evidenceAt && daysBetween(evidenceAt, evaluatedAt) > policy.maximumAgeDays) excluded.push(reason("COMPARABLE_EVIDENCE_TOO_OLD", "Evidence is older than the policy maximum."));
  else if (policy.requireTransactionDate && !evidenceAt) unresolved.push(reason("COMPARABLE_DATE_UNRESOLVED", "Evidence date required by policy is unavailable."));
  compareDifference(subject.characteristics.bedrooms, candidate.bedrooms, policy.bedroomDifferenceMaximum, "COMPARABLE_BEDROOM_VARIANCE_EXCEEDED", excluded);
  compareDifference(subject.characteristics.bathrooms, candidate.bathrooms, policy.bathroomDifferenceMaximum, "COMPARABLE_BATHROOM_VARIANCE_EXCEEDED", excluded);
  if (subject.characteristics.squareFeet !== undefined && candidate.squareFeet === undefined) unresolved.push(reason("COMPARABLE_SQUARE_FEET_UNRESOLVED", "Square footage is unavailable for comparison."));
  else if (subject.characteristics.squareFeet && candidate.squareFeet && Math.abs(candidate.squareFeet - subject.characteristics.squareFeet) / subject.characteristics.squareFeet > policy.squareFeetVarianceMaximum) excluded.push(reason("COMPARABLE_SQUARE_FEET_VARIANCE_EXCEEDED", "Square-footage variance exceeds policy."));
  if (excluded.length) return Object.freeze({ status: "excluded", reasons: Object.freeze(excluded.sort(byCode)) });
  if (unresolved.length) return Object.freeze({ status: "unresolved", reasons: Object.freeze(unresolved.sort(byCode)), dataGaps: Object.freeze(candidate.dataGaps.map((gap) => ({ ...gap }))) });
  return Object.freeze({ status: "eligible", reasons: Object.freeze([reason("COMPARABLE_ELIGIBLE", "Candidate satisfies hard eligibility requirements.")]) });
}
function compareDifference(subject: number | undefined, candidate: number | undefined, maximum: number, code: "COMPARABLE_BEDROOM_VARIANCE_EXCEEDED" | "COMPARABLE_BATHROOM_VARIANCE_EXCEEDED", reasons: MarketComparableReason[]): void { if (subject !== undefined && candidate !== undefined && Math.abs(candidate - subject) > maximum) reasons.push(reason(code, "Characteristic variance exceeds policy.")); }
function reason(code: MarketComparableReason["code"], description: string): MarketComparableReason { return { code, description }; }
function byCode(a: MarketComparableReason, b: MarketComparableReason): number { return a.code.localeCompare(b.code); }
function normalize(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function daysBetween(earlier: Date, later: Date): number { return Math.max(0, (later.getTime() - earlier.getTime()) / 86_400_000); }
function isSubject(subject: MarketProperty, candidate: MarketComparableCandidate): boolean {
  if (candidate.providerReferences.some((reference) => subject.providerReferences.some((subjectReference) => reference.provider === subjectReference.provider && reference.externalId === subjectReference.externalId))) return true;
  const subjectAddress = normalizeProviderAddress(subject.address);
  const candidateAddress = normalizeProviderAddress(candidate.address);
  return Boolean(subjectAddress && candidateAddress && subjectAddress.comparisonKey === candidateAddress.comparisonKey);
}
