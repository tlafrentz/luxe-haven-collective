import type {
  CapitalPosition,
  Portfolio,
  PortfolioAllocation,
  PortfolioDecision,
  PortfolioExposure as PortfolioExposureModel,
  PortfolioHealth as PortfolioHealthModel,
  PortfolioId,
  PortfolioObservation,
  PortfolioOpportunity,
  PortfolioOwnerId,
  PortfolioProperty,
  PortfolioStrategyPlan,
} from "../domain";

export interface PortfolioRepository {
  findById(id: PortfolioId, ownerId: PortfolioOwnerId): Promise<Portfolio | null>;
  save(portfolio: Portfolio, expectedVersion?: number): Promise<void>;
}

export type PortfolioSummary = Readonly<{
  id: string;
  name: string;
  strategy: PortfolioStrategyPlan;
  activePropertyCount: number;
  activeOpportunityCount: number;
  health: PortfolioHealthModel["status"];
  version: number;
}>;

export type PortfolioMembership = Readonly<{
  portfolioId: string;
  properties: readonly PortfolioProperty[];
  opportunities: readonly PortfolioOpportunity[];
}>;

export type PortfolioCapital = Readonly<{
  portfolioId: string;
  position: CapitalPosition;
  allocation: PortfolioAllocation;
}>;

export type PortfolioExposure = Readonly<{
  portfolioId: string;
  exposure: PortfolioExposureModel;
}>;

export type PortfolioHealth = Readonly<{
  portfolioId: string;
  health: PortfolioHealthModel;
  observations: readonly PortfolioObservation[];
  decisions: readonly PortfolioDecision[];
}>;

export interface PortfolioProjectionReader {
  getSummary(id: PortfolioId, ownerId: PortfolioOwnerId): Promise<PortfolioSummary | null>;
  getMembership(id: PortfolioId, ownerId: PortfolioOwnerId): Promise<PortfolioMembership | null>;
  getCapital(id: PortfolioId, ownerId: PortfolioOwnerId): Promise<PortfolioCapital | null>;
  getExposure(id: PortfolioId, ownerId: PortfolioOwnerId): Promise<PortfolioExposure | null>;
  getHealth(id: PortfolioId, ownerId: PortfolioOwnerId): Promise<PortfolioHealth | null>;
}
