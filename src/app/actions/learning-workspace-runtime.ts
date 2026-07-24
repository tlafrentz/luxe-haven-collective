import "server-only";
import { createGetLearningDashboard, createProductionLearningWorkspaceComposition, type LearningObservationWindow, type LearningWorkspaceOutcomeReader, type LearningWorkspacePortfolioLearningReader, type LearningWorkspacePortfolioReader, type LearningWorkspaceRecommendationReader } from "@/features/learning-intelligence";
import { getSessionProfile } from "@/lib/auth/session";

const unavailablePortfolio: LearningWorkspacePortfolioReader = Object.freeze({
  async read() {
    throw new Error("Portfolio learning workspace storage adapters are not configured.");
  },
});
const unavailableOutcomes: LearningWorkspaceOutcomeReader = Object.freeze({
  async read() { throw new Error("Outcome assessment storage adapters are not configured."); },
});
const unavailableRecommendations: LearningWorkspaceRecommendationReader = Object.freeze({
  async read() { throw new Error("Recommendation effectiveness storage adapters are not configured."); },
});
const unavailableLearnings: LearningWorkspacePortfolioLearningReader = Object.freeze({
  async read() { throw new Error("Portfolio learning storage adapters are not configured."); },
});

export async function getContinuousImprovementWorkspaceRouteState(input: Readonly<{
  portfolioId: string;
  observationWindow: LearningObservationWindow;
}>) {
  const { user } = await getSessionProfile();
  if (!user) return { ok: false as const, code: "LEARNING_WORKSPACE_NOT_AUTHENTICATED" as const };
  const execute = createProductionLearningWorkspaceComposition({
    authenticatedOwnerId: user.id,
    readers: Object.freeze({ portfolios: unavailablePortfolio, outcomes: unavailableOutcomes, recommendations: unavailableRecommendations, learnings: unavailableLearnings }),
  });
  const result = await execute(Object.freeze({ ownerId: user.id, portfolioId: input.portfolioId, observationWindow: input.observationWindow }));
  return result.isSuccess ? { ok: true as const, state: result.value } : { ok: false as const, code: result.error.code };
}

export async function getLearningDashboardRouteState(input: Readonly<{
  portfolioId: string;
  observationWindow: LearningObservationWindow;
}>) {
  const { user } = await getSessionProfile();
  if (!user) return { ok: false as const, code: "LEARNING_DASHBOARD_NOT_AUTHENTICATED" as const };
  const getWorkspace = createProductionLearningWorkspaceComposition({
    authenticatedOwnerId: user.id,
    readers: Object.freeze({ portfolios: unavailablePortfolio, outcomes: unavailableOutcomes, recommendations: unavailableRecommendations, learnings: unavailableLearnings }),
  });
  const result = await createGetLearningDashboard(getWorkspace)(Object.freeze({ ownerId: user.id, portfolioId: input.portfolioId, observationWindow: input.observationWindow }));
  return result.isSuccess ? { ok: true as const, state: result.value } : { ok: false as const, code: result.error.code };
}
