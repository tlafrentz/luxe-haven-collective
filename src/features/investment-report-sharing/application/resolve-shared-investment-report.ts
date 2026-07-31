import { INVESTMENT_REPORT_SHARE_DEADLINE_MS, InvestmentReportShareError, buildSharedInvestmentReportView, deriveShareStatus, verifyShareCredential, type InvestmentReportShareGrant } from "../domain/investment-report-share";
import type { InvestmentReportSnapshot } from "@/features/investment-reports";

export type SharedReportSource = Readonly<{ title: string; strategy: "purchase" | "rental-arbitrage"; generatedAt: string; snapshot: InvestmentReportSnapshot }>;
export type SharedAccessRepository = Readonly<{
  findGrant(shareId: string): Promise<InvestmentReportShareGrant | null>;
  findReport(reportId: string): Promise<SharedReportSource | null>;
  record(shareId: string, event: "report-opened" | "pdf-downloaded" | "access-rejected", outcome: string, correlationId: string): Promise<void>;
}>;

export async function resolveSharedInvestmentReport(input: Readonly<{ shareId: string; secret: string; repository: SharedAccessRepository; now?: () => Date; deadlineMs?: number; forPdf?: boolean }>) {
  const correlationId = crypto.randomUUID(), now = input.now ?? (() => new Date());
  return deadline(resolve(input, correlationId, now), input.deadlineMs ?? INVESTMENT_REPORT_SHARE_DEADLINE_MS);
}
async function resolve(input: Parameters<typeof resolveSharedInvestmentReport>[0], correlationId: string, now: () => Date) {
  const grant = await input.repository.findGrant(input.shareId);
  if (!grant || !verifyShareCredential(input.secret, grant.credentialDigest)) throw new InvestmentReportShareError("SHARE_CREDENTIAL_INVALID", "This shared report is unavailable.");
  const status = deriveShareStatus(grant, now());
  if (status !== "active") {
    void input.repository.record(grant.id, "access-rejected", status, correlationId).catch(() => undefined);
    throw new InvestmentReportShareError(status === "expired" ? "SHARE_EXPIRED" : "SHARE_REVOKED", "This shared report is unavailable.");
  }
  if (input.forPdf && !grant.allowPdfDownload) throw new InvestmentReportShareError("SHARE_PDF_NOT_ALLOWED", "This shared report is unavailable.");
  const report = await input.repository.findReport(grant.reportId);
  if (!report) throw new InvestmentReportShareError("REPORT_NOT_FOUND", "This shared report is unavailable.");
  const view = buildSharedInvestmentReportView({ ...report, expiresAt: grant.expiresAt, allowPdfDownload: grant.allowPdfDownload });
  if (!input.forPdf) void input.repository.record(grant.id, "report-opened", "granted", correlationId).catch(() => undefined);
  return Object.freeze({ grant, report, view, correlationId });
}
export function deadline<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => { let settled = false; const timer = setTimeout(() => { if (!settled) { settled = true; reject(new InvestmentReportShareError("SHARED_REPORT_TEMPORARILY_UNAVAILABLE", "This shared report is temporarily unavailable.")); } }, milliseconds); operation.then(value => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } }, error => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } }); });
}
