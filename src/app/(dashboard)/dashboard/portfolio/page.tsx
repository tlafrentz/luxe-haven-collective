import { getPortfolioOverviewRouteState } from "@/app/actions/portfolio-overview-runtime";
import { PortfolioOverviewError, PortfolioOverviewView } from "@/features/portfolio-intelligence";
import Link from "next/link";

export default async function PortfolioDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const preset = period(single(params.period));
  const comparison = comparisonType(single(params.comparison));
  const scope = single(params.scope);
  const propertyIds = scope === "workspace" || !params.properties ? undefined : values(params.properties);
  const result = await getPortfolioOverviewRouteState({ workspaceId: single(params.workspace), propertyIds, periodPreset: preset, comparisonType: comparison });
  return result.ok ? <><div className="mx-auto flex max-w-7xl justify-end px-5 pt-5"><Link className="rounded-full border px-4 py-2 text-sm font-semibold" href={`/dashboard/reports/new?type=portfolio-performance${single(params.workspace)?`&workspace=${single(params.workspace)}`:""}`}>Generate portfolio report</Link></div><PortfolioOverviewView overview={result.overview} /></> : <PortfolioOverviewError message={result.message} />;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function values(value: string | string[]) { return Array.isArray(value) ? value : [value]; }
function period(value?: string) { return value === "30d" || value === "ytd" || value === "12m" ? value : "90d"; }
function comparisonType(value?: string) { return value === "previous-year" || value === "none" ? value : "previous-period"; }
