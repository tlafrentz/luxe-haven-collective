import { redirect, notFound } from "next/navigation";
import { getCanonicalReport } from "@/features/reporting-suite/application/reporting-workspace-composition";
export default async function ReportDetailPage({params}:{params:Promise<{reportId:string}>}){const {reportId}=await params,model=await getCanonicalReport(reportId);if(!model)notFound();if(model.version.status==="ready")redirect(`/dashboard/reports/${reportId}/versions/${model.version.reportVersionId}`);redirect(`/dashboard/reports/${reportId}/versions/${model.version.reportVersionId}`)}
