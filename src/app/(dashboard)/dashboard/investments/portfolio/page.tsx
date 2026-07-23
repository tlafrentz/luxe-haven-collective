import { getInvestmentOpportunityRequestContext } from "@/app/actions/investment-opportunity-runtime";
import { loadPortfolioWorkspace, type PortfolioWorkspaceFilter, type PortfolioWorkspaceView } from "@/features/investment-opportunity";
import { PortfolioWorkspace, parsePortfolioRoute, parsePortfolioStatus } from "@/features/investment-opportunity/components";

const empty: PortfolioWorkspaceView = { metrics: { evaluating: 0, researching: 0, shortlisted: 0, underContract: 0, acquired: 0 }, opportunities: [], empty: true };
export default async function InvestmentPortfolioPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams, status = parsePortfolioStatus(single(params.status)), route = parsePortfolioRoute(single(params.route));
  const filter: PortfolioWorkspaceFilter = { ...(status ? { statuses: [status] } : {}), ...(route ? { route } : {}), ...(single(params.archived) === "true" ? { includeArchived: true } : {}), ...(single(params.search)?.trim() ? { search: single(params.search)?.trim() } : {}), ...(single(params.cursor) ? { cursor: single(params.cursor) } : {}) };
  const context = await getInvestmentOpportunityRequestContext();
  const view = context.ok ? await loadPortfolioWorkspace(context.repository, context.ownerId, filter) : empty;
  return <PortfolioWorkspace view={view} filter={filter} />;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
