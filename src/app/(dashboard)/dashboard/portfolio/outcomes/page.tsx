import { getPortfolioOutcomesRouteState } from "@/app/actions/portfolio-outcomes-runtime";
import { PortfolioOutcomesError, PortfolioOutcomesView } from "@/features/portfolio-intelligence";

export default async function PortfolioOutcomesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const result = await getPortfolioOutcomesRouteState({
    workspaceId: single(params.workspace), periodPreset: period(single(params.period)),
    comparisonType: comparison(single(params.comparison)),
  });
  return result.ok ? <PortfolioOutcomesView workspace={result.workspace} /> : <PortfolioOutcomesError message={result.message} />;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function period(value?: string) { return value === "30d" || value === "ytd" || value === "12m" ? value : "90d"; }
function comparison(value?: string) { return value === "previous-year" || value === "none" ? value : "previous-period"; }

