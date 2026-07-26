import { createClient } from "@/lib/supabase/server";

export default async function AssumptionAdministrationPage() {
  const client = await createClient();
  const { data: isAdmin } = await client.rpc("is_admin");
  if (isAdmin !== true) return <Denied />;
  const { data } = await client.from("learning_assumptions")
    .select("id,statement,category,source_review_id,created_at")
    .order("created_at", { ascending: false }).limit(200);
  return <main className="mx-auto max-w-6xl space-y-6 px-5 py-10">
    <Header title="Assumption validation" description="Assumptions awaiting or preserving review-backed validation." />
    <section className="rounded-3xl border border-stone-200 bg-white p-6">
      {data?.length ? <ul className="space-y-3">{data.map(item =>
        <li key={item.id} className="rounded-xl bg-stone-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{item.category}</p>
          <p className="mt-1 font-medium">{item.statement}</p>
          <p className="mt-2 font-mono text-xs text-stone-500">Review {item.source_review_id}</p>
        </li>)}</ul> : <p className="text-sm text-stone-500">No assumptions are awaiting validation.</p>}
    </section>
  </main>;
}
function Denied(){return <main className="mx-auto max-w-3xl py-12"><p role="alert">Learning administration is unavailable.</p></main>}
function Header({title,description}:{title:string;description:string}){return <header><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-700">Learning governance</p><h1 className="mt-2 text-4xl font-semibold">{title}</h1><p className="mt-3 text-stone-600">{description}</p></header>}
