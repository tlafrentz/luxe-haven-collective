import { OpportunityNoteBody, createInvestmentOpportunityId, createOpportunityNoteId, type OpportunityActorReference, type OpportunityNote } from "../domain";

export interface OpportunityNoteRepository {
  add(input: Readonly<{ note: OpportunityNote; ownerId: string; expectedVersion: number; activityId: string; commandId: string; occurredAt: Date }>): Promise<number>;
  list(opportunityId: string, ownerId: string): Promise<readonly OpportunityNote[]>;
}
export async function addOpportunityNote(repository: OpportunityNoteRepository, input: Readonly<{ opportunityId: string; ownerId: string; body: string; actor: OpportunityActorReference; expectedVersion: number; commandId: string; occurredAt?: Date }>) {
  const occurredAt = input.occurredAt ?? new Date(), note: OpportunityNote = Object.freeze({ id: createOpportunityNoteId(), opportunityId: createInvestmentOpportunityId(input.opportunityId), body: OpportunityNoteBody.create(input.body), author: input.actor, createdAt: occurredAt });
  const version = await repository.add({ note, ownerId: input.ownerId, expectedVersion: input.expectedVersion, activityId: `opportunity-activity-${crypto.randomUUID()}`, commandId: input.commandId, occurredAt });
  return Object.freeze({ note, aggregateVersion: version });
}
export async function listOpportunityNotes(repository: OpportunityNoteRepository, opportunityId: string, ownerId: string) { return repository.list(opportunityId, ownerId); }
