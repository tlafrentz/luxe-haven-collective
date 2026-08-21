import { getFinancialOverviewRouteState } from "@/app/actions/financial-overview-runtime";
import { FinancialOverviewErrorView, FinancialOverviewView } from "@/features/financial-intelligence/presentation";

export default async function FinancialOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const from = single(params.from), to = single(params.to);
  const result = await getFinancialOverviewRouteState({
    workspaceId: single(params.workspace),
    periodPreset: from && to ? "custom" : "last-month", comparisonType: "previous-period",
    customFrom: from, customTo: to,
  });
  if(!result.ok)return <FinancialOverviewErrorView code={result.code} message={result.message}/>;
  return <FinancialOverviewView overview={result.overview}/>;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
