import { PortfolioWorkspace } from "@/features/portfolio-intelligence";
import { getPortfolioWorkspaceRouteState } from "@/app/actions/portfolio-workspace-runtime";

export default async function PortfolioIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const portfolioId = single(params.portfolio);
  if (!portfolioId) return <PortfolioScopeRequired />;
  const end = parseDate(single(params.end)) ?? new Date();
  const start = parseDate(single(params.start)) ?? new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()));
  const result = await getPortfolioWorkspaceRouteState({ portfolioId, start, end, evaluatedAt: new Date() });
  if (!result.ok) return <PortfolioWorkspaceError code={result.code} />;
  return <PortfolioWorkspace state={result.state} />;
}

function PortfolioScopeRequired() {
  return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><section role="status" className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Portfolio Intelligence</p><h1 className="mt-3 text-3xl font-semibold text-stone-950">Select a canonical portfolio.</h1><p className="mt-4 text-sm leading-6 text-stone-600">Portfolio Intelligence is scoped by a PI-001 Portfolio identity. Once a canonical portfolio is selected, this route loads health, capital, allocation, composition, and lineage through one authorized server query.</p><p className="mt-4 rounded-xl bg-stone-50 p-4 text-sm text-stone-700">No property membership is inferred from the acquisition portfolio or property list.</p></section></div>;
}
function PortfolioWorkspaceError({ code }: { code: string }) {
  const notFound = code === "PORTFOLIO_WORKSPACE_NOT_FOUND";
  return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><section role="alert" aria-live="assertive" className="rounded-[2rem] border border-rose-200 bg-white p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Portfolio Intelligence</p><h1 className="mt-3 text-3xl font-semibold text-stone-950">{notFound ? "Portfolio not found." : "Portfolio workspace is temporarily unavailable."}</h1><p className="mt-4 text-sm leading-6 text-stone-600">{notFound ? "The portfolio does not exist or is outside your owner scope." : "Canonical portfolio storage or compatible assessments could not be read. No health, capital, or allocation values have been fabricated."}</p></section></div>;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function parseDate(value?: string) { if (!value) return null; const parsed = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(parsed.getTime()) ? null : parsed; }
