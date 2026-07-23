import type { OpportunityNoteRepository } from "../../application";
import type { OpportunityNote } from "../../domain";
import { InvestmentOpportunityError } from "../../application";

export class InMemoryOpportunityNoteRepository implements OpportunityNoteRepository {
  private readonly notes = new Map<string, OpportunityNote[]>();
  private readonly versions = new Map<string, number>();
  setVersion(opportunityId: string, version: number) { this.versions.set(opportunityId, version); }
  async add(input: Parameters<OpportunityNoteRepository["add"]>[0]) { const current = this.versions.get(input.note.opportunityId.value) ?? input.expectedVersion; if (current !== input.expectedVersion) throw new InvestmentOpportunityError("CONCURRENT_OPPORTUNITY_MODIFICATION", "Stale note version."); const values = this.notes.get(input.note.opportunityId.value) ?? []; if (!values.some(note => note.id.equals(input.note.id))) values.push(input.note); this.notes.set(input.note.opportunityId.value, values); const version = current + 1; this.versions.set(input.note.opportunityId.value, version); return version; }
  async list(opportunityId: string, ownerId: string) { void ownerId; return Object.freeze([...(this.notes.get(opportunityId) ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.value.localeCompare(a.id.value))); }
}
