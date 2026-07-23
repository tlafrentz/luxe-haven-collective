import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getInvestmentOpportunityRequestContext } from "./investment-opportunity-runtime";
import {
  composeAcquisitionWorkspaceProduction,
  type AcquisitionWorkspaceQueryLogger,
  type AcquisitionWorkspaceQueryMetrics,
} from "@/features/investment-opportunity/acquisition-workspace";
import {
  SupabaseAcquisitionPipelineRepository,
  type AcquisitionActivityRow,
  type AcquisitionPipelineCoreRow,
  type AcquisitionStageHistoryRow,
  type SupabaseAcquisitionPipelineGateway,
} from "@/features/investment-opportunity/acquisition-pipeline";
import type { AcquisitionAgreementBasisRow, AcquisitionContractRow, AcquisitionCounterpartyResponseRow, AcquisitionOfferRow } from "@/features/investment-opportunity/acquisition-pipeline/infrastructure/persistence/supabase/acquisition-commercial-mapper";
import type { AcquisitionContingencyRow, AcquisitionDueDiligenceRow, AcquisitionRequirementHistoryRow } from "@/features/investment-opportunity/acquisition-pipeline/infrastructure/persistence/supabase/acquisition-requirement-mapper";

type Client = Awaited<ReturnType<typeof createClient>>;
type Bundle = Awaited<ReturnType<SupabaseAcquisitionPipelineGateway["findCoreByOpportunity"]>>;

class ServerAcquisitionPipelineReadGateway implements SupabaseAcquisitionPipelineGateway {
  public constructor(private readonly client: Client) {}
  public async findCoreById(id: string, ownerId?: string) { return this.find({ id }, ownerId); }
  public async findCoreByOpportunity(opportunityId: string, ownerId?: string) { return this.find({ opportunity_id: opportunityId }, ownerId); }
  public async insertCore(): Promise<void> { throw new Error("Read-only Acquisition Workspace gateway."); }
  public async updateCore(): Promise<"updated" | "conflict"> { throw new Error("Read-only Acquisition Workspace gateway."); }

  private async find(filter: Readonly<{ id?: string; opportunity_id?: string }>, ownerId?: string): Promise<Bundle> {
    let request = this.client.from("acquisition_pipelines").select("*");
    if (filter.id) request = request.eq("id", filter.id);
    if (filter.opportunity_id) request = request.eq("opportunity_id", filter.opportunity_id);
    if (ownerId) request = request.eq("owner_id", ownerId);
    const { data, error } = await request.maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const pipeline = data as unknown as AcquisitionPipelineCoreRow;
    const id = pipeline.id;
    const [history, activity, offers, responses, agreement, contract, contingencies, diligence, requirementHistory] = await Promise.all([
      this.rows<AcquisitionStageHistoryRow>("acquisition_stage_history", id, "occurred_at", true),
      this.rows<AcquisitionActivityRow>("acquisition_pipeline_activity", id, "occurred_at", true),
      this.rows<AcquisitionOfferRow>("acquisition_offers", id, "sequence", true),
      this.rows<AcquisitionCounterpartyResponseRow>("acquisition_counterparty_responses", id, "responded_at", true),
      this.one<AcquisitionAgreementBasisRow>("acquisition_agreement_bases", id),
      this.one<AcquisitionContractRow>("acquisition_contracts", id),
      this.rows<AcquisitionContingencyRow>("acquisition_contingencies", id, "created_at", true),
      this.rows<AcquisitionDueDiligenceRow>("acquisition_due_diligence_items", id, "created_at", true),
      this.rows<AcquisitionRequirementHistoryRow>("acquisition_requirement_history", id, "occurred_at", true),
    ]);
    return { pipeline, history, activity, offers, responses, contingencies, diligence, requirementHistory, ...(agreement ? { agreement } : {}), ...(contract ? { contract } : {}) };
  }
  private async rows<T>(table: string, pipelineId: string, order: string, ascending: boolean): Promise<readonly T[]> {
    const { data, error } = await this.client.from(table).select("*").eq("pipeline_id", pipelineId).order(order, { ascending });
    if (error) throw error;
    return (data ?? []) as unknown as readonly T[];
  }
  private async one<T>(table: string, pipelineId: string): Promise<T | undefined> {
    const { data, error } = await this.client.from(table).select("*").eq("pipeline_id", pipelineId).maybeSingle();
    if (error) throw error;
    return data ? data as unknown as T : undefined;
  }
}

const logger: AcquisitionWorkspaceQueryLogger = { info: () => undefined };
const metrics: AcquisitionWorkspaceQueryMetrics = { observeDuration: () => undefined };

export async function getAcquisitionWorkspaceRequestContext() {
  const opportunity = await getInvestmentOpportunityRequestContext();
  if (!opportunity.ok) return { ok: false as const };
  const client = await createClient();
  const pipeline = new SupabaseAcquisitionPipelineRepository(new ServerAcquisitionPipelineReadGateway(client), opportunity.ownerId);
  const runtime = composeAcquisitionWorkspaceProduction({
    ownerId: opportunity.ownerId,
    opportunities: opportunity.repository,
    pipelines: pipeline,
    actions: { getActionStates: async () => { throw new Error("Action enrichment is unavailable."); } },
    evidence: { getEvidenceStates: async () => { throw new Error("Evidence enrichment is unavailable."); } },
    principals: {
      getPrincipal: async () => ({
        authenticated: true,
        actorId: opportunity.ownerId,
        ownerId: opportunity.ownerId,
        capabilities: { activate: true, manageOffers: true, recordContract: true, manageRequirements: true, prepareClosing: true, close: true, exit: true },
      }),
    },
    deployment: { readDeployed: true, commandsDeployed: false, remoteTransactionsVerified: false, remoteRlsVerified: false, eventDeliveryDurable: false, documentReaderAvailable: false },
    logger,
    metrics,
    now: () => new Date(),
  });
  return { ok: true as const, ownerId: opportunity.ownerId, actor: { type: "user" as const, id: opportunity.ownerId }, handler: runtime.getAcquisitionWorkspace };
}
