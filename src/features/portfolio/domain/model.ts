import type { ConfidenceAssessment } from "@/platform/scoring";

import { PortfolioDomainError } from "./portfolio-error";
import {
  AssetWeight,
  CapitalAllocation,
  DiversificationScore,
  MarketExposure,
  Money,
  Percentage,
  PortfolioGoal,
  RiskWeight,
  type PortfolioDecisionId,
  type PortfolioId,
  type PortfolioObservationId,
  type PortfolioOpportunityId,
  type PortfolioPropertyId,
} from "./value-objects";

export type PortfolioPropertyStatus = "active" | "historical";
export type PortfolioOpportunityStatus =
  | "observed"
  | "analyzing"
  | "candidate"
  | "approved"
  | "acquiring"
  | "rejected"
  | "acquired"
  | "exited";
export type PortfolioHealthStatus = "healthy" | "attention" | "at-risk" | "critical";
export type PortfolioObservationType =
  | "market-concentration"
  | "revenue-concentration"
  | "geographic-concentration"
  | "capital-utilization"
  | "growth-opportunity";
export type PortfolioDecisionType =
  | "acquire-property"
  | "improve-property"
  | "sell-property"
  | "wait"
  | "refinance"
  | "diversify-market";

export type PropertyReference = Readonly<{ propertyId: string }>;
export type OpportunityReference = Readonly<{ opportunityId: string }>;
export type AnalysisReference = Readonly<{ analysisId: string }>;

export type PortfolioProperty = Readonly<{
  id: PortfolioPropertyId;
  property: PropertyReference;
  status: PortfolioPropertyStatus;
  weight: AssetWeight;
  contribution: Money;
  market: string;
  propertyType: string;
  annualRevenue: Money;
  risk: RiskWeight;
  addedAt: Date;
  removedAt?: Date;
}>;

export type PortfolioOpportunity = Readonly<{
  id: PortfolioOpportunityId;
  opportunity: OpportunityReference;
  status: PortfolioOpportunityStatus;
  addedAt: Date;
  removedAt?: Date;
}>;

export class CapitalPosition {
  private constructor(
    public readonly available: Money,
    public readonly committed: Money,
    public readonly reserved: Money,
    public readonly allocated: Money,
    public readonly futureRequirements: Money,
  ) {}
  public static create(input: {
    available: Money;
    committed: Money;
    reserved: Money;
    allocated: Money;
    futureRequirements: Money;
  }): CapitalPosition {
    if (Object.values(input).some((value) => value.isNegative())) {
      throw new PortfolioDomainError("INVALID_CAPITAL_POSITION", "Capital position amounts cannot be negative.");
    }
    return new CapitalPosition(
      input.available,
      input.committed,
      input.reserved,
      input.allocated,
      input.futureRequirements,
    );
  }
  public static empty(): CapitalPosition {
    return CapitalPosition.create({
      available: Money.zero(),
      committed: Money.zero(),
      reserved: Money.zero(),
      allocated: Money.zero(),
      futureRequirements: Money.zero(),
    });
  }
  public get utilization(): Percentage {
    const base = this.available.amount + this.committed.amount + this.reserved.amount + this.allocated.amount;
    return Percentage.create(base === 0 ? 0 : ((this.committed.amount + this.reserved.amount + this.allocated.amount) / base) * 100);
  }
}

export type PortfolioAllocation = Readonly<{
  capitalPriorities: readonly CapitalAllocation[];
  investmentPriorities: readonly string[];
  growthStrategy: string;
}>;

export type PortfolioExposure = Readonly<{
  entries: readonly MarketExposure[];
  diversification: DiversificationScore;
}>;

export class PortfolioHealth {
  private constructor(
    public readonly status: PortfolioHealthStatus,
    public readonly assessedAt: Date,
    public readonly rationale?: string,
  ) {}
  public static create(input: { status: PortfolioHealthStatus; assessedAt: Date; rationale?: string }): PortfolioHealth {
    if (Number.isNaN(input.assessedAt.getTime())) {
      throw new PortfolioDomainError("INVALID_PORTFOLIO_HEALTH", "Health assessment date is invalid.");
    }
    return new PortfolioHealth(input.status, new Date(input.assessedAt), input.rationale?.trim());
  }
}

export type PortfolioObservation = Readonly<{
  id: PortfolioObservationId;
  portfolioId: PortfolioId;
  type: PortfolioObservationType;
  summary: string;
  confidence?: ConfidenceAssessment;
  observedAt: Date;
  sourceReference?: string;
}>;

export type PortfolioDecision = Readonly<{
  id: PortfolioDecisionId;
  portfolioId: PortfolioId;
  type: PortfolioDecisionType;
  rationale: string;
  decidedAt: Date;
  property?: PropertyReference;
  opportunity?: OpportunityReference;
  analysis?: AnalysisReference;
  observationId?: PortfolioObservationId;
}>;

export type PortfolioComposition = Readonly<{
  properties: readonly PortfolioProperty[];
  opportunities: readonly PortfolioOpportunity[];
}>;

export type PortfolioStrategyPlan = Readonly<{
  strategy: import("./value-objects").PortfolioStrategy;
  goals: readonly PortfolioGoal[];
}>;

export function createPortfolioAllocation(input: {
  capitalPriorities?: readonly CapitalAllocation[];
  investmentPriorities?: readonly string[];
  growthStrategy?: string;
} = {}): PortfolioAllocation {
  const investmentPriorities = (input.investmentPriorities ?? []).map((value) => value.trim());
  const growthStrategy = (input.growthStrategy ?? "").trim();
  if (investmentPriorities.some((value) => !value)) {
    throw new PortfolioDomainError("INVALID_PORTFOLIO_ALLOCATION", "Investment priorities cannot be blank.");
  }
  return Object.freeze({
    capitalPriorities: Object.freeze([...(input.capitalPriorities ?? [])]),
    investmentPriorities: Object.freeze(investmentPriorities),
    growthStrategy,
  });
}

export function createPortfolioExposure(
  entries: readonly MarketExposure[] = [],
  diversification = DiversificationScore.create(0),
): PortfolioExposure {
  const keys = entries.map((entry) => `${entry.dimension}\0${entry.segment.toLocaleLowerCase("en-US")}`);
  if (new Set(keys).size !== keys.length) {
    throw new PortfolioDomainError("DUPLICATE_EXPOSURE", "Exposure segments must be unique within a dimension.");
  }
  for (const dimension of new Set(entries.map((entry) => entry.dimension))) {
    const total = entries.filter((entry) => entry.dimension === dimension).reduce((sum, entry) => sum + entry.weight.value, 0);
    if (total > 100 + Number.EPSILON) {
      throw new PortfolioDomainError("INVALID_EXPOSURE", `Exposure for ${dimension} cannot exceed 100%.`);
    }
  }
  return Object.freeze({ entries: Object.freeze([...entries]), diversification });
}
