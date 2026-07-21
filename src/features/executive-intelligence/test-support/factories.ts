import type { ExecutiveDataQualitySummary, ExecutiveIntelligenceView } from "../domain";

export function createExecutiveDataQualitySummary(
  overrides: Partial<ExecutiveDataQualitySummary> = {},
): ExecutiveDataQualitySummary {
  return {
    availablePillars: [], unavailablePillars: [], confidence: null, gaps: [],
    summary: "Canonical lifecycle data is available for all configured providers.",
    ...overrides,
  };
}

export function createExecutiveIntelligenceView(
  overrides: Partial<ExecutiveIntelligenceView> = {},
): ExecutiveIntelligenceView {
  return {
    generatedAt: new Date("2026-07-20T12:00:00Z"),
    scope: { properties: [], selectedProperty: null, propertyCount: null, startDate: "2026-07-01", endDate: "2026-08-01", scopeKnown: false },
    performance: { available: false, grossRevenue: { value: null, trend: null }, occupancyRate: { value: null, trend: null },
      averageDailyRate: { value: null, trend: null }, revPar: { value: null, trend: null }, totalBookings: null, upcomingBookings: null },
    health: { score: null, confidence: null, status: "unavailable", summary: "Business health is unavailable.",
      availablePillars: 0, totalPillars: 7, supportingScoreKeys: [] },
    attention: { risks: [], opportunities: [], priorities: [] },
    decisions: { active: 0, awaitingEvidence: 0, readyForReview: 0, recentlyCompleted: 0, highestPriorityDecision: null },
    execution: { openActions: 0, inProgressActions: 0, overdueActions: 0, completedActions: 0, blockedActions: 0, highestPriorityAction: null },
    outcomes: { measuredOutcomes: 0, positiveOutcomes: 0, neutralOutcomes: 0, negativeOutcomes: 0, latestOutcome: null, learningSummary: null },
    dataQuality: createExecutiveDataQualitySummary(),
    briefing: { headline: "No immediate priorities require attention", summary: "0 items prioritized from canonical Platform records.",
      recommendedFocus: "Continue monitoring Platform Outcomes and Intelligence.", highlights: [], concerns: [] },
    ...overrides,
  };
}
