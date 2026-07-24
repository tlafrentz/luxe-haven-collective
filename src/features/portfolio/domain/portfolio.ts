import type { PortfolioEvent } from "./events";
import {
  CapitalPosition,
  PortfolioHealth,
  createPortfolioAllocation,
  createPortfolioExposure,
  type PortfolioAllocation,
  type PortfolioComposition,
  type PortfolioDecision,
  type PortfolioExposure,
  type PortfolioObservation,
  type PortfolioOpportunity,
  type PortfolioOpportunityStatus,
  type PortfolioProperty,
  type PortfolioStrategyPlan,
} from "./model";
import { PortfolioDomainError } from "./portfolio-error";
import {
  AssetWeight,
  PortfolioName,
  RiskWeight,
  createPortfolioDecisionId,
  createPortfolioId,
  createPortfolioObservationId,
  createPortfolioOpportunityId,
  createPortfolioPropertyId,
  type Money,
  type PortfolioId,
  type PortfolioOwnerId,
} from "./value-objects";

export type PortfolioState = Readonly<{
  id: PortfolioId;
  ownerId: PortfolioOwnerId;
  name: PortfolioName;
  strategy: PortfolioStrategyPlan;
  composition: PortfolioComposition;
  capital: CapitalPosition;
  exposure: PortfolioExposure;
  allocation: PortfolioAllocation;
  health: PortfolioHealth;
  observations: readonly PortfolioObservation[];
  decisions: readonly PortfolioDecision[];
  events: readonly PortfolioEvent[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}>;

const OPPORTUNITY_TRANSITIONS: Readonly<Record<PortfolioOpportunityStatus, readonly PortfolioOpportunityStatus[]>> = {
  observed: ["analyzing", "rejected", "exited"],
  analyzing: ["candidate", "rejected", "exited"],
  candidate: ["approved", "analyzing", "rejected", "exited"],
  approved: ["acquiring", "candidate", "rejected", "exited"],
  acquiring: ["acquired", "approved", "rejected", "exited"],
  rejected: ["observed", "exited"],
  acquired: ["exited"],
  exited: [],
};

type PortfolioEventInput = PortfolioEvent extends infer T
  ? T extends PortfolioEvent
    ? Omit<T, "portfolioId" | "occurredAt" | "aggregateVersion">
    : never
  : never;

export class Portfolio {
  private constructor(private state: PortfolioState) {}

  public static create(input: {
    id?: PortfolioId;
    ownerId: PortfolioOwnerId;
    name: string;
    strategy: PortfolioStrategyPlan;
    occurredAt: Date;
  }): Portfolio {
    assertDate(input.occurredAt);
    const id = input.id ?? createPortfolioId();
    const health = PortfolioHealth.create({ status: "healthy", assessedAt: input.occurredAt });
    const event: PortfolioEvent = { type: "portfolio-created", portfolioId: id, occurredAt: new Date(input.occurredAt), aggregateVersion: 1 };
    return new Portfolio({
      id,
      ownerId: input.ownerId,
      name: PortfolioName.create(input.name),
      strategy: Object.freeze({ strategy: input.strategy.strategy, goals: Object.freeze([...input.strategy.goals]) }),
      composition: Object.freeze({ properties: Object.freeze([]), opportunities: Object.freeze([]) }),
      capital: CapitalPosition.empty(),
      exposure: createPortfolioExposure(),
      allocation: createPortfolioAllocation(),
      health,
      observations: Object.freeze([]),
      decisions: Object.freeze([]),
      events: Object.freeze([event]),
      createdAt: new Date(input.occurredAt),
      updatedAt: new Date(input.occurredAt),
      version: 1,
    });
  }

  public static restore(state: PortfolioState): Portfolio {
    return new Portfolio(cloneState(state));
  }

  public get props(): PortfolioState {
    return cloneState(this.state);
  }
  public get id(): PortfolioId {
    return this.state.id;
  }
  public get ownerId(): PortfolioOwnerId {
    return this.state.ownerId;
  }
  public get version(): number {
    return this.state.version;
  }

  public addProperty(input: {
    propertyId: string;
    status?: PortfolioProperty["status"];
    weight: AssetWeight;
    contribution: Money;
    market: string;
    propertyType: string;
    annualRevenue: Money;
    risk: RiskWeight;
    occurredAt: Date;
  }): void {
    this.assertUniqueActive("property", input.propertyId);
    const market = requiredText(input.market, "Property market");
    const propertyType = requiredText(input.propertyType, "Property type");
    const membership: PortfolioProperty = Object.freeze({
      id: createPortfolioPropertyId(),
      property: Object.freeze({ propertyId: requiredText(input.propertyId, "Property reference") }),
      status: input.status ?? "active",
      weight: input.weight,
      contribution: input.contribution,
      market,
      propertyType,
      annualRevenue: input.annualRevenue,
      risk: input.risk,
      addedAt: new Date(input.occurredAt),
    });
    this.mutate(
      { type: "property-added", propertyId: input.propertyId },
      input.occurredAt,
      { composition: Object.freeze({ ...this.state.composition, properties: Object.freeze([...this.state.composition.properties, membership]) }) },
    );
  }

  public removeProperty(propertyId: string, occurredAt: Date): void {
    const index = this.state.composition.properties.findIndex((item) => item.property.propertyId === propertyId && !item.removedAt);
    if (index < 0) throw new PortfolioDomainError("PROPERTY_MEMBERSHIP_NOT_FOUND", "Active property membership was not found.");
    const properties = this.state.composition.properties.map((item, position) =>
      position === index ? Object.freeze({ ...item, status: "historical" as const, removedAt: new Date(occurredAt) }) : item,
    );
    this.mutate({ type: "property-removed", propertyId }, occurredAt, {
      composition: Object.freeze({ ...this.state.composition, properties: Object.freeze(properties) }),
    });
  }

  public addOpportunity(opportunityId: string, status: PortfolioOpportunityStatus, occurredAt: Date): void {
    this.assertUniqueActive("opportunity", opportunityId);
    const membership: PortfolioOpportunity = Object.freeze({
      id: createPortfolioOpportunityId(),
      opportunity: Object.freeze({ opportunityId: requiredText(opportunityId, "Opportunity reference") }),
      status,
      addedAt: new Date(occurredAt),
    });
    this.mutate({ type: "opportunity-added", opportunityId }, occurredAt, {
      composition: Object.freeze({ ...this.state.composition, opportunities: Object.freeze([...this.state.composition.opportunities, membership]) }),
    });
  }

  public transitionOpportunity(opportunityId: string, status: PortfolioOpportunityStatus, occurredAt: Date): void {
    const current = this.state.composition.opportunities.find((item) => item.opportunity.opportunityId === opportunityId && !item.removedAt);
    if (!current) throw new PortfolioDomainError("OPPORTUNITY_MEMBERSHIP_NOT_FOUND", "Active opportunity membership was not found.");
    if (!OPPORTUNITY_TRANSITIONS[current.status].includes(status)) {
      throw new PortfolioDomainError("INVALID_OPPORTUNITY_MEMBERSHIP_TRANSITION", `Cannot move portfolio opportunity from ${current.status} to ${status}.`);
    }
    const opportunities = this.state.composition.opportunities.map((item) => item.id.equals(current.id) ? Object.freeze({ ...item, status }) : item);
    this.bump(occurredAt, { composition: Object.freeze({ ...this.state.composition, opportunities: Object.freeze(opportunities) }) });
  }

  public removeOpportunity(opportunityId: string, occurredAt: Date): void {
    const current = this.state.composition.opportunities.find((item) => item.opportunity.opportunityId === opportunityId && !item.removedAt);
    if (!current) throw new PortfolioDomainError("OPPORTUNITY_MEMBERSHIP_NOT_FOUND", "Active opportunity membership was not found.");
    const opportunities = this.state.composition.opportunities.map((item) =>
      item.id.equals(current.id) ? Object.freeze({ ...item, status: "exited" as const, removedAt: new Date(occurredAt) }) : item,
    );
    this.mutate({ type: "opportunity-removed", opportunityId }, occurredAt, {
      composition: Object.freeze({ ...this.state.composition, opportunities: Object.freeze(opportunities) }),
    });
  }

  public updateCapital(capital: CapitalPosition, occurredAt: Date): void {
    this.mutate({ type: "capital-updated" }, occurredAt, { capital });
  }
  public updateExposure(exposure: PortfolioExposure, occurredAt: Date): void {
    this.bump(occurredAt, { exposure });
  }
  public changeAllocation(allocation: PortfolioAllocation, occurredAt: Date): void {
    this.mutate({ type: "allocation-changed" }, occurredAt, { allocation });
  }
  public changeHealth(health: PortfolioHealth, occurredAt: Date): void {
    if (health.status === this.state.health.status) return;
    this.mutate({ type: "health-changed", previous: this.state.health.status, current: health.status }, occurredAt, { health });
  }

  public publishObservation(input: Omit<PortfolioObservation, "id" | "portfolioId">, occurredAt: Date): PortfolioObservation {
    const observation: PortfolioObservation = Object.freeze({
      ...input,
      id: createPortfolioObservationId(),
      portfolioId: this.id,
      summary: requiredText(input.summary, "Observation summary"),
      observedAt: new Date(input.observedAt),
    });
    this.mutate({ type: "observation-published", observationType: observation.type }, occurredAt, {
      observations: Object.freeze([...this.state.observations, observation]),
    });
    return observation;
  }

  public recordDecision(input: Omit<PortfolioDecision, "id" | "portfolioId">, occurredAt: Date): PortfolioDecision {
    if (input.observationId && !this.state.observations.some((item) => item.id.equals(input.observationId!))) {
      throw new PortfolioDomainError("OBSERVATION_NOT_FOUND", "A decision may only reference a portfolio observation in this portfolio.");
    }
    const decision: PortfolioDecision = Object.freeze({
      ...input,
      id: createPortfolioDecisionId(),
      portfolioId: this.id,
      rationale: requiredText(input.rationale, "Decision rationale"),
      decidedAt: new Date(input.decidedAt),
    });
    this.mutate({ type: "decision-recorded", decisionType: decision.type }, occurredAt, {
      decisions: Object.freeze([...this.state.decisions, decision]),
    });
    return decision;
  }

  private assertUniqueActive(kind: "property" | "opportunity", reference: string): void {
    const exists = kind === "property"
      ? this.state.composition.properties.some((item) => item.property.propertyId === reference && !item.removedAt)
      : this.state.composition.opportunities.some((item) => item.opportunity.opportunityId === reference && !item.removedAt);
    if (exists) throw new PortfolioDomainError("DUPLICATE_MEMBERSHIP", `An active ${kind} membership already exists.`);
  }
  private mutate(event: PortfolioEventInput, occurredAt: Date, patch: Partial<PortfolioState>): void {
    const version = this.state.version + 1;
    const complete = { ...event, portfolioId: this.id, occurredAt: new Date(occurredAt), aggregateVersion: version } as PortfolioEvent;
    this.state = { ...this.state, ...patch, events: Object.freeze([...this.state.events, complete]), updatedAt: new Date(occurredAt), version };
  }
  private bump(occurredAt: Date, patch: Partial<PortfolioState>): void {
    assertDate(occurredAt);
    this.state = { ...this.state, ...patch, updatedAt: new Date(occurredAt), version: this.state.version + 1 };
  }
}

function requiredText(value: string, label: string): string {
  const clean = value.trim();
  if (!clean) throw new PortfolioDomainError("INVALID_PORTFOLIO_VALUE", `${label} is required.`);
  return clean;
}
function assertDate(value: Date): void {
  if (Number.isNaN(value.getTime())) throw new PortfolioDomainError("INVALID_PORTFOLIO_DATE", "Portfolio date is invalid.");
}
function cloneState(state: PortfolioState): PortfolioState {
  return {
    ...state,
    strategy: Object.freeze({ ...state.strategy, goals: Object.freeze([...state.strategy.goals]) }),
    composition: Object.freeze({
      properties: Object.freeze(state.composition.properties.map((item) => Object.freeze({
        ...item,
        property: Object.freeze({ ...item.property }),
        addedAt: new Date(item.addedAt),
        ...(item.removedAt ? { removedAt: new Date(item.removedAt) } : {}),
      }))),
      opportunities: Object.freeze(state.composition.opportunities.map((item) => Object.freeze({
        ...item,
        opportunity: Object.freeze({ ...item.opportunity }),
        addedAt: new Date(item.addedAt),
        ...(item.removedAt ? { removedAt: new Date(item.removedAt) } : {}),
      }))),
    }),
    exposure: Object.freeze({ ...state.exposure, entries: Object.freeze([...state.exposure.entries]) }),
    allocation: Object.freeze({
      ...state.allocation,
      capitalPriorities: Object.freeze([...state.allocation.capitalPriorities]),
      investmentPriorities: Object.freeze([...state.allocation.investmentPriorities]),
    }),
    observations: Object.freeze(state.observations.map((item) => Object.freeze({ ...item, observedAt: new Date(item.observedAt) }))),
    decisions: Object.freeze(state.decisions.map((item) => Object.freeze({ ...item, decidedAt: new Date(item.decidedAt) }))),
    events: Object.freeze(state.events.map((item) => Object.freeze({ ...item, occurredAt: new Date(item.occurredAt) }))),
    createdAt: new Date(state.createdAt),
    updatedAt: new Date(state.updatedAt),
  };
}
