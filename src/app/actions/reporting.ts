"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceAccessContext, SupabaseTeamAccessRepository } from "@/features/workspace";
import { getCommerceAccessWorkspace } from "./commerce-access";
import { getInvestmentScenarioWorkspaceRequest } from "./investment-scenario-runtime";
import { getInvestmentScenarioLearningRequest } from "./investment-scenario-learning-runtime";
import { compareInvestmentScenarios, readImmutableAnalysis } from "@/features/investment-opportunity";
import { getInvestmentOpportunityRequestContext } from "./investment-opportunity-runtime";
import { getFinancialOverviewRouteState } from "./financial-overview-runtime";
import { getPortfolioOverviewRouteState } from "./portfolio-overview-runtime";
import { getAnalyticsDashboardProjection } from "@/features/analytics";
import {
  assertSharingAllowed,
  compareReportProjections,
  createGeneratedReport,
  getReportDefinition,
  renderReportHtml,
  renderSimpleReportPdf,
  reportDefinitions,
  validateReportProjection,
  validateReportRequest,
  type ReportConfidence,
  type ReportFreshness,
  type ReportMetric,
  type ReportPeriod,
  type ReportProjection,
  type ReportRequest,
  type ReportScope,
  type ReportSectionSnapshot,
  type ReportTemplate,
  type ReportType,
} from "@/platform/reporting";

export type ReportShareActionState = Readonly<{ ok: boolean; message: string; url?: string }>;

export type ReportPreflightState = "ready" | "missing-source-data" | "insufficient-permission" | "missing-entitlement" | "unsupported-scope" | "projection-unavailable" | "configuration-incomplete" | "provider-unavailable";

export async function getReportWorkspace(filters?: Readonly<{ status?: string; type?: string; shared?: string; q?: string; page?: number }>) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const page = Math.max(1, filters?.page ?? 1), pageSize = 25, from = (page - 1) * pageSize;
  let reportsQuery = client.from("generated_reports")
    .select("id,report_number,report_type,status,title,confidence,freshness,version_number,generated_at,scope_snapshot,period_snapshot,report_artifacts(id,artifact_type,status)", { count: "exact" })
    .order("generated_at", { ascending: false }).range(from, from + pageSize - 1);
  if (filters?.status && filters.status !== "all") reportsQuery = reportsQuery.eq("status", filters.status);
  else reportsQuery = reportsQuery.neq("status", "archived");
  if (filters?.type && filters.type !== "all") reportsQuery = reportsQuery.eq("report_type", filters.type);
  if (filters?.q?.trim()) reportsQuery = reportsQuery.or(`title.ilike.%${safeSearch(filters.q)}%,report_number.ilike.%${safeSearch(filters.q)}%`);
  const [{ data, count }, { data: jobs }] = await Promise.all([
    reportsQuery,
    client.from("report_generation_jobs")
      .select("id,status,stage,failure_code,failure_message,created_at,report_request_id,report_requests!inner(report_type,title,workspace_id)")
      .in("status", ["queued", "processing", "failed"]).order("created_at", { ascending: false }).limit(25),
  ]);
  return Object.freeze({ reports: data ?? [], jobs: jobs ?? [], total: count ?? 0, page, pageSize, evaluatedAt: new Date().toISOString() });
}

export async function getReportComposerContext(input?: Readonly<{ workspaceId?: string; reportType?: string; sourceId?: string; scenarioId?: string; analysisVersionId?:string }>) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return Object.freeze({ state: "insufficient-permission" as ReportPreflightState, message: "Sign in to create a report.", nextAction: "/login" });
  try {
    const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, input?.workspaceId);
    const commerce = await getCommerceAccessWorkspace();
    const [{ data: properties }, { data: opportunities }] = await Promise.all([
      client.from("properties").select("id,name,status").eq("owner_id", access.ownerId).order("name").limit(500),
      client.from("investment_opportunities").select("id,name,status").eq("workspace_id", access.workspaceId).order("updated_at", { ascending: false }).limit(200),
    ]);
    const entitlements = new Set((commerce?.entitlements ?? []).filter(item => item.status === "available").map(item => item.key));
    const definitions = reportDefinitions.map(definition => Object.freeze({
      key: definition.key, name: definition.name, description: definition.description,
      requiredSections: definition.requiredSections, optionalSections: definition.optionalSections,
      enabled: entitlements.has(definition.requiredEntitlementKey),
      blockingReason: entitlements.has(definition.requiredEntitlementKey) ? undefined : "Your current plan does not include this report type.",
    }));
    const selected = getReportDefinition((input?.reportType ?? "portfolio-performance") as ReportType);
    const scenarioWorkspace=selected?.key==="investment-decision"&&input?.sourceId?await getInvestmentScenarioWorkspaceRequest(input.sourceId):null;
    const selectedScenario=input?.scenarioId??(scenarioWorkspace?.ok?scenarioWorkspace.workspace.preferredScenario?.id:undefined);
    const{data:versions}=selected?.key==="investment-decision"&&input?.sourceId?await client.from("investment_opportunity_analyses").select("id,sequence,created_at").eq("opportunity_id",input.sourceId).order("sequence",{ascending:false}):{data:[]};
    const selectedAnalysisVersion=input?.analysisVersionId??(selectedScenario&&scenarioWorkspace?.ok?scenarioWorkspace.workspace.scenarios.find(item=>item.id===selectedScenario)?.sourceAnalysisVersionId:undefined);
    const state: ReportPreflightState = !selected ? "unsupported-scope"
      : !entitlements.has(selected.requiredEntitlementKey) ? "missing-entitlement"
      : selected.key === "property-performance" && !input?.sourceId ? "configuration-incomplete"
      : selected.key === "investment-decision" && (!input?.sourceId || !selectedAnalysisVersion) ? "configuration-incomplete"
      : "ready";
    return Object.freeze({
      state, workspaceId: access.workspaceId, role: access.role, definitions,
      properties: properties ?? [], opportunities: opportunities ?? [],
      scenarios:scenarioWorkspace?.ok?scenarioWorkspace.workspace.activeScenarios.map(item=>({id:item.id,name:item.name,preferred:item.preferred,version:item.metadataRevision??1})):[],
      versions:(versions??[]).map(item=>({id:item.id,sequence:item.sequence,createdAt:item.created_at})),
      selectedAnalysisVersion,
      selectedScenario,
      selectedType: selected?.key ?? "portfolio-performance",
      message: preflightMessage(state), nextAction: state === "missing-entitlement" ? "/dashboard/billing" : undefined,
      evaluatedAt: new Date().toISOString(),
    });
  } catch {
    return Object.freeze({ state: "insufficient-permission" as ReportPreflightState, message: "You do not have access to a reporting workspace.", nextAction: "/dashboard" });
  }
}

export async function getGeneratedReportView(reportId: string) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || !reportId.startsWith("report-")) return null;
  const { data: report } = await client.from("generated_reports").select("*").eq("id", reportId).maybeSingle();
  if (!report) return null;
  if(report.report_type==="investment-decision"&&report.opportunity_id){const context=await getInvestmentOpportunityRequestContext();if(!context.ok||!await context.authorizeOpportunity(report.opportunity_id,"report.read",report.analysis_version_id??undefined))return null;}
  const [{ data: artifacts }, { data: artifactJobs }, { data: shares }, { data: activity }, { data: versions }] = await Promise.all([
    client.from("report_artifacts").select("id,artifact_type,status,size_bytes,checksum,renderer_version,created_at").eq("report_id", reportId).order("created_at", { ascending: false }),
    client.from("report_artifact_jobs").select("id,artifact_type,status,attempts,idempotency_key,renderer_version,failure_code,failure_message,retryable,created_at,completed_at").eq("report_id", reportId).order("created_at", { ascending: false }).limit(50),
    client.from("report_shares").select("id,status,access_mode,expires_at,max_views,view_count,download_count,recipient_label,watermark,confidentiality_level,created_at,last_viewed_at,revoked_at").eq("report_id", reportId).order("created_at", { ascending: false }),
    client.from("report_activity").select("id,event_type,safe_summary,resulting_state,occurred_at").eq("report_id", reportId).order("occurred_at", { ascending: false }),
    client.from("generated_reports").select("id,report_number,title,status,version_number,generated_at,confidence,freshness,supersedes_report_id").eq("workspace_id",report.workspace_id).eq("series_key",report.series_key).order("version_number",{ascending:false}),
  ]);
  return Object.freeze({ report, artifacts: artifacts ?? [], artifactJobs: artifactJobs ?? [], shares: shares ?? [], activity: activity ?? [], versions: versions ?? [] });
}

export async function getReportComparisonWorkspace(reportA?:string,reportB?:string){
  const client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)return null;
  const{data:reports}=await client.from("generated_reports").select("id,report_number,title,report_type,series_key,version_number,status,generated_at,projection_snapshot").order("generated_at",{ascending:false}).limit(500);
  const a=reports?.find(item=>item.id===reportA),b=reports?.find(item=>item.id===reportB);
  const comparison=a&&b&&a.series_key===b.series_key?compareReportProjections(a.projection_snapshot as ReportProjection,b.projection_snapshot as ReportProjection):null;
  return Object.freeze({reports:reports??[],selectedA:a?.id,selectedB:b?.id,comparison,error:a&&b&&!comparison?"Reports must belong to the same history series.":undefined});
}

export async function getExecutiveReportWorkspace(workspaceId?:string){
  const client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)return null;
  const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,workspaceId);
  const[{data:reports},{data:collections},{data:jobs}]=await Promise.all([
    client.from("generated_reports").select("id,report_number,report_type,title,status,version_number,confidence,freshness,generated_at,scope_snapshot,report_artifacts(id,artifact_type,status),report_shares(id,status)").eq("workspace_id",access.workspaceId).order("generated_at",{ascending:false}).limit(100),
    client.from("report_collections").select("id,name,description,collection_type,status,updated_at,report_collection_items(id,report_id,position)").eq("workspace_id",access.workspaceId).order("updated_at",{ascending:false}).limit(50),
    client.from("report_artifact_jobs").select("id,report_id,artifact_type,status,failure_message,created_at").in("status",["queued","rendering","validating","storing","failed"]).order("created_at",{ascending:false}).limit(25),
  ]);
  return Object.freeze({workspaceId:access.workspaceId,reports:reports??[],collections:collections??[],jobs:jobs??[]});
}

export async function createReportCollectionAction(formData:FormData){
  const client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)throw new Error("report_permission_denied");
  const access=await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(),user.id,String(formData.get("workspaceId")??"")||undefined);
  const name=String(formData.get("name")??"").trim().slice(0,160);if(!name)throw new Error("report_scope_invalid");
  const allowed=["investor-due-diligence","monthly-operations","quarterly-executive-review","board-meeting","acquisition-package","custom"],type=allowed.includes(String(formData.get("collectionType")))?String(formData.get("collectionType")):"custom";
  const id=`report-collection-${crypto.randomUUID()}`,admin=createAdminClient();
  await admin.from("report_collections").insert({id,workspace_id:access.workspaceId,name,description:String(formData.get("description")??"").trim().slice(0,500)||null,collection_type:type,status:"draft",created_by_profile_id:user.id});
  revalidatePath("/dashboard/reports/executive");redirect(`/dashboard/reports/executive?collection=${id}`);
}

export async function addReportToCollectionAction(formData:FormData){
  const collectionId=String(formData.get("collectionId")??""),reportId=String(formData.get("reportId")??""),client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)throw new Error("report_permission_denied");
  const[{data:collection},{data:report}]=await Promise.all([client.from("report_collections").select("id,workspace_id").eq("id",collectionId).maybeSingle(),client.from("generated_reports").select("id,workspace_id").eq("id",reportId).maybeSingle()]);
  if(!collection||!report||collection.workspace_id!==report.workspace_id)throw new Error("report_permission_denied");
  const admin=createAdminClient(),{count}=await admin.from("report_collection_items").select("id",{count:"exact",head:true}).eq("collection_id",collectionId);
  await admin.from("report_collection_items").upsert({id:`report-collection-item-${crypto.randomUUID()}`,collection_id:collectionId,report_id:reportId,position:count??0,added_by_profile_id:user.id},{onConflict:"collection_id,report_id",ignoreDuplicates:true});
  await admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:reportId,workspace_id:report.workspace_id,actor_profile_id:user.id,event_type:"report-added-to-collection",safe_summary:"Immutable report referenced by an executive collection.",resulting_state:"collected",occurred_at:new Date().toISOString()});
  revalidatePath("/dashboard/reports/executive");
}

export async function generateReportAction(formData: FormData) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("report_permission_denied");
  const access = await getCommerceAccessWorkspace();
  if (!access) throw new Error("report_permission_denied");
  const reportType = String(formData.get("reportType") ?? "") as ReportType;
  const definition = getReportDefinition(reportType);
  if (!definition) throw new Error("report_definition_not_found");
  const requestedWorkspaceId = String(formData.get("workspaceId") ?? "");
  const workspaceAccess = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, requestedWorkspaceId || undefined);
  const workspaceId = workspaceAccess.workspaceId;
  const idempotencyKey = String(formData.get("idempotencyKey") ?? crypto.randomUUID());
  const admin = createAdminClient();
  const { data: duplicateRequest } = await admin.from("report_requests").select("id,status").eq("workspace_id", workspaceId).eq("idempotency_key", idempotencyKey).maybeSingle();
  if (duplicateRequest) {
    const { data: duplicateReport } = await admin.from("generated_reports").select("id").eq("report_request_id", duplicateRequest.id).maybeSingle();
    redirect(duplicateReport ? `/dashboard/reports/${duplicateReport.id}` : "/dashboard/reports");
  }
  const sourceId = String(formData.get("sourceId") ?? "");
  let scenarioId = String(formData.get("scenarioId") ?? "");
  let analysisVersionId=String(formData.get("analysisVersionId")??"");
  const requestedComparisonIds=String(formData.get("comparisonScenarioIds")??"").split(",").map(value=>value.trim()).filter(Boolean);
  let scenarioIdentity:{name:string;version:number;analysisVersionId:string;notes?:string}|undefined;
  if(reportType==="investment-decision"){const scenarioWorkspace=await getInvestmentScenarioWorkspaceRequest(sourceId);if(!scenarioWorkspace.ok)throw new Error("report_source_not_ready");const selectedScenario=scenarioId?scenarioWorkspace.workspace.scenarios.find(item=>item.id===scenarioId):undefined;if(requestedComparisonIds.length&&(requestedComparisonIds.length<2||requestedComparisonIds.length>4||new Set(requestedComparisonIds).size!==requestedComparisonIds.length||requestedComparisonIds.some(id=>!scenarioWorkspace.workspace.scenarios.some(item=>item.id===id))))throw new Error("report_comparison_invalid");if(selectedScenario){scenarioId=selectedScenario.id;if(analysisVersionId&&analysisVersionId!==selectedScenario.sourceAnalysisVersionId)throw new Error("report_source_lineage_mismatch");analysisVersionId=selectedScenario.sourceAnalysisVersionId;scenarioIdentity={name:selectedScenario.name,version:selectedScenario.metadataRevision??1,analysisVersionId,...(selectedScenario.notes?{notes:selectedScenario.notes}:{})};}if(!analysisVersionId)throw new Error("report_source_not_ready");const immutableContext=await getInvestmentOpportunityRequestContext();if(!immutableContext.ok||immutableContext.workspaceId!==workspaceId||!await immutableContext.authorizeOpportunity(sourceId,"report.generate",analysisVersionId)||!await readImmutableAnalysis(immutableContext.repository,{ownerId:immutableContext.ownerId,opportunityId:sourceId,analysisVersionId}))throw new Error("report_source_not_ready");}
  const scope = scopeFor(reportType, workspaceId, sourceId, analysisVersionId,scenarioId,scenarioIdentity?.name);
  const period = periodFor(reportType, String(formData.get("periodPreset") ?? "current-month"));
  const requestId = `report-request-${crypto.randomUUID()}`;
  const template = templateFor(reportType);
  const request: ReportRequest = Object.freeze({
    id: requestId, workspaceId, requestedByProfileId: user.id, reportType, scope,
    ...(period ? { period } : {}), sourceContext: Object.freeze(sourceContext(reportType, sourceId,analysisVersionId, scenarioId,scenarioIdentity,requestedComparisonIds)),
    templateId: template.id, title: String(formData.get("title") ?? "").trim() || undefined,
    subtitle: String(formData.get("subtitle") ?? "").trim() || undefined,
    sectionConfiguration: Object.freeze([]), status: "generating", idempotencyKey, createdAt: new Date().toISOString(),
  });
  const allowed = access.entitlements.some((item) => item.key === definition.requiredEntitlementKey && item.status === "available");
  validateReportRequest({ request, template, authorizedWorkspaceId: workspaceAccess.workspaceId, hasEntitlement: allowed });
  const projection = validateReportProjection(await buildProjection(request), definition);
  const jobId = `report-job-${crypto.randomUUID()}`;
  const entitlementVersion = access.version;
  const { error: requestError } = await admin.from("report_requests").insert(toRequestRow(request, entitlementVersion));
  if (requestError) throw new Error("report_generation_conflict");
  await admin.from("report_generation_jobs").insert({ id: jobId, report_request_id: requestId, status: "processing", stage: "projection", attempts: 1, idempotency_key: `generation:${request.idempotencyKey}`, locked_at: new Date().toISOString(), locked_by: `request:${user.id}`, lease_expires_at: new Date(Date.now() + 120_000).toISOString(), started_at: new Date().toISOString() });
  try {
    const { data: reportNumber, error: numberError } = await admin.rpc("next_report_number", { p_report_type: reportType });
    if (numberError || !reportNumber) throw new Error("report_generation_failed");
    const reportId = `report-${crypto.randomUUID()}`;
    const generatedAt = new Date().toISOString();
    const seriesKey = `${reportType}:${sourceId || workspaceId}`;
    const { data: prior } = await admin.from("generated_reports").select("id,version_number,status").eq("workspace_id", workspaceId).eq("series_key", seriesKey).order("version_number", { ascending: false }).limit(1).maybeSingle();
    const report = createGeneratedReport({ id: reportId, reportNumber, request, projection, template, versionNumber: (prior?.version_number ?? 0) + 1, seriesKey, supersedesReportId: prior?.id, generatedAt });
    const snapshot = JSON.stringify(report.projectionSnapshot);
    const { error: reportError } = await admin.from("generated_reports").insert({
      id: report.id, report_number: report.reportNumber, report_request_id: requestId, workspace_id: workspaceId,
      generated_by_profile_id: user.id, report_type: reportType, status: "generated", title: report.title, subtitle: report.subtitle,
      scope_type: scope.type, property_id: scope.propertyId, opportunity_id: scope.opportunityId, scenario_id: scope.scenarioId, analysis_version_id: scope.analysisVersionId,
      scope_snapshot: scope, period_snapshot: period, source_context_snapshot: request.sourceContext,
      projection_snapshot: report.projectionSnapshot, snapshot_schema_version: report.snapshotSchemaVersion,
      snapshot_size_bytes: new TextEncoder().encode(snapshot).byteLength, template_id: template.id, template_version: template.version,
      projection_version: projection.projectionVersion, source_versions: projection.sourceVersions, confidence: projection.confidence,
      freshness: projection.freshness, series_key: seriesKey, version_number: report.versionNumber,
      supersedes_report_id: report.supersedesReportId, generated_at: generatedAt,
    });
    if (reportError) throw new Error("report_generation_failed");
    if (prior && prior.status !== "archived" && prior.status !== "superseded") {
      await admin.from("generated_reports").update({ status: "superseded" }).eq("id", prior.id);
    }
    await Promise.all([
      admin.from("report_requests").update({ status: "completed", updated_at: generatedAt }).eq("id", requestId),
      admin.from("report_generation_jobs").update({ status: "completed", stage: "completed", generated_report_id: reportId, completed_at: generatedAt, lease_expires_at: null }).eq("id", jobId),
      admin.from("report_activity").insert({ id: `report-activity-${crypto.randomUUID()}`, report_request_id: requestId, report_id: reportId, job_id: jobId, workspace_id: workspaceId, actor_profile_id: user.id, event_type: "report-generated", safe_summary: "Immutable report snapshot and required artifacts generated.", resulting_state: "generated", occurred_at: generatedAt }),
    ]);
    revalidatePath("/dashboard/reports");
    redirect(`/dashboard/reports/${reportId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "report_unexpected";
    await Promise.all([
      admin.from("report_requests").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", requestId),
      admin.from("report_generation_jobs").update({ status: "failed", failure_code: message, failure_message: "Report generation requires operational review.", lease_expires_at: null }).eq("id", jobId),
    ]);
    throw error;
  }
}

export async function downloadReportArtifact(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  const type = String(formData.get("artifactType") ?? "pdf");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("report_permission_denied");
  const access = await getCommerceAccessWorkspace();
  if (!access?.entitlements.some(item => item.key === "reports.download" && item.status === "available")) throw new Error("report_entitlement_required");
  const { data: artifact } = await client.from("report_artifacts").select("id,storage_path").eq("report_id", reportId).eq("artifact_type", type).eq("status", "active").maybeSingle();
  if (!artifact) throw new Error("report_artifact_not_found");
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("report-artifacts").createSignedUrl(artifact.storage_path, 300, { download: type === "pdf" });
  if (error || !data?.signedUrl) throw new Error("report_storage_failed");
  const { data: report } = await client.from("generated_reports").select("workspace_id").eq("id", reportId).maybeSingle();
  if (report) await admin.from("report_activity").insert({ id: `report-activity-${crypto.randomUUID()}`, report_id: reportId, workspace_id: report.workspace_id, actor_profile_id: user.id, event_type: "artifact-downloaded", safe_summary: `${type.toUpperCase()} artifact downloaded through authorized short-lived access.`, resulting_state: "active", occurred_at: new Date().toISOString() });
  redirect(data.signedUrl);
}

export async function publishReportArtifactsAction(formData: FormData) {
  const reportId=String(formData.get("reportId")??""),requested=String(formData.get("artifactType")??"both");
  const types:readonly ("html"|"pdf")[]=requested==="html"?["html"]:requested==="pdf"?["pdf"]:["html","pdf"];
  const commandId=String(formData.get("commandId")??crypto.randomUUID());
  const client=await createClient(),{data:{user}}=await client.auth.getUser();
  if(!user)throw new Error("report_permission_denied");
  const access=await getCommerceAccessWorkspace();
  if(!access?.entitlements.some(item=>item.key==="reports.download"&&item.status==="available"))throw new Error("report_entitlement_required");
  const{data:report}=await client.from("generated_reports").select("*").eq("id",reportId).maybeSingle();
  if(!report||report.status==="archived")throw new Error("report_permission_denied");
  const admin=createAdminClient(),{data:templateRow}=await admin.from("report_templates").select("*").eq("id",report.template_id).eq("version",report.template_version).maybeSingle();
  if(!templateRow)throw new Error("report_template_not_found");
  const template=templateFromRow(templateRow),projection=report.projection_snapshot as ReportProjection;
  for(const type of types)await publishArtifact({admin,report,projection,template,type,userId:user.id,commandId});
  revalidatePath("/dashboard/reports");revalidatePath(`/dashboard/reports/${reportId}`);
}

export async function archiveReportArtifactAction(formData:FormData){
  const reportId=String(formData.get("reportId")??""),artifactId=String(formData.get("artifactId")??"");
  const client=await createClient(),{data:{user}}=await client.auth.getUser();
  if(!user)throw new Error("report_permission_denied");
  const{data:report}=await client.from("generated_reports").select("workspace_id").eq("id",reportId).maybeSingle();
  const{data:artifact}=await client.from("report_artifacts").select("id,artifact_type,status").eq("id",artifactId).eq("report_id",reportId).maybeSingle();
  if(!report||!artifact||artifact.status!=="active")throw new Error("report_permission_denied");
  const admin=createAdminClient(),now=new Date().toISOString();
  await Promise.all([
    admin.from("report_artifacts").update({status:"archived"}).eq("id",artifactId).eq("status","active"),
    admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:reportId,workspace_id:report.workspace_id,actor_profile_id:user.id,event_type:"artifact-archived",safe_summary:`${artifact.artifact_type.toUpperCase()} artifact archived; the immutable report remains available.`,resulting_state:"archived",occurred_at:now}),
  ]);
  revalidatePath(`/dashboard/reports/${reportId}`);
}

export async function archiveReportAction(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  const next = String(formData.get("operation") ?? "") === "restore" ? "generated" : "archived";
  const client = await createClient();
  const { data: report } = await client.from("generated_reports").select("id,workspace_id,status").eq("id", reportId).maybeSingle();
  if (!report) throw new Error("report_permission_denied");
  const admin = createAdminClient();
  await admin.from("generated_reports").update({ status: next, archived_at: next === "archived" ? new Date().toISOString() : null }).eq("id", reportId);
  if(next==="archived")await Promise.all([
    admin.from("report_artifacts").update({status:"archived"}).eq("report_id",reportId).eq("status","active"),
    admin.from("report_shares").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("report_id",reportId).eq("status","active"),
  ]);
  await admin.from("report_activity").insert({ id: `report-activity-${crypto.randomUUID()}`, report_id: reportId, workspace_id: report.workspace_id, event_type: next === "archived" ? "report-archived" : "report-restored", safe_summary: `Report ${next}.`, resulting_state: next, occurred_at: new Date().toISOString() });
  revalidatePath("/dashboard/reports");
  revalidatePath(`/dashboard/reports/${reportId}`);
}

export async function createReportShareAction(_state: ReportShareActionState, formData: FormData): Promise<ReportShareActionState> {
  const reportId = String(formData.get("reportId") ?? "");
  const accessMode = String(formData.get("accessMode") ?? "view") === "view-and-download" ? "view-and-download" : "view";
  const expiresInDays = Math.min(90, Math.max(1, Number(formData.get("expiresInDays") ?? 7)));
  const maxViews = Math.min(1000, Math.max(1, Number(formData.get("maxViews") ?? 25)));
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { ok: false, message: "Permission denied." };
  const commerce=await getCommerceAccessWorkspace();
  if(!commerce?.entitlements.some(item=>item.key==="reports.share"&&item.status==="available"))return{ok:false,message:"Your current access does not include external report sharing."};
  const { data: report } = await client.from("generated_reports").select("id,report_type,workspace_id,status").eq("id", reportId).maybeSingle();
  if (!report || report.status!=="published") return { ok: false, message: "Only published reports can be shared." };
  try { assertSharingAllowed(report.report_type as ReportType, true); } catch { return { ok: false, message: "External sharing is disabled for this report type." }; }
  const admin = createAdminClient();
  const{data:policy}=await admin.from("report_sharing_policies").select("*").eq("workspace_id",report.workspace_id).eq("report_type",report.report_type).maybeSingle();
  if(policy?.external_access==="internal-only")return{ok:false,message:"Workspace policy limits this report type to internal access."};
  if(policy&&!policy.allowed_access_modes.includes(accessMode))return{ok:false,message:"Workspace policy does not allow the selected access mode."};
  const rawToken = `${crypto.randomUUID().replaceAll("-","")}${crypto.randomUUID().replaceAll("-","")}`;
  const tokenHash = await checksum(new TextEncoder().encode(rawToken));
  const shareId = `report-share-${crypto.randomUUID()}`;
  const policyDays=policy?.maximum_expiration_days??90,expiresAt = new Date(Date.now() + Math.min(expiresInDays,policyDays) * 86_400_000).toISOString();
  const recipientLabel=String(formData.get("recipientLabel")??"").trim().slice(0,120),notes=String(formData.get("notes")??"").trim().slice(0,1000),watermark=String(formData.get("watermark")??"").trim().slice(0,120);
  if(policy?.require_recipient_label&&!recipientLabel)return{ok:false,message:"Workspace policy requires a recipient label."};
  const confidentiality=["standard","confidential","strictly-confidential"].includes(String(formData.get("confidentiality")))?String(formData.get("confidentiality")):"confidential";
  const { error } = await admin.from("report_shares").insert({ id: shareId, report_id: reportId, created_by_profile_id: user.id, token_hash: tokenHash, status: "active", access_mode: accessMode, expires_at: expiresAt, max_views: maxViews,recipient_label:recipientLabel||null,notes:notes||null,watermark:watermark||null,confidentiality_level:confidentiality });
  if (error) return { ok: false, message: "Secure share could not be created." };
  await admin.from("report_activity").insert({ id: `report-activity-${crypto.randomUUID()}`, report_id: reportId, share_id: shareId, workspace_id: report.workspace_id, actor_profile_id: user.id, event_type: "report-shared", safe_summary: `Secure ${accessMode} share created with expiration and view limit.`, resulting_state: "published", occurred_at: new Date().toISOString() });
  revalidatePath(`/dashboard/reports/${reportId}/share`);
  return { ok: true, message: "Secure share created. Copy this link now; the token is not stored.", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reports/shared/${rawToken}` };
}

export async function revokeReportShareAction(formData: FormData) {
  const shareId = String(formData.get("shareId") ?? "");
  const reportId = String(formData.get("reportId") ?? "");
  const client = await createClient();
  const { data: { user } }=await client.auth.getUser();
  const { data: share } = await client.from("report_shares").select("id,report_id,generated_reports(workspace_id)").eq("id", shareId).eq("report_id", reportId).maybeSingle();
  if (!share) throw new Error("report_permission_denied");
  const admin = createAdminClient();
  const now=new Date().toISOString();
  await Promise.all([
    admin.from("report_shares").update({ status: "revoked", revoked_at: now }).eq("id", shareId).eq("status", "active"),
    admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:reportId,share_id:shareId,workspace_id:(share.generated_reports as unknown as {workspace_id:string}).workspace_id,actor_profile_id:user?.id,event_type:"share-revoked",safe_summary:"External report share revoked immediately.",resulting_state:"revoked",occurred_at:now}),
  ]);
  revalidatePath(`/dashboard/reports/${reportId}/share`);
}

export async function regenerateReportShareAction(_state:ReportShareActionState,formData:FormData):Promise<ReportShareActionState>{
  const shareId=String(formData.get("shareId")??""),reportId=String(formData.get("reportId")??"");
  const client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)return{ok:false,message:"Permission denied."};
  const commerce=await getCommerceAccessWorkspace();if(!commerce?.entitlements.some(item=>item.key==="reports.share"&&item.status==="available"))return{ok:false,message:"Sharing access is required."};
  const{data:share}=await client.from("report_shares").select("*,generated_reports!inner(workspace_id,status)").eq("id",shareId).eq("report_id",reportId).maybeSingle();
  if(!share||share.status!=="active"||!["published","superseded"].includes((share.generated_reports as unknown as {status:string}).status))return{ok:false,message:"This share can no longer be regenerated."};
  const rawToken=`${crypto.randomUUID().replaceAll("-","")}${crypto.randomUUID().replaceAll("-","")}`,tokenHash=await checksum(new TextEncoder().encode(rawToken)),newId=`report-share-${crypto.randomUUID()}`,now=new Date().toISOString(),admin=createAdminClient();
  const{error}=await admin.from("report_shares").insert({id:newId,report_id:reportId,created_by_profile_id:user.id,token_hash:tokenHash,status:"active",access_mode:share.access_mode,expires_at:share.expires_at,max_views:share.max_views,recipient_label:share.recipient_label,notes:share.notes,watermark:share.watermark,confidentiality_level:share.confidentiality_level});
  if(error)return{ok:false,message:"A replacement share could not be created."};
  await Promise.all([
    admin.from("report_shares").update({status:"revoked",revoked_at:now}).eq("id",shareId).eq("status","active"),
    admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:reportId,share_id:newId,workspace_id:(share.generated_reports as unknown as {workspace_id:string}).workspace_id,actor_profile_id:user.id,event_type:"share-link-regenerated",safe_summary:"Share link regenerated; the prior token was revoked immediately.",resulting_state:"active",occurred_at:now}),
  ]);
  revalidatePath(`/dashboard/reports/${reportId}/share`);
  return{ok:true,message:"Replacement link created. Copy it now; the token is not stored.",url:`${process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000"}/reports/shared/${rawToken}`};
}

export async function resolveSharedReport(rawToken: string) {
  if (!/^[a-f0-9]{64}$/.test(rawToken)) return Object.freeze({unavailable:true as const});
  const admin = createAdminClient();
  const tokenHash = await checksum(new TextEncoder().encode(rawToken));
  const { data: share } = await admin.from("report_shares").select("id,report_id,status,access_mode,expires_at,max_views,view_count,recipient_label,watermark,confidentiality_level").eq("token_hash", tokenHash).maybeSingle();
  const now = new Date();
  if (!share || share.status !== "active" || (share.expires_at && new Date(share.expires_at) <= now) || (share.max_views !== null && share.view_count >= share.max_views)) {
    return Object.freeze({unavailable:true as const});
  }
  const { data: report } = await admin.from("generated_reports").select("id,report_number,report_type,title,subtitle,status,scope_snapshot,period_snapshot,projection_snapshot,confidence,freshness,generated_at,template_version,projection_version,version_number").eq("id", share.report_id).maybeSingle();
  if (!report || !["published","superseded"].includes(report.status)) return Object.freeze({unavailable:true as const});
  const{data:reportContext}=await admin.from("generated_reports").select("workspace_id").eq("id",share.report_id).single();
  if(!reportContext)return Object.freeze({unavailable:true as const});
  await Promise.all([
    admin.from("report_shares").update({ view_count: share.view_count + 1, last_viewed_at: now.toISOString() }).eq("id", share.id).eq("view_count", share.view_count),
    admin.from("report_share_access").insert({ id: `report-share-access-${crypto.randomUUID()}`, share_id: share.id, access_type: "view", result: "allowed", accessed_at: now.toISOString() }),
    admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:share.report_id,share_id:share.id,workspace_id:reportContext.workspace_id,event_type:"share-viewed",safe_summary:"External recipient viewed the governed report share.",resulting_state:"viewed",occurred_at:now.toISOString()}),
  ]);
  return Object.freeze({ unavailable:false as const,report,share:{recipientLabel:share.recipient_label,watermark:share.watermark,confidentiality:share.confidentiality_level}, canDownload: share.access_mode === "view-and-download" });
}

export async function downloadSharedReportArtifact(formData:FormData){
  const rawToken=String(formData.get("token")??"");
  const resolved=await resolveSharedReport(rawToken);
  if(resolved.unavailable||!resolved.canDownload)throw new Error("report_share_not_allowed");
  const admin=createAdminClient(),tokenHash=await checksum(new TextEncoder().encode(rawToken));
  const{data:share}=await admin.from("report_shares").select("id,report_id,download_count").eq("token_hash",tokenHash).eq("status","active").maybeSingle();
  if(!share)throw new Error("report_share_revoked");
  const{data:artifact}=await admin.from("report_artifacts").select("id,storage_path").eq("report_id",share.report_id).eq("artifact_type","pdf").eq("status","active").maybeSingle();
  if(!artifact)throw new Error("report_artifact_not_found");
  const{data:url,error}=await admin.storage.from("report-artifacts").createSignedUrl(artifact.storage_path,120,{download:true});
  if(error||!url?.signedUrl)throw new Error("report_storage_failed");
  const now=new Date().toISOString();
  const{data:reportContext}=await admin.from("generated_reports").select("workspace_id").eq("id",share.report_id).single();
  if(!reportContext)throw new Error("report_share_not_allowed");
  await Promise.all([
    admin.from("report_shares").update({download_count:share.download_count+1}).eq("id",share.id).eq("download_count",share.download_count),
    admin.from("report_share_access").insert({id:`report-share-access-${crypto.randomUUID()}`,share_id:share.id,access_type:"download",result:"allowed",accessed_at:now}),
    admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:share.report_id,share_id:share.id,workspace_id:reportContext.workspace_id,event_type:"share-artifact-downloaded",safe_summary:"External recipient downloaded the active PDF artifact.",resulting_state:"downloaded",occurred_at:now}),
  ]);
  redirect(url.signedUrl);
}

export async function retryReportJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const client = await createClient();
  const { data: admin } = await client.rpc("is_admin");
  if (admin !== true) throw new Error("report_permission_denied");
  const { data: job } = await client.from("report_generation_jobs").select("id,status,generated_report_id,failure_code").eq("id", jobId).maybeSingle();
  if (!job || job.status !== "failed" || ["report_permission_denied","report_entitlement_required","report_scope_invalid","report_projection_invalid"].includes(job.failure_code ?? "")) throw new Error("report_generation_conflict");
  const service = createAdminClient();
  await service.from("report_generation_jobs").update({ status: "queued", stage: job.generated_report_id ? "pdf" : "projection", failure_code: null, failure_message: null, locked_at: null, locked_by: null, lease_expires_at: null }).eq("id", jobId).eq("status", "failed");
  revalidatePath("/admin/reports/jobs");
  revalidatePath("/admin/reports/health");
}

async function buildProjection(request: ReportRequest): Promise<ReportProjection> {
  const builders:Record<ReportType,(value:ReportRequest)=>Promise<ReportProjection>>={"investment-decision":investmentProjection,"property-performance":propertyProjection,"portfolio-performance":portfolioProjection,"financial-performance":financialProjection};
  return builders[request.reportType](request);
}

async function propertyProjection(request:ReportRequest):Promise<ReportProjection>{
  const propertyId=request.scope.propertyId;if(!propertyId||!request.period?.start)throw new Error("report_source_not_ready");
  const analytics=await getAnalyticsDashboardProjection({propertyId,startDate:request.period.start,endDate:request.period.end});
  if(!analytics.selectedProperty)throw new Error("report_source_not_ready");
  const m=analytics.metrics,hasEvidence=analytics.bookings.length>0,confidenceValue:ReportConfidence=hasEvidence?"moderate":"insufficient-evidence",freshnessValue:ReportFreshness=hasEvidence?"current":"partial";
  const currency=(value:number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);
  const metrics=[metric("revenue","Revenue",currency(m.grossRevenue),hasEvidence?"actual":"unavailable",m.grossRevenue),metric("occupancy","Occupancy",`${m.occupancyRate.toFixed(1)}%`,hasEvidence?"actual":"unavailable",m.occupancyRate),metric("adr","ADR",currency(m.averageDailyRate),hasEvidence?"actual":"unavailable",m.averageDailyRate),metric("revpar","RevPAR",currency(m.revPar),hasEvidence?"actual":"unavailable",m.revPar)];
  const findings=analytics.summaries.map(item=>item.description).join(" ")||"No measured performance findings are available for this period.";
  return projection(request,`${analytics.selectedProperty.name} — Property Performance`,findings,confidenceValue,freshnessValue,"analytics-property-projection.v1",[
    section("performance-summary","Executive Summary",findings,metrics,confidenceValue),
    section("revenue-metrics","Revenue, Occupancy, ADR, and RevPAR","Canonical measured property performance for the selected period.",metrics,confidenceValue),
    section("booking-trends","Booking Trends",`${m.totalBookings} bookings · ${m.completedBookings} completed · ${m.cancelledBookings} cancelled.`,[metric("bookings","Bookings",String(m.totalBookings),hasEvidence?"actual":"unavailable",m.totalBookings),metric("average-stay","Average Length of Stay",`${m.averageLengthOfStay.toFixed(1)} days`,hasEvidence?"actual":"unavailable",m.averageLengthOfStay)],confidenceValue),
    section("operational-attention","Operational Health and Recommendations",findings,[],confidenceValue),
    section("evidence-methodology","Guest Experience, Evidence, and Methodology",hasEvidence?"Performance uses completed and confirmed booking evidence. Guest-satisfaction evidence is unavailable in this projection and is not represented as zero.":"Booking and guest-experience evidence are unavailable for this period.",[],confidenceValue),
  ],analytics.generatedAt);
}

async function investmentProjection(request: ReportRequest): Promise<ReportProjection> {
  const result = await getInvestmentScenarioWorkspaceRequest(request.scope.opportunityId!);
  if (!result.ok) throw new Error("report_source_not_ready");
  const scenario = request.scope.scenarioId?result.workspace.scenarios.find((item) => item.id === request.scope.scenarioId):undefined;
  const context=await getInvestmentOpportunityRequestContext();
  if(!context.ok||context.workspaceId!==request.workspaceId)throw new Error("report_source_not_ready");
  const immutable=await readImmutableAnalysis(context.repository,{ownerId:context.ownerId,opportunityId:request.scope.opportunityId!,analysisVersionId:request.scope.analysisVersionId!});
  if(!immutable)throw new Error("report_source_not_ready");
  const snapshot = immutable.snapshot, confidenceLevel = confidence(snapshot.confidence.level);
  const comparisonIds=(request.sourceContext.comparedScenarioIds??"").split(",").filter(Boolean);
  const comparedScenarios=comparisonIds.flatMap(id=>{const item=result.workspace.scenarios.find(candidate=>candidate.id===id);return item?[item]:[]});
  const comparison=comparedScenarios.length>=2?compareInvestmentScenarios(comparedScenarios,new Date(snapshot.analyzedAt)):null;
  const learningResult=scenario?await getInvestmentScenarioLearningRequest(request.scope.opportunityId!,scenario.id):null;
  const learning=learningResult?.ok&&learningResult.projection?.state!=="no-outcome"?learningResult.projection:null;
  const money = (key: string, label: string, value?: { amount: number; currency: string }): ReportMetric => metric(key, label, value ? new Intl.NumberFormat("en-US", { style: "currency", currency: value.currency }).format(value.amount) : "Unavailable", "projected");
  const comparisonSection=comparison?section("scenario-comparison","Scenario Comparison",comparison.executiveSummary.decision,comparison.metrics.map(item=>metric(`comparison-${item.key}`,item.label,item.bestScenarioIds.length?`${comparedScenarios.find(scenario=>scenario.id===item.bestScenarioIds[0])?.name??"Unavailable"} leads`:"Unavailable",item.bestScenarioIds.length?"projected":"unavailable")),confidenceLevel,comparison.tradeoffs.map(item=>({Scenario:comparedScenarios.find(scenario=>scenario.id===item.scenarioId)?.name??"Unavailable",Benefits:item.benefits.join(" ")||"None identified",Tradeoffs:item.tradeoffs.join(" ")||"None identified",Risks:item.risks.join(" ")||"None identified"}))):null;
  return projection(request, `${result.workspace.opportunity.name} — Investment Decision`, comparison?.executiveSummary.decision??snapshot.recommendation.summary, confidenceLevel, snapshot.dataGaps.length ? "partial" : "current", request.scope.analysisVersionId!, [
    section("decision-summary","Decision Summary",snapshot.recommendation.summary,[metric("recommendation","Recommendation",snapshot.recommendation.recommendation.replaceAll("-"," "),"projected")],confidenceLevel),
    ...(comparisonSection?[comparisonSection]:[]),
    ...(learning?[section("scenario-learning","Historical Accuracy and Learning",learning.summary.overallLearning,learning.metrics.map(item=>metric(`learning-${item.key}`,item.label,item.percentageVariance===undefined?"Unavailable":`${item.percentageVariance>=0?"+":""}${item.percentageVariance.toFixed(1)}% variance`,item.actual===undefined?"unavailable":"actual")),confidenceLevel,learning.lessons.map(item=>({Category:item.category,Lesson:item.statement,Evidence:item.evidence.join(", ")||"Unavailable"})))]:[]),
    section("property-profile","Property Profile",result.workspace.opportunity.address,[],confidenceLevel),
    section("market-intelligence","Market Intelligence",`${snapshot.market.name}. ${snapshot.market.trend}.`,[money("market-adr","Market ADR",snapshot.market.medianAdr),metric("market-occupancy","Market Occupancy",`${(snapshot.market.medianOccupancy.value*100).toFixed(1)}%`,"estimated")],confidenceLevel),
    section("financial-performance","Financial Performance","Selected scenario projection.",[money("revenue","Annual Revenue",snapshot.financials.projectedAnnualRevenue),money("noi","NOI",snapshot.financials.netOperatingIncome),money("cash-flow","Annual Cash Flow",snapshot.financials.annualCashFlow),metric("occupancy","Occupancy",`${(snapshot.financials.projectedOccupancy.value*100).toFixed(1)}%`,"projected")],confidenceLevel),
    section("risk-analysis","Risk Analysis",`${snapshot.risks.length} identified risks.`,[],confidenceLevel,snapshot.risks.map((risk)=>({Risk:risk.title,Severity:risk.severity,Mitigation:risk.mitigation??"Not documented"}))),
    section("investment-score","Investment Score","Canonical scenario score.",[metric("score","Score",`${snapshot.score.value} of ${snapshot.score.scaleMaximum}`,"projected")],confidenceLevel),
    section("recommendation","Recommendation",snapshot.recommendation.rationale.join(" "),[],confidenceLevel),
    section("evidence-methodology","Evidence and Methodology",`${snapshot.dataGaps.length?`Missing evidence: ${snapshot.dataGaps.map((gap)=>gap.description).join("; ")}`:"No material evidence gaps were recorded."}${scenario?.notes?` Operator notes: ${scenario.notes}`:""}`,[],confidenceLevel),
  ], new Date(snapshot.analyzedAt).toISOString());
}

async function financialProjection(request: ReportRequest): Promise<ReportProjection> {
  const state = await getFinancialOverviewRouteState({ workspaceId: request.workspaceId, periodPreset: "this-month", comparisonType: "previous-period" });
  if (!state.ok) throw new Error("report_source_not_ready");
  const overview = state.overview, confidenceLevel = confidence(overview.confidence);
  const metrics = overview.metrics.map((item) => metric(item.metric, item.metric.replaceAll("-"," "), item.current.money?.format() ?? (item.current.percentage !== undefined ? `${(item.current.percentage*100).toFixed(1)}%` : "Unavailable"), qualification(item.current.qualification)));
  return projection(request, `Financial Performance — ${overview.scope.label}`, overview.condition.summary, confidenceLevel, overview.freshness, overview.projectionVersion, [
    section("financial-condition","Financial Condition",overview.condition.summary,metrics,confidenceLevel),
    section("income-statement","Income Statement",overview.profitability.explanation,metrics.filter((item)=>["revenue","operating-expenses","noi","operating-margin"].includes(item.key)),confidenceLevel),
    section("cash-flow","Cash Flow",overview.liquidity.explanation,metrics.filter((item)=>["cash-balance","net-cash-movement"].includes(item.key)),confidenceLevel),
    section("liquidity","Liquidity",overview.liquidity.explanation,[],confidenceLevel),
    section("budget-forecast","Budget and Forecast",overview.planning.explanation,[],confidenceLevel),
    section("evidence-methodology", "Evidence and Reconciliation", `Reconciliation: ${overview.evidence.reconciliation}. ${overview.evidence.gaps.join(" ")}`, [], confidenceLevel),
  ], overview.evaluatedAt, { accountingBasis: overview.accountingBasis, reportingCurrency: overview.reportingCurrency });
}

async function portfolioProjection(request: ReportRequest): Promise<ReportProjection> {
  const state = await getPortfolioOverviewRouteState({ workspaceId: request.workspaceId, periodPreset: "30d", comparisonType: "previous-period" });
  if (!state.ok) throw new Error("report_source_not_ready");
  const overview = state.overview, confidenceLevel = confidence(overview.confidence);
  const metrics = overview.metrics.map((item) => metric(item.metric, item.metric.replaceAll("-"," "), item.current.state === "available" ? String(item.current.value) : "Unavailable", item.availability === "estimated" ? "estimated" : item.current.state === "available" ? "actual" : "unavailable"));
  return projection(request, `Portfolio Performance — ${overview.scopeLabel}`, overview.condition.explanation, confidenceLevel, overview.freshness, `portfolio-report:${overview.evaluatedAt}`, [
    section("portfolio-condition","Portfolio Condition",overview.condition.explanation,[],confidenceLevel),
    section("primary-metrics","Primary Metrics",overview.condition.primaryDriver,metrics,confidenceLevel),
    section("property-contribution","Property Contribution","Contribution reconciles to the authorized report scope.",[],confidenceLevel,overview.propertyContribution.items.map((item)=>({Property:item.name,Revenue:item.revenue===null?"Unavailable":String(item.revenue),Share:item.revenueShare===null?"Unavailable":`${(item.revenueShare*100).toFixed(1)}%`}))),
    section("risks-opportunities","Risks and Opportunities",overview.attention.map((item)=>item.description).join(" "),[],confidenceLevel),
    section("evidence-methodology","Evidence and Freshness",`Limiting source: ${overview.evidence.limitingSource??"None identified"}.`,[],confidenceLevel),
  ], overview.evaluatedAt);
}

function projection(request:ReportRequest,title:string,summary:string,confidenceValue:ReportConfidence,freshnessValue:ReportFreshness,version:string,sections:readonly ReportSectionSnapshot[],evaluatedAt:string,extra?:{accountingBasis?:string;reportingCurrency?:string}):ReportProjection{const narrative=(keys:readonly string[])=>sections.filter(item=>keys.includes(item.key)&&item.narrative).map(item=>item.narrative!);return Object.freeze({reportType:request.reportType,scope:request.scope,...(request.period?{period:request.period}:{}),title,summary,executiveSummary:Object.freeze({decision:summary,primaryFindings:Object.freeze(sections.filter(item=>item.metrics.length>0).slice(0,3).map(item=>item.narrative??item.title)),keyRisks:Object.freeze(narrative(["risk-analysis","risks-opportunities","operational-attention"])),recommendedActions:Object.freeze(narrative(["recommendation","operational-attention","budget-forecast"])),confidence:confidenceValue,freshness:freshnessValue}),sections:Object.freeze(sections),evidence:Object.freeze(sections.flatMap((item)=>item.evidence)),confidence:confidenceValue,freshness:freshnessValue,sourceVersions:Object.freeze([{source:request.sourceContext.type??request.reportType,version,evaluatedAt}]),projectionVersion:`${request.reportType}.report.v1`,evaluatedAt,...extra});}
function section(key:string,title:string,narrative:string,metrics:readonly ReportMetric[],confidenceValue:ReportConfidence,rows?:readonly Readonly<Record<string,string>>[]):ReportSectionSnapshot{return Object.freeze({key,title,order:0,status:"included",narrative,metrics:Object.freeze(metrics),...(rows?{rows:Object.freeze(rows)}:{}),confidence:confidenceValue,freshness:"current",evidence:Object.freeze([])});}
function metric(key:string,label:string,displayValue:string,qualificationValue:ReportMetric["qualification"],rawValue?:number|string):ReportMetric{return Object.freeze({key,label,displayValue,...(rawValue!==undefined?{rawValue}:{}),qualification:qualificationValue,accessibleDescription:`${label}: ${displayValue}. ${qualificationValue} value.`});}
function confidence(value:string):ReportConfidence{return value==="high"?"high":value==="moderate"||value==="medium"?"moderate":value==="low"?"low":"insufficient-evidence";}
function qualification(value:string):ReportMetric["qualification"]{return value==="measured"?"actual":value==="forecast"?"forecast":value==="estimated"?"estimated":value==="projected"?"projected":"unavailable";}
function scopeFor(type:ReportType,workspaceId:string,sourceId:string,analysisVersionId:string,scenarioId:string,scenarioName?:string):ReportScope{if(!workspaceId)throw new Error("report_scope_invalid");if(type==="investment-decision")return Object.freeze({type:"investment-scenario",workspaceId,opportunityId:sourceId,analysisVersionId,...(scenarioId?{scenarioId}:{}),label:scenarioName??"Saved Investment Analysis",partial:false});if(type==="property-performance")return Object.freeze({type:"property",workspaceId,propertyId:sourceId,label:"Selected Property",partial:false});if(type==="portfolio-performance")return Object.freeze({type:"workspace",workspaceId,label:"Authorized Portfolio",partial:false});return Object.freeze({type:"financial-scope",workspaceId,label:"Authorized Financial Scope",partial:false});}
function sourceContext(type:ReportType,sourceId:string,analysisVersionId:string,scenarioId:string,scenario?:{name:string;version:number;notes?:string},comparisonIds:readonly string[]=[]):Readonly<Record<string,string>>{return type==="investment-decision"?{type:"investment-analysis-version",opportunityId:sourceId,analysisVersionId,...(scenarioId?{scenarioId}:{}),...(comparisonIds.length?{comparedScenarioIds:comparisonIds.join(",")} :{}),...(scenario?{scenarioName:scenario.name,scenarioVersion:String(scenario.version),...(scenario.notes?{scenarioNotes:scenario.notes}:{})}:{})}:type==="property-performance"?{type:"property",propertyId:sourceId}:type==="portfolio-performance"?{type:"portfolio"}:{type:"financial-scope"};}
function periodFor(type:ReportType,preset:string):ReportPeriod|undefined{const today=new Date().toISOString().slice(0,10);if(type==="investment-decision")return Object.freeze({preset:"analysis-as-of",end:today,label:`Analysis as of ${today}`});const start=`${today.slice(0,7)}-01`;return Object.freeze({preset:(["current-month","year-to-date","trailing-12-months"].includes(preset)?preset:"current-month")as ReportPeriod["preset"],start,end:today,label:`${start} to ${today}`});}
function templateFor(type:ReportType):ReportTemplate{const definition=getReportDefinition(type)!;return Object.freeze({id:definition.defaultTemplateId,key:`${type}-editorial`,name:`Luxe Haven ${definition.name}`,reportType:type,version:1,status:"active",sectionKeys:definition.requiredSections,brand:Object.freeze({name:"Luxe Haven Collective",accent:"#8a6b22",confidentiality:"Confidential"}),createdAt:"2026-07-25T00:00:00.000Z",activatedAt:"2026-07-25T00:00:00.000Z"});}
function toRequestRow(request:ReportRequest,entitlementVersion:string){return{id:request.id,workspace_id:request.workspaceId,requested_by_profile_id:request.requestedByProfileId,report_type:request.reportType,scope_type:request.scope.type,scope_snapshot:request.scope,period_snapshot:request.period,source_context:request.sourceContext,template_id:request.templateId,title:request.title,subtitle:request.subtitle,section_configuration:request.sectionConfiguration,status:"generating",idempotency_key:request.idempotencyKey,entitlement_version:entitlementVersion,permission_snapshot:{resolved:true,profileId:request.requestedByProfileId}};}
async function checksum(bytes:Uint8Array){const hash=await crypto.subtle.digest("SHA-256",bytes as BufferSource);return Array.from(new Uint8Array(hash)).map((value)=>value.toString(16).padStart(2,"0")).join("");}
function preflightMessage(state:ReportPreflightState){return{
  ready:"The canonical projection is available and generation can proceed.",
  "missing-source-data":"The source workspace does not yet contain enough intelligence to produce this report.",
  "insufficient-permission":"Your role does not include access to this report scope.",
  "missing-entitlement":"Your current product access does not include generation for this report type.",
  "unsupported-scope":"This report type cannot be generated for the selected scope.",
  "projection-unavailable":"The canonical source projection is not connected yet. Existing reports remain available.",
  "configuration-incomplete":"Choose the required source and scenario before generation.",
  "provider-unavailable":"Report rendering is temporarily unavailable. Saved reports remain accessible.",
}[state];}

function templateFromRow(row:Record<string,unknown>):ReportTemplate{
  const brand=(row.brand_configuration??{}) as Record<string,unknown>;
  const sections=Array.isArray(row.section_definitions)?row.section_definitions.map(String):[];
  return Object.freeze({id:String(row.id),key:String(row.template_key),name:String(row.name),reportType:row.report_type as ReportType,version:Number(row.version),status:row.status as ReportTemplate["status"],sectionKeys:Object.freeze(sections),brand:Object.freeze({name:String(brand.name??"Luxe Haven Collective"),accent:String(brand.accent??"#8a6b22"),confidentiality:String(brand.confidentiality??"Confidential")}),createdAt:String(row.created_at),...(row.activated_at?{activatedAt:String(row.activated_at)}:{})});
}

async function publishArtifact(input:{admin:ReturnType<typeof createAdminClient>;report:Record<string,unknown>;projection:ReportProjection;template:ReportTemplate;type:"html"|"pdf";userId:string;commandId:string}){
  const{admin,report,projection,template,type,userId,commandId}=input,reportId=String(report.id),workspaceId=String(report.workspace_id);
  const rendererVersion=type==="html"?"luxe-haven-html.v1":"luxe-haven-pdf.v1",idempotencyKey=`publish:${reportId}:${type}:${commandId}`;
  const{data:existing}=await admin.from("report_artifact_jobs").select("id,status,attempts").eq("idempotency_key",idempotencyKey).maybeSingle();
  if(existing?.status==="completed")return;
  const jobId=existing?.id??`report-artifact-job-${crypto.randomUUID()}`,now=new Date().toISOString();
  if(existing)await admin.from("report_artifact_jobs").update({status:"rendering",attempts:existing.attempts+1,failure_code:null,failure_message:null,retryable:null,started_at:now,locked_at:now,locked_by:`request:${userId}`,lease_expires_at:new Date(Date.now()+120_000).toISOString()}).eq("id",jobId);
  else await admin.from("report_artifact_jobs").insert({id:jobId,report_id:reportId,artifact_type:type,status:"rendering",attempts:1,idempotency_key:idempotencyKey,renderer_version:rendererVersion,created_by_profile_id:userId,started_at:now,locked_at:now,locked_by:`request:${userId}`,lease_expires_at:new Date(Date.now()+120_000).toISOString()});
  await admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:reportId,workspace_id:workspaceId,actor_profile_id:userId,event_type:"publishing-requested",safe_summary:`${type.toUpperCase()} publishing requested from the immutable report snapshot.`,resulting_state:"rendering",occurred_at:now});
  try{
    const html=await renderReportHtml(projection,template);
    const bytes=type==="html"?new TextEncoder().encode(html.content):renderSimpleReportPdf(html.content,{title:String(report.title),generatedAt:String(report.generated_at)});
    await admin.from("report_artifact_jobs").update({status:"validating"}).eq("id",jobId);
    if(type==="html"&&(!html.content.includes("<main")||!html.content.includes("<h1")))throw new Error("artifact_validation_failed");
    if(type==="pdf"&&new TextDecoder().decode(bytes.slice(0,8))!=="%PDF-1.4")throw new Error("artifact_validation_failed");
    if(bytes.byteLength<500)throw new Error("artifact_validation_failed");
    const digest=await checksum(bytes),artifactId=`report-artifact-${type}-${crypto.randomUUID()}`,path=`${workspaceId}/${reportId}/${artifactId}.${type}`;
    await admin.from("report_artifact_jobs").update({status:"storing"}).eq("id",jobId);
    const{error:uploadError}=await admin.storage.from("report-artifacts").upload(path,bytes,{contentType:type==="html"?"text/html":"application/pdf",upsert:false});
    if(uploadError)throw new Error("artifact_storage_failed");
    const{error:artifactError}=await admin.from("report_artifacts").insert({id:artifactId,report_id:reportId,artifact_type:type,storage_path:path,mime_type:type==="html"?"text/html":"application/pdf",size_bytes:bytes.byteLength,checksum:digest,renderer_version:rendererVersion,status:"pending"});
    if(artifactError)throw new Error("artifact_storage_failed");
    const{error:activationError}=await admin.rpc("activate_report_artifact",{p_artifact_id:artifactId});
    if(activationError)throw new Error("artifact_storage_failed");
    const completedAt=new Date().toISOString();
    await Promise.all([
      admin.from("report_artifact_jobs").update({status:"completed",artifact_id:artifactId,completed_at:completedAt,lease_expires_at:null}).eq("id",jobId),
      admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:reportId,job_id:null,workspace_id:workspaceId,actor_profile_id:userId,event_type:"artifact-stored",safe_summary:`Validated ${type.toUpperCase()} artifact stored with checksum and renderer lineage.`,resulting_state:"active",occurred_at:completedAt}),
    ]);
    if(type==="pdf"&&report.status==="generated"){
      await admin.from("generated_reports").update({status:"published"}).eq("id",reportId).eq("status","generated");
      await admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:reportId,workspace_id:workspaceId,actor_profile_id:userId,event_type:"publishing-completed",safe_summary:"Required PDF artifact completed; report transitioned to published.",resulting_state:"published",occurred_at:completedAt});
    }
  }catch(error){
    const code=error instanceof Error?error.message:"artifact_renderer_unavailable",retryable=!["report_permission_denied","report_template_not_found","artifact_validation_failed"].includes(code);
    await Promise.all([
      admin.from("report_artifact_jobs").update({status:"failed",failure_code:code,failure_message:artifactFailureMessage(code),retryable,lease_expires_at:null}).eq("id",jobId),
      admin.from("report_activity").insert({id:`report-activity-${crypto.randomUUID()}`,report_id:reportId,workspace_id:workspaceId,actor_profile_id:userId,event_type:"publishing-failed",safe_summary:`${type.toUpperCase()} publishing failed safely. ${artifactFailureMessage(code)}`,resulting_state:"failed",occurred_at:new Date().toISOString()}),
    ]);
  }
}
function artifactFailureMessage(code:string){return code==="artifact_validation_failed"?"The rendered file did not pass artifact validation.":code==="artifact_storage_failed"?"Private artifact storage was unavailable. Retry is safe.":"The renderer was unavailable. The saved report is unchanged and retry is safe.";}
function safeSearch(value:string){return value.trim().replaceAll(/[,%()]/g," ").slice(0,100);}
