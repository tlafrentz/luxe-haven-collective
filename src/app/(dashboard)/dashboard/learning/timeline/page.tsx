import Link from "next/link";
import{getPlatformLearningTimeline}from"@/app/actions/platform-learning-workspace";
import{Empty,LearningHeader}from"@/components/learning/learning-workspace-ui";
export default async function LearningTimelinePage({searchParams}:{searchParams:Promise<{workspace?:string}>}){
  const{workspace}=await searchParams,items=await getPlatformLearningTimeline(workspace);
  return <main className="mx-auto max-w-5xl space-y-8 px-5 py-10"><LearningHeader title="Learning Timeline" description="What changed in organizational knowledge, why confidence changed, and which validations or retirements created the change."/>
    {items.length?<ol className="overflow-hidden rounded-3xl border bg-white">{items.map((item,index)=><li className={`grid gap-3 p-5 sm:grid-cols-[150px_1fr_auto] ${index?"border-t":""}`} key={item.id}><time className="text-sm text-stone-500">{new Date(item.occurredAt).toLocaleString()}</time><div><p className="font-semibold capitalize">{item.type.replaceAll("-"," ")}</p><p className="mt-1 text-sm text-stone-600">{item.summary}</p></div>{item.referenceId?<Link className="text-sm font-semibold text-teal-800" href={item.type.includes("lesson")?`/dashboard/learning/lessons/${item.referenceId}`:"/dashboard/learning/reviews"}>Inspect →</Link>:null}</li>)}</ol>:<Empty title="No learning changes yet" detail="Completed outcome reviews, validations, confidence changes, and retired assumptions will appear here."/>}
  </main>
}
