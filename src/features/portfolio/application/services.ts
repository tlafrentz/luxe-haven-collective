import {
  Portfolio,
  createPortfolioOwnerId,
  type PortfolioId,
  type PortfolioStrategyPlan,
} from "../domain";
import type { PortfolioRepository } from "./contracts";

export class PortfolioApplicationError extends Error {
  public constructor(public readonly code: "PORTFOLIO_NOT_FOUND" | "PORTFOLIO_ACCESS_DENIED" | "CONCURRENT_PORTFOLIO_MODIFICATION", message: string) {
    super(message);
    this.name = "PortfolioApplicationError";
  }
}

export async function createPortfolio(repository: PortfolioRepository, input: {
  authenticatedOwnerId: string;
  ownerId?: string;
  name: string;
  strategy: PortfolioStrategyPlan;
  occurredAt?: Date;
}): Promise<Portfolio> {
  if (input.ownerId && input.ownerId !== input.authenticatedOwnerId) {
    throw new PortfolioApplicationError("PORTFOLIO_ACCESS_DENIED", "Authenticated ownership cannot be overridden.");
  }
  const portfolio = Portfolio.create({
    ownerId: createPortfolioOwnerId(input.authenticatedOwnerId),
    name: input.name,
    strategy: input.strategy,
    occurredAt: input.occurredAt ?? new Date(),
  });
  await repository.save(portfolio);
  return portfolio;
}

export async function loadPortfolio(repository: PortfolioRepository, id: PortfolioId, authenticatedOwnerId: string): Promise<Portfolio | null> {
  return repository.findById(id, createPortfolioOwnerId(authenticatedOwnerId));
}

export async function savePortfolio(repository: PortfolioRepository, input: {
  portfolio: Portfolio;
  authenticatedOwnerId: string;
  expectedVersion: number;
}): Promise<void> {
  if (input.portfolio.ownerId.value !== input.authenticatedOwnerId) {
    throw new PortfolioApplicationError("PORTFOLIO_ACCESS_DENIED", "Portfolio ownership does not match the authenticated owner.");
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new PortfolioApplicationError("CONCURRENT_PORTFOLIO_MODIFICATION", "A valid expected portfolio version is required.");
  }
  await repository.save(input.portfolio, input.expectedVersion);
}

export async function requirePortfolio(repository: PortfolioRepository, id: PortfolioId, authenticatedOwnerId: string): Promise<Portfolio> {
  const portfolio = await loadPortfolio(repository, id, authenticatedOwnerId);
  if (!portfolio) throw new PortfolioApplicationError("PORTFOLIO_NOT_FOUND", "Portfolio was not found.");
  return portfolio;
}
