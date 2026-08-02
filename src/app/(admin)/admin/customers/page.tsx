import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { getAdminCustomers } from "@/features/admin/application/operations-overview";

const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "Unavailable";
export default async function CustomersPage() {
  const customers = await getAdminCustomers();
  return <div className="space-y-8 py-8">
    <AdminPageHeader title="Customers" description="Manage customer organizations represented by canonical owner profiles." />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><AdminStatCard label="Total Customers" value={customers.length} detail="Canonical owner profiles" /><AdminStatCard label="Active Customers" value={customers.length} detail="No separate lifecycle is currently defined" /><AdminStatCard label="Pending Invites" value="Unavailable" /><AdminStatCard label="Suspended" value="Unavailable" /><AdminStatCard label="Deactivated" value="Unavailable" /></section>
    <AdminSectionCard><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><caption className="sr-only">Customers and their property relationships</caption><thead className="border-b text-xs text-stone-500"><tr><th className="pb-3">Customer</th><th className="pb-3">Email</th><th className="pb-3">Properties</th><th className="pb-3">Joined</th><th className="pb-3">Status</th><th className="pb-3">Last Active</th></tr></thead><tbody>{customers.map(customer => <tr key={customer.id} className="border-b border-stone-100"><td className="py-4 font-semibold text-stone-950">{customer.name}</td><td className="py-4 text-stone-600">{customer.email ?? "Unavailable"}</td><td className="py-4">{customer.propertyCount}</td><td className="py-4"><time dateTime={customer.joinedAt ?? undefined}>{date(customer.joinedAt)}</time></td><td className="py-4"><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Active</span></td><td className="py-4 text-stone-500">Unavailable</td></tr>)}</tbody></table>{customers.length === 0 ? <p role="status" className="py-12 text-center text-sm text-stone-500">No customers have been created.</p> : null}</div></AdminSectionCard>
  </div>;
}
