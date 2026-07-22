import type { MarketComparableAcquisitionResult, MarketComparableCandidate, MarketComparableDataGap, MarketComparablePurpose } from "./comparable-acquisition";
import type { MarketProperty } from "./property-resolution";

export type MarketComparableReasonCode =
  | "COMPARABLE_ELIGIBLE" | "COMPARABLE_SUBJECT_MATCH" | "COMPARABLE_UNSUPPORTED_PROPERTY_TYPE" | "COMPARABLE_DISTANCE_EXCEEDED"
  | "COMPARABLE_EVIDENCE_TOO_OLD" | "COMPARABLE_PRICE_MISSING" | "COMPARABLE_RENT_MISSING"
  | "COMPARABLE_BEDROOM_VARIANCE_EXCEEDED" | "COMPARABLE_BATHROOM_VARIANCE_EXCEEDED"
  | "COMPARABLE_SQUARE_FEET_VARIANCE_EXCEEDED" | "COMPARABLE_PROPERTY_TYPE_UNRESOLVED"
  | "COMPARABLE_SQUARE_FEET_UNRESOLVED" | "COMPARABLE_COORDINATES_UNRESOLVED"
  | "COMPARABLE_DATE_UNRESOLVED" | "COMPARABLE_HARD_OUTLIER";
export interface MarketComparableReason { readonly code: MarketComparableReasonCode; readonly description: string }

export interface MarketComparableEligibilityPolicy {
  readonly allowedPropertyTypes: readonly string[]; readonly maximumDistanceMiles: number; readonly maximumAgeDays: number;
  readonly bedroomDifferenceMaximum: number; readonly bathroomDifferenceMaximum: number; readonly squareFeetVarianceMaximum: number;
  readonly requirePrice: boolean; readonly requireTransactionDate: boolean; readonly requireMonthlyRent: boolean; readonly requireCoordinates: boolean;
}
export type MarketComparableSimilarityDimension = "distance" | "square-feet" | "bedrooms" | "bathrooms" | "year-built" | "property-type" | "recency";
export interface MarketComparableSimilarityPolicy { readonly weights: Readonly<Record<MarketComparableSimilarityDimension, number>>; readonly maximumYearBuiltDifference: number }
export interface MarketComparableOutlierPolicy { readonly minimumSampleSize: number; readonly softDeviationRatio: number; readonly hardDeviationRatio: number }
export interface MarketComparableWeightingPolicy { readonly softOutlierMultiplier: number; readonly incompleteEvidenceMultiplier: number }
export interface MarketComparableQualificationPolicy { readonly purpose: Exclude<MarketComparablePurpose, "short-term-rental-performance">; readonly eligibility: MarketComparableEligibilityPolicy; readonly similarity: MarketComparableSimilarityPolicy; readonly outliers: MarketComparableOutlierPolicy; readonly weighting: MarketComparableWeightingPolicy; readonly minimumIncludedComparables: number; readonly preferredComparableCount: number }

export interface MarketComparableSimilarityComponent { readonly dimension: MarketComparableSimilarityDimension; readonly score: number; readonly policyWeight: number; readonly effectiveWeight: number }
export interface MarketComparableSimilarityAssessment { readonly score: number; readonly components: readonly MarketComparableSimilarityComponent[]; readonly missingDimensions: readonly MarketComparableSimilarityDimension[]; readonly rationale: readonly string[] }
export interface MarketComparableOutlierAssessment { readonly status: "not-outlier" | "soft-outlier" | "hard-outlier" | "insufficient-sample"; readonly dimensions: readonly string[]; readonly rationale: readonly string[] }
export interface MarketComparableWeightAssessment { readonly rawWeight: number; readonly components: readonly Readonly<{ key: string; value: number }>[]; readonly rationale: readonly string[] }
export type MarketComparableEligibilityAssessment =
  | Readonly<{ status: "eligible"; reasons: readonly MarketComparableReason[] }>
  | Readonly<{ status: "excluded"; reasons: readonly MarketComparableReason[] }>
  | Readonly<{ status: "unresolved"; reasons: readonly MarketComparableReason[]; dataGaps: readonly MarketComparableDataGap[] }>;
export interface QualifiedMarketComparable { readonly candidate: MarketComparableCandidate; readonly eligibility: Extract<MarketComparableEligibilityAssessment, { status: "eligible" }>; readonly similarity: MarketComparableSimilarityAssessment; readonly outlier: MarketComparableOutlierAssessment; readonly weight: MarketComparableWeightAssessment; readonly normalizedWeight: number; readonly inclusionReasons: readonly MarketComparableReason[]; readonly dataGaps: readonly MarketComparableDataGap[] }
export interface ExcludedMarketComparable { readonly candidate: MarketComparableCandidate; readonly stage: "eligibility" | "outlier"; readonly reasons: readonly MarketComparableReason[]; readonly similarity?: MarketComparableSimilarityAssessment; readonly outlier?: MarketComparableOutlierAssessment }
export interface UnresolvedMarketComparable { readonly candidate: MarketComparableCandidate; readonly reasons: readonly MarketComparableReason[]; readonly dataGaps: readonly MarketComparableDataGap[] }
export interface MarketComparableQualificationSummary { readonly acquiredCount: number; readonly includedCount: number; readonly excludedCount: number; readonly unresolvedCount: number; readonly sufficiency: "sufficient" | "limited" | "insufficient"; readonly totalNormalizedWeight: number; readonly averageSimilarityScore?: number; readonly medianDistanceMiles?: number; readonly oldestIncludedEvidenceAt?: Date; readonly dataGapCount: number }
export interface MarketComparableQualificationLineage { readonly subjectId: string; readonly acquisitionId: string; readonly candidateIds: readonly string[] }
export interface MarketComparableQualificationContext { readonly qualificationId: string; readonly evaluatedAt: Date; readonly evaluatedBy?: string }
export interface QualifyMarketComparablesCommand { readonly subject: MarketProperty; readonly acquisition: MarketComparableAcquisitionResult; readonly policy: MarketComparableQualificationPolicy; readonly context: MarketComparableQualificationContext }
export interface MarketComparableQualificationResult { readonly qualificationId: string; readonly subjectId: string; readonly acquisitionId: string; readonly purpose: Exclude<MarketComparablePurpose, "short-term-rental-performance">; readonly included: readonly QualifiedMarketComparable[]; readonly excluded: readonly ExcludedMarketComparable[]; readonly unresolved: readonly UnresolvedMarketComparable[]; readonly summary: MarketComparableQualificationSummary; readonly policySnapshot: MarketComparableQualificationPolicy; readonly dataGaps: readonly MarketComparableDataGap[]; readonly lineage: MarketComparableQualificationLineage; readonly evaluatedAt: Date }
