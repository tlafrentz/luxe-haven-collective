import Link from "next/link";
import { notFound } from "next/navigation";
import { archiveReportAction, downloadReportArtifact, getGeneratedReportView } from "@/app/actions/reporting";
import { ReportViewer, type ReportProjection } from "@/platform/reporting";

export default async function ReportDetailPage({params}:{params:Promise<{reportId:string}>}) {
  const {reportId}=await params,view=await getGeneratedReportView(reportId);if(!view)notFound();
  const projection=view.report.projection_snapshot as ReportProjection;
  return <main className="bg-stone-100 pb-16"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-5 print:hidden"><Link href="/dashboard/reports">← Report history</Link><div className="flex flex-wrap gap-2"><Link className="rounded-full border bg-white px-4 py-2 font-semibold" href={`/dashboard/reports/${reportId}/print`}>Print view</Link>{view.artifacts.some((item)=>item.artifact_type==="pdf")?<form action={downloadReportArtifact}><input name="reportId" type="hidden" value={reportId}/><input name="artifactType" type="hidden" value="pdf"/><button className="rounded-full border bg-white px-4 py-2 font-semibold">Download PDF</button></form>:null}<Link className="rounded-full border bg-white px-4 py-2 font-semibold" href={`/dashboard/reports/${reportId}/share`}>Share</Link><form action={archiveReportAction}><input name="reportId" type="hidden" value={reportId}/><input name="operation" type="hidden" value={view.report.status==="archived"?"restore":"archive"}/><button className="rounded-full border bg-white px-4 py-2 font-semibold">{view.report.status==="archived"?"Restore":"Archive"}</button></form></div></div><ReportViewer projection={projection} metadata={{reportNumber:view.report.report_number,generatedAt:view.report.generated_at,templateVersion:view.report.template_version}} /></main>;
}
