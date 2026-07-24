import { Result, type ResultType } from "@/platform/kernel";
import type { OutcomeOwnerId } from "../../outcomes";
import {
  evaluatePortfolioLearning, type PortfolioLearningAssessment, type PortfolioLearningAssessmentId,
  type PortfolioLearningObservationWindow,
} from "../domain";
import type {
  EvaluatePortfolioLearningError, PortfolioLearningAssessmentRepository,
  PortfolioLearningAuthorization, PortfolioLearningDecisionOutcomeReader,
  PortfolioLearningPolicyProvider, PortfolioLearningPortfolioReader,
  PortfolioLearningRecommendationEffectivenessReader, PortfolioLearningRepositoryError,
} from "./contracts";

export type EvaluatePortfolioLearningQuery = Readonly<{
  ownerId: OutcomeOwnerId;
  portfolioId: string;
  assessmentId: PortfolioLearningAssessmentId;
  observationWindow: PortfolioLearningObservationWindow;
  policyVersion?: string;
  evaluatedAt: Date;
  expectedVersion: number | null;
  correlationId?: string;
}>;
type Dependencies = Readonly<{
  authorization: PortfolioLearningAuthorization;
  portfolios: PortfolioLearningPortfolioReader;
  decisionOutcomes: PortfolioLearningDecisionOutcomeReader;
  recommendationEffectiveness: PortfolioLearningRecommendationEffectivenessReader;
  policies: PortfolioLearningPolicyProvider;
  repository: PortfolioLearningAssessmentRepository;
}>;

export async function evaluatePortfolioLearningService(dependencies: Dependencies, query: EvaluatePortfolioLearningQuery): Promise<ResultType<PortfolioLearningAssessment, EvaluatePortfolioLearningError>> {
  if (!await dependencies.authorization.canEvaluate(query.ownerId, query.portfolioId)) return Result.fail({ code: "PORTFOLIO_LEARNING_NOT_AUTHORIZED" });
  const policy = dependencies.policies.get(query.policyVersion);
  if (!policy) return Result.fail({ code: "PORTFOLIO_LEARNING_POLICY_NOT_FOUND" });
  const portfolio = await dependencies.portfolios.readPortfolio(query.ownerId, query.portfolioId);
  if (portfolio.isFailure) return Result.fail({ code: "PORTFOLIO_LEARNING_OUTCOMES_UNAVAILABLE", retryable: portfolio.error.retryable });
  if (!portfolio.value) return Result.fail({ code: "PORTFOLIO_LEARNING_NOT_FOUND" });
  const decisions = await dependencies.decisionOutcomes.readEligible(query.ownerId, query.portfolioId, query.observationWindow, policy.limits.decisionAssessments);
  if (decisions.isFailure) return Result.fail({ code: "PORTFOLIO_LEARNING_OUTCOMES_UNAVAILABLE", retryable: decisions.error.retryable });
  const effectiveness = await dependencies.recommendationEffectiveness.readEligible(query.ownerId, query.portfolioId, query.observationWindow, policy.limits.effectivenessAssessments);
  const previous = await dependencies.repository.findLatest(query.ownerId, query.portfolioId);
  if (previous.isFailure) return Result.fail(mapRepository(previous.error));
  if ((previous.value?.version ?? null) !== query.expectedVersion) return Result.fail({ code: "PORTFOLIO_LEARNING_VERSION_CONFLICT", ...(previous.value ? { currentVersion: previous.value.version } : {}) });
  try {
    const value = evaluatePortfolioLearning({
      assessmentId: query.assessmentId, portfolio: portfolio.value, decisionOutcomes: decisions.value,
      recommendationEffectiveness: effectiveness.isSuccess ? effectiveness.value : Object.freeze([]),
      policy, evaluatedAt: query.evaluatedAt, observationWindow: query.observationWindow,
      ...(previous.value ? { previousAssessment: previous.value } : {}),
    });
    const degraded = effectiveness.isFailure ? Object.freeze({
      ...value,
      limitations: Object.freeze([...value.limitations, Object.freeze({
        code: "LEARNING_SOURCE_UNAVAILABLE" as const, impact: "material" as const, source: "evidence" as const, affectedAssessmentIds: Object.freeze([]),
      })]),
    }) : value;
    const saved = await dependencies.repository.save(degraded, query.expectedVersion);
    return saved.isFailure ? Result.fail(mapRepository(saved.error)) : Result.ok(degraded);
  } catch (error) {
    return Result.fail({ code: "PORTFOLIO_LEARNING_INPUT_INVALID", reason: error instanceof Error ? error.message : undefined });
  }
}
function mapRepository(error: PortfolioLearningRepositoryError): EvaluatePortfolioLearningError {
  if (error.code === "PORTFOLIO_LEARNING_VERSION_CONFLICT") return error;
  if (error.code === "PORTFOLIO_LEARNING_REPOSITORY_UNAVAILABLE") return error;
  return { code: "PORTFOLIO_LEARNING_UNEXPECTED" };
}
