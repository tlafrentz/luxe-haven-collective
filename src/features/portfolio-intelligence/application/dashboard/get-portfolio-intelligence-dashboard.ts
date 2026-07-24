import { Result } from "@/platform/kernel";
import { buildPortfolioIntelligenceDashboard } from "./build-portfolio-intelligence-dashboard";
import {
  PORTFOLIO_DASHBOARD_LIMITS,
  type GetPortfolioIntelligenceDashboardError,
  type GetPortfolioIntelligenceDashboardQuery,
  type PortfolioDashboardAuthorizer,
  type PortfolioDashboardObserver,
  type PortfolioDashboardReader,
} from "./contracts";

export function createGetPortfolioIntelligenceDashboard(dependencies: Readonly<{
  authorizer: PortfolioDashboardAuthorizer;
  reader: PortfolioDashboardReader;
  observer?: PortfolioDashboardObserver;
}>) {
  return async (query: GetPortfolioIntelligenceDashboardQuery) => {
    if (!valid(query)) return Result.fail<GetPortfolioIntelligenceDashboardError>({ code: "PORTFOLIO_DASHBOARD_INPUT_INVALID", field: "query" });
    const authorization = await dependencies.authorizer.authorize(query.ownerId, query.portfolioId);
    if (authorization === "unauthenticated") return Result.fail<GetPortfolioIntelligenceDashboardError>({ code: "PORTFOLIO_DASHBOARD_NOT_AUTHENTICATED" });
    if (authorization === "concealed") return Result.fail<GetPortfolioIntelligenceDashboardError>({ code: "PORTFOLIO_DASHBOARD_NOT_FOUND" });
    try {
      const source = await dependencies.reader.read(query.ownerId, query.portfolioId, PORTFOLIO_DASHBOARD_LIMITS.subjectReferences);
      if (!source) return Result.fail<GetPortfolioIntelligenceDashboardError>({ code: "PORTFOLIO_DASHBOARD_NOT_FOUND" });
      const state = buildPortfolioIntelligenceDashboard(source, query);
      const unavailableSectionCount = state.status === "degraded" ? state.unavailableSections.length : state.status === "insufficient-data" ? state.gaps.length : 0;
      dependencies.observer?.record("portfolio_dashboard_opened", { status: state.status, unavailableSectionCount });
      return Result.ok(state);
    } catch {
      return Result.fail<GetPortfolioIntelligenceDashboardError>({ code: "PORTFOLIO_DASHBOARD_PORTFOLIO_UNAVAILABLE", retryable: true });
    }
  };
}

function valid(query: GetPortfolioIntelligenceDashboardQuery) {
  return Boolean(query.ownerId.trim()) &&
    !Number.isNaN(query.evaluatedAt.getTime()) &&
    !Number.isNaN(query.observationWindow.start.getTime()) &&
    !Number.isNaN(query.observationWindow.end.getTime()) &&
    query.observationWindow.start <= query.observationWindow.end;
}
