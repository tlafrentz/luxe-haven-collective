import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { getAdminCustomers,getFoundingPartnerReviewsDue,getProgramFilterOptions } from "@/features/admin/application/operations-overview";
import Link from "next/link";

const FORMER_STAGES=["converted","declined","exited"];
const ACTIVE_STAGES=["onboarding","active"];

export default async function CustomersPage({searchParams}:{searchParams:Promise<{program?:string;cohort?:string;lifecycle?:string;status?:string}>}) {
  const query=await searchParams,
    [allCustomers,filterOptions,reviewsDue]=await Promise.all([getAdminCustomers(),getProgramFilterOptions(),getFoundingPartnerReviewsDue()]),
    customers=allCustomers.filter(customer=>
      (!query.program||customer.program===query.program)&&
      (!query.cohort||customer.cohort===query.cohort)&&
      (!query.lifecycle||customer.lifecycleStage===query.lifecycle)&&
      (!query.status||(query.status==="active"?ACTIVE_STAGES.includes(customer.lifecycleStage):FORMER_STAGES.includes(customer.lifecycleStage)))
    );
  const paramsWith=(overrides:Record<string,string|undefined>)=>{const next=new URLSearchParams();for(const [k,v] of Object.entries({...query,...overrides}))if(v)next.set(k,v);const s=next.toString();return s?`?${s}`:"";};
  return <div className="space-y-8 py-8">
    <AdminPageHeader title="Customers" description="Manage canonical customers, prospects, offers, programs, and activity." />
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      <Link className="rounded-full border px-3 py-2" href="/admin/customers">All</Link>
      <Link className="rounded-full border px-3 py-2" href="/admin/customers?lifecycle=prospect">Prospects</Link>
      <Link className="rounded-full border px-3 py-2" href="/admin/customers?lifecycle=applied">Applicants</Link>
      <Link className={`rounded-full border px-3 py-2 ${query.status==="active"?"bg-stone-950 text-white":""}`} href={paramsWith({status:query.status==="active"?undefined:"active"})}>Active</Link>
      <Link className={`rounded-full border px-3 py-2 ${query.status==="former"?"bg-stone-950 text-white":""}`} href={paramsWith({status:query.status==="former"?undefined:"former"})}>Former</Link>
      <form className="flex items-center gap-2"><input type="hidden" name="lifecycle" value={query.lifecycle??""}/><input type="hidden" name="status" value={query.status??""}/><select name="program" defaultValue={query.program??""} className="min-h-10 rounded-full border px-3 text-sm"><option value="">All programs</option>{filterOptions.programs.map(p=><option key={p.value} value={p.label}>{p.label}</option>)}</select><select name="cohort" defaultValue={query.cohort??""} className="min-h-10 rounded-full border px-3 text-sm"><option value="">All cohorts</option>{filterOptions.cohorts.map(c=><option key={c} value={c}>{c}</option>)}</select><button className="rounded-full border px-3 py-2 text-sm font-semibold">Filter</button></form>
    </nav>
    {reviewsDue.length>0?<AdminSectionCard><h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">Reviews due</h2><ul className="mt-3 grid gap-2 text-sm">{reviewsDue.map(r=><li key={r.programId}><Link className="underline" href={`/admin/customers/programs/${r.programId}?tab=day90-review`}>{r.customerName}</Link> — due {new Date(r.targetEndAt).toLocaleDateString()}</li>)}</ul></AdminSectionCard>:null}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><AdminStatCard label="Total Customers" value={customers.length} detail="Canonical owner profiles" /><AdminStatCard label="Active Customers" value={customers.length} detail="No separate lifecycle is currently defined" /><AdminStatCard label="Pending Invites" value="Unavailable" /><AdminStatCard label="Suspended" value="Unavailable" /><AdminStatCard label="Deactivated" value="Unavailable" /></section>
    <AdminSectionCard><div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-sm"><caption className="sr-only">Customers and program relationships</caption><thead className="border-b text-xs text-stone-500"><tr><th className="pb-3">Customer</th><th className="pb-3">Lifecycle</th><th className="pb-3">Program</th><th className="pb-3">Cohort</th><th className="pb-3">Properties</th><th className="pb-3">Next action</th></tr></thead><tbody>{customers.map(customer => <tr key={customer.id} className="border-b border-stone-100"><td className="py-4"><p className="font-semibold text-stone-950">{customer.name}</p><p className="text-xs text-stone-500">{customer.email??"Unavailable"}</p></td><td className="py-4 capitalize">{customer.lifecycleStage}</td><td className="py-4">{customer.programId?<Link className="font-semibold underline" href={`/admin/customers/programs/${customer.programId}`}>{customer.program}</Link>:"—"}</td><td className="py-4">{customer.cohort??"—"}</td><td className="py-4">{customer.propertyCount}</td><td className="py-4 text-stone-600">{customer.nextAction??"—"}</td></tr>)}</tbody></table>{customers.length === 0 ? <p role="status" className="py-12 text-center text-sm text-stone-500">No customers match this filter.</p> : null}</div></AdminSectionCard>
  </div>;
}
