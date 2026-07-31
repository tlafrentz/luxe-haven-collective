import { listInvestmentReports } from "@/app/actions/investment-reports";
import { InvestmentReportLibrary } from "@/features/investment-reports/components";

export default async function InvestmentReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; error?: string }> }) {
  const query = await searchParams, status = query.status === "archived" ? "archived" : "active";
  const result = await listInvestmentReports(status, Math.max(1, Number(query.page) || 1));
  return <InvestmentReportLibrary reports={result?.reports ?? []} status={status} error={!result || !result.ok || query.error ? query.error ?? "retrieval-failed" : undefined} />;
}
