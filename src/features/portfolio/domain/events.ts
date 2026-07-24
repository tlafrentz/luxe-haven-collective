import type { PortfolioHealthStatus, PortfolioObservationType } from "./model";
import type { PortfolioId } from "./value-objects";

type EventBase = Readonly<{
  portfolioId: PortfolioId;
  occurredAt: Date;
  aggregateVersion: number;
}>;

export type PortfolioEvent =
  | (EventBase & { type: "portfolio-created" })
  | (EventBase & { type: "property-added"; propertyId: string })
  | (EventBase & { type: "property-removed"; propertyId: string })
  | (EventBase & { type: "opportunity-added"; opportunityId: string })
  | (EventBase & { type: "opportunity-removed"; opportunityId: string })
  | (EventBase & { type: "capital-updated" })
  | (EventBase & { type: "allocation-changed" })
  | (EventBase & { type: "health-changed"; previous: PortfolioHealthStatus; current: PortfolioHealthStatus })
  | (EventBase & { type: "observation-published"; observationType: PortfolioObservationType })
  | (EventBase & { type: "decision-recorded"; decisionType: string });
