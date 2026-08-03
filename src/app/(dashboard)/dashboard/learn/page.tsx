import Link from "next/link";
import { getPlatformLearningWorkspace } from "@/app/actions/platform-learning-workspace";
import { Empty, LearningHeader, LessonCard, Metric, ReviewRow } from "@/components/learning/learning-workspace-ui";

export default async function LearnOutcomesPage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace } = await searchParams;
  const model = await getPlatformLearningWorkspace(workspace);
  const { metrics, health, recentLessons, recentReviews } = model.dashboard;

  return <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
    <LearningHeader title="Outcomes" description="Measure completed work, review what changed, and promote supported learning into trusted organizational knowledge." />
    <section aria-label="Learning overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Metric label="Outcome reviews due" value={metrics.reviewsReady + metrics.reviewsOverdue} detail={`${metrics.reviewsOverdue} overdue`} />
      <Metric label="Candidate lessons" value={metrics.candidateLessons} />
      <Metric label="Validated lessons" value={metrics.validatedLessons} />
      <Metric label="Contradictions" value={metrics.contradictedLessons} />
      <Metric label="Knowledge gaps" value={model.gaps.length} />
    </section>
    <section className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Outcome reviews</h2><Link className="text-sm font-semibold text-teal-800" href="/dashboard/learn/outcomes">View all →</Link></div>
        {recentReviews.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><caption className="sr-only">Recent outcome reviews</caption><thead><tr><th className="p-4">Review</th><th className="p-4">Status</th><th className="p-4">Result</th><th className="p-4">Confidence</th><th className="p-4">Completed</th></tr></thead><tbody>{recentReviews.map(review => <ReviewRow key={review.id} review={review} />)}</tbody></table></div> : <div className="mt-4"><Empty title="No outcomes to review" detail="Completed actions with measurement plans will appear here." /></div>}
      </div>
      <aside className="rounded-2xl border bg-white p-5"><p className="text-sm text-stone-500">Knowledge health</p><p className="mt-3 text-4xl font-semibold">{health.score}<span className="text-lg text-stone-400">/100</span></p><p className="mt-2 text-sm capitalize text-stone-600">{health.status} · supporting indicator</p><progress className="mt-5 w-full accent-teal-700" value={health.score} max={100}>{health.score}%</progress></aside>
    </section>
    <section>
      <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">Recent validated knowledge</h2><Link className="text-sm font-semibold text-teal-800" href="/dashboard/learn/lessons">Open knowledge →</Link></div>
      {recentLessons.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{recentLessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)}</div> : <div className="mt-4"><Empty title="No validated lessons yet" detail="Outcome reviews may propose candidates; validation is always explicit." /></div>}
    </section>
  </main>;
}
