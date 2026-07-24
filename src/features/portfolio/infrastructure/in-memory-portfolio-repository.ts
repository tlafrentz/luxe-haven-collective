import { Portfolio, PortfolioDomainError, type PortfolioId, type PortfolioOwnerId, type PortfolioState } from "../domain";
import type { PortfolioRepository } from "../application";

export class InMemoryPortfolioRepository implements PortfolioRepository {
  private readonly records = new Map<string, PortfolioState>();

  public async findById(id: PortfolioId, ownerId: PortfolioOwnerId): Promise<Portfolio | null> {
    const state = this.records.get(id.value);
    if (!state || !state.ownerId.equals(ownerId)) return null;
    return Portfolio.restore(state);
  }

  public async save(portfolio: Portfolio, expectedVersion?: number): Promise<void> {
    const current = this.records.get(portfolio.id.value);
    if (!current && expectedVersion !== undefined) {
      throw new PortfolioDomainError("PORTFOLIO_VERSION_CONFLICT", "A new portfolio cannot have an expected version.");
    }
    if (current && expectedVersion !== current.version) {
      throw new PortfolioDomainError("PORTFOLIO_VERSION_CONFLICT", "The portfolio was modified concurrently.");
    }
    this.records.set(portfolio.id.value, portfolio.props);
  }
}
