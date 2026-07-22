import type { MarketComparableCandidate, MarketComparableDataGap } from "../domain/comparable-acquisition";
import type { ExcludedMarketComparable, MarketComparableOutlierAssessment, MarketComparableQualificationPolicy, MarketComparableQualificationResult, MarketComparableReason, QualifiedMarketComparable, QualifyMarketComparablesCommand, UnresolvedMarketComparable } from "../domain/comparable-qualification";
import { assessMarketComparableEligibility } from "./assess-market-comparable-eligibility";
import { calculateMarketComparableSimilarity } from "./calculate-market-comparable-similarity";
import { assessMarketComparableOutliers } from "./assess-market-comparable-outliers";
import { calculateMarketComparableWeight, normalizeMarketComparableWeights } from "./calculate-market-comparable-weight";

export function qualifyMarketComparables(command: QualifyMarketComparablesCommand): MarketComparableQualificationResult {
  validate(command);
  const eligibilityExcluded: ExcludedMarketComparable[] = [];
  const unresolved: UnresolvedMarketComparable[] = [];
  const eligible: Readonly<{ candidate: MarketComparableCandidate; eligibility: Extract<ReturnType<typeof assessMarketComparableEligibility>, { status: "eligible" }>; similarity: ReturnType<typeof calculateMarketComparableSimilarity> }>[] = [];
  const candidateCopies = structuredClone(command.acquisition.candidates);
  for (const candidate of [...candidateCopies].sort((a, b) => a.id.localeCompare(b.id))) {
    const assessment = assessMarketComparableEligibility(command.subject, candidate, command.policy.eligibility, command.context.evaluatedAt);
    if (assessment.status === "excluded") { eligibilityExcluded.push({ candidate, stage: "eligibility", reasons: assessment.reasons }); continue; }
    if (assessment.status === "unresolved") { unresolved.push({ candidate, reasons: assessment.reasons, dataGaps: assessment.dataGaps }); continue; }
    eligible.push({ candidate, eligibility: assessment, similarity: calculateMarketComparableSimilarity(command.subject, candidate, command.policy.similarity, command.context.evaluatedAt, command.policy.eligibility.maximumAgeDays, command.policy.eligibility.maximumDistanceMiles) });
  }
  const outliers = assessMarketComparableOutliers(eligible.map((item) => item.candidate), command.policy.outliers);
  const outlierExcluded: ExcludedMarketComparable[] = [];
  const weighted = eligible.flatMap((item) => {
    const outlier = requiredOutlier(outliers.get(item.candidate.id));
    if (outlier.status === "hard-outlier") { outlierExcluded.push({ candidate: item.candidate, stage: "outlier", reasons: [reason("COMPARABLE_HARD_OUTLIER", outlier.rationale[0])], similarity: item.similarity, outlier }); return []; }
    return [{ ...item, outlier, weight: calculateMarketComparableWeight(item.candidate, item.similarity, outlier, command.policy.weighting) }];
  });
  const included: QualifiedMarketComparable[] = normalizeMarketComparableWeights(weighted).map((item) => ({ ...item, inclusionReasons: item.eligibility.reasons, dataGaps: item.candidate.dataGaps }));
  included.sort((a, b) => b.normalizedWeight - a.normalizedWeight || b.similarity.score - a.similarity.score || (a.candidate.distanceMiles ?? Infinity) - (b.candidate.distanceMiles ?? Infinity) || a.candidate.id.localeCompare(b.candidate.id));
  const excluded = [...eligibilityExcluded, ...outlierExcluded].sort((a, b) => a.stage.localeCompare(b.stage) || (a.reasons[0]?.code ?? "").localeCompare(b.reasons[0]?.code ?? "") || a.candidate.id.localeCompare(b.candidate.id));
  unresolved.sort((a, b) => (a.reasons[0]?.code ?? "").localeCompare(b.reasons[0]?.code ?? "") || a.candidate.id.localeCompare(b.candidate.id));
  const dataGaps = uniqueGaps([...included.flatMap((item) => item.dataGaps), ...unresolved.flatMap((item) => item.dataGaps), ...excluded.flatMap((item) => item.candidate.dataGaps)]);
  const totalNormalizedWeight = round(included.reduce((sum, item) => sum + item.normalizedWeight, 0));
  const summary = {
    acquiredCount: command.acquisition.candidates.length, includedCount: included.length, excludedCount: excluded.length, unresolvedCount: unresolved.length,
    sufficiency: included.length >= command.policy.preferredComparableCount ? "sufficient" as const : included.length >= command.policy.minimumIncludedComparables ? "limited" as const : "insufficient" as const,
    totalNormalizedWeight, ...(included.length ? { averageSimilarityScore: round(included.reduce((sum, item) => sum + item.similarity.score, 0) / included.length) } : {}),
    ...(median(included.flatMap((item) => item.candidate.distanceMiles === undefined ? [] : [item.candidate.distanceMiles])) !== undefined ? { medianDistanceMiles: median(included.flatMap((item) => item.candidate.distanceMiles === undefined ? [] : [item.candidate.distanceMiles])) } : {}),
    ...(oldestDate(included) ? { oldestIncludedEvidenceAt: oldestDate(included) } : {}), dataGapCount: dataGaps.length,
  };
  return deepFreeze({ qualificationId: command.context.qualificationId, subjectId: command.subject.id, acquisitionId: command.acquisition.acquisitionId, purpose: command.policy.purpose, included, excluded, unresolved, summary, policySnapshot: clonePolicy(command.policy), dataGaps, lineage: { subjectId: command.subject.id, acquisitionId: command.acquisition.acquisitionId, candidateIds: command.acquisition.candidates.map((candidate) => candidate.id).sort() }, evaluatedAt: new Date(command.context.evaluatedAt.getTime()) });
}

function validate(command: QualifyMarketComparablesCommand): void {
  if (!command.context.qualificationId.trim()) throw new Error("Market comparable qualification id is required.");
  if (command.acquisition.subjectId !== command.subject.id) throw new Error("MARKET_COMPARABLE_QUALIFICATION_SUBJECT_MISMATCH");
  if (command.acquisition.purpose === "short-term-rental-performance" || command.acquisition.purpose !== command.policy.purpose) throw new Error("MARKET_COMPARABLE_QUALIFICATION_PURPOSE_MISMATCH");
  if (new Set(command.acquisition.candidates.map((candidate) => candidate.id)).size !== command.acquisition.candidates.length) throw new Error("MARKET_COMPARABLE_QUALIFICATION_DUPLICATE_CANDIDATE");
  validatePolicy(command.policy);
}
function validatePolicy(policy: MarketComparableQualificationPolicy): void { if (policy.minimumIncludedComparables < 1 || policy.preferredComparableCount < policy.minimumIncludedComparables) throw new Error("Market comparable qualification sample policy is invalid."); const total = Object.values(policy.similarity.weights).reduce((sum, value) => sum + value, 0); if (Math.abs(total - 100) > 0.01) throw new Error("Market comparable similarity weights must total 100."); if (policy.outliers.minimumSampleSize < 3 || policy.outliers.softDeviationRatio < 0 || policy.outliers.hardDeviationRatio <= policy.outliers.softDeviationRatio) throw new Error("Market comparable outlier policy is invalid."); }
function requiredOutlier(value: MarketComparableOutlierAssessment | undefined): MarketComparableOutlierAssessment { if (!value) throw new Error("Market comparable outlier assessment is missing."); return value; }
function reason(code: MarketComparableReason["code"], description: string): MarketComparableReason { return { code, description }; }
function uniqueGaps(gaps: readonly MarketComparableDataGap[]): MarketComparableDataGap[] { return [...new Map(gaps.map((gap) => [gap.code, gap])).values()].sort((a, b) => a.code.localeCompare(b.code)); }
function median(values: readonly number[]): number | undefined { if (!values.length) return undefined; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : round((sorted[middle - 1] + sorted[middle]) / 2); }
function oldestDate(included: readonly QualifiedMarketComparable[]): Date | undefined { const times = included.flatMap((item) => { const date = item.candidate.listing?.listedAt ?? item.candidate.rental?.listedAt; return date ? [date.getTime()] : []; }); return times.length ? new Date(Math.min(...times)) : undefined; }
function clonePolicy(policy: MarketComparableQualificationPolicy): MarketComparableQualificationPolicy { return structuredClone(policy); }
function round(value: number): number { return Math.round(value * 1_000_000) / 1_000_000; }
function deepFreeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child); } return value; }
