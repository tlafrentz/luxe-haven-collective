"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addOpportunityNote, archiveInvestmentOpportunity, buildOpportunityAnalysisSnapshotFromWorkspace, buildOpportunityPropertyReference, buildOpportunitySourceSummary, createInvestmentOpportunityWithResult, createInvestmentOpportunityId, InvestmentOpportunityError, listCompatibleInvestmentOpportunities, requireInvestmentAuthorization, restoreInvestmentOpportunity, saveOpportunityAnalysisWithResult, updateInvestmentOpportunity, updateOpportunityStatus, type InvestmentAuthorizationOperation,type OpportunityStatus } from "@/features/investment-opportunity";
import { createClient } from "@/lib/supabase/server";
import { getInvestmentOpportunityRequestContext } from "./investment-opportunity-runtime";
import { resolveInvestmentAnalysis } from "./investment-analysis-save-store";

export type OpportunityMutationResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; code: string; message: string; fieldErrors?: Readonly<Record<string, readonly string[]>>; currentVersion?: number }>;
type WorkflowFailure = Extract<OpportunityMutationResult<never>, { ok: false }>;
const saveSchema = z.object({ analysisToken: z.string().min(1), name: z.string().trim().max(120).optional(), tags: z.array(z.string().max(40)).max(20), idempotencyKey: z.string().min(8).max(160), note: z.string().trim().max(5000).optional() });
const existingSchema = saveSchema.pick({ analysisToken: true, idempotencyKey: true }).extend({ opportunityId: z.string().min(1), expectedVersion: z.number().int().positive(), sourceAnalysisVersionId:z.string().min(1).optional() });
const preferredScenarioSchema = z.object({ opportunityId: z.string().min(1), scenarioId: z.string().min(1), expectedVersion: z.number().int().positive(), idempotencyKey: z.string().min(8).max(160) });

export async function saveAnalysisAsScenarioAction(input: unknown): Promise<OpportunityMutationResult<{ opportunityId: string; analysisId: string; scenarioId: string; redirectPath: string }>> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const saved = await saveAnalysisAsNewOpportunityAction(parsed.data);
  if (!saved.ok) return saved;
  try {
    const client = await createClient();
    const scenarioId = `scenario-${crypto.randomUUID()}`;
    const { error: visibilityError } = await client.from("investment_opportunities").update({ scenario_only: true }).eq("id", saved.data.opportunityId);
    if (visibilityError) throw visibilityError;
    const { error } = await client.rpc("create_investment_scenario", {
      p_opportunity_id: saved.data.opportunityId,
      p_source_analysis_version_id: saved.data.analysisId,
      p_source_scenario_id: "",
      p_scenario_id: scenarioId,
      p_name: parsed.data.name || "Base scenario",
      p_scenario_type: "base",
      p_description: "Saved from Investment Analysis.",
      p_notes: parsed.data.note || "",
      p_expected_version: saved.data.aggregateVersion,
      p_command_id: `${parsed.data.idempotencyKey}:scenario`,
    });
    if (error) throw error;
    revalidatePath("/dashboard/investments/scenarios");
    revalidatePath("/dashboard/investments/opportunities");
    return { ok: true, data: { opportunityId: saved.data.opportunityId, analysisId: saved.data.analysisId, scenarioId, redirectPath: "/dashboard/investments/scenarios" } };
  } catch {
    return failure("SCENARIO_PERSISTENCE_FAILED", "The analysis was retained, but the saved scenario could not be finalized. Try again.");
  }
}

export async function convertScenarioToOpportunityAction(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const context = await workflowContext();
  if (!opportunityId || !context.ok || !await context.authorizeOpportunity(opportunityId, "opportunity.modify")) throw new Error("OPPORTUNITY_ACCESS_DENIED");
  const client = await createClient();
  const { error } = await client.from("investment_opportunities").update({ scenario_only: false }).eq("id", opportunityId).eq("workspace_id", context.workspaceId);
  if (error) throw new Error("OPPORTUNITY_PROMOTION_FAILED");
  revalidatePath("/dashboard/investments/scenarios");
  revalidatePath("/dashboard/investments/opportunities");
  redirect(`/dashboard/investments/opportunities/${opportunityId}`);
}

export async function markPreferredScenarioAction(input: unknown) {
  const parsed = preferredScenarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, message: "The preferred scenario request is invalid." };
  const context = await getInvestmentOpportunityRequestContext();
  if (!context.ok||!await context.authorizeOpportunity(parsed.data.opportunityId,"scenario.modify")) return { ok: false as const, message: "You are not authorized to change the preferred scenario." };
  try {
    const client=await createClient(),{data:scenario}=await client.from("investment_scenarios").select("revision").eq("scenario_id",parsed.data.scenarioId).eq("opportunity_id",parsed.data.opportunityId).maybeSingle();
    if(!scenario)throw new Error("Scenario was not found.");
    const{data,error}=await client.rpc("mutate_investment_scenario",{p_opportunity_id:parsed.data.opportunityId,p_scenario_id:parsed.data.scenarioId,p_operation:"preferred",p_name:"",p_description:"",p_notes:"",p_expected_scenario_revision:scenario.revision,p_expected_version:parsed.data.expectedVersion,p_command_id:parsed.data.idempotencyKey});
    if(error)throw error;
    revalidatePath(`/dashboard/investments/opportunities/${parsed.data.opportunityId}`);
    revalidatePath(`/dashboard/investments/opportunities/${parsed.data.opportunityId}/scenarios`);
    return { ok: true as const, aggregateVersion:data?.[0]?.aggregate_version??parsed.data.expectedVersion+1 };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "The preferred scenario could not be changed." };
  }
}
const mutationSchema = z.object({ opportunityId: z.string().min(1), expectedVersion: z.number().int().positive(), commandId: z.string().min(8).max(160) });

export async function saveAnalysisAsNewOpportunityAction(input: unknown): Promise<OpportunityMutationResult<{ opportunityId: string; analysisId: string; analysisSequence: 1; aggregateVersion: number; redirectPath: string }>> {
  const parsed = saveSchema.safeParse(input); if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const context = await workflowContext(); if (!context.ok) return context;
  try{requireInvestmentAuthorization(context.access,"opportunity.create",{workspaceId:context.workspaceId});}catch{return failure("OPPORTUNITY_ACCESS_DENIED","You are not authorized to manage opportunities.");}
  const stored = await resolveInvestmentAnalysis(parsed.data.analysisToken, context.actor.id); if (!stored) return failure("ANALYSIS_TOKEN_EXPIRED", "This analysis is no longer available to save. Run the analysis again.");
  try {
    const payloadHash = await commandHash(["new", parsed.data.analysisToken, parsed.data.name ?? "", parsed.data.tags, parsed.data.note ?? ""]);
    const replay = await context.repository.findSaveReceipt(parsed.data.idempotencyKey, payloadHash);
    if (replay) { revalidate(replay.opportunityId); return { ok: true, data: { opportunityId: replay.opportunityId, analysisId: replay.analysisVersionId!, analysisSequence: 1, aggregateVersion: replay.aggregateVersion, redirectPath: `/dashboard/investments/opportunities/${replay.opportunityId}` } }; }
    const property = buildOpportunityPropertyReference(stored.result, stored.analyzedAt), analysis = buildSaveInput(stored);
    const occurredAt = new Date(), noteId = `opportunity-note-${crypto.randomUUID()}`, noteActivityId = `opportunity-activity-${crypto.randomUUID()}`;
    const atomicNote = parsed.data.note ? { note: { id: noteId, opportunity_id: "", body: parsed.data.note, created_by: context.actor, created_at: occurredAt.toISOString(), updated_at: null }, activity: { id: noteActivityId, opportunity_id: "", type: "note-added", actor: context.actor, details: { noteId }, occurred_at: occurredAt.toISOString(), aggregate_version: 3, command_id: `${parsed.data.idempotencyKey}:note` } } : undefined;
    const { opportunity, saveResult } = await createInvestmentOpportunityWithResult(context.repository, { authenticatedOwnerId: context.ownerId, actor: context.actor, route: stored.result.lifecycleResult.acquisitionType, property, ...(parsed.data.name ? { name: parsed.data.name } : {}), tags: parsed.data.tags, initialAnalysis: analysis, commandId: parsed.data.idempotencyKey, occurredAt, saveOptions: { payloadHash, ...(atomicNote ? { initialNote: atomicNote } : {}) } });
    const saved = opportunity.props.analyses[0]; if (!saved && !saveResult.analysisVersionId) throw new Error("Initial analysis was not saved.");
    console.info("investment_opportunity_saved",{requestId:stored.result.lineage.workspaceRunId,commandId:parsed.data.idempotencyKey,workspaceId:context.workspaceId,opportunityId:saveResult.opportunityId,analysisVersionId:saveResult.analysisVersionId??saved!.id.value,marketSnapshotId:stored.marketReference?.marketSnapshotId,propertySnapshotId:stored.marketReference?.subjectPropertySnapshotId,analysisVersionNumber:1,idempotent:saveResult.idempotent});
    if(stored.marketReference)console.info("opportunity_created_with_market_snapshot",{analysisId:stored.marketReference.analysisId,marketSnapshotId:stored.marketReference.marketSnapshotId,propertySnapshotId:stored.marketReference.subjectPropertySnapshotId,correlationId:stored.result.lineage.workspaceRunId,opportunityId:saveResult.opportunityId});
    revalidate(saveResult.opportunityId); return { ok: true, data: { opportunityId: saveResult.opportunityId, analysisId: saveResult.analysisVersionId ?? saved!.id.value, analysisSequence: 1, aggregateVersion: saveResult.aggregateVersion, redirectPath: `/dashboard/investments/opportunities/${saveResult.opportunityId}` } };
  } catch (error) { return mapError(error); }
}
export async function saveAnalysisToOpportunityAction(input: unknown): Promise<OpportunityMutationResult<{ opportunityId: string; analysisId: string; analysisSequence: number; aggregateVersion: number; redirectPath: string }>> {
  const parsed = existingSchema.safeParse(input); if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors);
  const context = await workflowContext(); if (!context.ok) return context;if(!await context.authorizeOpportunity(parsed.data.opportunityId,"analysis.create",parsed.data.sourceAnalysisVersionId))return failure("OPPORTUNITY_ACCESS_DENIED","You are not authorized to manage opportunities."); const stored = await resolveInvestmentAnalysis(parsed.data.analysisToken, context.actor.id); if (!stored) return failure("ANALYSIS_TOKEN_EXPIRED", "This analysis is no longer available to save. Run the analysis again.");
  try { const payloadHash = await commandHash(["existing", parsed.data.analysisToken, parsed.data.opportunityId,parsed.data.sourceAnalysisVersionId??"latest"]), replay = await context.repository.findSaveReceipt(parsed.data.idempotencyKey, payloadHash); if (replay) { revalidate(replay.opportunityId); return { ok: true, data: { opportunityId: replay.opportunityId, analysisId: replay.analysisVersionId!, analysisSequence: replay.analysisVersionNumber!, aggregateVersion: replay.aggregateVersion, redirectPath: `/dashboard/investments/opportunities/${replay.opportunityId}` } }; } const { opportunity, saveResult } = await saveOpportunityAnalysisWithResult(context.repository, { authenticatedOwnerId: context.ownerId, actor: context.actor, opportunityId: createInvestmentOpportunityId(parsed.data.opportunityId), expectedVersion: parsed.data.expectedVersion, commandId: parsed.data.idempotencyKey, analysis: {...buildSaveInput(stored),...(parsed.data.sourceAnalysisVersionId?{sourceAnalysisVersionId:parsed.data.sourceAnalysisVersionId}:{})}, saveOptions: { payloadHash } }); const saved = opportunity.props.analyses.at(-1)!; console.info("investment_analysis_version_created",{requestId:stored.result.lineage.workspaceRunId,commandId:parsed.data.idempotencyKey,workspaceId:context.workspaceId,opportunityId:saveResult.opportunityId,analysisVersionId:saveResult.analysisVersionId??saved.id.value,sourceAnalysisVersionId:saved.props.lineage.sourceAnalysisVersionId??null,analysisVersionNumber:saveResult.analysisVersionNumber??saved.sequence,idempotent:saveResult.idempotent}); revalidate(saveResult.opportunityId); return { ok: true, data: { opportunityId: saveResult.opportunityId, analysisId: saveResult.analysisVersionId ?? saved.id.value, analysisSequence: saveResult.analysisVersionNumber ?? saved.sequence, aggregateVersion: saveResult.aggregateVersion, redirectPath: `/dashboard/investments/opportunities/${saveResult.opportunityId}` } }; } catch (error) { return mapError(error); }
}
export async function listCompatibleOpportunitiesAction(analysisToken: string): Promise<OpportunityMutationResult<readonly Readonly<{ id: string; name: string; status: OpportunityStatus; aggregateVersion: number; analysisCount: number; currentRecommendation?: string; lastAnalyzedAt?: Date }>[]> > {
  const context = await workflowContext(); if (!context.ok) return context; const stored = await resolveInvestmentAnalysis(analysisToken, context.actor.id); if (!stored) return failure("ANALYSIS_TOKEN_EXPIRED", "This analysis is no longer available to save. Run the analysis again.");
  const values = await listCompatibleInvestmentOpportunities(context.repository, { ownerId: context.ownerId, route: stored.result.lifecycleResult.acquisitionType, property: buildOpportunityPropertyReference(stored.result, stored.analyzedAt) }); return { ok: true, data: values };
}
export async function updateOpportunityMetadataAction(input: unknown) { const parsed = mutationSchema.extend({ name: z.string().trim().min(1).max(120).optional(), tags: z.array(z.string().max(40)).max(20).optional() }).safeParse(input); return mutate(parsed,"opportunity.modify", (context, value) => updateInvestmentOpportunity(context.repository, { authenticatedOwnerId: context.ownerId, actor: context.actor, opportunityId: createInvestmentOpportunityId(value.opportunityId), expectedVersion: value.expectedVersion, commandId: value.commandId, name: value.name, tags: value.tags })); }
export async function updateOpportunityStatusAction(input: unknown) { const parsed = mutationSchema.extend({ status: z.enum(["evaluating", "researching", "shortlisted", "offer-submitted", "under-contract", "acquired", "rejected"]) }).safeParse(input); return mutate(parsed,"opportunity.modify", (context, value) => updateOpportunityStatus(context.repository, { authenticatedOwnerId: context.ownerId, actor: context.actor, opportunityId: createInvestmentOpportunityId(value.opportunityId), expectedVersion: value.expectedVersion, commandId: value.commandId, status: value.status })); }
export async function archiveOpportunityAction(input: unknown) { const parsed = mutationSchema.safeParse(input); return mutate(parsed,"opportunity.archive", (context, value) => archiveInvestmentOpportunity(context.repository, { authenticatedOwnerId: context.ownerId, actor: context.actor, opportunityId: createInvestmentOpportunityId(value.opportunityId), expectedVersion: value.expectedVersion, commandId: value.commandId })); }
export async function restoreOpportunityAction(input: unknown) { const parsed = mutationSchema.safeParse(input); return mutate(parsed,"opportunity.archive", (context, value) => restoreInvestmentOpportunity(context.repository, { authenticatedOwnerId: context.ownerId, actor: context.actor, opportunityId: createInvestmentOpportunityId(value.opportunityId), expectedVersion: value.expectedVersion, commandId: value.commandId })); }
export async function addOpportunityNoteAction(input: unknown) { const parsed = mutationSchema.extend({ body: z.string().trim().min(1).max(5000) }).safeParse(input); if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors); const context = await workflowContext(); if (!context.ok||!await context.authorizeOpportunity(parsed.data.opportunityId,"note.create")) return failure("OPPORTUNITY_ACCESS_DENIED","You are not authorized to manage opportunities."); try { const result = await addOpportunityNote(context.noteRepository, { opportunityId: parsed.data.opportunityId, ownerId: context.ownerId, body: parsed.data.body, actor: context.actor, expectedVersion: parsed.data.expectedVersion, commandId: parsed.data.commandId }); revalidate(parsed.data.opportunityId); return { ok: true as const, data: { aggregateVersion: result.aggregateVersion, noteId: result.note.id.value } }; } catch (error) { return mapError(error); } }

function buildSaveInput(stored: NonNullable<Awaited<ReturnType<typeof resolveInvestmentAnalysis>>>) { const result = stored.result; return { lifecycleResult: result.lifecycleResult, lifecycleResultId: result.lineage.workspaceRunId, analyzedAt: stored.analyzedAt, snapshot: buildOpportunityAnalysisSnapshotFromWorkspace(result, stored.analyzedAt), sourceSummary: buildOpportunitySourceSummary(result), policyVersions: { marketAnalysisPolicy: result.investmentMarketContext.lineage.policyVersion, ...(stored.marketReference ? { comparableQualificationPolicy: stored.marketReference.comparablePolicyVersion } : {}) }, lineage: { investmentAnalysisContextId: result.lineage.workspaceRunId, investmentMarketContextId: result.investmentMarketContext.marketAnalysisId, marketAnalysisReportId: result.marketReport.analysisId, ...(stored.marketReference ? { subjectPropertySnapshotId: stored.marketReference.subjectPropertySnapshotId, marketSnapshotId: stored.marketReference.marketSnapshotId, assumptionVersion: stored.marketReference.assumptionVersion, confidenceVersion: stored.marketReference.confidenceVersion, comparablePolicyVersion: stored.marketReference.comparablePolicyVersion } : {}) } }; }
async function workflowContext() { try { const context = await getInvestmentOpportunityRequestContext(); if (!context.ok) return failure("OPPORTUNITY_ACCESS_DENIED", "You are not authorized to manage opportunities."); return { ...context, actor: { type: "user" as const, id: context.actorId } }; } catch { return failure("OPPORTUNITY_ACCESS_DENIED", "You are not authorized to manage opportunities."); } }
async function mutate<T extends {opportunityId:string}>(parsed: Readonly<{ success: true; data: T }> | Readonly<{ success: false; error: z.ZodError }>,operation:InvestmentAuthorizationOperation, command: (context: Exclude<Awaited<ReturnType<typeof workflowContext>>, WorkflowFailure>, value: T) => Promise<{ id: { value: string }; version: number }>) { if (!parsed.success) return invalid(parsed.error.flatten().fieldErrors); const context = await workflowContext(); if (!context.ok||!await context.authorizeOpportunity(parsed.data.opportunityId,operation))return failure("OPPORTUNITY_ACCESS_DENIED","You are not authorized to manage opportunities."); try { const opportunity = await command(context, parsed.data); revalidate(opportunity.id.value); return { ok: true as const, data: { opportunityId: opportunity.id.value, aggregateVersion: opportunity.version } }; } catch (error) { return mapError(error); } }
function revalidate(id: string) { revalidatePath("/dashboard/investments/portfolio"); revalidatePath(`/dashboard/investments/portfolio/${id}`); revalidatePath(`/dashboard/investments/portfolio/${id}/analyses`); }
function invalid(errors: Record<string, string[] | undefined>): WorkflowFailure { return { ok: false, code: "INVALID_INPUT", message: "Review the highlighted fields.", fieldErrors: Object.fromEntries(Object.entries(errors).filter((entry): entry is [string, string[]] => Boolean(entry[1]))) }; }
function failure(code: string, message: string, currentVersion?: number): WorkflowFailure { return { ok: false, code, message, ...(currentVersion ? { currentVersion } : {}) }; }
function mapError(error: unknown): WorkflowFailure { if (error instanceof InvestmentOpportunityError) { const messages: Record<string, string> = { ANALYSIS_ALREADY_SAVED: "This analysis was already saved. Opening the saved opportunity.", CONCURRENT_OPPORTUNITY_MODIFICATION: "This opportunity changed in another session. Refresh and try again.", OPPORTUNITY_ARCHIVED: "Restore the opportunity before adding another analysis.", ANALYSIS_INVALID: "This analysis cannot be added because the acquisition routes or property identities do not match." }; return failure(error.code, messages[error.code] ?? error.message); } return failure("OPPORTUNITY_PERSISTENCE_FAILED", "The opportunity could not be saved. No partial record was created."); }
async function commandHash(value: unknown) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))); return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
