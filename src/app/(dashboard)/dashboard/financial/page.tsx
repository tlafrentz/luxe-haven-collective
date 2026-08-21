import { getFinancialOverviewRouteState, type FinancialComparisonType, type FinancialPeriodPreset } from "@/app/actions/financial-overview-runtime";
import { FinancialOverviewErrorView, FinancialOverviewView } from "@/features/financial-intelligence/presentation";

export default async function FinancialOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scope = single(params.scope);
  const propertyIds = scope === "workspace" || !params.properties ? undefined : values(params.properties);
  const periodPreset = single(params.from) && single(params.to) ? "custom" : preset(single(params.period));
  const comparisonType = comparison(single(params.comparison));
  const result = await getFinancialOverviewRouteState({
    workspaceId: single(params.workspace), propertyIds,
    periodPreset, comparisonType,
    customFrom: single(params.from), customTo: single(params.to),
  });
  if(!result.ok)return <FinancialOverviewErrorView code={result.code} message={result.message}/>;
  return <FinancialOverviewView overview={result.overview} controls={{ scopeType: scope ?? result.overview.scope.type, periodPreset, comparisonType }}/>;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function values(value: string | string[]) { return Array.isArray(value) ? value : [value]; }
function preset(value?: string): FinancialPeriodPreset { return ["this-month", "last-month", "qtd", "ytd", "12m", "custom"].includes(value ?? "") ? value as FinancialPeriodPreset : "last-month"; }
function comparison(value?: string): FinancialComparisonType { return ["previous-period", "previous-year", "budget", "forecast", "none"].includes(value ?? "") ? value as FinancialComparisonType : "previous-period"; }
