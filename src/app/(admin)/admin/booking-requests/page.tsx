import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyRow, Metric, StatusPill } from "@/components/admin/operations-ui";
import { listBookingRequests } from "@/features/booking-requests/application";

const fmtDate = (v: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(v));
const fmtMoney = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);

function countOverdue(rows: readonly { status: string; slaDueAt: string | null }[]): number {
  const now = Date.now();
  return rows.filter((r) => r.slaDueAt && new Date(r.slaDueAt).getTime() < now && ["submitted", "under_review"].includes(r.status)).length;
}

export default async function BookingRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const rows = await listBookingRequests(status ? { status } : {});
  const needsReview = rows.filter((r) => r.status === "submitted" || r.status === "under_review").length;
  const awaitingPayment = rows.filter((r) => r.status === "awaiting_payment").length;
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const overdue = countOverdue(rows);

  return (
    <div className="space-y-8 py-8">
      <AdminPageHeader
        title="Stay Requests"
        description="Mesa direct-booking request pipeline. No control here can force a request to confirmed — a verified Stripe payment is the sole confirmation authority."
      />
      <section className="grid gap-3 sm:grid-cols-4" aria-label="Pipeline summary">
        <Metric label="Needs review" value={needsReview} />
        <Metric label="Awaiting payment" value={awaitingPayment} />
        <Metric label="Confirmed" value={confirmed} />
        <Metric label="Overdue review" value={overdue} detail={overdue > 0 ? "Past the review SLA" : undefined} />
      </section>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              {["Property", "Dates", "Guests", "Quote", "SLA", "Status", ""].map((label) => (
                <th className="px-4 py-3" key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">{row.propertyName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{fmtDate(row.arrival)} – {fmtDate(row.departure)}</td>
                  <td className="px-4 py-3">{row.guestCount}</td>
                  <td className="px-4 py-3">{row.totalMinor !== null && row.currency ? fmtMoney(row.totalMinor, row.currency) : "—"}</td>
                  <td className="px-4 py-3">{row.slaDueAt ? fmtDate(row.slaDueAt) : "—"}</td>
                  <td className="px-4 py-3"><StatusPill value={row.status} /></td>
                  <td className="px-4 py-3">
                    <Link className="font-semibold underline" href={`/admin/booking-requests/${row.id}`}>Review</Link>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow columns={7} label="No stay requests yet." />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
