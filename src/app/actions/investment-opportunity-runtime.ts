import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SupabaseInvestmentOpportunityRepository, SupabaseOpportunityNoteRepository, type InvestmentOpportunityPersistencePayload, type InvestmentOpportunityPersistenceRecord, type SupabaseInvestmentOpportunityGateway, type SupabaseOpportunityNoteGateway } from "@/features/investment-opportunity/infrastructure";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import type { InvestmentOpportunitySaveOptions, InvestmentOpportunitySaveResult } from "@/features/investment-opportunity";
import { requireInvestmentAuthorization,type InvestmentAuthorizationOperation } from "@/features/investment-opportunity";

type Client = Awaited<ReturnType<typeof createClient>>;
type Row = Record<string, unknown>;

class ServerSupabaseOpportunityGateway implements SupabaseInvestmentOpportunityGateway {
  constructor(private readonly client: Client) {}
  async saveAtomic(payload: InvestmentOpportunityPersistencePayload, expectedVersion?: number, commandId?: string, options?: InvestmentOpportunitySaveOptions): Promise<InvestmentOpportunitySaveResult> {
    const { data, error } = await this.client.rpc("save_investment_opportunity", { p_payload: payload, p_expected_version: expectedVersion ?? null, p_command_id: commandId ?? null, p_payload_hash: options?.payloadHash ?? commandId ?? null, p_initial_note: options?.initialNote ?? null });
    if (error) throw error;
    const value = data as unknown as Record<string, unknown>;
    if (!value || typeof value.opportunityId !== "string" || typeof value.aggregateVersion !== "number") throw new Error("Save receipt was invalid.");
    return { opportunityId: value.opportunityId, ...(typeof value.analysisVersionId === "string" ? { analysisVersionId: value.analysisVersionId } : {}), ...(typeof value.analysisVersionNumber === "number" ? { analysisVersionNumber: value.analysisVersionNumber } : {}), aggregateVersion: value.aggregateVersion, idempotent: value.idempotent === true };
  }
  async findBundle(id: string, ownerId: string): Promise<InvestmentOpportunityPersistenceRecord | null> {
    const startedAt=Date.now(),{data,error}=await this.client.rpc("get_investment_opportunity_bundle",{p_opportunity_id:id});
    if(error)throw error;if(!data)return null;
    const bundle=data as unknown as {opportunity:Row;analyses:Row[];tags:Row[];activity:Row[]};
    if(String(bundle.opportunity.workspace_id)!==ownerId)return null;
    console.info("investment_opportunity_bundle_read",{workspaceId:ownerId,opportunityId:id,analysisVersionId:bundle.opportunity.current_analysis_id??null,durationMs:Date.now()-startedAt});
    return{opportunity:bundle.opportunity,analyses:bundle.analyses??[],tags:bundle.tags??[],activity:bundle.activity??[]};
  }
  async findSaveReceipt(commandId: string, payloadHash: string): Promise<InvestmentOpportunitySaveResult | null> {
    const { data, error } = await this.client.from("investment_opportunity_commands").select("payload_hash,result").eq("command_id", commandId).maybeSingle();
    if (error || !data) return null;
    if (data.payload_hash !== payloadHash) throw new Error("Investment Opportunity command payload conflict.");
    const value = data.result as unknown as Record<string, unknown>;
    if (typeof value.opportunityId !== "string" || typeof value.aggregateVersion !== "number") throw new Error("Save receipt was invalid.");
    const receipt={ opportunityId: value.opportunityId, ...(typeof value.analysisVersionId === "string" ? { analysisVersionId: value.analysisVersionId } : {}), ...(typeof value.analysisVersionNumber === "number" ? { analysisVersionNumber: value.analysisVersionNumber } : {}), aggregateVersion: value.aggregateVersion, idempotent: true } as const;
    console.info("investment_opportunity_save_receipt_reused",{commandId,opportunityId:receipt.opportunityId,analysisVersionId:receipt.analysisVersionId??null});
    return receipt;
  }
  async listBundles(query: Readonly<{ ownerId: string; statuses?: readonly string[]; includeArchived: boolean; route?: string; limit: number; cursor?: string }>) {
    let request = this.client.from("investment_opportunities").select("*").eq("workspace_id", query.ownerId).eq("scenario_only", false).order("updated_at", { ascending: false }).order("id", { ascending: true });
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
  async listRows(opportunityId: string, ownerId: string) { const parent = await this.client.from("investment_opportunities").select("id").eq("id", opportunityId).eq("workspace_id", ownerId).maybeSingle(); if (parent.error) throw parent.error; if (!parent.data) return []; const { data, error } = await this.client.from("investment_opportunity_notes").select("*").eq("opportunity_id", opportunityId).order("created_at", { ascending: false }).order("id", { ascending: false }); if (error) throw error; return (data ?? []) as unknown as Row[]; }
}

export async function getInvestmentOpportunityRequestContext() {
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false as const };
  try {
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id);
    const authorizeOpportunity=async(opportunityId:string,operation:InvestmentAuthorizationOperation,analysisVersionId?:string)=>{
      const requestId=crypto.randomUUID(),startedAt=Date.now(),{data}=await client.from("investment_opportunities").select("id,workspace_id,property_id,archived_at").eq("id",opportunityId).maybeSingle();
      if(!data){console.warn("investment_authorization_decision",{requestId,userId:user.id,workspaceId:access.workspaceId,operation,resourceType:"investment-opportunity",resourceId:opportunityId,decision:"denied",policy:"investment-intelligence-auth-v1",reason:"not-found",durationMs:Date.now()-startedAt});return false;}
      try{const decision=requireInvestmentAuthorization(access,operation,{workspaceId:String(data.workspace_id),...(data.property_id?{propertyId:String(data.property_id)}:{}),opportunityId,...(analysisVersionId?{analysisVersionId}:{}),archived:Boolean(data.archived_at)});console.info("investment_authorization_decision",{requestId,userId:user.id,workspaceId:access.workspaceId,operation,resourceType:analysisVersionId?"analysis-version":"investment-opportunity",resourceId:analysisVersionId??opportunityId,decision:"allowed",policy:decision.policy,durationMs:Date.now()-startedAt});return true;}catch(error){const reason=error instanceof Error&&"decision"in error?(error as {decision:{reason:string}}).decision.reason:"denied";console.warn("investment_authorization_decision",{requestId,userId:user.id,workspaceId:access.workspaceId,operation,resourceType:analysisVersionId?"analysis-version":"investment-opportunity",resourceId:analysisVersionId??opportunityId,decision:"denied",policy:"investment-intelligence-auth-v1",reason,durationMs:Date.now()-startedAt});return false;}
    };
    return { ok: true as const, ownerId: access.workspaceId, workspaceId: access.workspaceId, actorId: user.id, access, authorizeOpportunity, repository: new SupabaseInvestmentOpportunityRepository(new ServerSupabaseOpportunityGateway(client), access.workspaceId, user.id), noteRepository: new SupabaseOpportunityNoteRepository(new ServerSupabaseOpportunityNoteGateway(client)) };
  } catch {
    return { ok: false as const };
  }
}
