import { INVESTMENT_REPORT_EXPORT_DEADLINE_MS, INVESTMENT_REPORT_EXPORT_MAX_BYTES, InvestmentReportExportError, buildInvestmentReportExportView, type InvestmentReportExportView } from "../domain/investment-report-export";
import type { InvestmentReportSnapshot } from "@/features/investment-reports";

export type ExportableInvestmentReport = Readonly<{ id: string; title: string; strategy: "purchase" | "rental-arbitrage"; status: "active" | "archived"; generatedAt: string; snapshot: InvestmentReportSnapshot }>;
export type InvestmentReportPdfRenderer = (view: InvestmentReportExportView) => Promise<Uint8Array>;
export type InvestmentReportExportTelemetry = (event: string, attributes: Readonly<Record<string, string | number>>) => void | Promise<void>;

export async function exportInvestmentReport(input: Readonly<{
  report: ExportableInvestmentReport; renderer: InvestmentReportPdfRenderer;
  now?: () => Date; deadlineMs?: number; telemetry?: InvestmentReportExportTelemetry;
}>) {
  const correlationId = crypto.randomUUID(), startedAt = Date.now(), now = input.now ?? (() => new Date());
  emit(input.telemetry, "investment_report_export_entered", { correlationId, reportId: input.report.id, strategy: input.report.strategy });
  emit(input.telemetry, "investment_report_export_snapshot_loaded", { correlationId, reportId: input.report.id, strategy: input.report.strategy, reportSchemaVersion: input.report.snapshot.schemaVersion });
  const view = buildInvestmentReportExportView({ reportId: input.report.id, title: input.report.title, strategy: input.report.strategy, generatedAt: input.report.generatedAt, snapshot: input.report.snapshot, exportedAt: now() });
  emit(input.telemetry, "investment_report_export_view_constructed", { correlationId, reportId: input.report.id, strategy: input.report.strategy, exportTemplateVersion: view.templateVersion });
  try {
    emit(input.telemetry, "investment_report_pdf_rendering_started", { correlationId, reportId: input.report.id, strategy: input.report.strategy });
    const bytes = await withDeadline(input.renderer(view), input.deadlineMs ?? INVESTMENT_REPORT_EXPORT_DEADLINE_MS);
    if (bytes.byteLength < 100 || bytes.byteLength > INVESTMENT_REPORT_EXPORT_MAX_BYTES || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      throw new InvestmentReportExportError("EXPORT_RENDER_FAILED", "The PDF renderer returned an invalid document.");
    }
    const durationMs = Date.now() - startedAt;
    emit(input.telemetry, "investment_report_pdf_rendering_completed", { correlationId, reportId: input.report.id, strategy: input.report.strategy, durationMs, byteSize: bytes.byteLength });
    emit(input.telemetry, "investment_report_export_completed", { correlationId, reportId: input.report.id, strategy: input.report.strategy, outcome: "completed", durationMs, byteSize: bytes.byteLength });
    return Object.freeze({ bytes, filename: view.filename, view, correlationId });
  } catch (error) {
    const classified = error instanceof InvestmentReportExportError ? error : new InvestmentReportExportError("EXPORT_RENDER_FAILED", "The PDF could not be generated. Please retry.");
    emit(input.telemetry, "investment_report_export_failed", { correlationId, reportId: input.report.id, strategy: input.report.strategy, failureClass: classified.code, durationMs: Date.now() - startedAt });
    throw classified;
  }
}

export function withDeadline<T>(operation: Promise<T>, deadlineMs: number): Promise<T> {
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) return Promise.reject(new InvestmentReportExportError("EXPORT_GENERATION_TIMEOUT", "PDF generation timed out. Please retry."));
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; reject(new InvestmentReportExportError("EXPORT_GENERATION_TIMEOUT", "PDF generation timed out. Please retry.")); } }, deadlineMs);
    operation.then(value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } }, () => { if (!settled) { settled = true; clearTimeout(timer); reject(new InvestmentReportExportError("EXPORT_RENDER_FAILED", "The PDF could not be generated. Please retry.")); } });
  });
}
function emit(telemetry: InvestmentReportExportTelemetry | undefined, event: string, attributes: Readonly<Record<string, string | number>>) { try { void Promise.resolve(telemetry?.(event, attributes)).catch(() => undefined); } catch { /* telemetry is non-critical */ } }
