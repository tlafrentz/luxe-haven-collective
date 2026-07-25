import { getPortfolioDecisionsRouteState } from "@/app/actions/portfolio-decisions-runtime";
import { PortfolioDecisionsError, PortfolioDecisionsView } from "@/features/portfolio-intelligence";

export default async function PortfolioDecisionsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = single(params.scope);
  const result = await getPortfolioDecisionsRouteState({
    workspaceId: single(params.workspace),
    propertyIds: scope === "workspace" || !params.properties ? undefined : values(params.properties),
    periodPreset: period(single(params.period)),
    comparisonType: comparison(single(params.comparison)),
  });
  return result.ok ? <PortfolioDecisionsView workspace={result.workspace} /> : <PortfolioDecisionsError message={result.message} />;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function values(value: string | string[]) { return Array.isArray(value) ? value : [value]; }
function period(value?: string) { return value === "30d" || value === "ytd" || value === "12m" ? value : "90d"; }
function comparison(value?: string) { return value === "previous-year" || value === "none" ? value : "previous-period"; }

