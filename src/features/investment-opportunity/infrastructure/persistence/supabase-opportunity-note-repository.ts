import { OpportunityNoteBody, createInvestmentOpportunityId, createOpportunityNoteId, type OpportunityActorReference, type OpportunityNote } from "../../domain";
import { InvestmentOpportunityError, type OpportunityNoteRepository } from "../../application";

export interface SupabaseOpportunityNoteGateway {
  addAtomic(input: Readonly<{ opportunityId: string; note: Readonly<Record<string, unknown>>; activity: Readonly<Record<string, unknown>>; expectedVersion: number; commandId: string }>): Promise<number>;
  listRows(opportunityId: string, ownerId: string): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
export class SupabaseOpportunityNoteRepository implements OpportunityNoteRepository {
  constructor(private readonly gateway: SupabaseOpportunityNoteGateway) {}
  async add(input: Parameters<OpportunityNoteRepository["add"]>[0]) { try { return await this.gateway.addAtomic({ opportunityId: input.note.opportunityId.value, note: { id: input.note.id.value, opportunity_id: input.note.opportunityId.value, body: input.note.body.value, created_by: input.note.author, created_at: input.note.createdAt.toISOString(), updated_at: null }, activity: { id: input.activityId, opportunity_id: input.note.opportunityId.value, type: "note-added", actor: input.note.author, details: { noteId: input.note.id.value }, occurred_at: input.occurredAt.toISOString(), aggregate_version: input.expectedVersion + 1, command_id: input.commandId }, expectedVersion: input.expectedVersion, commandId: input.commandId }); } catch (cause) { if (code(cause) === "40001") throw new InvestmentOpportunityError("CONCURRENT_OPPORTUNITY_MODIFICATION", "The opportunity changed while adding the note.", cause); throw new InvestmentOpportunityError("OPPORTUNITY_PERSISTENCE_FAILED", "The note could not be saved.", cause); } }
  async list(opportunityId: string, ownerId: string): Promise<readonly OpportunityNote[]> { const rows = await this.gateway.listRows(opportunityId, ownerId); return Object.freeze(rows.map(row => Object.freeze({ id: createOpportunityNoteId(text(row.id)), opportunityId: createInvestmentOpportunityId(text(row.opportunity_id)), body: OpportunityNoteBody.create(text(row.body)), author: object(row.created_by) as OpportunityActorReference, createdAt: date(row.created_at), ...(row.updated_at ? { updatedAt: date(row.updated_at) } : {}) })).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.value.localeCompare(a.id.value))); }
}
function code(error: unknown) { return error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined; }
function text(value: unknown) { if (typeof value !== "string" || !value.trim()) throw new TypeError("Invalid note row."); return value; }
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Invalid note actor."); return value as Record<string, unknown>; }
function date(value: unknown) { const result = new Date(text(value)); if (Number.isNaN(result.getTime())) throw new TypeError("Invalid note timestamp."); return result; }
