import { getLearningDashboardRouteState } from "@/app/actions/learning-workspace-runtime";
import { LearningIntelligenceDashboardView } from "@/features/learning-intelligence";

export default async function LearningDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const portfolioId = single(params.portfolio);
  if (!portfolioId) return <ScopeRequired />;
  const end = parseDate(single(params.end)) ?? new Date();
  const start = parseDate(single(params.start)) ?? new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()));
  const result = await getLearningDashboardRouteState({ portfolioId, observationWindow: Object.freeze({ start, end }) });
  return result.ok ? <LearningIntelligenceDashboardView state={result.state} /> : <RouteError code={result.code} />;
}
function ScopeRequired() { return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><section role="status" className="rounded-3xl border border-stone-200 bg-white p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Learn · Learning Intelligence</p><h1 className="mt-3 text-3xl font-semibold">Select a canonical portfolio.</h1><p className="mt-4 text-sm leading-6 text-stone-600">The executive dashboard is owner scoped and does not infer portfolio membership.</p></section></div>; }
function RouteError({ code }: { code: string }) { const missing = code === "LEARNING_DASHBOARD_NOT_FOUND" || code === "LEARNING_DASHBOARD_NOT_AUTHORIZED"; return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><section role="alert" aria-live="assertive" className="rounded-3xl border border-rose-200 bg-white p-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Learning Intelligence</p><h1 className="mt-3 text-3xl font-semibold">{missing ? "Portfolio not found." : "Learning Intelligence is temporarily unavailable."}</h1><p className="mt-4 text-sm text-stone-600">No Outcome, recommendation, trend, or learning has been fabricated.</p></section></div>; }
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function parseDate(value?: string) { if (!value) return null; const parsed = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(parsed.getTime()) ? null : parsed; }
