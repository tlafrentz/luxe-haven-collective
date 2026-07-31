import { notFound } from "next/navigation";
import { getInvestmentReport } from "@/app/actions/investment-reports";
import { InvestmentReportDetail } from "@/features/investment-reports/components";
import { listInvestmentReportShares } from "@/app/actions/investment-report-sharing";
import { InvestmentReportShareManager } from "@/features/investment-report-sharing/components";

export default async function InvestmentReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params, [report, shares] = await Promise.all([getInvestmentReport(reportId), listInvestmentReportShares(reportId)]);
  if (!report) notFound();
  return <><InvestmentReportDetail report={report} /><InvestmentReportShareManager reportId={report.id} reportStatus={report.status} shares={shares ?? []} /></>;
}
