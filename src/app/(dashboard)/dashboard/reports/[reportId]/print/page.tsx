import { notFound } from "next/navigation";
import { getGeneratedReportView } from "@/app/actions/reporting";
import { ReportViewer, type ReportProjection } from "@/platform/reporting";
import { PrintControls } from "@/components/reporting/print-controls";
export default async function ReportPrintPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params,
    view = await getGeneratedReportView(reportId);
  if (!view) notFound();
  return (
    <main className="bg-white">
      <PrintControls reportId={reportId} />
      <ReportViewer
        projection={view.report.projection_snapshot as ReportProjection}
        metadata={{
          reportNumber: view.report.report_number,
          generatedAt: view.report.generated_at,
          templateVersion: view.report.template_version,
        }}
      />
    </main>
  );
}
