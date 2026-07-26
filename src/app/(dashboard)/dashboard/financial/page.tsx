import { getFinancialOverviewRouteState, type FinancialComparisonType, type FinancialPeriodPreset } from "@/app/actions/financial-overview-runtime";
import { FinancialOverviewErrorView, FinancialOverviewView } from "@/features/financial-intelligence/presentation";
import Link from "next/link";

export default async function FinancialOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scope = single(params.scope);
  const propertyIds = scope === "workspace" || !params.properties ? undefined : values(params.properties);
  const result = await getFinancialOverviewRouteState({
    workspaceId: single(params.workspace), propertyIds,
    periodPreset: preset(single(params.period)), comparisonType: comparison(single(params.comparison)),
    customFrom: single(params.from), customTo: single(params.to),
  });
  return result.ok ? <><div className="mx-auto flex max-w-7xl justify-end px-5 pt-5"><Link className="rounded-full border px-4 py-2 text-sm font-semibold" href={`/dashboard/reports/new?type=financial-performance${single(params.workspace)?`&workspace=${single(params.workspace)}`:""}`}>Generate financial report</Link></div><FinancialOverviewView overview={result.overview} /></> : <FinancialOverviewErrorView code={result.code} message={result.message} />;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function values(value: string | string[]) { return Array.isArray(value) ? value : [value]; }
function preset(value?: string): FinancialPeriodPreset { return ["this-month", "last-month", "qtd", "ytd", "12m", "custom"].includes(value ?? "") ? value as FinancialPeriodPreset : "this-month"; }
function comparison(value?: string): FinancialComparisonType { return ["previous-period", "previous-year", "budget", "forecast", "none"].includes(value ?? "") ? value as FinancialComparisonType : "previous-period"; }
