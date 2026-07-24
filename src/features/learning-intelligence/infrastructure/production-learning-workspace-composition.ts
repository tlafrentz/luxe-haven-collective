import { createGetContinuousImprovementWorkspace, type ContinuousImprovementWorkspaceDependencies, type LearningWorkspaceOutcomeReader, type LearningWorkspacePortfolioLearningReader, type LearningWorkspacePortfolioReader, type LearningWorkspaceRecommendationReader } from "../application";

export type ProductionLearningWorkspaceReaders = Readonly<{
  portfolios: LearningWorkspacePortfolioReader;
  outcomes: LearningWorkspaceOutcomeReader;
  recommendations: LearningWorkspaceRecommendationReader;
  learnings: LearningWorkspacePortfolioLearningReader;
}>;

export function createProductionLearningWorkspaceComposition(input: Readonly<{
  authenticatedOwnerId: string;
  readers: ProductionLearningWorkspaceReaders;
}>) {
  const dependencies: ContinuousImprovementWorkspaceDependencies = Object.freeze({
    authorization: Object.freeze({
      async canRead(ownerId: string) {
        return ownerId === input.authenticatedOwnerId ? "authorized" as const : "concealed" as const;
      },
    }),
    ...input.readers,
  });
  return createGetContinuousImprovementWorkspace(dependencies);
}
