"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { acceptAlternateProposal, getBookingRequestStatus, withdrawBookingRequest, type BookingRequestStatusView } from "@/app/actions/booking-requests";
import { track } from "@/lib/analytics/track";

const POLL_INTERVAL_MS = 4_000;
const MAX_POLLS = 15;
const TRANSIENT_STATUSES = new Set(["draft", "submitted", "under_review", "alternate_proposed", "approved", "awaiting_payment"]);

function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  submitted: { title: "We received your request", body: "We're checking the calendar and will follow up within the stated response window." },
  under_review: { title: "Your request is under review", body: "An operator is checking availability across our calendar workflow." },
  approved: { title: "Availability confirmed", body: "We're finalizing your hold — this usually takes just a moment." },
  payment_failed: { title: "Payment didn't go through", body: "Your dates have not been confirmed. If your hold is still active, you can try again." },
  declined: { title: "We can't fulfill this request", body: "Contact us if you'd like to discuss alternate dates or properties." },
  withdrawn: { title: "Request withdrawn", body: "You withdrew this request. Submit a new one anytime." },
  expired: { title: "This request has expired", body: "The response, quote, or payment window elapsed. Please submit a new request." },
};

export function RequestStatusView({ requestToken }: { requestToken: string }) {
  const [result, setResult] = useState<BookingRequestStatusView | null>(() =>
    requestToken ? null : { state: "not_found" },
  );
  const pollCountRef = useRef(0);
  const trackedConfirmedRef = useRef(false);

  useEffect(() => {
    if (!requestToken) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const outcome = await getBookingRequestStatus(requestToken);
      if (cancelled) return;
      setResult(outcome);

      if (outcome.state === "confirmed" && !trackedConfirmedRef.current) {
        trackedConfirmedRef.current = true;
        track("payment_verified", { requestToken });
        track("booking_confirmed", { confirmationCode: outcome.confirmationCode });
      }

      const stillTransient = outcome.state === "active" && TRANSIENT_STATUSES.has(outcome.status);
      if (stillTransient && pollCountRef.current < MAX_POLLS) {
        pollCountRef.current += 1;
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [requestToken]);

  if (!result) {
    return (
      <main className="bg-[#fffdf9] py-20">
        <div className="container-shell max-w-lg text-center" role="status" aria-live="polite">
          <Spinner />
          <p className="mt-6 text-sm text-stone-600">Checking your request…</p>
        </div>
      </main>
    );
  }

  if (result.state === "not_found") {
    return (
      <StatusShell title="We couldn't find that request" body="This link may have expired or been used already. If you believe you submitted a request, contact us." >
        <SupportLink />
      </StatusShell>
    );
  }

  if (result.state === "confirmed") {
    return (
      <main className="bg-[#fffdf9] py-20">
        <div className="container-shell max-w-lg text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-800">✓</div>
          <h1 className="mt-6 font-serif text-3xl">Your stay is confirmed</h1>
          <div className="mt-6 rounded-xl border bg-white p-6 text-left text-sm">
            {result.confirmationCode ? (
              <p>
                <span className="text-stone-500">Confirmation </span>
                <span className="font-semibold">{result.confirmationCode}</span>
              </p>
            ) : null}
            <p className="mt-2"><span className="text-stone-500">Property </span>{result.propertyName}</p>
            <p className="mt-2"><span className="text-stone-500">Check-in </span>{result.checkIn}</p>
            <p className="mt-1"><span className="text-stone-500">Check-out </span>{result.checkOut}</p>
            <p className="mt-1"><span className="text-stone-500">Guests </span>{result.guests}</p>
            {result.amountPaidMinor !== null && result.currency ? (
              <p className="mt-1"><span className="text-stone-500">Paid </span>{formatMoney(result.amountPaidMinor, result.currency)}</p>
            ) : null}
          </div>
          <p className="mt-6 text-sm text-stone-600">
            The rental agreement record, support details, and pre-arrival instructions will follow by
            email.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <SupportLink />
            <Link href="/terms#cancellation" className="rounded-full border px-6 py-3 text-sm font-semibold">
              View cancellation policy
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // state === "active"
  if (result.status === "awaiting_payment") {
    return (
      <StatusShell title="Ready for secure payment" body={`We've verified availability for ${result.propertyName}. Complete payment to confirm your stay.`}>
        <Link
          href={`/stays/${result.propertySlug}/checkout?request=${requestToken}`}
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Continue to payment
        </Link>
      </StatusShell>
    );
  }

  if (result.status === "alternate_proposed") {
    return (
      <StatusShell
        title="We're proposing different dates"
        body={`For ${result.propertyName}, we can offer ${result.arrival} to ${result.departure}${result.totalMinor !== null && result.currency ? ` for an estimated ${formatMoney(result.totalMinor, result.currency)}` : ""}. This offer requires your acceptance before we continue reviewing.`}
      >
        <AlternateActions requestToken={requestToken} />
      </StatusShell>
    );
  }

  if (result.status === "submitted" || result.status === "under_review" || result.status === "approved" || result.status === "draft") {
    const copy = STATUS_COPY[result.status] ?? { title: "Checking your request", body: "" };
    return (
      <main className="bg-[#fffdf9] py-20">
        <div className="container-shell max-w-lg text-center" role="status" aria-live="polite">
          <Spinner />
          <h1 className="mt-6 font-serif text-3xl">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">{copy.body}</p>
          {result.status === "submitted" || result.status === "under_review" ? (
            <button
              type="button"
              onClick={() => void withdrawBookingRequest(requestToken).then(() => window.location.reload())}
              className="mt-6 text-xs underline text-stone-500"
            >
              Withdraw this request
            </button>
          ) : null}
        </div>
      </main>
    );
  }

  const copy = STATUS_COPY[result.status] ?? { title: "Request status", body: "" };
  return (
    <StatusShell title={copy.title} body={copy.body}>
      {result.status === "payment_failed" ? (
        <Link href={`/stays/${result.propertySlug}/checkout?request=${requestToken}`} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
          Try payment again
        </Link>
      ) : null}
      <SupportLink />
    </StatusShell>
  );
}

function AlternateActions({ requestToken }: { requestToken: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await acceptAlternateProposal(requestToken);
          window.location.reload();
        }}
        className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        Accept these dates
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await withdrawBookingRequest(requestToken);
          window.location.reload();
        }}
        className="rounded-full border px-6 py-3 text-sm font-semibold disabled:opacity-50"
      >
        Withdraw request
      </button>
    </div>
  );
}

function StatusShell({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="bg-[#fffdf9] py-20">
      <div className="container-shell max-w-lg text-center">
        <h1 className="font-serif text-3xl">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">{body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>
      </div>
    </main>
  );
}

function SupportLink() {
  return (
    <Link href="/contact?service=stay" className="rounded-full border px-6 py-3 text-sm font-semibold">
      Contact support
    </Link>
  );
}

function Spinner() {
  return <div aria-hidden="true" className="mx-auto size-14 animate-spin rounded-full border-4 border-[#dfe9e2] border-t-[#102825]" />;
}
