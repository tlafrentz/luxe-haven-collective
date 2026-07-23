import { getInvestmentOpportunityRequestContext } from "@/app/actions/investment-opportunity-runtime";
import { loadPortfolioWorkspace } from "@/features/investment-opportunity";
import { InvestmentIntelligenceOverview } from "@/features/investment-intelligence/components/investment-intelligence-overview";
import { redirect } from "next/navigation";

export default async function InvestmentIntelligencePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.strategy || params.opportunity || params.mode) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
    }
    redirect(`/dashboard/investments/new?${query}`);
  }
  const context = await getInvestmentOpportunityRequestContext();
  if (!context.ok) return <InvestmentIntelligenceOverview failed />;
  let view;
  try {
    view = await loadPortfolioWorkspace(context.repository, context.ownerId, { limit: 5 });
  } catch {
    return <InvestmentIntelligenceOverview failed />;
  }
  return <InvestmentIntelligenceOverview view={view} />;
}
