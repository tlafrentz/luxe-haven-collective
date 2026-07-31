import type { Metadata } from "next";
import { resolveSharedInvestmentReport } from "@/features/investment-report-sharing";
import { SharedInvestmentReport, SharedReportUnavailable } from "@/features/investment-report-sharing/components";
import { createSharedAccessRepository } from "@/app/actions/investment-report-sharing-runtime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared Investment Report | Luxe Haven Collective", robots: { index: false, follow: false, noarchive: true }, referrer: "no-referrer" };
export default async function SharedInvestmentReportPage({ params }: { params: Promise<{ shareId: string; secret: string }> }) {
  const { shareId, secret } = await params;
  const result = await resolveSharedInvestmentReport({ shareId, secret, repository: createSharedAccessRepository() }).catch(() => null);
  return result ? <SharedInvestmentReport view={result.view} /> : <SharedReportUnavailable />;
}
