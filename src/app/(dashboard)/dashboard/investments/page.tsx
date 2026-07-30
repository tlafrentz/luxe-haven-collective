import { loadInvestmentOverviewPageData } from "@/app/actions/investment-overview-query";
import { InvestmentIntelligenceOverview } from "@/features/investment-intelligence/components/investment-intelligence-overview";
import { redirect } from "next/navigation";

export default async function InvestmentIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  if (params.strategy || params.opportunity || params.mode) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      for (const item of Array.isArray(value) ? value : value ? [value] : []) {
        query.append(key, item);
      }
    }

    redirect(`/dashboard/investments/new?${query}`);
  }

  const result = await loadInvestmentOverviewPageData();

  if (!result.ok) {
    return <InvestmentIntelligenceOverview failed />;
  }

  return (
    <InvestmentIntelligenceOverview
      view={result.view}
      scenarioCount={result.scenarioCount}
    />
  );
}
