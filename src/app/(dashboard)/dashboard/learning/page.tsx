import { getContinuousImprovementWorkspaceRouteState } from "@/app/actions/learning-workspace-runtime";
import { ContinuousImprovementWorkspaceView } from "@/features/learning-intelligence";

export default async function LearningWorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const portfolioId = single(params.portfolio);
  if (!portfolioId) return <ScopeRequired />;
  const end = parseDate(single(params.end)) ?? new Date();
  const start = parseDate(single(params.start)) ?? new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate()));
  const result = await getContinuousImprovementWorkspaceRouteState({ portfolioId, observationWindow: Object.freeze({ start, end }) });
  return result.ok ? <ContinuousImprovementWorkspaceView state={result.state} /> : <RouteError code={result.code} />;
}
function ScopeRequired() {
  return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><section role="status" className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Learn · Continuous Improvement</p><h1 className="mt-3 text-3xl font-semibold text-stone-950">Select a canonical portfolio.</h1><p className="mt-4 text-sm leading-6 text-stone-600">Learning Intelligence is owner scoped and never infers portfolio membership from presentation data. Open this workspace from a portfolio or provide its canonical portfolio identifier.</p></section></div>;
}
function RouteError({ code }: { code: string }) {
  const missing = code === "LEARNING_WORKSPACE_NOT_FOUND" || code === "LEARNING_WORKSPACE_NOT_AUTHORIZED";
  return <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><section role="alert" aria-live="assertive" className="rounded-[2rem] border border-rose-200 bg-white p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">Continuous Improvement</p><h1 className="mt-3 text-3xl font-semibold text-stone-950">{missing ? "Portfolio not found." : "Learning Intelligence is temporarily unavailable."}</h1><p className="mt-4 text-sm leading-6 text-stone-600">{missing ? "The portfolio does not exist or is outside your owner scope." : "Canonical Learning Intelligence could not be read. No Outcome, trend, effectiveness assessment, or learning has been fabricated."}</p></section></div>;
}
function single(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function parseDate(value?: string) { if (!value) return null; const parsed = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(parsed.getTime()) ? null : parsed; }
