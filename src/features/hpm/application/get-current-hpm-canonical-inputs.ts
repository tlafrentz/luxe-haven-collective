import { getAnalyticsDashboardProjection, toPlatformObservations, type AnalyticsDashboardProjection, type AnalyticsQueryParams } from "@/features/analytics";
import { getRevenueIntelligence, type RevenueIntelligence } from "@/features/revenue-intelligence";
import { ActionCollection } from "@/platform/actions";
import { ClaimCollection } from "@/platform/claims";
import { DecisionCollection } from "@/platform/decisions";
import { EvaluationCollection } from "@/platform/evaluations";
import { EvidenceCollection } from "@/platform/evidence";
import { IntelligenceCollection } from "@/platform/intelligence";
import { LearningCollection } from "@/platform/learning";
import { ObservationCollection } from "@/platform/observations";
import { OutcomeCollection } from "@/platform/outcomes";
import { RecommendationCollection } from "@/platform/recommendations";

import type { HpmCanonicalInputs } from "../domain";

export type CurrentHpmQuery = AnalyticsQueryParams & Readonly<{ generatedAt?: string }>;

export type CurrentHpmSourceContext = Readonly<{
  analytics: AnalyticsDashboardProjection;
  revenue: RevenueIntelligence;
}>;

export type CurrentHpmCanonicalAssembly = Readonly<{
  inputs: HpmCanonicalInputs;
  context: CurrentHpmSourceContext;
}>;

export type CurrentHpmCanonicalInputProviders = Readonly<{
  getAnalytics: typeof getAnalyticsDashboardProjection;
  getRevenue: typeof getRevenueIntelligence;
}>;

const productionProviders: CurrentHpmCanonicalInputProviders = {
  getAnalytics: getAnalyticsDashboardProjection,
  getRevenue: getRevenueIntelligence,
};

/** Production assembly boundary for all currently available canonical HPM inputs. */
export async function getCurrentHpmCanonicalInputs(
  query: CurrentHpmQuery,
  providers: CurrentHpmCanonicalInputProviders = productionProviders,
): Promise<CurrentHpmCanonicalAssembly> {
  const generatedAt = query.generatedAt ?? new Date().toISOString();
  const [analytics, revenue] = await Promise.all([
    providers.getAnalytics({ ...query, generatedAt }),
    providers.getRevenue({ ...query, detectedAt: generatedAt }),
  ]);
  const metricObservations = toPlatformObservations(analytics.metricProjections);
  const reasoning = revenue.reasoning;
  const observations = ObservationCollection.create([
    ...metricObservations.toArray(),
    ...(reasoning?.observations.toArray() ?? []),
  ]);

  return Object.freeze({
    inputs: Object.freeze({
      observations,
      evidence: reasoning?.evidence ?? EvidenceCollection.empty(),
      claims: reasoning?.claims ?? ClaimCollection.empty(),
      evaluations: reasoning?.evaluations ?? EvaluationCollection.empty(),
      recommendations: reasoning?.recommendations ?? RecommendationCollection.empty(),
      decisions: DecisionCollection.empty(),
      actions: ActionCollection.empty(),
      outcomes: OutcomeCollection.empty(),
      intelligence: IntelligenceCollection.empty(),
      learning: LearningCollection.empty(),
      analytics: Object.freeze({
        generatedAt: new Date(generatedAt),
        metricCount: analytics.metricProjections.length,
      }),
    }),
    context: Object.freeze({ analytics, revenue }),
  });
}
