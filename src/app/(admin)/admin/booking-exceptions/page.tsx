import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyRow, Metric, StatusPill } from "@/components/admin/operations-ui";
import { listBookingExceptions } from "@/features/admin-operations";

const fmt = (v: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

export default async function BookingExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const rows = await listBookingExceptions(status ? { status } : {});
  const open = rows.filter((r) => r.status === "open").length;
  const reviewing = rows.filter((r) => r.status === "reviewing").length;
  const resolved = rows.filter((r) => r.status === "resolved").length;

  return (
    <div className="space-y-8 py-8">
      <AdminPageHeader
        title="Booking Exceptions"
        description="Reservation events that could not be safely reconciled — LHS-001 Mesa direct booking. No control here can force a reservation to confirmed; resolution happens in Hospitable."
      />
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Exception summary">
        <Metric label="Open" value={open} />
        <Metric label="Reviewing" value={reviewing} />
        <Metric label="Resolved" value={resolved} />
      </section>
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              {["Detected", "Issue", "Property", "Reservation", "Status", "Next action"].map((label) => (
                <th className="px-4 py-3" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3">{fmt(row.detectedAt)}</td>
                  <td className="px-4 py-3">{row.issueType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{row.propertyName ?? "Unmapped"}</td>
                  <td className="px-4 py-3">{row.reservationExternalId ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusPill value={row.status} />
                  </td>
                  <td className="max-w-xs px-4 py-3 text-stone-600">{row.nextAction ?? "Review in Hospitable"}</td>
                </tr>
              ))
            ) : (
              <EmptyRow columns={6} label="No booking exceptions recorded." />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
