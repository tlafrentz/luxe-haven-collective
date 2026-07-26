import { createClient } from "@/lib/supabase/server";

export default async function LessonAdministrationPage() {
  const client = await createClient();
  const { data: isAdmin } = await client.rpc("is_admin");
  if (isAdmin !== true) return <main className="mx-auto max-w-3xl py-12"><p role="alert">Learning administration is unavailable.</p></main>;
  const [{ data: candidates }, { data: lessons }] = await Promise.all([
    client.from("learning_candidate_lessons").select("id,statement,category,status,confidence,created_at").order("created_at",{ascending:false}).limit(100),
    client.from("learning_lesson_versions").select("id,series_id,revision,statement,category,status,maturity,confidence,created_at").order("created_at",{ascending:false}).limit(200),
  ]);
  return <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
    <header><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-700">Learning governance</p><h1 className="mt-2 text-4xl font-semibold">Lessons</h1><p className="mt-3 text-stone-600">Candidate review and immutable organizational-knowledge versions.</p></header>
    <section className="grid gap-4 sm:grid-cols-3"><Card label="Candidates" value={candidates?.length??0}/><Card label="Validated" value={(lessons??[]).filter(x=>x.status==="validated").length}/><Card label="Retired" value={(lessons??[]).filter(x=>x.status==="retired").length}/></section>
    <section className="rounded-3xl border border-stone-200 bg-white p-6"><h2 className="text-xl font-semibold">Knowledge versions</h2>{lessons?.length?<div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Lesson</th><th className="p-3">State</th><th className="p-3">Maturity</th><th className="p-3">Confidence</th></tr></thead><tbody>{lessons.map(x=><tr key={x.id} className="border-b last:border-0"><td className="p-3"><p>{x.statement}</p><p className="font-mono text-xs text-stone-500">{x.series_id} · v{x.revision}</p></td><td className="p-3">{x.status}</td><td className="p-3">{x.maturity}</td><td className="p-3">{x.confidence}</td></tr>)}</tbody></table></div>:<p className="mt-4 text-sm text-stone-500">No published organizational knowledge exists yet.</p>}</section>
  </main>;
}
function Card({label,value}:{label:string;value:number}){return <div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>}
