import { getPortfolioPropertyComparisonRouteState } from "@/app/actions/portfolio-property-comparison-runtime";
import { PortfolioPropertyComparisonError, PortfolioPropertyComparisonView } from "@/features/portfolio-intelligence";

export default async function PortfolioPropertiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const scope = single(params.scope);
  const result = await getPortfolioPropertyComparisonRouteState({
    workspaceId: single(params.workspace),
    propertyIds: scope === "workspace" || !params.properties ? undefined : values(params.properties),
    periodPreset: period(single(params.period)), comparisonType: comparison(single(params.comparison)),
    metricFamily: family(single(params.family)), normalization: normalization(single(params.normalize)),
    grouping: grouping(single(params.group)), view: view(single(params.view)),
    selectedPropertyId: single(params.property), sortBy: sort(single(params.sort)),
    sortDirection: single(params.direction) === "ascending" ? "ascending" : "descending",
  });
  return result.ok ? <PortfolioPropertyComparisonView comparison={result.comparison} /> : <PortfolioPropertyComparisonError message={result.message} />;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function values(value: string | string[]) { return Array.isArray(value) ? value : [value]; }
function period(value?: string) { return value === "30d" || value === "ytd" || value === "12m" ? value : "90d"; }
function comparison(value?: string) { return value === "previous-year" || value === "none" ? value : "previous-period"; }
function family(value?: string) { return value === "financial" || value === "operational" || value === "guest" || value === "evidence" ? value : "revenue"; }
function normalization(value?: string) { return value === "available-night" || value === "booked-night" || value === "property" || value === "bedroom" ? value : "absolute"; }
function grouping(value?: string) { return value === "market" || value === "property-type" || value === "operating-model" || value === "acquisition-strategy" ? value : "none"; }
function view(value?: string) { return value === "contribution" || value === "momentum" ? value : "table"; }
function sort(value?: string) { return value === "name" || value === "revenue-change" || value === "occupancy" || value === "revpar" || value === "burden" || value === "confidence" ? value : "revenue"; }
