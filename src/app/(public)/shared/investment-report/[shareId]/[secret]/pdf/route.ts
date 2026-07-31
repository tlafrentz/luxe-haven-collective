import { createSharedAccessRepository } from "@/app/actions/investment-report-sharing-runtime";
import { resolveSharedInvestmentReport } from "@/features/investment-report-sharing";
import { exportInvestmentReport } from "@/features/investment-report-export";
import { renderInvestmentReportPdf } from "@/features/investment-report-export/infrastructure/render-investment-report-pdf";
export const runtime = "nodejs"; export const dynamic = "force-dynamic"; export const maxDuration = 20;
export async function GET(_request: Request, { params }: { params: Promise<{ shareId: string; secret: string }> }) {
  const { shareId, secret } = await params, repository = createSharedAccessRepository();
  try {
    const access = await resolveSharedInvestmentReport({ shareId, secret, repository, forPdf: true });
    const result = await exportInvestmentReport({ report: { id: access.grant.reportId, title: access.report.title, strategy: access.report.strategy, status: "active", generatedAt: access.report.generatedAt, snapshot: access.report.snapshot }, renderer: renderInvestmentReportPdf });
    await repository.record(access.grant.id, "pdf-downloaded", "granted", access.correlationId).catch(() => undefined);
    return new Response(Buffer.from(result.bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" } });
  } catch { return Response.json({ ok: false, message: "This shared report is unavailable. The link may be invalid, expired, or revoked." }, { status: 404, headers: { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, noarchive" } }); }
}
