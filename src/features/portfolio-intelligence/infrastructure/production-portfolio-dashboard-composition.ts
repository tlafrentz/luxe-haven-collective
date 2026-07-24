import type { PortfolioId } from "@/features/portfolio";
import type {
  CapitalAllocationAssessment,
  PortfolioHealthAssessment,
  PortfolioRecommendationAssessment,
  PortfolioRecommendationHistory,
} from "../domain";
import {
  createGetPortfolioIntelligenceDashboard,
  type PortfolioDashboardObserver,
  type PortfolioDashboardReader,
  type PortfolioDashboardSource,
  type PortfolioWorkspaceReader,
} from "../application";
import {
  ProductionPortfolioWorkspaceAuthorizer,
  type PortfolioWorkspacePrincipalReader,
} from "./production-portfolio-workspace-composition";

export interface PortfolioDashboardHealthHistoryReader {
  findPreviousCompatible(ownerId: string, portfolioId: PortfolioId, current: PortfolioHealthAssessment): Promise<PortfolioHealthAssessment | null>;
}
export interface PortfolioDashboardAllocationHistoryReader {
  findPreviousCompatible(ownerId: string, portfolioId: PortfolioId, current: CapitalAllocationAssessment): Promise<CapitalAllocationAssessment | null>;
}
export interface PortfolioDashboardRecommendationAssessmentReader {
  findLatest(ownerId: string, portfolioId: PortfolioId): Promise<PortfolioRecommendationAssessment | null>;
  findPreviousCompatible(ownerId: string, portfolioId: PortfolioId, current: PortfolioRecommendationAssessment): Promise<PortfolioRecommendationAssessment | null>;
}
export interface PortfolioDashboardRecommendationHistoryReader {
  findActive(ownerId: string, recommendationIds: readonly string[], limit: number): Promise<readonly PortfolioRecommendationHistory[]>;
}

export class ProductionPortfolioDashboardReader implements PortfolioDashboardReader {
  public constructor(
    private readonly workspace: PortfolioWorkspaceReader,
    private readonly healthHistory: PortfolioDashboardHealthHistoryReader,
    private readonly allocationHistory: PortfolioDashboardAllocationHistoryReader,
    private readonly recommendations: PortfolioDashboardRecommendationAssessmentReader,
    private readonly recommendationHistory: PortfolioDashboardRecommendationHistoryReader,
  ) {}

  public async read(ownerId: string, portfolioId: PortfolioId, referenceLimit: number): Promise<PortfolioDashboardSource | null> {
    const current = await this.workspace.read(ownerId, portfolioId);
    if (!current) return null;
    const [recommendationResult, previousHealthResult, previousAllocationResult] = await Promise.allSettled([
      this.recommendations.findLatest(ownerId, portfolioId),
      current.health ? this.healthHistory.findPreviousCompatible(ownerId, portfolioId, current.health) : Promise.resolve(null),
      current.allocation ? this.allocationHistory.findPreviousCompatible(ownerId, portfolioId, current.allocation) : Promise.resolve(null),
    ]);
    const recommendations = recommendationResult.status === "fulfilled" ? recommendationResult.value : null;
    const [previousRecommendationsResult, historiesResult] = await Promise.allSettled([
      recommendations ? this.recommendations.findPreviousCompatible(ownerId, portfolioId, recommendations) : Promise.resolve(null),
      recommendations ? this.recommendationHistory.findActive(ownerId, recommendations.recommendations.map((item) => item.id.value).slice(0, referenceLimit), referenceLimit) : Promise.resolve([]),
    ]);
    return Object.freeze({
      current,
      recommendations,
      recommendationHistories: Object.freeze(historiesResult.status === "fulfilled" ? [...historiesResult.value] : []),
      previousHealth: previousHealthResult.status === "fulfilled" ? previousHealthResult.value : null,
      previousAllocation: previousAllocationResult.status === "fulfilled" ? previousAllocationResult.value : null,
      previousRecommendations: previousRecommendationsResult.status === "fulfilled" ? previousRecommendationsResult.value : null,
    });
  }
}

export function composePortfolioDashboardProduction(dependencies: Readonly<{
  workspace: PortfolioWorkspaceReader;
  principals: PortfolioWorkspacePrincipalReader;
  healthHistory: PortfolioDashboardHealthHistoryReader;
  allocationHistory: PortfolioDashboardAllocationHistoryReader;
  recommendations: PortfolioDashboardRecommendationAssessmentReader;
  recommendationHistory: PortfolioDashboardRecommendationHistoryReader;
  observer?: PortfolioDashboardObserver;
}>) {
  return Object.freeze({
    getPortfolioIntelligenceDashboard: createGetPortfolioIntelligenceDashboard({
      authorizer: new ProductionPortfolioWorkspaceAuthorizer(dependencies.principals),
      reader: new ProductionPortfolioDashboardReader(
        dependencies.workspace,
        dependencies.healthHistory,
        dependencies.allocationHistory,
        dependencies.recommendations,
        dependencies.recommendationHistory,
      ),
      ...(dependencies.observer ? { observer: dependencies.observer } : {}),
    }),
  });
}
