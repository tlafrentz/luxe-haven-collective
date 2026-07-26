import { getIncomeStatementRouteState } from "@/app/actions/income-statement-runtime";
import type { FinancialPeriodPreset } from "@/app/actions/financial-overview-runtime";
import { IncomeStatementErrorView, IncomeStatementView } from "@/features/financial-intelligence/presentation";

export default async function ProfitabilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, scope = single(params.scope);
  const result = await getIncomeStatementRouteState({
    workspaceId: single(params.workspace), propertyIds: scope === "workspace" || !params.properties ? undefined : values(params.properties),
    periodPreset: preset(single(params.period)), comparisonType: comparison(single(params.comparison)),
    customFrom: single(params.from), customTo: single(params.to),
  });
  return result.ok ? <IncomeStatementView statement={result.statement} /> : <IncomeStatementErrorView code={result.code} message={result.message} />;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function values(value: string | string[]) { return Array.isArray(value) ? value : [value]; }
function preset(value?: string): FinancialPeriodPreset { return ["this-month", "last-month", "qtd", "ytd", "12m", "custom"].includes(value ?? "") ? value as FinancialPeriodPreset : "this-month"; }
function comparison(value?: string) { return value === "previous-year" || value === "none" ? value : "previous-period"; }
