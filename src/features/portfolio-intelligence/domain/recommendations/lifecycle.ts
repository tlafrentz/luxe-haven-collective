import type {
  PortfolioRecommendationHistory,
  PortfolioRecommendationLifecycleEvent,
  PortfolioRecommendationLifecycleStatus,
} from "./contracts";

const transitions = {
  generated: ["presented", "expired", "superseded"],
  presented: ["acknowledged", "dismissed", "expired", "superseded"],
  acknowledged: ["resolved", "dismissed", "expired", "superseded"],
  resolved: ["historical"],
  dismissed: ["historical"],
  superseded: ["historical"],
  expired: ["historical"],
  historical: [],
} as const satisfies Readonly<Record<PortfolioRecommendationLifecycleStatus, readonly PortfolioRecommendationLifecycleStatus[]>>;

export function createRecommendationHistory(input: Readonly<{
  recommendationId: PortfolioRecommendationHistory["recommendationId"];
  portfolioId: PortfolioRecommendationHistory["portfolioId"];
  generatedAt: Date;
}>): PortfolioRecommendationHistory {
  return Object.freeze({
    recommendationId: input.recommendationId,
    portfolioId: input.portfolioId,
    events: Object.freeze([event("generated", input.generatedAt)]),
    currentStatus: "generated",
  });
}

export function transitionRecommendationHistory(
  history: PortfolioRecommendationHistory,
  input: Readonly<{ status: PortfolioRecommendationLifecycleStatus; occurredAt: Date; actorId?: string; reasonCode?: string }>,
): PortfolioRecommendationHistory {
  const allowed: readonly PortfolioRecommendationLifecycleStatus[] = transitions[history.currentStatus];
  if (!allowed.includes(input.status)) throw new Error(`Cannot transition recommendation from ${history.currentStatus} to ${input.status}.`);
  const previous = history.events.at(-1)!;
  if (input.occurredAt < previous.occurredAt || Number.isNaN(input.occurredAt.getTime())) throw new TypeError("Recommendation lifecycle events must be chronological.");
  const next = event(input.status, input.occurredAt, input.actorId, input.reasonCode);
  return Object.freeze({ ...history, events: Object.freeze([...history.events, next]), currentStatus: input.status });
}

function event(status: PortfolioRecommendationLifecycleStatus, occurredAt: Date, actorId?: string, reasonCode?: string): PortfolioRecommendationLifecycleEvent {
  if (Number.isNaN(occurredAt.getTime())) throw new TypeError("Recommendation lifecycle date is invalid.");
  return Object.freeze({ status, occurredAt: new Date(occurredAt), ...(actorId?.trim() ? { actorId: actorId.trim() } : {}), ...(reasonCode?.trim() ? { reasonCode: reasonCode.trim() } : {}) });
}
