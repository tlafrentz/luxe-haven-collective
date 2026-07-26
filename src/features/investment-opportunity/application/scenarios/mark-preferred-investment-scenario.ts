import {
  createInvestmentOpportunityId,
  createOpportunityAnalysisId,
  createOpportunityOwnerId,
  type OpportunityActorReference,
} from "../../domain";
import type { InvestmentOpportunityRepository } from "../ports/repository";

export async function markPreferredInvestmentScenario(
  repository: InvestmentOpportunityRepository,
  input: Readonly<{
    ownerId: string;
    opportunityId: string;
    scenarioId: string;
    expectedVersion: number;
    actor: OpportunityActorReference;
    occurredAt?: Date;
    idempotencyKey?: string;
  }>,
) {
  const ownerId = createOpportunityOwnerId(input.ownerId);
  const opportunity = await repository.findById(createInvestmentOpportunityId(input.opportunityId), ownerId);
  if (!opportunity) throw new Error("Investment scenario workspace was not found.");
  if (opportunity.version !== input.expectedVersion) throw new Error("Scenario workspace changed. Reload before selecting a preferred scenario.");
  const scenarioId = createOpportunityAnalysisId(input.scenarioId);
  opportunity.setCurrentAnalysis(scenarioId, {
    actor: input.actor,
    occurredAt: input.occurredAt ?? new Date(),
    commandId: input.idempotencyKey,
  });
  await repository.save(opportunity, input.expectedVersion, input.idempotencyKey);
  return opportunity;
}
