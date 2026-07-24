import { Identifier, Money, Percentage } from "@/platform/kernel";
import { Score } from "@/platform/scoring";

import { PortfolioDomainError } from "./portfolio-error";

export type PortfolioId = Identifier<`portfolio-${string}`>;
export type PortfolioOwnerId = Identifier<string>;
export type PortfolioPropertyId = Identifier<`portfolio-property-${string}`>;
export type PortfolioOpportunityId = Identifier<`portfolio-opportunity-${string}`>;
export type PortfolioObservationId = Identifier<`portfolio-observation-${string}`>;
export type PortfolioDecisionId = Identifier<`portfolio-decision-${string}`>;

function id<T extends string>(value: string | undefined, prefix: string): Identifier<T> {
  const candidate = value ?? `${prefix}-${crypto.randomUUID()}`;
  if (!candidate.startsWith(`${prefix}-`)) {
    throw new PortfolioDomainError("INVALID_PORTFOLIO_ID", `Identifier must begin with ${prefix}-.`);
  }
  return Identifier.create(candidate as T);
}

export const createPortfolioId = (value?: string): PortfolioId => id(value, "portfolio");
export const createPortfolioOwnerId = (value: string): PortfolioOwnerId => Identifier.create(value);
export const createPortfolioPropertyId = (value?: string): PortfolioPropertyId => id(value, "portfolio-property");
export const createPortfolioOpportunityId = (value?: string): PortfolioOpportunityId => id(value, "portfolio-opportunity");
export const createPortfolioObservationId = (value?: string): PortfolioObservationId => id(value, "portfolio-observation");
export const createPortfolioDecisionId = (value?: string): PortfolioDecisionId => id(value, "portfolio-decision");

export class PortfolioName {
  private constructor(public readonly value: string) {}
  public static create(value: string): PortfolioName {
    const clean = value.trim();
    if (!clean || clean.length > 120) {
      throw new PortfolioDomainError("INVALID_PORTFOLIO_NAME", "Portfolio name must contain 1–120 characters.");
    }
    return new PortfolioName(clean);
  }
}

export type PortfolioStrategyKind = "income" | "growth" | "balanced" | "capital-preservation" | "custom";
export class PortfolioStrategy {
  private constructor(public readonly kind: PortfolioStrategyKind, public readonly description?: string) {}
  public static create(kind: PortfolioStrategyKind, description?: string): PortfolioStrategy {
    const clean = description?.trim();
    if (kind === "custom" && !clean) {
      throw new PortfolioDomainError("INVALID_PORTFOLIO_STRATEGY", "A custom strategy requires a description.");
    }
    if (clean && clean.length > 500) {
      throw new PortfolioDomainError("INVALID_PORTFOLIO_STRATEGY", "Strategy descriptions may not exceed 500 characters.");
    }
    return new PortfolioStrategy(kind, clean);
  }
}

export type PortfolioGoalKind = "cash-flow" | "appreciation" | "diversification" | "scale" | "risk-reduction" | "custom";
export class PortfolioGoal {
  private constructor(public readonly kind: PortfolioGoalKind, public readonly description: string) {}
  public static create(kind: PortfolioGoalKind, description: string): PortfolioGoal {
    const clean = description.trim();
    if (!clean || clean.length > 300) {
      throw new PortfolioDomainError("INVALID_PORTFOLIO_GOAL", "Portfolio goals must contain 1–300 characters.");
    }
    return new PortfolioGoal(kind, clean);
  }
}

export class CapitalAllocation {
  private constructor(public readonly priority: string, public readonly amount: Money, public readonly rationale?: string) {}
  public static create(input: { priority: string; amount: Money; rationale?: string }): CapitalAllocation {
    const priority = input.priority.trim();
    const rationale = input.rationale?.trim();
    if (!priority || input.amount.isNegative()) {
      throw new PortfolioDomainError("INVALID_CAPITAL_ALLOCATION", "Capital allocation requires a priority and non-negative amount.");
    }
    return new CapitalAllocation(priority, input.amount, rationale);
  }
}

export class DiversificationScore {
  private constructor(public readonly score: Score) {}
  public static create(value: number): DiversificationScore {
    return new DiversificationScore(Score.create(value));
  }
  public get value(): number {
    return this.score.value;
  }
}

export type ExposureDimension = "market" | "property-type" | "operator" | "geographic" | "revenue" | "concentration";
export class MarketExposure {
  private constructor(
    public readonly dimension: ExposureDimension,
    public readonly segment: string,
    public readonly weight: Percentage,
  ) {}
  public static create(input: { dimension: ExposureDimension; segment: string; weight: Percentage }): MarketExposure {
    const segment = input.segment.trim();
    if (!segment) throw new PortfolioDomainError("INVALID_EXPOSURE", "Exposure segment is required.");
    return new MarketExposure(input.dimension, segment, input.weight);
  }
}

export class AssetWeight {
  private constructor(public readonly value: Percentage) {}
  public static create(value: number): AssetWeight {
    return new AssetWeight(Percentage.create(value));
  }
}

export class RiskWeight {
  private constructor(public readonly value: Percentage) {}
  public static create(value: number): RiskWeight {
    return new RiskWeight(Percentage.create(value));
  }
}

export { Money, Percentage, Score };
