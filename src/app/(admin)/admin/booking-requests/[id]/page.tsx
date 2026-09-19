import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusPill } from "@/components/admin/operations-ui";
import { getBookingRequestDetail } from "@/features/booking-requests/application";
import { RefundPanel } from "./refund-panel";
import { RequestReviewPanel } from "./request-review-panel";

const fmt = (v: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
const fmtMoney = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);

export default async function BookingRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getBookingRequestDetail(id);
  if (!detail) notFound();

  const activeQuote = detail.quotes.find((quote) => quote.status === "accepted");
  const activeBlock = detail.blocks.find((block) => block.status === "active");

  return (
    <div className="space-y-8 py-8">
      <AdminPageHeader title={`${detail.propertyName} — ${detail.arrival} to ${detail.departure}`} description={`Request ${detail.id}`} />
      <div className="flex gap-2">
        <StatusPill value={detail.status} />
      </div>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">Guest contact</h2>
          {detail.guest ? (
            <dl className="mt-3 space-y-1 text-sm text-stone-700">
              <div><dt className="inline text-stone-500">Name: </dt><dd className="inline">{detail.guest.fullName}</dd></div>
              <div><dt className="inline text-stone-500">Email: </dt><dd className="inline">{detail.guest.email}</dd></div>
              {detail.guest.phone ? <div><dt className="inline text-stone-500">Phone: </dt><dd className="inline">{detail.guest.phone}</dd></div> : null}
              {detail.guest.visitPurpose ? <div><dt className="inline text-stone-500">Purpose: </dt><dd className="inline">{detail.guest.visitPurpose}</dd></div> : null}
              {detail.guest.accessibilityNeeds ? <div><dt className="inline text-stone-500">Accessibility: </dt><dd className="inline">{detail.guest.accessibilityNeeds}</dd></div> : null}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No contact details recorded.</p>
          )}
          <dl className="mt-4 space-y-1 border-t pt-3 text-sm text-stone-700">
            <div><dt className="inline text-stone-500">Guests: </dt><dd className="inline">{detail.adults ?? 0} adults, {detail.children} children, {detail.pets} pets</dd></div>
            <div><dt className="inline text-stone-500">Submitted: </dt><dd className="inline">{fmt(detail.createdAt)}</dd></div>
            {detail.slaDueAt ? <div><dt className="inline text-stone-500">Review due: </dt><dd className="inline">{fmt(detail.slaDueAt)}</dd></div> : null}
          </dl>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">Current quote</h2>
          {activeQuote ? (
            <p className="mt-3 text-2xl font-semibold">{fmtMoney(activeQuote.totalMinor, activeQuote.currency)}</p>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No accepted quote.</p>
          )}
          <h3 className="mt-5 font-semibold">Calendar block</h3>
          {activeBlock ? (
            <dl className="mt-2 space-y-1 text-sm text-stone-700">
              <div><dt className="inline text-stone-500">System: </dt><dd className="inline">{activeBlock.calendarSystem}</dd></div>
              {activeBlock.externalReference ? <div><dt className="inline text-stone-500">Reference: </dt><dd className="inline">{activeBlock.externalReference}</dd></div> : null}
              <div><dt className="inline text-stone-500">Expires: </dt><dd className="inline">{fmt(activeBlock.expiresAt)}</dd></div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-stone-500">No active block recorded.</p>
          )}
          {detail.invitations.length ? (
            <>
              <h3 className="mt-5 font-semibold">Payment invitations</h3>
              <ul className="mt-2 space-y-1 text-sm text-stone-700">
                {detail.invitations.map((invitation) => (
                  <li key={invitation.id}>
                    {fmtMoney(invitation.amountMinor, invitation.currency)} · <StatusPill value={invitation.status} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </section>

      <RequestReviewPanel requestId={detail.id} status={detail.status} arrival={detail.arrival} departure={detail.departure} activeQuoteId={activeQuote?.id ?? null} activeBlockId={activeBlock?.id ?? null} />

      {detail.booking ? <RefundPanel booking={detail.booking} /> : null}

      {detail.reviews.length ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">Review history</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone-700">
            {detail.reviews.map((review) => (
              <li key={review.id} className="border-b border-stone-100 pb-2 last:border-0">
                <StatusPill value={review.decision} /> <span className="text-stone-500">{fmt(review.decidedAt)}</span>
                {review.notes ? <p className="mt-1 text-stone-600">{review.notes}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
