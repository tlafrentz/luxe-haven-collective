import { notFound } from "next/navigation";
import { resolveSharedReport } from "@/app/actions/reporting";
import { ReportViewer, type ReportProjection } from "@/platform/reporting";
export const metadata={robots:{index:false,follow:false}};
export default async function SharedReportPage({params}:{params:Promise<{token:string}>}){const{token}=await params,view=await resolveSharedReport(token);if(!view)notFound();return <main className="bg-stone-100"><div role="status" className="mx-auto max-w-5xl px-5 py-4 text-sm text-stone-600">Secure read-only report share. This link does not grant access to the Luxe Haven Workspace.</div><ReportViewer projection={view.report.projection_snapshot as ReportProjection} metadata={{reportNumber:view.report.report_number,generatedAt:view.report.generated_at,templateVersion:view.report.template_version}} /></main>;}
