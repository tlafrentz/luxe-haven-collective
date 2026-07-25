import Link from "next/link";
import { getPortfolioOutcomesRouteState } from "@/app/actions/portfolio-outcomes-runtime";
import { PortfolioOutcomesError } from "@/features/portfolio-intelligence";

export default async function PortfolioOutcomeReviewPage({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  const result = await getPortfolioOutcomesRouteState({ periodPreset: "90d", comparisonType: "previous-period" });
  if (!result.ok) return <PortfolioOutcomesError message={result.message} />;
  const review = result.workspace.reviews.find(({ id }) => id === decodeURIComponent(reviewId));
  if (!review) return <PortfolioOutcomesError message="This immutable outcome review is unavailable in your authorized Workspace scope." />;
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8"><Link href="/dashboard/portfolio/outcomes" className="text-sm font-semibold">← Portfolio outcomes</Link><header className="rounded-[2rem] bg-stone-950 p-8 text-white"><p className="text-xs uppercase tracking-wide text-teal-200">Immutable decision review</p><h1 className="mt-3 text-3xl font-semibold">{review.decisionId}</h1><p className="mt-3 text-stone-300">{review.success.replaceAll("-", " ")} · assessment version {review.assessmentVersion}</p></header><section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Lessons learned</h2><dl className="mt-4 space-y-4"><Item label="What happened" value={review.lessons.whatHappened} /><Item label="Why" value={review.lessons.why} /><Item label="What surprised us" value={review.lessons.surprise} /><Item label="Future guidance" value={review.lessons.futureGuidance} /></dl></section><section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Historical integrity</h2><p className="mt-2 text-sm text-stone-600">The expected outcomes and evidence version shown here are preserved from the approved decision. Later observations create new reviews and learning records; they do not rewrite this review.</p></section></main>;
}
function Item({ label, value }: Readonly<{ label: string; value: string }>) { return <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</dt><dd className="mt-1 text-sm text-stone-700">{value}</dd></div>; }

