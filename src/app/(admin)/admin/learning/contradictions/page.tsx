import { createClient } from "@/lib/supabase/server";

export default async function ContradictionAdministrationPage() {
  const client = await createClient();
  const { data: isAdmin } = await client.rpc("is_admin");
  if (isAdmin !== true) return <main className="mx-auto max-w-3xl py-12"><p role="alert">Learning administration is unavailable.</p></main>;
  const { data } = await client.from("learning_lesson_relationships")
    .select("id,from_lesson_id,to_lesson_id,contradiction_state,rationale,created_at")
    .eq("relationship_type","contradicts").order("created_at",{ascending:false}).limit(200);
  return <main className="mx-auto max-w-6xl space-y-6 px-5 py-10"><header><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-700">Learning governance</p><h1 className="mt-2 text-4xl font-semibold">Contradictions</h1><p className="mt-3 text-stone-600">Overlapping, opposing knowledge retained for refinement or resolution.</p></header><section className="rounded-3xl border border-stone-200 bg-white p-6">{data?.length?<ul className="space-y-3">{data.map(x=><li key={x.id} className="rounded-xl bg-stone-50 p-4"><p className="font-medium">{x.contradiction_state}: {x.rationale}</p><p className="mt-2 font-mono text-xs text-stone-500">{x.from_lesson_id} ↔ {x.to_lesson_id}</p></li>)}</ul>:<p className="text-sm text-stone-500">No possible or confirmed contradictions require review.</p>}</section></main>;
}
