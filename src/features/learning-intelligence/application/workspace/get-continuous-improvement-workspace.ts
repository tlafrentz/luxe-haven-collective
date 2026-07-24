import { Result, type ResultType } from "@/platform/kernel";
import { buildContinuousImprovementWorkspace } from "./build-continuous-improvement-workspace";
import type { ContinuousImprovementWorkspaceState, GetContinuousImprovementWorkspaceError, GetContinuousImprovementWorkspaceQuery, LearningWorkspaceAuthorization, LearningWorkspaceOutcomeReader, LearningWorkspacePortfolioLearningReader, LearningWorkspacePortfolioReader, LearningWorkspaceRecommendationReader, LearningWorkspaceSection } from "./continuous-improvement-workspace";

export type ContinuousImprovementWorkspaceDependencies = Readonly<{
  authorization: LearningWorkspaceAuthorization;
  portfolios: LearningWorkspacePortfolioReader;
  outcomes: LearningWorkspaceOutcomeReader;
  recommendations: LearningWorkspaceRecommendationReader;
  learnings: LearningWorkspacePortfolioLearningReader;
}>;

export function createGetContinuousImprovementWorkspace(dependencies: ContinuousImprovementWorkspaceDependencies) {
  return async (query: GetContinuousImprovementWorkspaceQuery): Promise<ResultType<ContinuousImprovementWorkspaceState, GetContinuousImprovementWorkspaceError>> => {
    if (!query.ownerId || !query.portfolioId || query.observationWindow.start >= query.observationWindow.end) return Result.fail({ code: "LEARNING_WORKSPACE_INPUT_INVALID", field: "observationWindow" });
    if (await dependencies.authorization.canRead(query.ownerId, query.portfolioId) !== "authorized") return Result.fail({ code: "LEARNING_WORKSPACE_NOT_AUTHORIZED" });
    let portfolio;
    try { portfolio = await dependencies.portfolios.read(query.ownerId, query.portfolioId); }
    catch { return Result.fail({ code: "LEARNING_WORKSPACE_UNEXPECTED" }); }
    if (!portfolio) return Result.fail({ code: "LEARNING_WORKSPACE_NOT_FOUND" });
    const unavailable: LearningWorkspaceSection[] = [];
    const [outcomeResult, recommendationResult, learningResult] = await Promise.allSettled([
      dependencies.outcomes.read(query.ownerId, query.portfolioId, query.observationWindow, Math.min(query.outcomeLimit ?? 10, 25)),
      dependencies.recommendations.read(query.ownerId, query.portfolioId, query.observationWindow, Math.min(query.recommendationLimit ?? 8, 20)),
      dependencies.learnings.read(query.ownerId, query.portfolioId, query.observationWindow),
    ]);
    if (outcomeResult.status === "rejected") unavailable.push("outcomes", "decisions", "measurement-quality");
    if (recommendationResult.status === "rejected") unavailable.push("recommendations");
    if (learningResult.status === "rejected") unavailable.push("learnings", "comparison");
    const outcomes = outcomeResult.status === "fulfilled" ? outcomeResult.value : { items: Object.freeze([]), planned: 0, measuring: 0 };
    return Result.ok(buildContinuousImprovementWorkspace(query, Object.freeze({
      portfolio, outcomes: outcomes.items, plannedOutcomeCount: outcomes.planned, measuringOutcomeCount: outcomes.measuring,
      recommendations: recommendationResult.status === "fulfilled" ? recommendationResult.value : Object.freeze([]),
      learning: learningResult.status === "fulfilled" ? learningResult.value : null,
      unavailableSections: Object.freeze([...new Set(unavailable)]),
    })));
  };
}
