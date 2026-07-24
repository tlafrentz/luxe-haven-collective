import { Result } from "@/platform/kernel";
import { buildPortfolioWorkspace } from "./build-portfolio-workspace";
import type {
  GetPortfolioIntelligenceWorkspaceError,
  GetPortfolioIntelligenceWorkspaceQuery,
  PortfolioIntelligenceWorkspaceState,
  PortfolioWorkspaceAuthorizer,
  PortfolioWorkspaceObserver,
  PortfolioWorkspaceReader,
} from "./contracts";

export function createGetPortfolioIntelligenceWorkspace(dependencies: Readonly<{
  authorizer: PortfolioWorkspaceAuthorizer;
  reader: PortfolioWorkspaceReader;
  observer?: PortfolioWorkspaceObserver;
}>) {
  return async (query: GetPortfolioIntelligenceWorkspaceQuery) => {
    if (!valid(query)) {
      return Result.fail<GetPortfolioIntelligenceWorkspaceError>({ code: "PORTFOLIO_WORKSPACE_INPUT_INVALID", field: "query" });
    }
    const authorization = await dependencies.authorizer.authorize(query.ownerId, query.portfolioId);
    if (authorization === "unauthenticated") return Result.fail<GetPortfolioIntelligenceWorkspaceError>({ code: "PORTFOLIO_WORKSPACE_NOT_AUTHENTICATED" });
    if (authorization === "concealed") return Result.fail<GetPortfolioIntelligenceWorkspaceError>({ code: "PORTFOLIO_WORKSPACE_NOT_FOUND" });
    try {
      const source = await dependencies.reader.read(query.ownerId, query.portfolioId);
      if (!source) return Result.fail<GetPortfolioIntelligenceWorkspaceError>({ code: "PORTFOLIO_WORKSPACE_NOT_FOUND" });
      const state: PortfolioIntelligenceWorkspaceState = buildPortfolioWorkspace(source, query);
      const limitationCount = state.status === "ready" ? state.workspace.limitations.length
        : state.status === "formation-stage" ? state.formation.limitations.length
          : "limitations" in state ? state.limitations.length : state.gaps.length;
      dependencies.observer?.record("portfolio_workspace_opened", { status: state.status, limitationCount });
      return Result.ok(state);
    } catch {
      return Result.fail<GetPortfolioIntelligenceWorkspaceError>({ code: "PORTFOLIO_WORKSPACE_PORTFOLIO_UNAVAILABLE", retryable: true });
    }
  };
}

function valid(query: GetPortfolioIntelligenceWorkspaceQuery): boolean {
  return Boolean(query.ownerId.trim()) &&
    !Number.isNaN(query.evaluatedAt.getTime()) &&
    !Number.isNaN(query.observationWindow.start.getTime()) &&
    !Number.isNaN(query.observationWindow.end.getTime()) &&
    query.observationWindow.start <= query.observationWindow.end;
}
