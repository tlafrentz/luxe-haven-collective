import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-section-card";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { getWorkspaceCounts } from "@/features/admin/application/operations-overview";

const value = (count: number | null) => count === null ? "Unavailable" : count.toLocaleString();

export default async function AdminWorkspacePage() {
  const counts = await getWorkspaceCounts();
  return <div className="space-y-8 py-8">
    <AdminPageHeader title="Workspace" description="Overview of platform activity and operational health." />
    <section aria-label="Workspace summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <AdminStatCard label="Total Customers" value={value(counts.customers)} detail="Owner profiles; current scope" />
      <AdminStatCard label="Total Properties" value={value(counts.properties)} detail="All canonical property records" />
      <AdminStatCard label="Active Bookings" value={value(counts.activeBookings)} detail="Confirmed booking lifecycle state" />
      <AdminStatCard label="Support Inquiries" value={value(counts.supportInquiries)} detail="New or reviewed contact inquiries" />
      <AdminStatCard label="Sync Health" value="Unavailable" detail="No canonical aggregate health policy" />
    </section>
    <div className="grid gap-5 xl:grid-cols-3">
      <AdminSectionCard title="Platform activity" description="Canonical operational records in the current scope.">
        <dl className="space-y-4 text-sm"><Row label="Customers" value={value(counts.customers)} /><Row label="Properties" value={value(counts.properties)} /><Row label="Confirmed bookings" value={value(counts.activeBookings)} /></dl>
        <Link className="mt-6 inline-flex text-sm font-semibold text-stone-950 underline-offset-4 hover:underline" href="/admin/audit">View all activity →</Link>
      </AdminSectionCard>
      <AdminSectionCard title="Operational health" description="Health values require defensible telemetry."><p className="text-sm text-stone-600">Integration success, uptime, data quality, and incidents are unavailable until centralized policies and telemetry are configured.</p></AdminSectionCard>
      <AdminSectionCard title="Recent alerts" description="Canonical failures and policy alerts only."><p role="status" className="text-sm text-stone-600">No canonical operational alert stream is configured.</p></AdminSectionCard>
    </div>
  </div>;
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 border-b border-stone-100 pb-3"><dt className="text-stone-600">{label}</dt><dd className="font-semibold text-stone-950">{value}</dd></div>; }
