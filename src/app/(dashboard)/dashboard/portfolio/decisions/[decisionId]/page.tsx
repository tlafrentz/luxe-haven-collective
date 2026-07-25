import Link from "next/link";
import { getPortfolioDecisionsRouteState } from "@/app/actions/portfolio-decisions-runtime";
import { PortfolioDecisionsError } from "@/features/portfolio-intelligence";
import { PortfolioDecisionReviewControls } from "@/features/portfolio-intelligence/presentation/portfolio-decision-review-controls";

export default async function PortfolioDecisionDetailPage({ params }: { params: Promise<{ decisionId: string }> }) {
  const { decisionId } = await params;
  const result = await getPortfolioDecisionsRouteState({ periodPreset: "90d", comparisonType: "previous-period" });
  if (!result.ok) return <PortfolioDecisionsError message={result.message} />;
  const candidate = result.workspace.candidates.find(({ id }) => id === decodeURIComponent(decisionId))
    ?? result.workspace.candidates.find(({ id }) => id === result.workspace.decisions.find(({ decisionId: id }) => id === decodeURIComponent(decisionId))?.recommendationId);
  const decision = result.workspace.decisions.find(({ decisionId: id }) => id === decodeURIComponent(decisionId));
  if (!candidate && !decision) return <PortfolioDecisionsError message="This recommendation or decision is unavailable in your authorized portfolio scope." />;
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <Link href="/dashboard/portfolio/decisions" className="text-sm font-semibold">← Portfolio decisions</Link>
    <header className="rounded-[2rem] bg-stone-950 p-8 text-white"><p className="text-xs uppercase tracking-wide text-teal-200">Decision review</p><h1 className="mt-3 text-3xl font-semibold">{decision?.question ?? candidate?.title}</h1><p className="mt-3 text-stone-300">{decision?.rationale ?? candidate?.description}</p></header>
    <section className="rounded-2xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-semibold">Governed review</h2><p className="mt-2 text-sm leading-6 text-stone-600">Review alternatives, evidence, assumptions, dependencies, resource requirements, tradeoffs, expected outcomes, and the review date before submitting an idempotent approval command. Approval is restricted to an authorized workspace owner and creates an editable Action Center plan; it does not move funds.</p></section>
    {candidate ? <section className="rounded-2xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-semibold">Alternatives</h2><ul className="mt-4 space-y-4">{candidate.alternatives.map((item) => <li key={item.id}><h3 className="font-semibold">{item.label}{item.baseline ? " — baseline" : ""}</h3><p className="text-sm text-stone-600">{item.description}</p><p className="mt-1 text-xs">Tradeoffs: {item.tradeoffs.join(" ")}</p></li>)}</ul></section> : null}
    {candidate ? <PortfolioDecisionReviewControls candidate={candidate} decision={decision} canApprove={result.workspace.canApprove} /> : null}
  </main>;
}
