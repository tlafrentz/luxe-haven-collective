import type {
  LearningConfidence, LessonApplicabilityRule, LessonContradictionState,
  LessonMaturity, LessonStatus,
} from "../domain";

export type LearningWorkspaceLesson = Readonly<{
  id: string; seriesId: string; revision: number; subjectId: string;
  title: string; statement: string; category: string;
  applicability: readonly LessonApplicabilityRule[];
  confidence: LearningConfidence; maturity: LessonMaturity; status: LessonStatus;
  contradictionState: LessonContradictionState; evidenceCount: number;
  sourceReviewIds: readonly string[]; sourceCandidateIds: readonly string[];
  policyVersion: string; validatedAt: string; supersedesLessonId?: string;
}>;
export type LearningWorkspaceReview = Readonly<{
  id: string; seriesId: string; subjectId: string; revision: number;
  status: string; confidence: LearningConfidence; freshness: string;
  scheduledAt?: string; completedAt?: string; planRevision: number;
  evaluationPolicyVersion: string; metricCount: number; evidenceCount: number;
  summaryStatus?: string; materiality?: string;
}>;
export type LearningContradictionSummary = Readonly<{
  id: string; firstLessonId: string; secondLessonId: string;
  state: LessonContradictionState; rationale: string; createdAt: string;
}>;
export type KnowledgeGap = Readonly<{
  id: string; type: "unvalidated-assumption" | "missing-measurement" | "overdue-review" |
  "low-confidence-lesson" | "contradiction" | "unsupported-context";
  severity: "high" | "medium" | "low"; title: string; detail: string; href: string;
}>;
export type LearningHealth = Readonly<{
  score: number; status: "healthy" | "developing" | "attention";
  coverage: number; freshness: number; evidenceQuality: number;
  reviewCompletion: number; contradictionRate: number;
  maturity: number; confidence: number; evaluatedAt: string;
}>;
export type LearningDashboard = Readonly<{
  metrics: Readonly<{
    reviewsCompleted: number; reviewsReady: number; reviewsOverdue: number;
    validatedLessons: number; candidateLessons: number; contradictedLessons: number;
    emergingKnowledge: number; wellValidatedKnowledge: number;
  }>;
  health: LearningHealth; recentReviews: readonly LearningWorkspaceReview[];
  recentLessons: readonly LearningWorkspaceLesson[];
  contradictions: readonly LearningContradictionSummary[];
  gaps: readonly KnowledgeGap[];
  trends: Readonly<{ lessonGrowth: number; reviewCompletion: number; maturityGrowth: number }>;
}>;
export type LearningWorkspaceReadModel = Readonly<{
  dashboard: LearningDashboard; lessons: readonly LearningWorkspaceLesson[];
  reviews: readonly LearningWorkspaceReview[]; gaps: readonly KnowledgeGap[];
  contradictions: readonly LearningContradictionSummary[];
  filters: Readonly<{ categories: readonly string[]; markets: readonly string[];
    properties: readonly string[]; strategies: readonly string[] }>;
  evaluatedAt: string;
}>;
export type LessonSearchFilters = Readonly<{
  query?: string; category?: string; market?: string; property?: string;
  propertyType?: string; strategy?: string; season?: string;
  confidence?: LearningConfidence; maturity?: LessonMaturity; status?: LessonStatus;
  applicability?: LessonApplicabilityRule["dimension"];
}>;

export function buildLearningWorkspace(input: {
  lessons: readonly LearningWorkspaceLesson[]; reviews: readonly LearningWorkspaceReview[];
  contradictions: readonly LearningContradictionSummary[]; candidateCount: number;
  unvalidatedAssumptionCount: number; unsupportedContexts?: readonly string[]; evaluatedAt: string;
}): LearningWorkspaceReadModel {
  const latestLessons = latestBySeries(input.lessons);
  const latestReviews = latestBySeries(input.reviews);
  const gaps = buildKnowledgeGaps({
    lessons: latestLessons, reviews: latestReviews, contradictions: input.contradictions,
    unvalidatedAssumptionCount: input.unvalidatedAssumptionCount,
    unsupportedContexts: input.unsupportedContexts ?? [],
  });
  const health = calculateKnowledgeHealth(latestLessons, latestReviews, input.contradictions, input.evaluatedAt);
  const metrics = Object.freeze({
    reviewsCompleted: latestReviews.filter(x => x.status === "completed").length,
    reviewsReady: latestReviews.filter(x => x.status === "ready").length,
    reviewsOverdue: latestReviews.filter(x => x.status === "overdue" || x.status === "waiting" && Boolean(x.completedAt)).length,
    validatedLessons: latestLessons.filter(x => x.status === "validated").length,
    candidateLessons: input.candidateCount,
    contradictedLessons: latestLessons.filter(x => x.contradictionState !== "none" || x.status === "contradicted").length,
    emergingKnowledge: latestLessons.filter(x => x.maturity === "emerging").length,
    wellValidatedKnowledge: latestLessons.filter(x => x.maturity === "well-validated").length,
  });
  const dashboard = Object.freeze({
    metrics, health, recentReviews: latestReviews.slice(0, 6),
    recentLessons: latestLessons.slice(0, 6), contradictions: input.contradictions.slice(0, 5),
    gaps: gaps.slice(0, 6), trends: Object.freeze({
      lessonGrowth: latestLessons.length, reviewCompletion: health.reviewCompletion,
      maturityGrowth: health.maturity,
    }),
  });
  return Object.freeze({
    dashboard, lessons: Object.freeze(latestLessons), reviews: Object.freeze(latestReviews),
    gaps, contradictions: Object.freeze([...input.contradictions]),
    filters: collectFilters(latestLessons), evaluatedAt: input.evaluatedAt,
  });
}

export function searchLessons(lessons: readonly LearningWorkspaceLesson[], filters: LessonSearchFilters) {
  const query = filters.query?.trim().toLocaleLowerCase();
  return Object.freeze(lessons.filter(lesson => {
    const applicability = lesson.applicability;
    const text = [lesson.title, lesson.statement, lesson.category,
      ...applicability.flatMap(x => [x.dimension, x.referenceId ?? "", x.value ?? ""]),
      ...lesson.sourceReviewIds].join(" ").toLocaleLowerCase();
    return (!query || text.includes(query)) &&
      (!filters.category || lesson.category === filters.category) &&
      (!filters.confidence || lesson.confidence === filters.confidence) &&
      (!filters.maturity || lesson.maturity === filters.maturity) &&
      (!filters.status || lesson.status === filters.status) &&
      (!filters.applicability || applicability.some(x => x.dimension === filters.applicability)) &&
      dimensionMatches(applicability, "market", filters.market) &&
      dimensionMatches(applicability, "property", filters.property) &&
      dimensionMatches(applicability, "property-type", filters.propertyType) &&
      dimensionMatches(applicability, "strategy", filters.strategy) &&
      dimensionMatches(applicability, "season", filters.season);
  }));
}

export function calculateKnowledgeHealth(lessons: readonly LearningWorkspaceLesson[],
  reviews: readonly LearningWorkspaceReview[], contradictions: readonly LearningContradictionSummary[],
  evaluatedAt: string): LearningHealth {
  const terminal = reviews.filter(x => ["completed", "unable-to-evaluate"].includes(x.status)).length;
  const completion = ratio(terminal, reviews.length);
  const coverage = ratio(lessons.filter(x => x.status === "validated").length, Math.max(1, reviews.filter(x => x.status === "completed").length));
  const freshness = ratio(lessons.filter(x => daysBetween(x.validatedAt, evaluatedAt) <= 365).length, lessons.length);
  const evidence = ratio(lessons.filter(x => x.evidenceCount > 0).length, lessons.length);
  const maturity = ratio(lessons.filter(x => ["established", "well-validated"].includes(x.maturity)).length, lessons.length);
  const confidence = ratio(lessons.filter(x => ["high", "moderate"].includes(x.confidence)).length, lessons.length);
  const contradictionRate = ratio(contradictions.length, lessons.length);
  const score = Math.round(100 * clamp(coverage * .2 + freshness * .15 + evidence * .2 +
    completion * .2 + maturity * .15 + confidence * .1 - contradictionRate * .15));
  return Object.freeze({ score, status: score >= 75 ? "healthy" : score >= 45 ? "developing" : "attention",
    coverage, freshness, evidenceQuality: evidence, reviewCompletion: completion,
    contradictionRate, maturity, confidence, evaluatedAt });
}

export function buildKnowledgeGaps(input: {
  lessons: readonly LearningWorkspaceLesson[]; reviews: readonly LearningWorkspaceReview[];
  contradictions: readonly LearningContradictionSummary[]; unvalidatedAssumptionCount: number;
  unsupportedContexts: readonly string[];
}): readonly KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  if (input.unvalidatedAssumptionCount) gaps.push(gap("assumptions", "unvalidated-assumption", "high",
    `${input.unvalidatedAssumptionCount} assumptions need validation`, "Completed reviews have assumptions without a governed result.", "/dashboard/learning/reviews"));
  const overdue = input.reviews.filter(x => x.status === "overdue").length;
  if (overdue) gaps.push(gap("overdue", "overdue-review", "high", `${overdue} reviews are overdue`,
    "Expected outcomes remain unmeasured or incomplete.", "/dashboard/learning/reviews?status=overdue"));
  const missing = input.reviews.filter(x => x.status === "unable-to-evaluate").length;
  if (missing) gaps.push(gap("measurements", "missing-measurement", "medium",
    `${missing} reviews lack sufficient evidence`, "Unavailable measurements remain explicit.", "/dashboard/learning/reviews?status=unable-to-evaluate"));
  const low = input.lessons.filter(x => ["low", "insufficient-evidence"].includes(x.confidence)).length;
  if (low) gaps.push(gap("confidence", "low-confidence-lesson", "medium", `${low} lessons have low confidence`,
    "Additional reviews or stronger evidence are needed.", "/dashboard/learning/lessons?confidence=low"));
  if (input.contradictions.length) gaps.push(gap("contradictions", "contradiction", "high",
    `${input.contradictions.length} contradictions need resolution`, "Conflicting knowledge remains visible.", "/dashboard/learning/health#contradictions"));
  input.unsupportedContexts.forEach((context, index) => gaps.push(gap(`context:${index}`, "unsupported-context", "low",
    `No validated learning for ${context}`, "This operating context lacks validated coverage.", "/dashboard/learning/lessons")));
  return Object.freeze(gaps);
}

function latestBySeries<T extends { seriesId: string; revision: number }>(values: readonly T[]): T[] {
  const map = new Map<string, T>();
  values.forEach(value => { const prior = map.get(value.seriesId); if (!prior || prior.revision < value.revision) map.set(value.seriesId, value); });
  return [...map.values()].sort((a, b) => b.revision - a.revision);
}
function dimensionMatches(values: readonly LessonApplicabilityRule[], dimension: LessonApplicabilityRule["dimension"], expected?: string) {
  return !expected || values.some(x => x.dimension === dimension && (x.referenceId === expected || x.value === expected));
}
function collectFilters(lessons: readonly LearningWorkspaceLesson[]) {
  const values = (dimension: LessonApplicabilityRule["dimension"]) => [...new Set(lessons.flatMap(x =>
    x.applicability.filter(a => a.dimension === dimension).map(a => a.value ?? a.referenceId ?? "")).filter(Boolean))].sort();
  return Object.freeze({ categories: [...new Set(lessons.map(x => x.category))].sort(),
    markets: values("market"), properties: values("property"), strategies: values("strategy") });
}
function ratio(value: number, total: number) { return total ? value / total : 0; }
function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function daysBetween(first: string, second: string) { return Math.abs(Date.parse(second) - Date.parse(first)) / 86400000; }
function gap(id: string, type: KnowledgeGap["type"], severity: KnowledgeGap["severity"],
  title: string, detail: string, href: string): KnowledgeGap { return Object.freeze({ id, type, severity, title, detail, href }); }
