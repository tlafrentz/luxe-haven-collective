import { getInvestmentReport } from "@/app/actions/investment-reports";
import { exportInvestmentReport, InvestmentReportExportError } from "@/features/investment-report-export";
import { renderInvestmentReportPdf } from "@/features/investment-report-export/infrastructure/render-investment-report-pdf";

export const runtime = "nodejs";
export const maxDuration = 20;
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  try {
    const report = await getInvestmentReport(reportId);
    if (!report) return failure("REPORT_NOT_FOUND", 404);
    const result = await exportInvestmentReport({
      report: { id: report.id, title: report.title, strategy: report.strategy, status: report.status, generatedAt: report.generatedAt, snapshot: report.snapshot },
      renderer: renderInvestmentReportPdf,
      telemetry: (event, attributes) => console.info(event, attributes),
    });
    console.info("investment_report_export_download_authorized", { correlationId: result.correlationId, reportId: report.id, strategy: report.strategy, byteSize: result.bytes.byteLength });
    return new Response(Buffer.from(result.bytes), { status: 200, headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(result.bytes.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) {
    const code = error instanceof InvestmentReportExportError ? error.code : "EXPORT_DELIVERY_FAILED";
    const status = code === "REPORT_NOT_FOUND" || code === "REPORT_UNAUTHORIZED" ? 404
      : code === "EXPORT_VERSION_UNSUPPORTED" || code === "REPORT_SNAPSHOT_INVALID" ? 422
      : code === "EXPORT_GENERATION_TIMEOUT" ? 504 : 503;
    return failure(code, status);
  }
}

function failure(code: string, status: number) {
  const message = code === "EXPORT_VERSION_UNSUPPORTED" ? "This saved report version is not supported by the current PDF exporter."
    : code === "REPORT_SNAPSHOT_INVALID" ? "This saved report is incomplete and cannot be exported."
    : code === "EXPORT_GENERATION_TIMEOUT" ? "PDF generation timed out. Please retry."
    : code === "REPORT_NOT_FOUND" || code === "REPORT_UNAUTHORIZED" ? "Report unavailable."
    : "The PDF could not be generated. Please retry.";
  return Response.json({ ok: false, code, message }, { status, headers: { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
}
