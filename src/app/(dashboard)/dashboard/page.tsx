import Link from "next/link";
import { filterOperationalProjection, getOperationalSurfaceProjection } from "@/features/operational-surfaces";
import { requireUser } from "@/lib/auth/session";

type HomePageProps = Readonly<{ searchParams: Promise<{ property?: string; start?: string; end?: string; from?: string; to?: string }> }>;

export default async function HomePage({ searchParams }: HomePageProps) {
  const [{ user, profile }, params] = await Promise.all([requireUser(), searchParams]);
  const full = await getOperationalSurfaceProjection({
    principal: { userId: user.id, workspaceId: user.id, role: profile?.role ?? "guest" },
    workspaceLabel: profile?.full_name ? `${profile.full_name}'s Workspace` : "Luxe Haven Workspace",
  });
  // Keep Home synchronized with the canonical shared Workspace Context. The
  // visual dashboard consumes this projection as its live-data boundary.
  const projection = filterOperationalProjection(full, {
    propertyId: params.property,
    startDate: params.from??params.start,
    endDate: params.to??params.end,
  });
  const cards = [
    ["Arrivals today", projection.home.arrivalsToday],
    ["Guests in stay", projection.home.guestsInStay],
    ["Departures today", projection.home.departuresToday],
    ["Open operational issues", projection.home.openOperationalIssues],
  ] as const;
  return <main className="mx-auto max-w-[1480px] space-y-6 px-5 py-8">
    <header><h1 className="text-3xl font-semibold">Home</h1><p className="mt-2 text-sm text-stone-600">Current operations for {projection.workspace.label}.</p></header>
    <section aria-label="Today" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label,value])=><article className="rounded-2xl border bg-white p-5" key={label}><p className="text-sm font-semibold text-stone-600">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></article>)}</section>
    <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <div className="rounded-2xl border bg-white p-5"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Properties</h2><Link className="text-sm font-semibold text-teal-800" href="/properties">View properties →</Link></div>{projection.properties.length?<div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b text-stone-500"><th className="py-3">Property</th><th className="py-3">Market</th><th className="py-3">Current guests</th><th className="py-3">Upcoming arrivals</th><th className="py-3">Data quality</th></tr></thead><tbody>{projection.properties.map(({property,currentGuests,upcomingArrivals,quality})=><tr className="border-b last:border-0" key={property.id}><td className="py-3 font-semibold">{property.name}</td><td className="py-3">{property.marketLabel??"Not configured"}</td><td className="py-3">{currentGuests}</td><td className="py-3">{upcomingArrivals}</td><td className="py-3 capitalize">{quality.status.replaceAll("-"," ")}</td></tr>)}</tbody></table></div>:<p className="mt-4 rounded-xl bg-stone-50 p-5 text-sm text-stone-600">No properties are available in the selected workspace scope.</p>}</div>
      <div className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-semibold">Operational data</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-stone-500">Provider</dt><dd className="mt-1 font-semibold">{projection.providerLabel}</dd></div><div><dt className="text-stone-500">Synchronization</dt><dd className="mt-1 font-semibold capitalize">{projection.synchronization.status.replaceAll("-"," ")}</dd></div><div><dt className="text-stone-500">Workspace quality</dt><dd className="mt-1 font-semibold capitalize">{projection.quality.status.replaceAll("-"," ")}</dd></div><div><dt className="text-stone-500">Evaluated</dt><dd className="mt-1 font-semibold">{new Date(projection.quality.evaluatedAt).toLocaleString()}</dd></div></dl><Link className="mt-5 inline-flex text-sm font-semibold text-teal-800" href="/dashboard/workspace/health">Review data health →</Link></div>
    </section>
  </main>;
}
