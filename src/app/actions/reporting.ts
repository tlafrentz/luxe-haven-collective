"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCommerceAccessWorkspace } from "./commerce-access";
import { getInvestmentScenarioWorkspaceRequest } from "./investment-scenario-runtime";
import { getFinancialOverviewRouteState } from "./financial-overview-runtime";
import { getPortfolioOverviewRouteState } from "./portfolio-overview-runtime";
import {
  assertSharingAllowed,
  createGeneratedReport,
  getReportDefinition,
  renderReportHtml,
  renderSimpleReportPdf,
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

export async function getReportWorkspace() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client.from("generated_reports").select("id,report_number,report_type,status,title,confidence,freshness,version_number,generated_at,scope_snapshot,period_snapshot").order("generated_at", { ascending: false }).limit(200);
  return Object.freeze({ reports: data ?? [], evaluatedAt: new Date().toISOString() });
}

export async function getGeneratedReportView(reportId: string) {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user || !reportId.startsWith("report-")) return null;
  const [{ data: report }, { data: artifacts }, { data: shares }, { data: activity }] = await Promise.all([
    client.from("generated_reports").select("*").eq("id", reportId).maybeSingle(),
    client.from("report_artifacts").select("id,artifact_type,status,size_bytes,checksum,created_at").eq("report_id", reportId).eq("status", "active"),
    client.from("report_shares").select("id,status,access_mode,expires_at,max_views,view_count,created_at").eq("report_id", reportId).order("created_at", { ascending: false }),
    client.from("report_activity").select("id,event_type,safe_summary,resulting_state,occurred_at").eq("report_id", reportId).order("occurred_at", { ascending: false }),
  ]);
  return report ? Object.freeze({ report, artifacts: artifacts ?? [], shares: shares ?? [], activity: activity ?? [] }) : null;
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
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const sourceId = String(formData.get("sourceId") ?? "");
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const scope = scopeFor(reportType, workspaceId, sourceId, scenarioId);
  const period = periodFor(reportType, String(formData.get("periodPreset") ?? "current-month"));
  const requestId = `report-request-${crypto.randomUUID()}`;
  const template = templateFor(reportType);
  const request: ReportRequest = Object.freeze({
    id: requestId, workspaceId, requestedByProfileId: user.id, reportType, scope,
    ...(period ? { period } : {}), sourceContext: Object.freeze(sourceContext(reportType, sourceId, scenarioId)),
    templateId: template.id, title: String(formData.get("title") ?? "").trim() || undefined,
    sectionConfiguration: Object.freeze([]), status: "generating", idempotencyKey: String(formData.get("idempotencyKey") ?? crypto.randomUUID()), createdAt: new Date().toISOString(),
  });
  const allowed = access.entitlements.some((item) => item.key === definition.requiredEntitlementKey && item.status === "available");
  validateReportRequest({ request, template, authorizedWorkspaceId: workspaceId, hasEntitlement: allowed });
  const projection = validateReportProjection(await buildProjection(request), definition);
  const admin = createAdminClient();
  const jobId = `report-job-${crypto.randomUUID()}`;
  const entitlementVersion = access.version;
  const { error: requestError } = await admin.from("report_requests").insert(toRequestRow(request, entitlementVersion));
  if (requestError) throw new Error("report_generation_conflict");
  await admin.from("report_generation_jobs").insert({ id: jobId, report_request_id: requestId, status: "processing", stage: "html", attempts: 1, idempotency_key: `generation:${request.idempotencyKey}`, locked_at: new Date().toISOString(), locked_by: `request:${user.id}`, lease_expires_at: new Date(Date.now() + 120_000).toISOString(), started_at: new Date().toISOString() });
  try {
    const { data: reportNumber, error: numberError } = await admin.rpc("next_report_number", { p_report_type: reportType });
    if (numberError || !reportNumber) throw new Error("report_generation_failed");
    const reportId = `report-${crypto.randomUUID()}`;
    const generatedAt = new Date().toISOString();
    const seriesKey = `${reportType}:${sourceId || workspaceId}`;
    const { count } = await admin.from("generated_reports").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("series_key", seriesKey);
    const report = createGeneratedReport({ id: reportId, reportNumber, request, projection, template, versionNumber: (count ?? 0) + 1, seriesKey, generatedAt });
    const html = await renderReportHtml(projection, template);
    const htmlChecksum = await checksum(new TextEncoder().encode(html.content));
    const pdf = renderSimpleReportPdf(html.content, { title: report.title, generatedAt });
    const pdfChecksum = await checksum(pdf);
    const base = `${workspaceId}/${reportId}`;
    const [htmlUpload, pdfUpload] = await Promise.all([
      admin.storage.from("report-artifacts").upload(`${base}/report.html`, html.content, { contentType: "text/html", upsert: false }),
      admin.storage.from("report-artifacts").upload(`${base}/report.pdf`, pdf, { contentType: "application/pdf", upsert: false }),
    ]);
    if (htmlUpload.error || pdfUpload.error) throw new Error("report_storage_failed");
    const snapshot = JSON.stringify(report.projectionSnapshot);
    const { error: reportError } = await admin.from("generated_reports").insert({
      id: report.id, report_number: report.reportNumber, report_request_id: requestId, workspace_id: workspaceId,
      generated_by_profile_id: user.id, report_type: reportType, status: "generated", title: report.title, subtitle: report.subtitle,
      scope_type: scope.type, property_id: scope.propertyId, opportunity_id: scope.opportunityId, scenario_id: scope.scenarioId,
      scope_snapshot: scope, period_snapshot: period, source_context_snapshot: request.sourceContext,
      projection_snapshot: report.projectionSnapshot, snapshot_schema_version: report.snapshotSchemaVersion,
      snapshot_size_bytes: new TextEncoder().encode(snapshot).byteLength, template_id: template.id, template_version: template.version,
      projection_version: projection.projectionVersion, source_versions: projection.sourceVersions, confidence: projection.confidence,
      freshness: projection.freshness, series_key: seriesKey, version_number: report.versionNumber, generated_at: generatedAt,
    });
    if (reportError) throw new Error("report_generation_failed");
    await admin.from("report_artifacts").insert([
      { id: `report-artifact-html-${crypto.randomUUID()}`, report_id: reportId, artifact_type: "html", storage_path: `${base}/report.html`, mime_type: "text/html", size_bytes: html.sizeBytes, checksum: htmlChecksum, renderer_version: "luxe-haven-html.v1", status: "active" },
      { id: `report-artifact-pdf-${crypto.randomUUID()}`, report_id: reportId, artifact_type: "pdf", storage_path: `${base}/report.pdf`, mime_type: "application/pdf", size_bytes: pdf.byteLength, checksum: pdfChecksum, renderer_version: "luxe-haven-pdf-fallback.v1", status: "active" },
    ]);
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
  const { data: artifact } = await client.from("report_artifacts").select("storage_path").eq("report_id", reportId).eq("artifact_type", type).eq("status", "active").maybeSingle();
  if (!artifact) throw new Error("report_artifact_not_found");
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("report-artifacts").createSignedUrl(artifact.storage_path, 300, { download: type === "pdf" });
  if (error || !data?.signedUrl) throw new Error("report_storage_failed");
  redirect(data.signedUrl);
}

export async function archiveReportAction(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  const next = String(formData.get("operation") ?? "") === "restore" ? "generated" : "archived";
  const client = await createClient();
  const { data: report } = await client.from("generated_reports").select("id,workspace_id,status").eq("id", reportId).maybeSingle();
  if (!report) throw new Error("report_permission_denied");
  const admin = createAdminClient();
  await admin.from("generated_reports").update({ status: next, archived_at: next === "archived" ? new Date().toISOString() : null }).eq("id", reportId);
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
  const { data: report } = await client.from("generated_reports").select("id,report_type,workspace_id").eq("id", reportId).maybeSingle();
  if (!report) return { ok: false, message: "Report not found." };
  try { assertSharingAllowed(report.report_type as ReportType, true); } catch { return { ok: false, message: "External sharing is disabled for this report type." }; }
  const rawToken = `${crypto.randomUUID().replaceAll("-","")}${crypto.randomUUID().replaceAll("-","")}`;
  const tokenHash = await checksum(new TextEncoder().encode(rawToken));
  const shareId = `report-share-${crypto.randomUUID()}`;
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000).toISOString();
  const { error } = await admin.from("report_shares").insert({ id: shareId, report_id: reportId, created_by_profile_id: user.id, token_hash: tokenHash, status: "active", access_mode: accessMode, expires_at: expiresAt, max_views: maxViews });
  if (error) return { ok: false, message: "Secure share could not be created." };
  await admin.from("report_activity").insert({ id: `report-activity-${crypto.randomUUID()}`, report_id: reportId, share_id: shareId, workspace_id: report.workspace_id, actor_profile_id: user.id, event_type: "report-shared", safe_summary: `Secure ${accessMode} share created with expiration and view limit.`, resulting_state: "published", occurred_at: new Date().toISOString() });
  revalidatePath(`/dashboard/reports/${reportId}/share`);
  return { ok: true, message: "Secure share created. Copy this link now; the token is not stored.", url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reports/shared/${rawToken}` };
}

export async function revokeReportShareAction(formData: FormData) {
  const shareId = String(formData.get("shareId") ?? "");
  const reportId = String(formData.get("reportId") ?? "");
  const client = await createClient();
  const { data: share } = await client.from("report_shares").select("id,report_id").eq("id", shareId).eq("report_id", reportId).maybeSingle();
  if (!share) throw new Error("report_permission_denied");
  const admin = createAdminClient();
  await admin.from("report_shares").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("id", shareId).eq("status", "active");
  revalidatePath(`/dashboard/reports/${reportId}/share`);
}

export async function resolveSharedReport(rawToken: string) {
  if (!/^[a-f0-9]{64}$/.test(rawToken)) return null;
  const admin = createAdminClient();
  const tokenHash = await checksum(new TextEncoder().encode(rawToken));
  const { data: share } = await admin.from("report_shares").select("id,report_id,status,access_mode,expires_at,max_views,view_count").eq("token_hash", tokenHash).maybeSingle();
  const now = new Date();
  if (!share || share.status !== "active" || (share.expires_at && new Date(share.expires_at) <= now) || (share.max_views !== null && share.view_count >= share.max_views)) {
    return null;
  }
  const { data: report } = await admin.from("generated_reports").select("id,report_number,report_type,title,subtitle,scope_snapshot,period_snapshot,projection_snapshot,confidence,freshness,generated_at,template_version,projection_version").eq("id", share.report_id).maybeSingle();
  if (!report || report.report_type === "financial-performance") return null;
  await Promise.all([
    admin.from("report_shares").update({ view_count: share.view_count + 1, last_viewed_at: now.toISOString() }).eq("id", share.id).eq("view_count", share.view_count),
    admin.from("report_share_access").insert({ id: `report-share-access-${crypto.randomUUID()}`, share_id: share.id, access_type: "view", result: "allowed", accessed_at: now.toISOString() }),
  ]);
  return Object.freeze({ report, canDownload: share.access_mode === "view-and-download" });
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
  if (request.reportType === "investment-decision") return investmentProjection(request);
  if (request.reportType === "financial-performance") return financialProjection(request);
  if (request.reportType === "portfolio-performance") return portfolioProjection(request);
  throw new Error("report_source_not_ready");
}

async function investmentProjection(request: ReportRequest): Promise<ReportProjection> {
  const result = await getInvestmentScenarioWorkspaceRequest(request.scope.opportunityId!);
  if (!result.ok) throw new Error("report_source_not_ready");
  const scenario = result.workspace.scenarios.find((item) => item.id === request.scope.scenarioId);
  if (!scenario) throw new Error("report_source_not_ready");
  const snapshot = scenario.snapshot.result, confidenceLevel = confidence(snapshot.confidence.level);
  const money = (key: string, label: string, value?: { amount: number; currency: string }): ReportMetric => metric(key, label, value ? new Intl.NumberFormat("en-US", { style: "currency", currency: value.currency }).format(value.amount) : "Unavailable", "projected");
  return projection(request, `${result.workspace.opportunity.name} — Investment Decision`, snapshot.recommendation.summary, confidenceLevel, snapshot.dataGaps.length ? "partial" : "current", scenario.snapshot.calculationVersion, [
    section("decision-summary","Decision Summary",snapshot.recommendation.summary,[metric("recommendation","Recommendation",snapshot.recommendation.recommendation.replaceAll("-"," "),"projected")],confidenceLevel),
    section("property-profile","Property Profile",result.workspace.opportunity.address,[],confidenceLevel),
    section("market-intelligence","Market Intelligence",`${snapshot.market.name}. ${snapshot.market.trend}.`,[money("market-adr","Market ADR",snapshot.market.medianAdr),metric("market-occupancy","Market Occupancy",`${(snapshot.market.medianOccupancy.value*100).toFixed(1)}%`,"estimated")],confidenceLevel),
    section("financial-performance","Financial Performance","Selected scenario projection.",[money("revenue","Annual Revenue",snapshot.financials.projectedAnnualRevenue),money("noi","NOI",snapshot.financials.netOperatingIncome),money("cash-flow","Annual Cash Flow",snapshot.financials.annualCashFlow),metric("occupancy","Occupancy",`${(snapshot.financials.projectedOccupancy.value*100).toFixed(1)}%`,"projected")],confidenceLevel),
    section("risk-analysis","Risk Analysis",`${snapshot.risks.length} identified risks.`,[],confidenceLevel,snapshot.risks.map((risk)=>({Risk:risk.title,Severity:risk.severity,Mitigation:risk.mitigation??"Not documented"}))),
    section("investment-score","Investment Score","Canonical scenario score.",[metric("score","Score",`${snapshot.score.value} of ${snapshot.score.scaleMaximum}`,"projected")],confidenceLevel),
    section("recommendation","Recommendation",snapshot.recommendation.rationale.join(" "),[],confidenceLevel),
    section("evidence-methodology","Evidence and Methodology",snapshot.dataGaps.length?`Missing evidence: ${snapshot.dataGaps.map((gap)=>gap.description).join("; ")}`:"No material evidence gaps were recorded.",[],confidenceLevel),
  ], scenario.snapshot.capturedAt.toISOString());
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

function projection(request:ReportRequest,title:string,summary:string,confidenceValue:ReportConfidence,freshnessValue:ReportFreshness,version:string,sections:readonly ReportSectionSnapshot[],evaluatedAt:string,extra?:{accountingBasis?:string;reportingCurrency?:string}):ReportProjection{return Object.freeze({reportType:request.reportType,scope:request.scope,...(request.period?{period:request.period}:{}),title,summary,sections:Object.freeze(sections),evidence:Object.freeze(sections.flatMap((item)=>item.evidence)),confidence:confidenceValue,freshness:freshnessValue,sourceVersions:Object.freeze([{source:request.sourceContext.type??request.reportType,version,evaluatedAt}]),projectionVersion:`${request.reportType}.report.v1`,evaluatedAt,...extra});}
function section(key:string,title:string,narrative:string,metrics:readonly ReportMetric[],confidenceValue:ReportConfidence,rows?:readonly Readonly<Record<string,string>>[]):ReportSectionSnapshot{return Object.freeze({key,title,order:0,status:"included",narrative,metrics:Object.freeze(metrics),...(rows?{rows:Object.freeze(rows)}:{}),confidence:confidenceValue,freshness:"current",evidence:Object.freeze([])});}
function metric(key:string,label:string,displayValue:string,qualificationValue:ReportMetric["qualification"]):ReportMetric{return Object.freeze({key,label,displayValue,qualification:qualificationValue,accessibleDescription:`${label}: ${displayValue}. ${qualificationValue} value.`});}
function confidence(value:string):ReportConfidence{return value==="high"?"high":value==="moderate"||value==="medium"?"moderate":value==="low"?"low":"insufficient-evidence";}
function qualification(value:string):ReportMetric["qualification"]{return value==="measured"?"actual":value==="forecast"?"forecast":value==="estimated"?"estimated":value==="projected"?"projected":"unavailable";}
function scopeFor(type:ReportType,workspaceId:string,sourceId:string,scenarioId:string):ReportScope{if(!workspaceId)throw new Error("report_scope_invalid");if(type==="investment-decision")return Object.freeze({type:"investment-scenario",workspaceId,opportunityId:sourceId,scenarioId,label:"Selected Investment Scenario",partial:false});if(type==="property-performance")return Object.freeze({type:"property",workspaceId,propertyId:sourceId,label:"Selected Property",partial:false});if(type==="portfolio-performance")return Object.freeze({type:"workspace",workspaceId,label:"Authorized Portfolio",partial:false});return Object.freeze({type:"financial-scope",workspaceId,label:"Authorized Financial Scope",partial:false});}
function sourceContext(type:ReportType,sourceId:string,scenarioId:string):Readonly<Record<string,string>>{return type==="investment-decision"?{type:"investment-scenario",opportunityId:sourceId,scenarioId}:type==="property-performance"?{type:"property",propertyId:sourceId}:type==="portfolio-performance"?{type:"portfolio"}:{type:"financial-scope"};}
function periodFor(type:ReportType,preset:string):ReportPeriod|undefined{const today=new Date().toISOString().slice(0,10);if(type==="investment-decision")return Object.freeze({preset:"analysis-as-of",end:today,label:`Analysis as of ${today}`});const start=`${today.slice(0,7)}-01`;return Object.freeze({preset:(["current-month","year-to-date","trailing-12-months"].includes(preset)?preset:"current-month")as ReportPeriod["preset"],start,end:today,label:`${start} to ${today}`});}
function templateFor(type:ReportType):ReportTemplate{const definition=getReportDefinition(type)!;return Object.freeze({id:definition.defaultTemplateId,key:`${type}-editorial`,name:`Luxe Haven ${definition.name}`,reportType:type,version:1,status:"active",sectionKeys:definition.requiredSections,brand:Object.freeze({name:"Luxe Haven Collective",accent:"#8a6b22",confidentiality:"Confidential"}),createdAt:"2026-07-25T00:00:00.000Z",activatedAt:"2026-07-25T00:00:00.000Z"});}
function toRequestRow(request:ReportRequest,entitlementVersion:string){return{id:request.id,workspace_id:request.workspaceId,requested_by_profile_id:request.requestedByProfileId,report_type:request.reportType,scope_type:request.scope.type,scope_snapshot:request.scope,period_snapshot:request.period,source_context:request.sourceContext,template_id:request.templateId,title:request.title,section_configuration:request.sectionConfiguration,status:"generating",idempotency_key:request.idempotencyKey,entitlement_version:entitlementVersion,permission_snapshot:{resolved:true,profileId:request.requestedByProfileId}};}
async function checksum(bytes:Uint8Array){const hash=await crypto.subtle.digest("SHA-256",bytes as BufferSource);return Array.from(new Uint8Array(hash)).map((value)=>value.toString(16).padStart(2,"0")).join("");}
