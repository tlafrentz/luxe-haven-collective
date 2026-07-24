import { getPortfolioDashboardRouteState } from "@/app/actions/portfolio-dashboard-runtime";
import { PortfolioDashboard } from "@/features/portfolio-intelligence";

export default async function PortfolioDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const portfolioId = single(params.portfolio);
  if (!portfolioId) return <PortfolioDashboardScopeRequired />;
  const end = parseDate(single(params.end)) ?? new Date();
  const start = parseDate(single(params.start)) ?? new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()));
  const result = await getPortfolioDashboardRouteState({ portfolioId, start, end, evaluatedAt: new Date() });
  return result.ok ? <PortfolioDashboard state={result.state} /> : <PortfolioDashboardRouteError code={result.code} />;
}
function PortfolioDashboardScopeRequired() {
  return <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><section role="status" className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Portfolio Intelligence</p><h1 className="mt-3 text-3xl font-semibold text-stone-950">Select a canonical portfolio.</h1><p className="mt-4 text-sm leading-6 text-stone-600">The executive dashboard is scoped by a PI-001 Portfolio identity. No property or acquisition membership is inferred.</p></section></main>;
}
function PortfolioDashboardRouteError({ code }: { code: string }) {
  const missing = code === "PORTFOLIO_DASHBOARD_NOT_FOUND";
  return <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><section role="alert" aria-live="assertive" className="rounded-[2rem] border border-rose-200 bg-white p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Portfolio Intelligence</p><h1 className="mt-3 text-3xl font-semibold text-stone-950">{missing ? "Portfolio not found." : "Portfolio dashboard is temporarily unavailable."}</h1><p className="mt-4 text-sm leading-6 text-stone-600">{missing ? "The portfolio does not exist or is outside your owner scope." : "Canonical intelligence could not be read. No condition, trend, capital value, or recommendation has been fabricated."}</p></section></main>;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function parseDate(value?: string) { if (!value) return null; const parsed = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(parsed.getTime()) ? null : parsed; }
