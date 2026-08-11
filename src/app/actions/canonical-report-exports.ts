"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCanonicalReport, requireReportingContext } from "@/features/reporting-suite/application/reporting-workspace-composition";
import { ReportExportService, ReportFoundationError, SupabaseReportArtifactStorage, SupabaseReportExportRepository, type ReportExportFormat } from "@/platform/reporting";

function service() { const admin = createAdminClient(); return new ReportExportService({ repository: new SupabaseReportExportRepository(admin), storage: new SupabaseReportArtifactStorage(admin) }); }

export async function requestCanonicalReportExportAction(form: FormData) {
  const context = await requireReportingContext(); if (!context) redirect("/login");
  const reportId=String(form.get("reportId")??""),versionId=String(form.get("versionId")??""),model=await getCanonicalReport(reportId,versionId);
  if(!model||model.version.reportVersionId!==versionId)throw new ReportFoundationError("REPORT_SCOPE_FORBIDDEN","This report version is unavailable.");
  const raw=String(form.get("format")??"pdf"),format:ReportExportFormat=raw==="csv"?"csv":"pdf",sectionKeys=form.getAll("sectionKeys").map(String);
  await service().request({actor:context.actor,reportVersion:model.version,format,...(sectionKeys.length?{sectionKeys}:{}),includeComparison:form.get("includeComparison")!=="false",includeFreshness:true,includeLineage:form.get("includeLineage")==="true",idempotencyKey:String(form.get("idempotencyKey")??crypto.randomUUID())});
  revalidatePath(`/dashboard/reports/${reportId}/versions/${versionId}`);
}

export async function downloadCanonicalReportExportAction(form: FormData) {
  const context=await requireReportingContext();if(!context)redirect("/login");
  const reportId=String(form.get("reportId")??""),versionId=String(form.get("versionId")??""),model=await getCanonicalReport(reportId,versionId);
  if(!model||model.version.reportVersionId!==versionId)throw new ReportFoundationError("REPORT_SCOPE_FORBIDDEN","Export download is unavailable.");
  const url=await service().download({actor:context.actor,exportId:String(form.get("exportId")??""),authorizedReportVersionIds:[versionId]});redirect(url);
}
