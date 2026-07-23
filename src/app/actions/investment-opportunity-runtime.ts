import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SupabaseInvestmentOpportunityRepository, SupabaseOpportunityNoteRepository, type InvestmentOpportunityPersistencePayload, type InvestmentOpportunityPersistenceRecord, type SupabaseInvestmentOpportunityGateway, type SupabaseOpportunityNoteGateway } from "@/features/investment-opportunity/infrastructure";

type Client = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

class ServerSupabaseOpportunityGateway implements SupabaseInvestmentOpportunityGateway {
  constructor(private readonly client: Client) {}
  async saveAtomic(payload: InvestmentOpportunityPersistencePayload, expectedVersion?: number, commandId?: string) {
    const { error } = await this.client.rpc("save_investment_opportunity", { p_payload: payload, p_expected_version: expectedVersion ?? null, p_command_id: commandId ?? null });
    if (error) throw error;
  }
  async findBundle(id: string, ownerId: string): Promise<InvestmentOpportunityPersistenceRecord | null> {
    const { data, error } = await this.client.from("investment_opportunities").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (error) throw error; if (!data) return null;
    return this.loadBundle(data as unknown as Row);
  }
  async listBundles(query: Readonly<{ ownerId: string; statuses?: readonly string[]; includeArchived: boolean; route?: string; limit: number; cursor?: string }>) {
    let request = this.client.from("investment_opportunities").select("*").eq("owner_id", query.ownerId).order("updated_at", { ascending: false }).order("id", { ascending: true });
    if (!query.includeArchived) request = request.is("archived_at", null);
    if (query.statuses?.length) request = request.in("status", [...query.statuses]);
    if (query.route) request = request.eq("route", query.route);
    const offset = Math.max(Number.parseInt(query.cursor ?? "0", 10) || 0, 0), { data, error } = await request.range(offset, offset + query.limit);
    if (error) throw error; const rows = (data ?? []) as unknown as Row[], visible = rows.slice(0, query.limit), records = await Promise.all(visible.map(row => this.loadBundle(row)));
    return { records, ...(rows.length > query.limit ? { nextCursor: String(offset + query.limit) } : {}) };
  }
  private async loadBundle(opportunity: Row): Promise<InvestmentOpportunityPersistenceRecord> {
    const id = String(opportunity.id), [analyses, tags, activity] = await Promise.all([
      this.client.from("investment_opportunity_analyses").select("*").eq("opportunity_id", id).order("sequence", { ascending: true }),
      this.client.from("investment_opportunity_tags").select("*").eq("opportunity_id", id).order("normalized_value", { ascending: true }),
      this.client.from("investment_opportunity_activity").select("*").eq("opportunity_id", id).order("occurred_at", { ascending: true }).order("id", { ascending: true }),
    ]);
    const failure = analyses.error ?? tags.error ?? activity.error; if (failure) throw failure;
    return { opportunity, analyses: (analyses.data ?? []) as unknown as Row[], tags: (tags.data ?? []) as unknown as Row[], activity: (activity.data ?? []) as unknown as Row[] };
  }
}
class ServerSupabaseOpportunityNoteGateway implements SupabaseOpportunityNoteGateway {
  constructor(private readonly client: Client) {}
  async addAtomic(input: Parameters<SupabaseOpportunityNoteGateway["addAtomic"]>[0]) { const { data, error } = await this.client.rpc("add_investment_opportunity_note", { p_opportunity_id: input.opportunityId, p_note: input.note, p_activity: input.activity, p_expected_version: input.expectedVersion, p_command_id: input.commandId }); if (error) throw error; if (typeof data !== "number") throw new Error("Note RPC returned an invalid aggregate version."); return data; }
  async listRows(opportunityId: string, ownerId: string) { const parent = await this.client.from("investment_opportunities").select("id").eq("id", opportunityId).eq("owner_id", ownerId).maybeSingle(); if (parent.error) throw parent.error; if (!parent.data) return []; const { data, error } = await this.client.from("investment_opportunity_notes").select("*").eq("opportunity_id", opportunityId).order("created_at", { ascending: false }).order("id", { ascending: false }); if (error) throw error; return (data ?? []) as unknown as Row[]; }
}

export async function getInvestmentOpportunityRequestContext() {
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false as const };
  return { ok: true as const, ownerId: user.id, repository: new SupabaseInvestmentOpportunityRepository(new ServerSupabaseOpportunityGateway(client)), noteRepository: new SupabaseOpportunityNoteRepository(new ServerSupabaseOpportunityNoteGateway(client)) };
}
