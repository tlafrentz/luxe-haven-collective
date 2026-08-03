import Link from "next/link";
import type {
  KnowledgeGap, LearningContradictionSummary, LearningHealth,
  LearningWorkspaceLesson, LearningWorkspaceReview,
} from "@/platform/learning";
import { LearningWorkspaceNavigation } from "./learning-workspace-navigation";

export function LearningHeader({ title, description }: { title: string; description: string }) {
  return <header><p className="text-xs font-semibold uppercase tracking-[.2em] text-teal-700">Learn · Remember · Improve</p><h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-950">{title}</h1><p className="mt-3 max-w-3xl text-stone-600">{description}</p><LearningWorkspaceNavigation /></header>;
}

export function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <article className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p>{detail?<p className="mt-1 text-xs text-stone-500">{detail}</p>:null}</article>;
}
export function LessonCard({ lesson }: { lesson: LearningWorkspaceLesson }) {
  return <article className="rounded-2xl border border-stone-200 bg-white p-5"><div className="flex flex-wrap items-center gap-2"><Tag>{lesson.category}</Tag><Tag>{lesson.maturity}</Tag><Tag>{lesson.confidence} confidence</Tag>{lesson.contradictionState!=="none"?<Tag>Contradiction {lesson.contradictionState}</Tag>:null}</div><h3 className="mt-4 text-lg font-semibold"><Link className="hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" href={`/dashboard/learn/lessons/${lesson.id}`}>{lesson.title}</Link></h3><p className="mt-2 text-sm leading-6 text-stone-600">{lesson.statement}</p><p className="mt-4 text-xs text-stone-500">{lesson.sourceReviewIds.length} supporting reviews · {lesson.evidenceCount} evidence references · revision {lesson.revision}</p><div className="mt-3 flex flex-wrap gap-2">{lesson.applicability.map((item,index)=><span key={`${item.dimension}:${item.referenceId??item.value}:${index}`} className="rounded-md bg-teal-50 px-2 py-1 text-xs text-teal-900">{item.dimension}: {item.value??item.referenceId}</span>)}</div></article>;
}
export function ReviewRow({ review }: { review: LearningWorkspaceReview }) {
  return <tr className="border-t"><td className="p-4"><Link className="font-semibold hover:text-teal-800" href={`/dashboard/learn/outcomes/${review.id}`}>Review {review.seriesId}</Link><span className="block text-xs text-stone-500">Plan revision {review.planRevision} · Review revision {review.revision}</span></td><td className="p-4 capitalize">{review.status.replaceAll("-"," ")}</td><td className="p-4 capitalize">{review.summaryStatus?.replaceAll("-"," ")??"Pending"}</td><td className="p-4 capitalize">{review.confidence.replaceAll("-"," ")}</td><td className="p-4">{review.completedAt?new Date(review.completedAt).toLocaleDateString():"Not completed"}</td></tr>;
}
export function GapCard({ gap }: { gap: KnowledgeGap }) {
  return <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-2"><Tag>{gap.severity} priority</Tag><Tag>{gap.expectedImpact} potential value</Tag></div><h3 className="mt-3 font-semibold">{gap.title}</h3><p className="mt-2 text-sm text-stone-700">{gap.detail}</p><dl className="mt-4 space-y-3 text-sm"><div><dt className="font-semibold">Suggested evidence</dt><dd className="text-stone-600">{gap.suggestedEvidence}</dd></div><div><dt className="font-semibold">Suggested action</dt><dd className="text-stone-600">{gap.suggestedAction}</dd></div></dl><Link className="mt-4 inline-flex text-sm font-semibold text-teal-800" href={gap.href}>Investigate gap →</Link></article>;
}
export function ContradictionCard({ contradiction }: { contradiction: LearningContradictionSummary }) {
  return <article className="rounded-2xl border border-rose-200 bg-rose-50 p-5"><Tag>{contradiction.state}</Tag><h3 className="mt-3 font-semibold">Conflicting knowledge retained</h3><p className="mt-2 text-sm text-stone-700">{contradiction.rationale}</p><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><Link className="rounded-lg bg-white p-3 font-mono text-xs" href={`/dashboard/learning/lessons/${contradiction.firstLessonId}`}>Lesson A: {contradiction.firstLessonId}</Link><Link className="rounded-lg bg-white p-3 font-mono text-xs" href={`/dashboard/learning/lessons/${contradiction.secondLessonId}`}>Lesson B: {contradiction.secondLessonId}</Link></div></article>;
}
export function HealthGrid({ health }: { health: LearningHealth }) {
  const cells:[string,number][]=[["Coverage",health.coverage],["Freshness",health.freshness],["Evidence quality",health.evidenceQuality],["Review completion",health.reviewCompletion],["Lesson maturity",health.maturity],["Confidence",health.confidence]];
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cells.map(([label,value])=><article key={label} className="rounded-2xl border bg-white p-5"><div className="flex justify-between text-sm"><span>{label}</span><strong>{Math.round(value*100)}%</strong></div><progress className="mt-3 w-full accent-teal-700" value={value} max={1}>{Math.round(value*100)}%</progress></article>)}</div>;
}
export function Empty({title,detail}:{title:string;detail:string}){return <section role="status" className="rounded-3xl border border-dashed border-stone-300 bg-white p-10 text-center"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-stone-600">{detail}</p></section>}
function Tag({children}:{children:React.ReactNode}){return <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold capitalize text-stone-700">{children}</span>}
