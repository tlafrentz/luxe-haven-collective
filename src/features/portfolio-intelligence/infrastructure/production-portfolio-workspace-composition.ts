import type { PortfolioRepository } from "@/features/portfolio";
import { createPortfolioOwnerId, type PortfolioId } from "@/features/portfolio";
import type { CapitalAllocationAssessment } from "../domain/allocation";
import type { PortfolioHealthAssessment } from "../domain/health";
import {
  createGetPortfolioIntelligenceWorkspace,
  type PortfolioWorkspaceAuthorizer,
  type PortfolioWorkspaceObserver,
  type PortfolioWorkspaceReader,
  type PortfolioWorkspaceSource,
} from "../application";

export interface PortfolioHealthAssessmentReader {
  findLatest(ownerId: string, portfolioId: PortfolioId): Promise<PortfolioHealthAssessment | null>;
}
export interface CapitalAllocationAssessmentReader {
  findLatest(ownerId: string, portfolioId: PortfolioId): Promise<CapitalAllocationAssessment | null>;
}
export interface PortfolioWorkspacePrincipalReader {
  read(): Promise<Readonly<{ authenticated: boolean; ownerId?: string }>>;
}

export class ProductionPortfolioWorkspaceAuthorizer implements PortfolioWorkspaceAuthorizer {
  public constructor(private readonly principals: PortfolioWorkspacePrincipalReader) {}
  public async authorize(ownerId: string): Promise<"authorized" | "unauthenticated" | "concealed"> {
    const principal = await this.principals.read();
    if (!principal.authenticated) return "unauthenticated";
    return principal.ownerId === ownerId ? "authorized" : "concealed";
  }
}

export class ProductionPortfolioWorkspaceReader implements PortfolioWorkspaceReader {
  public constructor(
    private readonly portfolios: PortfolioRepository,
    private readonly health: PortfolioHealthAssessmentReader,
    private readonly allocation: CapitalAllocationAssessmentReader,
  ) {}

  public async read(ownerId: string, portfolioId: PortfolioId): Promise<PortfolioWorkspaceSource | null> {
    const portfolio = await this.portfolios.findById(portfolioId, createPortfolioOwnerId(ownerId));
    if (!portfolio) return null;
    const state = portfolio.props;
    const [health, allocation] = await Promise.all([
      this.health.findLatest(ownerId, portfolioId).catch(() => null),
      this.allocation.findLatest(ownerId, portfolioId).catch(() => null),
    ]);
    return Object.freeze({
      portfolioId,
      version: state.version,
      name: state.name.value,
      strategySummary: state.strategy.strategy.description ?? state.strategy.strategy.kind,
      reportingCurrency: "USD",
      updatedAt: new Date(state.updatedAt),
      properties: Object.freeze(state.composition.properties.map((membership) => Object.freeze({
        propertyId: membership.property.propertyId,
        name: membership.property.propertyId,
        market: membership.market,
        propertyType: membership.propertyType,
        active: membership.status === "active" && !membership.removedAt,
      }))),
      opportunities: Object.freeze(state.composition.opportunities.map((membership) => Object.freeze({
        opportunityId: membership.opportunity.opportunityId,
        name: membership.opportunity.opportunityId,
        planningStatus: membership.status,
        active: !["rejected", "acquired", "exited"].includes(membership.status) && !membership.removedAt,
      }))),
      health,
      allocation,
    });
  }
}

export function composePortfolioWorkspaceProduction(dependencies: Readonly<{
  portfolios: PortfolioRepository;
  health: PortfolioHealthAssessmentReader;
  allocation: CapitalAllocationAssessmentReader;
  principals: PortfolioWorkspacePrincipalReader;
  observer?: PortfolioWorkspaceObserver;
}>) {
  return Object.freeze({
    getPortfolioIntelligenceWorkspace: createGetPortfolioIntelligenceWorkspace({
      authorizer: new ProductionPortfolioWorkspaceAuthorizer(dependencies.principals),
      reader: new ProductionPortfolioWorkspaceReader(dependencies.portfolios, dependencies.health, dependencies.allocation),
      ...(dependencies.observer ? { observer: dependencies.observer } : {}),
    }),
  });
}
