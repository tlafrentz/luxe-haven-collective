"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getInvestmentOpportunityRequestContext } from "./investment-opportunity-runtime";
import { readImmutableAnalysis } from "@/features/investment-opportunity";
import { buildInvestmentReportSnapshot, buildInvestmentReportView, type InvestmentReportRecord, type InvestmentReportSnapshot } from "@/features/investment-reports";

const PAGE_SIZE = 25;

export async function findInvestmentReportForAnalysis(opportunityId: string, analysisId: string) {
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client.from("generated_reports").select("id")
    .eq("report_type", "investment-decision").eq("owner_profile_id", user.id)
    .eq("opportunity_id", opportunityId).eq("analysis_version_id", analysisId).maybeSingle();
  return data?.id ?? null;
}

export async function generateInvestmentReportAction(formData: FormData) {
  const opportunityId = String(formData.get("opportunityId") ?? "");
  const analysisId = String(formData.get("analysisId") ?? "");
  const correlationId = crypto.randomUUID();
  console.info("investment_report_generation_entered", { correlationId, opportunityId, analysisVersion: analysisId });
  const context = await getInvestmentOpportunityRequestContext();
  if (!context.ok || !await context.authorizeOpportunity(opportunityId, "report.generate", analysisId)) {
    console.warn("investment_report_generation_failed", { correlationId, opportunityId, analysisVersion: analysisId, failureClass: "unauthorized" });
    redirect("/dashboard/investments/reports?error=unavailable");
  }
  const analysis = await readImmutableAnalysis(context.repository, { ownerId: context.ownerId, opportunityId, analysisVersionId: analysisId });
  if (!analysis) redirect("/dashboard/investments/reports?error=analysis-not-found");
  console.info("investment_report_source_loaded", { correlationId, opportunityId, analysisVersion: analysisId, strategy: analysis.snapshot.route });
  let snapshot: InvestmentReportSnapshot;
  try {
    snapshot = buildInvestmentReportSnapshot(analysis, new Date());
    console.info("investment_report_snapshot_constructed", { correlationId, opportunityId, analysisVersion: analysisId, strategy: snapshot.lineage.strategy });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code: unknown }).code).toLowerCase().replaceAll("_", "-") : "unexpected";
    console.warn("investment_report_generation_failed", { correlationId, opportunityId, analysisVersion: analysisId, failureClass: code });
    redirect(`/dashboard/investments/reports?error=${code}`);
  }
  const client = await createClient(), encoded = new TextEncoder().encode(JSON.stringify(snapshot));
  const { data, error } = await client.rpc("generate_investment_report_v1", {
    p_opportunity_id: opportunityId, p_analysis_version_id: analysisId,
    p_title: `${analysis.opportunity.name} — Investment Decision`,
    p_strategy: snapshot.lineage.strategy, p_snapshot: snapshot,
    p_snapshot_size_bytes: encoded.byteLength, p_correlation_id: correlationId,
  });
  const result = data as unknown as { reportId?: string; existing?: boolean } | null;
  if (error || !result?.reportId) {
    console.warn("investment_report_generation_failed", { correlationId, opportunityId, analysisVersion: analysisId, failureClass: "persistence" });
    redirect("/dashboard/investments/reports?error=persistence-failed");
  }
  console.info(result.existing ? "investment_report_existing_returned" : "investment_report_persisted", { correlationId, reportId: result.reportId, opportunityId, analysisVersion: analysisId, strategy: snapshot.lineage.strategy });
  console.info("investment_report_generation_completed", { correlationId, reportId: result.reportId, opportunityId, analysisVersion: analysisId, outcome: result.existing ? "existing" : "created" });
  revalidatePath("/dashboard/investments/reports");
  redirect(`/dashboard/investments/reports/${result.reportId}${result.existing ? "?existing=1" : ""}`);
}

export async function getInvestmentReport(reportId: string) {
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client.from("generated_reports")
    .select("id,owner_profile_id,opportunity_id,analysis_version_id,status,title,acquisition_strategy,generated_at,archived_at,projection_snapshot")
    .eq("id", reportId).eq("report_type", "investment-decision").eq("owner_profile_id", user.id).maybeSingle();
  if (!data) return null;
  return buildInvestmentReportView(toRecord(data));
}

export async function listInvestmentReports(status: "active" | "archived", page = 1) {
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  let query = client.from("generated_reports")
    .select("id,owner_profile_id,opportunity_id,analysis_version_id,status,title,acquisition_strategy,generated_at,archived_at,projection_snapshot", { count: "exact" })
    .eq("report_type", "investment-decision").eq("owner_profile_id", user.id)
    .order("generated_at", { ascending: false }).order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
  query = status === "archived" ? query.eq("status", "archived") : query.in("status", ["generated", "published"]);
  const { data, count, error } = await query;
  if (error) return { ok: false as const, reports: [], total: 0, page, pageSize: PAGE_SIZE };
  return { ok: true as const, reports: (data ?? []).map(row => buildInvestmentReportView(toRecord(row))), total: count ?? 0, page, pageSize: PAGE_SIZE };
}

export async function listInvestmentReportsForOpportunity(opportunityId: string) {
  const client = await createClient(), { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client.from("generated_reports")
    .select("id,owner_profile_id,opportunity_id,analysis_version_id,status,title,acquisition_strategy,generated_at,archived_at,projection_snapshot")
    .eq("report_type", "investment-decision").eq("owner_profile_id", user.id).eq("opportunity_id", opportunityId)
    .order("generated_at", { ascending: false }).order("id", { ascending: true }).limit(50);
  if (error) return null;
  return (data ?? []).map(row => buildInvestmentReportView(toRecord(row)));
}

export async function transitionInvestmentReportAction(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? ""), operation = String(formData.get("operation") ?? "");
  if (operation !== "archive" && operation !== "restore") redirect("/dashboard/investments/reports?error=invalid-transition");
  const client = await createClient();
  const { error } = await client.rpc("transition_investment_report_v1", { p_report_id: reportId, p_operation: operation });
  if (error) redirect(`/dashboard/investments/reports?error=${operation}-conflict`);
  console.info(operation === "archive" ? "investment_report_archived" : "investment_report_restored", { reportId, outcome: "completed" });
  revalidatePath("/dashboard/investments/reports"); revalidatePath(`/dashboard/investments/reports/${reportId}`);
  redirect(`/dashboard/investments/reports?status=${operation === "archive" ? "active" : "archived"}`);
}

function toRecord(row: Record<string, unknown>): InvestmentReportRecord {
  const status = row.status === "archived" ? "archived" : "active";
  return {
    id: String(row.id), ownerId: String(row.owner_profile_id), opportunityId: String(row.opportunity_id),
    analysisId: String(row.analysis_version_id), status, title: String(row.title),
    strategy: row.acquisition_strategy === "rental-arbitrage" ? "rental-arbitrage" : "purchase",
    generatedAt: String(row.generated_at), archivedAt: row.archived_at ? String(row.archived_at) : null,
    snapshot: row.projection_snapshot as InvestmentReportSnapshot,
  };
}
